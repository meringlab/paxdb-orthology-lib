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
    server: "http://192.168.1.137:7474",
    user: "neo4j",
    pass: "t5y6u7i8"
});

function save_proteins(proteins, abundances) {
    log.info('importing %s proteins and %s abundances', proteins.length, Object.keys(abundances).length)

    var d = when.defer()
    if (proteins.length === 0) {
        log.info('no proteins to import')
        d.resolve()
        return d.promise
    }
    const chunk = 1000
    var i, j, proteinBatch
    var savedNodes = []
    for (i = 0, j = proteins.length; i < j; i += chunk) {
        log.debug("saving chunk [%s-%s]", i, i + chunk)
        proteinBatch = proteins.slice(i, i + chunk);
        var txn = db.batch();
        var nodesBatch = []
        proteinBatch.forEach(function (p) {
            var node = txn.save(p);
            nodesBatch.push(node)
            txn.label(node, "Protein");
            if (abundances[p.eid] && abundances[p.eid].length > 0) {
                abundances[p.eid].forEach(function (el) {
                    var abundance = txn.save({"value": el.value, "rank": el.rank});
                    txn.label(abundance, "Abundance");
                    txn.relate(node, el.tissue, abundance /*, isDefault : true|false*/);
                })
            }
        })
        txn.commit(function (err, results) {
            if (err) {
                log.error(err, 'import_proteins - FAILED, %s nodes will remain saved', savedNodes.length)
                var e = Error("TRANSACTION FAILED: " + err.message);
                e.results = results;
                d.reject(e);
                //TODO remove savedNodes
                return
            }
            savedNodes.concat(nodesBatch)
            //can't use txn.index.create, lib doesn't allow data and schema manipulation in the same txn, so:
            var indicesDeferred = when.defer()
            db.index.createIfNone('Protein', 'iid', function (err, index) {
                if (err) {
                    log.error(err, 'import_proteins - failed to create iid index for Protein')
                    indicesDeferred.reject('failed to create iid index for Protein: ' + err)
                    return;
                }
                db.index.createIfNone('Protein', 'eid', function (err, index) {
                    if (err) {
                        log.error(err, 'import_proteins - failed to create eid index for Protein')
                        indicesDeferred.reject('failed to create eid index for Protein: ' + err)
                    }
                    indicesDeferred.resolve()
                });
            })

            d.resolve(indicesDeferred.promise);
        })
    }


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
        var dataset = parseDataset(fs.readFileSync(datasetFile, {'encoding': 'utf8'}));

        //TODO refactor to appendAbundances(abundances, dataset.abundances)
        var outOf = '/' + String(dataset.numAbundances);
        for (var i = 0; i < dataset.abundances.length; i++) {
            var p = dataset.abundances[i];
            if (!abundances.hasOwnProperty(p.eid)) {
                abundances[p.eid] = []
            }
            abundances[p.eid].push({"tissue": dataset.organ, value: p.value, rank: String(i + 1) + outOf})
        }
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

    return save_proteins(proteins, abundances)
}
function import_proteins(proteins_dir, abundances_dir) {
    log.info("importing proteins %s, %s", proteins_dir, abundances_dir)
    glob(proteins_dir + "/*-proteins.txt", function (err, files) {
        //chain promises in sequential order:
        var link = function (prevPromise, currentFile) {
            return prevPromise.then(function () {
                log.info('calling import_proteins for %s', currentFile)
                return import_proteins_from_file(currentFile, abundances_dir);
                //return when('primise to import ' + currentFile)
            })
        };
        files.reduce(link, when('starting promise')).then(function (res) {
            log.info('proteins import complete')
        }, function (err) {
            log.error(err, 'failed to import')
        })
    })
}
function parseOrthgroups(groupId, contents) {
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
        groups.push({
            "id": groupId,
            "name": rec[0],
            "clade": orthgroups[String(groupId)].toUpperCase(),
            "members": members
        })
    })
    return groups
}

function save_orthgroups(groups) {
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
        var node = txn.save({"levelId": g.id /*, "level": g.clade*/});
        txn.label(node, "NOG");

        var query = "MATCH (p:Protein) WHERE p.iid IN [" + g.members + "] RETURN p.iid, id(p) ";
        db.query(query, function (err, results) {
            if (err) {
                log.error(err, 'saveGroup(%s) - failed to find proteins %s,[%s], query: %s', g.name, g.members, query)
                saved.reject(Error(g.name + ' - failed to find proteins ' + g.members + ': ' + err.message));
                return
            }
            var proteinRecords = new Set(results.map(function (el) {
                return el['p.iid']
            }))
            var diff = g.members.filter(function (x) {
                return !proteinRecords.has(x)
            })
            if (diff.length > 0) {
                log.error('saveGroup(%s) - failed to find all members for %s, missing: [%s]', g.name, diff)
                saved.reject(Error(g.name + ' - failed to find proteins ' + diff));
                return
            }
            //if (proteinRecords.length < Object.keys(results).length) {
            //    log.error('saveGroup(%s) - NON UNIQUE PROTEIN RECORDS, group: %s, members: [%s], records:[%s]', g.name, g.members, proteinRecords)
            //    saved.reject(Error(g.name + ' - NON UNIQUE PROTEIN RECORDS' + g.members));
            //    return
            //}
            var byIid = {}
            results.forEach(function (r) {
                byIid[r['p.iid']] = {"id": r['id(p)']};
            })
            g.members.forEach(function (protein_iid) {
                txn.relate(byIid[protein_iid], g.clade, node);
            })
            saved.resolve()
        });
        return saved.promise;
    }

    var taskPromises = groups.map(function (g) {
        return saveGroup(g)
    });
    when.all(taskPromises).then(function (not_used) {
        log.trace('committing transaction')
        txn.commit(function (err, results) {
            if (err) {
                log.error(err, 'import_orthgroups - TRANSACTION FAILED')
                var e = Error("TRANSACTION FAILED: " + err.message);
                e.results = results;
                deferredImport.reject(e);
                return
            }

            deferredImport.resolve();
            log.trace('transaction completed')
        })
    }, function (err) {
        log.error(err, 'import_orthgroups - failed to save one of the groups')
        var e = Error("failed to save one of the groups: " + err.message);
        deferredImport.reject(e);
    })

    return deferredImport.promise
}

function import_import_orthgroups_from_file(file) {
    log.info("orthgroups from %s", file);
    var groupId = parseInt(/\/?(\d+)\-orthologs.txt/.exec(file)[1])
    log.info('groupId: %s', groupId)
    var groups = parseOrthgroups(groupId, fs.readFileSync(file, {'encoding': 'utf8'}));
    log.debug('%s orthgroup records from %s', groups.length, file)

    //chain promises in sequential order:
    var link = function (prevPromise, currentSlice) {
        return prevPromise.then(function () {
            return save_orthgroups(currentSlice)
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
    glob(orthgroups_dir + "/*-orthologs.txt", function (err, files) {
        //chain promises in sequential order:
        var link = function (prevPromise, currentFile) {
            return prevPromise.then(function () {
                log.info('calling import_orthgroups for %s', currentFile)
                return import_import_orthgroups_from_file(currentFile);
            })
        };
        files.reduce(link, when('starting promise')).then(function (res) {
            log.info('orthgroups import complete')
        }, function (err) {
            log.error(err, 'failed to import orthgroups')
        })
    })
}
//import_orthgroups('../../data/v4.0/orthgroups')