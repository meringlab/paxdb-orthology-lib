/**
 * Created by milans on 07/07/15.
 */

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
    "9606.ENSP00000356969": [{"dataset_id": 4, "tissue": "BRAIN", value: 11, rank: "11/2263"},
        , {"dataset_id": 5, "tissue": "KIDNEY", value: 111, rank: "11/2263"},
        , {"dataset_id": 6, "tissue": "WHOLE_ORGANISM", value: 22, rank: "22/2263"}],
    "10116.ENSRNOP00000004662": [{"dataset_id": 7, "tissue": "BRAIN", value: 33, rank: "33/1111"},
        {"dataset_id": 8, "tissue": "WHOLE_ORGANISM", value: 44, rank: "44/1111"}],
    "9796.ENSECAP00000008027": [{"dataset_id": 9, "tissue": "BRAIN", value: 33, rank: "33/1111"},
        {"dataset_id": 10, "tissue": "WHOLE_ORGANISM", value: 40, rank: "40/1111"}],
    "10090.ENSMUSP00000005824": [{"dataset_id": 11, "tissue": "BRAIN", value: 55, rank: "55/1111"},
        {"dataset_id": 12, "tissue": "WHOLE_ORGANISM", value: 66, rank: "66/1111"}]
}

var nogs = [
    {"id": 9443, "name": "NOG21051", "clade": "PRIMATES", "members": [1803841, 1854701]},
    {"id": 9443, "name": "NOG21051", "clade": "SUPRAPRIMATES", "members": [1803841, 1854701, 2093738, 2117313]}
]

var neo4j = require('../storage/neo4j/index')

neo4j.count('Protein')
    .then(function (num) {
        num.should.equal(0);
    })
    .then(function () {
        return neo4j.import_proteins(proteins, abundances)
    })
    .then(function () {
        return neo4j.count('Protein')
    }, function (err) {
        throw err;
    })
    .then(function (num) {
        num.should.equal(proteins.length);
    })
    .then(function () {
        neo4j.import_orthgroups(nogs);
    })
    .done()
