/**
 * Created by milans on 07/07/15.
 */
const seraph = require("disposable-seraph");
const storageModule = require('../src/storage');
const should = require('chai').should(),
    expect = require('chai').expect,
    assert = require('assert');

const proteins = [
    { iid: 1854701, eid: "9606.ENSP00000356969", name: "APOA2" },
    { iid: 2117313, eid: "10116.ENSRNOP00000004662", name: "Apoa2" },
    { iid: 1987468, eid: "9796.ENSECAP00000008027", name: "APOA2" },
    { iid: 1873336, eid: "9615.ENSCAFP00000018988", name: "APOA2" },
    { iid: 2093738, eid: "10090.ENSMUSP00000005824", name: "Apoa2" },
    { iid: 1803841, eid: "9598.ENSPTRP00000002645", name: "APOA2" }
];

const abundances = {
    "9598.ENSPTRP00000002645": [
        { "dataset_id": 1, "tissue": "BRAIN", value: 511, rank: "511/5555" },
        { "dataset_id": 2, "tissue": "KIDNEY", value: 555, rank: "555/5555" },
        { "dataset_id": 3, "tissue": "WHOLE_ORGANISM", value: 522, rank: "522/5555" }
    ],
    "9606.ENSP00000356969": [
        { "dataset_id": 4, "tissue": "BRAIN", value: 11, rank: "11/2263" }
        , { "dataset_id": 5, "tissue": "KIDNEY", value: 111, rank: "11/2263" }
        , { "dataset_id": 6, "tissue": "WHOLE_ORGANISM", value: 22, rank: "22/2263" }
    ],
    "10116.ENSRNOP00000004662": [
        { "dataset_id": 7, "tissue": "BRAIN", value: 33, rank: "33/1111" },
        { "dataset_id": 8, "tissue": "WHOLE_ORGANISM", value: 44, rank: "44/1111" }
    ],
    "9796.ENSECAP00000008027": [
        { "dataset_id": 9, "tissue": "BRAIN", value: 33, rank: "33/1111" },
        { "dataset_id": 10, "tissue": "WHOLE_ORGANISM", value: 40, rank: "40/1111" }
    ],
    "10090.ENSMUSP00000005824": [
        { "dataset_id": 11, "tissue": "BRAIN", value: 55, rank: "55/1111" },
        { "dataset_id": 12, "tissue": "WHOLE_ORGANISM", value: 66, rank: "66/1111" }
    ]
};

const nogs = [
    { "id": 9443, "name": "NOG21051", "clade": "PRIMATES", "members": [1803841, 1854701] },
    { "id": 9443, "name": "NOG21051", "clade": "SUPRAPRIMATES", "members": [1803841, 1854701, 2093738, 2117313] }
];

describe('orthology service', function() {
    let db, supervisor;

    before(function(done) {
        // allow 10 minutes for initial disposable-seraph startup.
        this.timeout(600000);
        this.slow(300000);
        seraph({ version: '3.4.5' /*,clean: true */}, function(err, _seraph, _supervisor) {
            if (err) return done(err);
            supervisor = _supervisor;
            db = _seraph;
            db.changePassword('test', function(err) {
                if (err) {
                    if (err.message !== 'Invalid username or password.') {
                        console.log('failed to change initial pasword', err);
                        return done(err);
                    }
                    console.warn('seems like the initial password has already been changed');
                }
                db.options.pass = 'test';
                //this is cached, so must change it as well
                db.options.authString = "bmVvNGo6dGVzdA=="; //base64 of 'neo4j:test', new Buffer('neo4j:test').toString('base64')
                console.log('seraph ready to use');
                done();
            });
            // done();
        });
    });

    after(function(done) {
        this.timeout(60000);
        this.slow(30000);
        supervisor && supervisor.stop(done);
    });

    beforeEach(function(done) {
        this.timeout(200000);
        this.slow(100000);

        // supervisor.clean(done)
        db.queryRaw('MATCH (n) DETACH DELETE n', function(err) {
            if (err) return done(err);
            done();
        });
    });

    it('should load and query', function(done) {
        var neo4j = storageModule({ db });
        neo4j.count('Protein')
            .then(function(num) {
                num.should.equal(0);
            })
            .then(function() {
                return neo4j.save_proteins(proteins, abundances)
            })
            .then(function() {
                return neo4j.count('Protein')
            })
            .then(function(num) {
                num.should.equal(proteins.length);
            })
            .then(function() {
                return neo4j.save_orthgroups(nogs);
            })
            .then(function() {
                return neo4j.loadOrthologs('9606.ENSP00000356969', 'PRIMATES', 'BRAIN')
            })
            .then(function(cogs) {
                cogs.members.length.should.equal(2);
            })
            .then(function() {
                return neo4j.findTissuesForOrthologsAtTaxonomicLevel('9606.ENSP00000356969', 'PRIMATES')
            })
            .then(function(nog) {
                nog.tissues.length.should.equal(3);
                nog.tissues.should.deep.equal(['BRAIN', 'KIDNEY', 'WHOLE_ORGANISM'])
            })
            .then(done, done)
    });

});
