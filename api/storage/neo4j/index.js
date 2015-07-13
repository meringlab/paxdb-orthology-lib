/**
 * Created by milans on 07/07/15.
 */
const when = require('when');
const bunyan = require('bunyan');
const fs = require('fs');
const glob = require("glob")
const orthgroups = require('../data.js').orthgroups

const log = bunyan.createLogger({name: "paxdb-API-orthologs", module: "storage/neo4j"});

exports = module.exports = {}

exports.count = count
exports.save_proteins = save_proteins
exports.save_orthgroups = save_orthgroups
exports.import_proteins = import_proteins
exports.import_orthgroups = import_orthgroups
exports.create_schema = create_schema

/**
 * just for unit testing
 * @type {{parseDataset: parseDataset, parseProteins: parseProteins, parseOrthgroups: parseOrthgroups}}
 * @private
 */
exports._internal = {
    parseDataset: parseDataset,
    parseProteins: parseProteins,
    parseOrthgroups: parseOrthgroups
}

const db = require("seraph")({
    server: "http://192.168.54.130:7474",
    user: "neo4j",
    pass: "t5y6u7i8"
});

function create_schema() {
    //can't use txn.index.create, lib doesn't allow data and schema manipulation in the same txn, so:
    var deferred = when.defer()
    db.index.createIfNone('Protein', 'iid', function (err, index) {
        if (err) {
            log.error(err, 'create_schema - failed to create iid index for Protein')
            deferred.reject('failed to create iid index for Protein: ' + err)
            return;
        }
        db.index.createIfNone('Protein', 'eid', function (err, index) {
            if (err) {
                log.error(err, 'create_schema - failed to create eid index for Protein')
                deferred.reject('failed to create eid index for Protein: ' + err)
                return
            }
            db.constraints.uniqueness.createIfNone('Protein', 'iid', function (err, constraint) {
                if (err) {
                    log.error(err, 'create_schema - failed to create UNIQUE constraint on iid for Protein')
                    deferred.reject('failed to create eid index for Protein: ' + err)
                    return
                }
                deferred.resolve()
            })

        });
    })
    return deferred.promise
}

function save_proteins(proteins, abundances) {
    log.info('saving %s proteins', proteins.length)

    var d = when.defer()
    if (proteins.length === 0) {
        log.info('no proteins to saving')
        d.resolve()
        return d.promise
    }
    var txn = db.batch();
    var numAbundances = 0;
    proteins.forEach(function (p) {
        var node = txn.save(p);
        txn.label(node, "Protein");
        if (abundances[p.eid] && abundances[p.eid].length > 0) {
            abundances[p.eid].forEach(function (el) {
                numAbundances++
                var abundance = txn.save({"value": el.value, "rank": el.rank});
                txn.label(abundance, "Abundance");
                txn.relate(node, el.tissue, abundance, {'tissue': el.tissue}/*, isDefaultAbundance : true|false*/);
            })
        }
    })
    log.info('about to commit %s proteins and %s abundances', proteins.length, numAbundances)
    txn.commit(function (err, results) {
        if (err) {
            log.error(err, 'saving_proteins - FAILED, %s nodes will remain saved', savedNodes.length)
            var e = Error("TRANSACTION FAILED: " + err.message);
            e.results = results;
            d.reject(e);
            return
        }
        d.resolve();
    })
    return d.promise
}

function count(label, callback) {
    var d = when.defer()

    var cypher = "MATCH (n:" + label + ") RETURN count(*)"
    db.queryRaw(cypher, function (err, result) {
        if (err) {
            log.error(err, 'neo4j - failed to count %s', label)
            throw new Error(err.message);
        }
        d.resolve(result.data[0][0])
    });
    return d.promise
}

function parseProteins(contents) {
    var proteins = []
    contents.split('\n').forEach(function (line) {
        if (line.trim() == 0) {
            return
        }
        var rec = line.split('\t');
        proteins.push({"iid": parseInt(rec[0]), "eid": rec[1], "name": rec[2]})
    })
    return proteins
}


function parseDataset(contents) {
    var dataset = {"abundances": []}
    var records = contents.split('\n');
    for (var i = 0; i < records.length && records[i].indexOf('#') == 0; i++) {
        if (records[i].indexOf('organ:') != -1) {
            dataset.organ = records[i].match(/organ\:\s+([A-Z_]+)/)[1]
        }
    }
    for (/*i from previous loop*/; i < records.length; i++) {
        var r = records[i].trim().split('\t');
        if (r.length < 2) {
            continue
        }
        dataset.abundances.push({iid: parseInt(r[0]), eid: r[1], value: parseFloat(r[2])})
    }
    dataset.numAbundances = dataset.abundances.length
    return dataset
}

