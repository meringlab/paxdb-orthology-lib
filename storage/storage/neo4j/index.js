/**
 * Created by milans on 07/07/15.
 */
var when = require('when');

exports = module.exports = {}

var db = require("seraph")({
    server: "http://192.168.1.137:7474",
    user: "neo4j",
    pass: "t5y6u7i8"
});

exports.import_proteins = function (proteins, abundances) {
    var d = when.defer()

//TODO check if array or empty
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
            var e = Error("TRANSACTION FAILED: " + err.message);
            e.results = results;
            d.reject(e);
            return
        }
        //can't use txn.index.create, lib doesn't allow data and schema manipulation in the same txn, so:
        var indicesDeferred = when.defer()
        db.index.create('Protein', 'iid', function (err, index) {
            if (err) {
                indicesDeferred.reject('failed to create iid index for Protein: ' + err)
                return;
            }
            db.index.create('Protein', 'eid', function (err, index) {
                if (err) indicesDeferred.reject('failed to create eid index for Protein: ' + err)
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
        if (err) throw new Error(err.message);
        d.resolve(result.data[0][0])
    });
    return d.promise
}