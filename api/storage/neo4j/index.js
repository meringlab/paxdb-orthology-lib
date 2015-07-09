/**
 * Created by milans on 07/07/15.
 */
var when = require('when');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "paxdb-API-orthologs", module: "storage/neo4j"});

exports = module.exports = {}

var db = require("seraph")({
    server: "http://192.168.1.137:7474",
    user: "neo4j",
    pass: "t5y6u7i8"
});

exports.save_proteins = function (proteins, abundances) {
    log.info('importing %s proteins and %s abundances', proteins.length, abundances.length)

    var d = when.defer()
    if (proteins.length === 0) {
        log.info('no proteins to import')
        d.resolve()
        return d.promise
    }
    var txn = db.batch();
    proteins.forEach(function (p) {
        var node = txn.save(p);
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
            log.error(err, 'import_proteins - TRANSACTION FAILED')
            var e = Error("TRANSACTION FAILED: " + err.message);
            e.results = results;
            d.reject(e);
            return
        }
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
    return d.promise
}

exports.count = function (label, callback) {
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

exports.save_orthgroups = function (groups) {
    log.info('importing %s orthgroups', groups.length)

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

        db.query("MATCH (p:Protein) WHERE p.iid IN [" + g.members + "] RETURN p.iid, id(p) ", function (err, results) {
            if (err) {
                log.error(err, 'import_orthgroups(%s) - failed to find proteins %s,[%s]', g.name, g.members)
                saved.reject(Error(g.name + ' - failed to find proteins ' + g.members + ': ' + err.message));
                return
            }
            if (g.members.length !== results.length) {
                log.error('import_orthgroups(%s) - failed to find all proteins %s, [%s], [%s]', g.name, g.members, results)
                saved.reject(Error(g.name + ' - failed to find all proteins ' + g.members));
                return
            }
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
        e.results = results;
        deferredImport.reject(e);
    })

    return deferredImport.promise
}