function loadAbundances(speciesId, abundances_dir) {
    var abundances = {}
    var abundanceFiles = glob.sync(abundances_dir + '/' + speciesId + '-*.txt')
    log.debug('abundance files found: %s', abundanceFiles)
    abundanceFiles.forEach(function (datasetFile) {
        log.info('reading %s abundances from %s', speciesId, datasetFile)
        var counter = 0
        var dataset = parseDataset(fs.readFileSync(datasetFile, {'encoding': 'utf8'}));

        //TODO refactor to appendAbundances(abundances, dataset.abundances)
        var outOf = '/' + String(dataset.numAbundances);
        for (var i = 0; i < dataset.abundances.length; i++) {
            var p = dataset.abundances[i];
            if (!abundances.hasOwnProperty(p.eid)) {
                abundances[p.eid] = []
            }
            counter++
            abundances[p.eid].push({"tissue": dataset.organ, value: p.value, rank: String(i + 1) + outOf})
        }
        log.info('%s abundances read from %s', counter, datasetFile)
    })
    return abundances;
}

function import_proteins_from_file(file, abundances_dir) {
    log.info("proteins from %s", file);
    var speciesId = /\/?(\d+)\-proteins.txt/.exec(file)[1]
    log.info('species: %s', speciesId)
    var proteins = parseProteins(fs.readFileSync(file, {'encoding': 'utf8'}));
    log.debug('%s protein records from %s', proteins.length, file)
    var abundances = loadAbundances(speciesId, abundances_dir);

    //chain promises in sequential order:
    var link = function (prevPromise, currentSlice) {
        return prevPromise.then(function () {
            return save_proteins(currentSlice, abundances)
        })
    };
    const chunk = 500, slices = []
    for (var i = 0, j = proteins.length; i < j; i += chunk) {
        slices.push(proteins.slice(i, i + chunk))
    }

    return slices.reduce(link, when('starting promise'))
}

function import_proteins(proteins_dir, abundances_dir) {
    log.info("importing proteins %s, %s", proteins_dir, abundances_dir)
    var files = glob.sync(proteins_dir + "/*-proteins.txt")

    //chain promises in sequential order:
    var link = function (prevPromise, currentFile) {
        return prevPromise.then(function () {
            log.info('calling import_proteins for %s', currentFile)
            return import_proteins_from_file(currentFile, abundances_dir);
            //return when('primise to import ' + currentFile)
        })
    };
    return files.reduce(link, when('starting promise'))
}
function parseOrthgroups(groupId, contents) {
    if (!(groupId in orthgroups)) {
        throw Error('orthgroup taxonomic level missing for ' + groupId)
    }
    var clade = orthgroups[groupId].toUpperCase();
    var groups = []
    contents.split('\n').forEach(function (line) {
        if (line.trim() == 0) {
            return
        }
        var rec = line.split('\t');
        //{"id": 9443, "name": "NOG21051", "clade": "PRIMATES", "members": [1803841, 1854701]},
        var members = rec.slice(1, rec.length).map(function (el) {
            return parseInt(el)
        });
        //to make names globaly unique, prepend groupId:
        groups.push({
            "id": groupId,
            "name": groupId + '.' + rec[0],
            "clade": clade,
            "members": members
        })
    })
    return groups
}

function save_orthgroups(groups, proteinIds) {
    log.info('saving %s orthgroups', groups.length)

    var d = when.defer()
    if (groups.length === 0) {
        log.info('no groups to import')
        d.resolve()
        return d.promise
    }

    var deferredImport = when.defer()
    var txn = db.batch();

    function saveGroup(g) {
        log.trace('saving group %s in %s', g.name, g.clade)
        var saved = when.defer()

        //{"id" :9443, "name": "NOG21051","clade": "PRIMATES", "members": [1803841, 1854701]},
        var node = txn.save({"levelId": g.id /*, "level": g.clade*/, "name": g.name});
        txn.label(node, "NOG");
        if (!proteinIds) {
            var query = "MATCH (p:Protein) WHERE p.iid IN [" + g.members + "] RETURN p.iid, id(p) ";
            db.query(query, function (err, results) {
                if (err) {
                    log.error(err, 'saveGroup(%s) - failed to find proteins %s, query: %s', g.name, g.members, query)
                    saved.reject(Error(g.name + ' - failed to find proteins ' + g.members + ': ' + err.message));
                    return
                }
                //if (g.members.length !== results.length) {
                //    var proteinRecords = new Set(results.map(function (el) {
                //        return el['p.iid']
                //    }))
                //    var diff = g.members.filter(function (x) {
                //        return !proteinRecords.has(x)
                //    })
                //    if (diff.length > 0) {
                //        log.error('saveGroup(%s) - failed to find all members for %s, missing: [%s]', g.name, diff)
                //        saved.reject(Error(g.name + ' - failed to find proteins ' + diff));
                //        return
                //    }
                //    if (proteinRecords.length < Object.keys(results).length) {
                //        log.warn('saveGroup(%s) - NON UNIQUE PROTEIN RECORDS, group: %s, records: %s', g.name, JSON.stringify(results))
                //        //    saved.reject(Error(g.name + ' - NON UNIQUE PROTEIN RECORDS' + g.members));
                //        //    return
                //    }
                //}

                results.forEach(function (r) {
                    txn.relate({"id": r['id(p)']}, g.clade, node, {'levelId': g.id});
                })

                saved.resolve()
            });
        } else {
            g.members.forEach(function (el) {
                if (el in proteinIds) {
                    txn.relate({"id": proteinIds[el]}, g.clade, node, {'level': g.clade});
                }
            })
            saved.resolve()
        }
        return saved.promise;
    }

    var taskPromises = groups.map(function (g) {
        return saveGroup(g)
    });
    when.all(taskPromises).then(function (not_used) {
        log.trace('committing transaction')
        txn.commit(function (err) {
            if (err) {
                log.error(err, 'save_orthgroups - TRANSACTION FAILED')
                var e = Error("TRANSACTION FAILED: " + err.message);
                deferredImport.reject(e);
                return
            }

            deferredImport.resolve();
            log.trace('transaction completed')
        })
    }, function (err) {
        log.error(err, 'save_orthgroups - failed to save one of the groups')
        var e = Error("failed to save one of the groups: " + err.message);
        deferredImport.reject(e);
    })

    return deferredImport.promise
}

