/**
 *
 * TODO
 * - handle reconnections
 */

const bunyan = require('bunyan');
const consul = require('consul');

function ConsulClient(consulHost) {
    this.consul = consul({ host: consulHost });
}

ConsulClient.prototype.serviceDescription = function serviceDescription(name, cb) {
    this.consul.catalog.service.nodes(name, (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            throw Error(`${name}  not available`);
        }
        cb(result);
    });
};

exports = module.exports = (options) => { //eslint-disable-line no-multi-assign
    const log = bunyan.createLogger({
        name: 'consul-client',
        module: 'paxdb-api'
    });
    let host = '127.0.0.1';

    if (options && Object.prototype.hasOwnProperty.call(options, 'consul_host')) {
        host = options.consul_host;
    }
    log.info(`consul host: ${host}`);
    return new ConsulClient(host);
};
