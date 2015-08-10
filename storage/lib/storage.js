/**
 * Created by milans on 07/07/15.
 */
const when = require('when');
const bunyan = require('bunyan');
const glob = require("glob")

function Storage(_db) {
    var db = _db
    const log = bunyan.createLogger({
        name: "paxdb-API-orthologs",
        module: "storage/neo4j",
        server: db.options.server
    });
    function findTaxonomicLevels(proteinId) {
        var id = proteinIdAsQueryParameter(proteinId)
        var query = 'MATCH (p:Protein {' + id + '})-[l]->(n:NOG)<-[ll]-(m:Protein)-[t]->(Abundance) return distinct l.level, collect(distinct t.tissue)'
    }

    this.findOrthologsAtTaxonomicLevel = function (proteinId, taxonomicLevel) {
        var d = when.defer()
        var id = proteinIdAsQueryParameter(proteinId)
        //var query = 'MATCH (:Protein {' + id + '})-[level]->(n:NOG) WITH n MATCH n<-[level]-(:Protein)-[tissue]-(:Abundance) return  distinct level.level,  tissue.tissue';
        var query = 'MATCH (:Protein {' + id + '})-[:' + taxonomicLevel + ']->(n:NOG)\n' +
            ' WITH n MATCH n<-[:' + taxonomicLevel + ']-(m:Protein) \n' +
            ' RETURN m.eid';
        db.query(query, function (err, results) {
            if (err) {
                log.error(err, 'findOrthologsAtTaxonomicLevel(%s,%s) FAILED, query:[%s]', proteinId, taxonomicLevel, query)
                var e = Error("findOrthologsAtTaxonomicLevel FAILED: " + err.message);
                deferredImport.reject(e);
                return
            }
            var response = {
                "proteinId": proteinId,
                "taxonomicLevel": taxonomicLevel,
                "members": results.map(function (row) {
                    return row['m.eid']
                })
            }
            d.resolve(response);
        })
        return d.promise
    }


    this.findTissuesForOrthologsAtTaxonomicLevel = function (proteinId, taxonomicLevel) {
        var d = when.defer()
        var id = proteinIdAsQueryParameter(proteinId)
        //var query = 'MATCH (:Protein {' + id + '})-[level]->(n:NOG) WITH n MATCH n<-[level]-(:Protein)-[tissue]-(:Abundance) return  distinct level.level,  tissue.tissue';
        var query = 'MATCH (:Protein {' + id + '})-[:' + taxonomicLevel + ']->(n:NOG)\n' +
            ' WITH n MATCH n<-[:' + taxonomicLevel + ']-(:Protein)-[tissue]->(:Abundance) \n' +
            ' RETURN DISTINCT tissue.tissue';
        db.query(query, function (err, results) {
            if (err) {
                log.error(err, 'findTissuesForOrthologsAtTaxonomicLevel(%s,%s) FAILED, query:[%s]', proteinId, taxonomicLevel, query)
                var e = Error("findTissuesForOrthologsAtTaxonomicLevel FAILED: " + err.message);
                d.reject(e);
                return
            }
            var response = {
                "proteinId": proteinId,
                "taxonomicLevel": taxonomicLevel,
                "tissues": results.map(function (row) {
                    return row['tissue.tissue']
                })
            }
            response.tissues.sort()
            d.resolve(response);
        })
        return d.promise
    }

    function proteinIdAsQueryParameter(proteinId) {
        return typeof(proteinId) === 'number' ? 'iid: ' + proteinId : 'eid: "' + proteinId + '"';
    }


    this.count = function (label, callback) {
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

    this.save_proteins = function (proteins, abundances) {
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


    this.save_orthgroups = function (groups, proteinIds) {
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

    this.loadOrthologs = function (proteinId, taxonomicLevel, tissue) {
        taxonomicLevel = taxonomicLevel || 'LUCA'
        tissue = tissue || 'WHOLE_ORGANISM'
        var d = when.defer()
        var id = proteinIdAsQueryParameter(proteinId)
        var query = "MATCH (:Protein {" + id + "})-[:" + taxonomicLevel + "]" +
            "->(n:NOG) WITH n MATCH n<-[:" + taxonomicLevel + "]-(m:Protein)-[:" +
            tissue + "]->(a:Abundance) return m,a";
        db.query(query, function (err, results) {
            if (err) {
                log.error(err, 'loadOrthologs(%s,%s,%s) FAILED, query:[%s]', proteinId, taxonomicLevel, tissue, query)
                var e = Error("loadOrthologs FAILED: " + err.message);
                deferredImport.reject(e);
                return
            }
            var response = {
                "proteinId": proteinId,
                "taxonomicLevel": taxonomicLevel,
                "tissue": tissue,
                "members": results.map(function (row) {
                    return {
                        "stringdbInternalId": row.m.iid,
                        "proteinId": row.m.eid,
                        "name": row.m.name,
                        "abundance": {
                            "value": parseFloat(row.a.value),
                            "position": parseInt(row.a.rank.substring(0, row.a.rank.indexOf('/'))),
                            "rank": row.a.rank
                        }
                    }
                })
            }
            d.resolve(response);
        })
        return d.promise
    }


    this.create_schema = function () {
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

    this.load_protein_ids = function () {
        var deferred = when.defer()
        db.query("MATCH (p:Protein) RETURN p.iid, id(p)", function (err, results) {
            if (err) {
                deferred.reject('failed to load protein ids: ' + err)
                return
            }
            proteinIds = {}
            var num = 0
            results.forEach(function (r) {
                proteinIds[r['p.iid']] = r['id(p)']
                num++
            })
            log.debug("%s protein ids loaded", num)
            deferred.resolve(proteinIds)
        })
        return deferred.promise
    }

}


exports = module.exports = function (options) {
    //disposabledb.constructor instanceof Seraph ?
    const log = bunyan.createLogger({
        name: "paxdb-API-orthologs",
        module: "storage/neo4j"
    });
    var db;
    if (options.hasOwnProperty('db')) {
        db = disposable
    } else {
        log.info('using server: ' + options.server)
        db = require("seraph")(options)
    }
    var data = require('./data')
    var taxonomy = require('./taxonomy')
    var storage = new Storage(db);

    storage.taxonomy = taxonomy
    storage.speciesTissuesMap = data.speciesTissuesMap
    storage.orthgroups = data.orthgroups
    return storage;
};