function import_import_orthgroups_from_file(file, proteinIds) {
    log.info("orthgroups from %s", file);
    var groupId = parseInt(/\/?(\d+)\-orthologs.txt/.exec(file)[1])
    log.info('groupId: %s', groupId)
    var groups = parseOrthgroups(groupId, fs.readFileSync(file, {'encoding': 'utf8'}));
    log.debug('%s orthgroup records from %s', groups.length, file)

    //chain promises in sequential order:
    var link = function (prevPromise, currentSlice) {
        return prevPromise.then(function () {
            return save_orthgroups(currentSlice, proteinIds)
        })
    };
    const chunk = 500, slices = []
    for (var i = 0, j = groups.length; i < j; i += chunk) {
        slices.push(groups.slice(i, i + chunk))
    }

    return slices.reduce(link, when('starting promise'))
}

function import_orthgroups(orthgroups_dir) {
    log.info("importing orthgroups from %s", orthgroups_dir)
    log.debug("loading protein ids")
    //quering for each group members throws errors ECONNRESET so need to load them upfront:
    db.query("MATCH (p:Protein) RETURN p.iid, id(p)", function (err, results) {
        if (err) {
            throw Error('failed to load protein ids ' + JSON.stringify(err))
        }
        proteinIds = {}
        var num = 0
        results.forEach(function (r) {
            proteinIds[r['p.iid']] = r['id(p)']
            num++
        })
        log.debug("%s protein ids loaded", num)

        var files = glob.sync(orthgroups_dir + "/*-orthologs.txt")
        //chain promises in sequential order:
        var link = function (prevPromise, currentFile) {
            return prevPromise.then(function () {
                log.info('calling import_orthgroups for %s', currentFile)
                return import_import_orthgroups_from_file(currentFile, proteinIds);
            })
        };
        files.reduce(link, when('starting promise')).then(function () {
            log.info('orthgroups import complete')
        }, function (err) {
            log.error(err, 'failed to import orthgroups')
        })
    })
}

function import_data() {
    log.level('debug')
    create_schema().then(function () {
        log.info("schema created")
        import_proteins('../../data/v4.0/proteins',
            '../../data/v4.0/abundances').then(function () {
                log.info('proteins import complete')
                import_orthgroups('../../data/v4.0/orthgroups').then(function () {
                    log.info('orthgroups import complete')
                }, function (err) {
                    log.error(err, 'failed to import orthgroups')
                })
            }, function (err) {
                log.error(err, 'failed to import proteins')
            })
    }, function (err) {
        log.error(err, "failed to create schema!")
    })

}

function findTaxonomicLevels(proteinId) {
    var id = typeof(proteinId) === 'number' ? 'iid: ' + proteinId : 'eid: ' + proteinId

    var query = 'MATCH (p:Protein {' + id + '})-[l]->(n:NOG)<-[ll]-(m:Protein)-[t]->(Abundance) return distinct l.level, collect(distinct t.tissue)'

}

function loadOrthologs(proteinId, taxonomicLevel, tissue) {
    taxonomicLevel = taxonomicLevel || 'LUCA'
    tissue = tissue || 'WHOLE_ORGANISM'
    var d = when.defer()
    var id = typeof(proteinId) === 'number' ? 'iid: ' + proteinId : 'eid: ' + proteinId
    var query = "MATCH (p:Protein {" + id + "})-[:" + taxonomicLevel + "]" +
        "->(n:" + taxonomicLevel + ")<-[:LUCA]-(m:Protein)-[:" +
        tissue + "]->(a:Abundance) return m,a";
    db.query(query, function (err, results) {
        if (err) {
            log.error(err, 'loadOrthologs(%s,%s,%s) FAILED', proteinId, taxonomicLevel, tissue)
            var e = Error("loadOrthologs FAILED: " + err.message);
            deferredImport.reject(e);
            return
        }
        var response = {
            "eid": proteinId,
            "tissues": ["WHOLE_ORGANISM", "BRAIN"],
            "members": []
        }
        return response
    })
    return d.promise
}


//DEMO:
//findOrthologs(633631, 'EUKARYOTES','WHOLE_ORGANISM')
//
