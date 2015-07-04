var appModule = '../bin/www';
var assert = require('assert');
var boot = require(appModule).boot,
    shutdown = require(appModule).shutdown,
    port = require(appModule).port,
    superagent = require('superagent'),
    should = require('chai').should(),
    expect = require('chai').expect;

//var request = require('request');

describe('server', function () {
    before(function () {
        boot();
    });

    describe('homepage', function () {
        it('should respond to GET', function (done) {
            //request('http://localhost:' + port, function(error, response, body) {
            //    should.not.exist(error);
            //    expect(response.statusCode).to.equal(200);
            //    body.indexOf('protein').should.not.equal(-1);
            //    body.indexOf('group').should.not.equal(-1);
            //    done()
            //});
            superagent
                .get('localhost:' + port)
                .accept('application/ld+json')
                .end(function (error, res) {
                    //assert(res.ok);
                    should.not.exist(error);
                    res.status.should.equal(200);
                    res.should.be.json;
                    res.type.should.equal("application/ld+json");
                    expect(res.body).to.have.property("@context")
                    expect(res.body).to.have.property("groups")
                    expect(res.body).to.have.property("proteins")
                    done();
                });
        })
    });
    after(function () {
        shutdown();
    });
});
