/**
 * Created by milans on 07/07/15.
 */
var seraph = require("disposable-seraph");

var should = require('chai').should(),
    expect = require('chai').expect,
    assert = require('assert');

var proteins = [
    {iid: 1854701, eid: "9606.ENSP00000356969", name: "APOA2"},
    {iid: 2117313, eid: "10116.ENSRNOP00000004662", name: "Apoa2"},
    {iid: 1987468, eid: "9796.ENSECAP00000008027", name: "APOA2"},
    {iid: 1873336, eid: "9615.ENSCAFP00000018988", name: "APOA2"},
    {iid: 2093738, eid: "10090.ENSMUSP00000005824", name: "Apoa2"},
    {iid: 1803841, eid: "9598.ENSPTRP00000002645", name: "APOA2"}];

var abundances = {
    "9598.ENSPTRP00000002645": [{"dataset_id": 1, "tissue": "BRAIN", value: 511, rank: "511/5555"},
        {"dataset_id": 2, "tissue": "KIDNEY", value: 555, rank: "555/5555"},
        {"dataset_id": 3, "tissue": "WHOLE_ORGANISM", value: 522, rank: "522/5555"}],
    "9606.ENSP00000356969": [{"dataset_id": 4, "tissue": "BRAIN", value: 11, rank: "11/2263"}
        , {"dataset_id": 5, "tissue": "KIDNEY", value: 111, rank: "11/2263"}
        , {"dataset_id": 6, "tissue": "WHOLE_ORGANISM", value: 22, rank: "22/2263"}],
    "10116.ENSRNOP00000004662": [{"dataset_id": 7, "tissue": "BRAIN", value: 33, rank: "33/1111"},
        {"dataset_id": 8, "tissue": "WHOLE_ORGANISM", value: 44, rank: "44/1111"}],
    "9796.ENSECAP00000008027": [{"dataset_id": 9, "tissue": "BRAIN", value: 33, rank: "33/1111"},
        {"dataset_id": 10, "tissue": "WHOLE_ORGANISM", value: 40, rank: "40/1111"}],
    "10090.ENSMUSP00000005824": [{"dataset_id": 11, "tissue": "BRAIN", value: 55, rank: "55/1111"},
        {"dataset_id": 12, "tissue": "WHOLE_ORGANISM", value: 66, rank: "66/1111"}]
};

var nogs = [
    {"id": 9443, "name": "NOG21051", "clade": "PRIMATES", "members": [1803841, 1854701]},
    {"id": 9443, "name": "NOG21051", "clade": "SUPRAPRIMATES", "members": [1803841, 1854701, 2093738, 2117313]}
];

describe('orthology service', function () {
    var db, neo;

    before(function (done) {
        // allow 10 minutes for initial disposable-seraph startup.
        this.timeout(600000);
        this.slow(300000);
        seraph({version: '2.2.3'}, function (err, dbObj, neoObj) {
            if (err) return done(err);
            neo = neoObj;
            db = dbObj;

            db.changePassword('test', function (err) {
                console.log('seraph ready to use')
                if (err) {
                    db.options.pass = 'test';
                    done()
                } else done()
            });
        });
    });

    after(function (done) {
        this.timeout(20000);
        this.slow(10000);
        neo.stop(done);
    });

    beforeEach(function (done) {
        this.timeout(200000);
        this.slow(100000);
        neo.clean(done)
    });

    it('should load and query', function (done) {
        var neo4j = require('../storage/neo4j/index')({db: db})

        neo4j.count('Protein')
            .then(function (num) {
                num.should.equal(0);
            })
            .then(function () {
                return neo4j.save_proteins(proteins, abundances)
            })
            .then(function () {
                return neo4j.count('Protein')
            })
            .then(function (num) {
                num.should.equal(proteins.length);
            })
            .then(function () {
                neo4j.save_orthgroups(nogs);
            })
            .then(function () {
                return neo4j.loadOrthologs('9606.ENSP00000356969', 'PRIMATES', 'BRAIN')
            })
            .then(function (cogs) {
                cogs.members.length.should.equal(2);
            })
            .then(function () {
                return neo4j.findTissuesForOrthologsAtTaxonomicLevel('9606.ENSP00000356969', 'PRIMATES')
            })
            .then(function (nog) {
                nog.tissues.length.should.equal(3);
                nog.tissues.should.deep.equal(['BRAIN', 'KIDNEY', 'WHOLE_ORGANISM'])
            })
            .then(done, done)

    });

});
