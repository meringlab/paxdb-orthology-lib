/**
 * Created by milans on 07/08/15.
 */

const when = require('when');
const bunyan = require('bunyan');
const fs = require('fs');
const glob = require('glob');
const orthgroups = require('./data.js').orthgroups;

const dataDir = `${__dirname}/../data/v4.0/`;

function Importer(config) {
    const log = bunyan.createLogger({
        name: 'paxdb-API-orthologs',
        module: 'storage/neo4j-importer',
        server: config ? config.url : 'disposable-neo4j'
    });

    const storage = config ? require('./storage')(config) : undefined;
    const _this = this;
    this.changeInitialPassword = (cb) => {
        storage.changePassword(config.pass + config.pass, cb);
    };
    this.import_data = () => {
        log.level('debug');
        storage.create_schema().then(() => {
            log.info('schema created');
            _this.import_proteins(`${dataDir}proteins`, `${dataDir}abundances`).then(() => {
                log.info('proteins import complete');
                _this.import_orthgroups(`${dataDir}orthgroups`).then(() => {
                    log.info('orthgroups import complete');
                }, err => {
                    log.error(err, 'failed to import orthgroups');
                });
            }, err => {
                log.error(err, 'failed to import proteins');
            });
        }, err => {
            log.error(err, 'failed to create schema!');
        });
    };

    function parseDataset(contents) {
        const dataset = { abundances: [] };
        const records = contents.split('\n');
        let i = 0;
        for (; i < records.length && records[i].indexOf('#') === 0; i++) {
            if (records[i].indexOf('organ:') !== -1) {
                dataset.organ = records[i].match(/organ\:\s+([A-Z_]+)/)[1];
            }
        }
        for (/*i from previous loop*/; i < records.length; i++) {
            const r = records[i].trim().split('\t');
            if (r.length < 2) {
                continue;
            }
            const abundance = { iid: parseInt(r[0], 10), eid: r[1], value: parseFloat(r[2], 10) };
            dataset.abundances.push(abundance);
        }
        dataset.numAbundances = dataset.abundances.length;
        return dataset;
    }

    function loadAbundances(speciesId, abundancesDir) {
        const abundances = {};
        const abundanceFiles = glob.sync(`${abundancesDir}/${speciesId}-*.txt`);
        log.debug('abundance files found: %s', abundanceFiles);
        abundanceFiles.forEach(datasetFile => {
            log.info('reading %s abundances from %s', speciesId, datasetFile);
            let counter = 0;
            const datasetContents = fs.readFileSync(datasetFile, { encoding: 'utf8' });
            const dataset = parseDataset(datasetContents);

            //TODO refactor to appendAbundances(abundances, dataset.abundances)
            const outOf = `/${String(dataset.numAbundances)}`;
            for (let i = 0; i < dataset.abundances.length; i++) {
                const p = dataset.abundances[i];
                if (!abundances.hasOwnProperty(p.eid)) {
                    abundances[p.eid] = [];
                }
                counter++;
                const rank = `${String(i + 1)}${outOf}`;
                abundances[p.eid].push({ tissue: dataset.organ, value: p.value, rank });
            }
            log.info('%s abundances read from %s', counter, datasetFile);
        });
        return abundances;
    }

    function parseProteins(contents) {
        const proteins = [];
        contents.split('\n').forEach(line => {
            if (line.trim() === 0) {
                return;
            }
            const r = line.split('\t');
            proteins.push({ iid: parseInt(r[0], 10), eid: r[1], name: r[2] });
        });
        return proteins;
    }

    this.import_proteins_from_file = (file, abundancesDir) => {
        log.info('proteins from %s', file);
        const speciesId = /\/?(\d+)\-proteins.txt/.exec(file)[1];
        log.info('species: %s', speciesId);
        const proteins = parseProteins(fs.readFileSync(file, { encoding: 'utf8' }));
        log.debug('%s protein records from %s', proteins.length, file);
        const abundances = loadAbundances(speciesId, abundancesDir);

        //chain promises in sequential order:
        function link(prevPromise, currentSlice) {
            return prevPromise.then(() => storage.save_proteins(currentSlice, abundances));
        }

        const chunk = 500;
        const slices = [];
        for (let i = 0, j = proteins.length; i < j; i += chunk) {
            slices.push(proteins.slice(i, i + chunk));
        }

        return slices.reduce(link, when('starting promise'));
    };

    this.import_proteins = (proteinsDir, abundancesDir) => {
        log.info('importing proteins %s, %s', proteinsDir, abundancesDir);
        const files = glob.sync(`${proteinsDir}/*-proteins.txt`);
        log.debug('total protein files to import: %s', files.length);

        //chain promises in sequential order:
        function link(prevPromise, currentFile) {
            return prevPromise.then(() => {
                log.info('calling import_proteins for %s', currentFile);
                return _this.import_proteins_from_file(currentFile, abundancesDir);
                //return when('primise to import ' + currentFile)
            });
        }

        return files.reduce(link, when('starting promise'));
    };
    function parseOrthgroups(groupId, contents) {
        if (!(groupId in orthgroups)) {
            throw Error(`orthgroup taxonomic level missing for ${groupId}`);
        }
        const clade = orthgroups[groupId].toUpperCase();
        const groups = [];
        contents.split('\n').forEach(line => {
            if (line.trim() === 0) {
                return;
            }
            const rec = line.split('\t');
            //{"id": 9443, "name": "NOG21051", "clade": "PRIMATES", "members": [1803841, 1854701]},
            const members = rec.slice(1, rec.length).map(el => parseInt(el, 10));
            //to make names globaly unique, prepend groupId:
            groups.push({
                id: groupId,
                name: `${groupId}.${rec[0]}`,
                clade,
                members
            });
        });
        return groups;
    }

    this.import_import_orthgroups_from_file = (file, proteinIds) => {
        log.info('orthgroups from %s', file);
        const groupId = parseInt(/\/?(\d+)\-orthologs.txt/.exec(file)[1], 10);
        log.info('groupId: %s', groupId);
        const groups = parseOrthgroups(groupId, fs.readFileSync(file, { encoding: 'utf8' }));
        log.debug('%s orthgroup records from %s', groups.length, file);

        //chain promises in sequential order:
        function link(prevPromise, currentSlice) {
            return prevPromise.then(() => storage.save_orthgroups(currentSlice, proteinIds));
        }

        const chunk = 500;
        const slices = [];
        for (let i = 0, j = groups.length; i < j; i += chunk) {
            slices.push(groups.slice(i, i + chunk));
        }

        return slices.reduce(link, when('starting promise'));
    };

    this.import_orthgroups = (orthgroupsDir) => {
        log.info('importing orthgroups from %s', orthgroupsDir);
        log.debug('loading protein ids');

        //quering for each group members throws errors ECONNRESET so need to load them upfront:
        return storage.load_protein_ids().then(proteinIds => {
            if (!proteinIds) {
                throw Error('failed to load protein ids');
            }
            const files = glob.sync(`${orthgroupsDir}/*-orthologs.txt`);
            //chain promises in sequential order:
            function link(prevPromise, currentFile) {
                return prevPromise.then(() => {
                    log.info('calling import_orthgroups for %s', currentFile);
                    return _this.import_import_orthgroups_from_file(currentFile, proteinIds);
                });
            }

            files.reduce(link, when('starting promise')).then(() => {
                log.info('orthgroups import complete');
            }, err => {
                log.error(err, 'failed to import orthgroups');
            });
        });
    };

    /**
     * just for unit testing
     * @private
     */
    this._internal = { parseDataset, parseProteins, parseOrthgroups };
}

exports = module.exports = options => new Importer(options);
