var appModule = '../bin/www';
var assert = require('assert');
var boot = require(appModule).boot,
    shutdown = require(appModule).shutdown,
    port = require(appModule).port,
    superagent = require('superagent'),
    should = require('chai').should(),
    expect = require('chai').expect;
var fs = require('fs');
const storage = require('../lib/storage');

describe('server', function () {
    before(function () {
        const neo4j = storage({
            server: process.env.NEO4J_URL || 'http://neo4j:7474',
            user: process.env.NEO4J_USER || 'neo4j',
            pass: process.env.NEO4J_PASS || 'neo4j'
        });
        boot(neo4j);
    });

    describe('homepage', function () {
        it('should respond to GET', function (done) {
            superagent
                .get('localhost:' + port)
                .accept('application/ld+json')
                .end(function (error, res) {
                    //assert(res.ok);
                    should.not.exist(error);
                    res.status.should.equal(200);
                    res.should.be.json;
                    res.type.should.equal("application/ld+json");
                    ["@context", "@id", "@type", "groups", "proteins"].forEach(function (prop) {
                        expect(res.body).to.have.property(prop)
                    });
                    done();
                });
        })
    });

    describe('protein', function () {
        it('should return representation to GET', function (done) {
            superagent
                //.get('localhost:' + port + '/protein/P12345')
                .get('localhost:' + port + '/protein/9606.ENSP00000356969/ortholog_groups')
                .accept('application/ld+json')
                .end(function (error, res) {
                    //assert(res.ok);
                    should.not.exist(error);
                    res.status.should.equal(200);
                    res.should.be.json;
                    res.type.should.equal("application/ld+json");
                    ["@context", "@id", "@type", "members"].forEach(function (prop) {
                        expect(res.body).to.have.property(prop)
                    });
                    done();
                });
        });
        it('should return valid tissues for a selected level', function (done) {
            superagent
                //.get('localhost:' + port + '/protein/P12345')
                .get('localhost:' + port + '/protein/9606.ENSP00000356969/ortholog_groups/LUCA')
                .accept('application/ld+json')
                .end(function (error, res) {
                    //assert(res.ok);
                    should.not.exist(error);
                    res.status.should.equal(200);
                    res.should.be.json;
                    res.type.should.equal("application/ld+json");
                    ["@context", "@id", "@type", "taxonomicLevel","members"].forEach(function (prop) {
                        expect(res.body).to.have.property(prop)
                    });
                    done();
                });
        });
        it('should return orthologs at a given level for a selected tissue', function (done) {
            superagent
                //.get('localhost:' + port + '/protein/P12345')
                .get('localhost:' + port + '/protein/9606.ENSP00000356969/ortholog_groups/LUCA/WHOLE_ORGANISM')
                .accept('application/ld+json')
                .end(function (error, res) {
                    //assert(res.ok);
                    should.not.exist(error);
                    res.status.should.equal(200);
                    res.should.be.json;
                    res.type.should.equal("application/ld+json");
                    ["@context", "@id", "@type", "taxonomicLevel","members"].forEach(function (prop) {
                        expect(res.body).to.have.property(prop)
                    });
                    done();
                });
        });
    });


    after(function () {
        shutdown();
    });
});
