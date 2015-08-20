/**
 *
 * TODO
 * - handle reconnections
 */

const bunyan = require('bunyan');

function ConsulClient(consul_host) {
    this.consul = require('consul')({host: consul_host});
}

ConsulClient.prototype.serviceDescription = function serviceDescription(name, cb) {
    this.consul.catalog.service.nodes(name, function (err, result) {
        if (err) throw err;
        if (result.length == 0) {
            throw Error(name + ' not available')
        }
        cb(result)
    });
}

exports = module.exports = function (options) {
    const log = bunyan.createLogger({
        name: "consul-client",
        module: "paxdb-api"
    });
    var host = '127.0.0.1'
    if (options && options.hasOwnProperty('consul_host')) {
        host = options.consul_host
    }
    log.info('consul host: ' + host)
    var client = new ConsulClient(host);

    return client;
};
