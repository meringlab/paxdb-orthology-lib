/**
 * Created by milans on 07/08/15.
 */

const when = require('when');
const bunyan = require('bunyan');
const fs = require('fs');
const glob = require("glob")
const orthgroups = require('./data.js').orthgroups

const data_dir = '../data/v4.0/';

function Importer(config) {
    const log = bunyan.createLogger({
        name: "paxdb-API-orthologs",
        module: "storage/neo4j-importer",
        server: config ? config.url : 'disposable-neo4j'
    });

    const storage = config ? require('./storage')(config) : undefined

    this.import_data = function () {
        log.level('debug')
        storage.create_schema().then(function () {
            log.info("schema created")
            this.import_proteins(data_dir + 'proteins',
                data_dir + 'abundances').then(function () {
                    log.info('proteins import complete')
                    this.import_orthgroups(data_dir + 'orthgroups').then(function () {
                        log.info('orthgroups import complete')
                    }, function (err) {
                        log.error(err, 'failed to import orthgroups')
                    })
                }, function (err) {
                    log.error(err, 'failed to import proteins')
                })
        }, function (err) {
            log.error(err, "failed to create schema!")
        })
    }

    function loadAbundances(speciesId, abundances_dir) {
        var abundances = {}
        var abundanceFiles = glob.sync(abundances_dir + '/' + speciesId + '-*.txt')
        log.debug('abundance files found: %s', abundanceFiles)
        abundanceFiles.forEach(function (datasetFile) {
            log.info('reading %s abundances from %s', speciesId, datasetFile)
            var counter = 0
            var dataset = parseDataset(fs.readFileSync(datasetFile, {'encoding': 'utf8'}));

            //TODO refactor to appendAbundances(abundances, dataset.abundances)
            var outOf = '/' + String(dataset.numAbundances);
            for (var i = 0; i < dataset.abundances.length; i++) {
                var p = dataset.abundances[i];
                if (!abundances.hasOwnProperty(p.eid)) {
                    abundances[p.eid] = []
                }
                counter++
                abundances[p.eid].push({"tissue": dataset.organ, value: p.value, rank: String(i + 1) + outOf})
            }
            log.info('%s abundances read from %s', counter, datasetFile)
        })
        return abundances;
    }

    this.import_proteins_from_file = function (file, abundances_dir) {
        log.info("proteins from %s", file);
        var speciesId = /\/?(\d+)\-proteins.txt/.exec(file)[1]
        log.info('species: %s', speciesId)
        var proteins = parseProteins(fs.readFileSync(file, {'encoding': 'utf8'}));
        log.debug('%s protein records from %s', proteins.length, file)
        var abundances = loadAbundances(speciesId, abundances_dir);

        //chain promises in sequential order:
        var link = function (prevPromise, currentSlice) {
            return prevPromise.then(function () {
                return storage.save_proteins(currentSlice, abundances)
            })
        };
        const chunk = 500, slices = []
        for (var i = 0, j = proteins.length; i < j; i += chunk) {
            slices.push(proteins.slice(i, i + chunk))
        }

        return slices.reduce(link, when('starting promise'))
    }

    this.import_proteins = function (proteins_dir, abundances_dir) {
        log.info("importing proteins %s, %s", proteins_dir, abundances_dir)
        var files = glob.sync(proteins_dir + "/*-proteins.txt")

        //chain promises in sequential order:
        var link = function (prevPromise, currentFile) {
            return prevPromise.then(function () {
                log.info('calling import_proteins for %s', currentFile)
                return this.import_proteins_from_file(currentFile, abundances_dir);
                //return when('primise to import ' + currentFile)
            })
        };
        return files.reduce(link, when('starting promise'))
    }


    this.import_import_orthgroups_from_file = function (file, proteinIds) {
        log.info("orthgroups from %s", file);
        var groupId = parseInt(/\/?(\d+)\-orthologs.txt/.exec(file)[1])
        log.info('groupId: %s', groupId)
        var groups = parseOrthgroups(groupId, fs.readFileSync(file, {'encoding': 'utf8'}));
        log.debug('%s orthgroup records from %s', groups.length, file)

        //chain promises in sequential order:
        var link = function (prevPromise, currentSlice) {
            return prevPromise.then(function () {
                return storage.save_orthgroups(currentSlice, proteinIds)
            })
        };
        const chunk = 500, slices = []
        for (var i = 0, j = groups.length; i < j; i += chunk) {
            slices.push(groups.slice(i, i + chunk))
        }

        return slices.reduce(link, when('starting promise'))
    }

    this.import_orthgroups = function (orthgroups_dir) {
        log.info("importing orthgroups from %s", orthgroups_dir)
        log.debug("loading protein ids")

        //quering for each group members throws errors ECONNRESET so need to load them upfront:
        storage.load_protein_ids().then(function (err, proteinIds) {
            if (err) {
                throw Error('failed to load protein ids ' + JSON.stringify(err))
            }
            var files = glob.sync(orthgroups_dir + "/*-orthologs.txt")
            //chain promises in sequential order:
            var link = function (prevPromise, currentFile) {
                return prevPromise.then(function () {
                    log.info('calling import_orthgroups for %s', currentFile)
                    return this.import_import_orthgroups_from_file(currentFile, proteinIds);
                })
            };
            files.reduce(link, when('starting promise')).then(function () {
                log.info('orthgroups import complete')
            }, function (err) {
                log.error(err, 'failed to import orthgroups')
            })
        })
    }

    /**
     * just for unit testing
     * @type {{parseDataset: parseDataset, parseProteins: parseProteins, parseOrthgroups: parseOrthgroups}}
     * @private
     */
    this._internal = {
        parseDataset: parseDataset,
        parseProteins: parseProteins,
        parseOrthgroups: parseOrthgroups
    }

    function parseProteins(contents) {
        var proteins = []
        contents.split('\n').forEach(function (line) {
            if (line.trim() == 0) {
                return
            }
            var rec = line.split('\t');
            proteins.push({"iid": parseInt(rec[0]), "eid": rec[1], "name": rec[2]})
        })
        return proteins
    }

    function parseDataset(contents) {
        var dataset = {"abundances": []}
        var records = contents.split('\n');
        for (var i = 0; i < records.length && records[i].indexOf('#') == 0; i++) {
            if (records[i].indexOf('organ:') != -1) {
                dataset.organ = records[i].match(/organ\:\s+([A-Z_]+)/)[1]
            }
        }
        for (/*i from previous loop*/; i < records.length; i++) {
            var r = records[i].trim().split('\t');
            if (r.length < 2) {
                continue
            }
            dataset.abundances.push({iid: parseInt(r[0]), eid: r[1], value: parseFloat(r[2])})
        }
        dataset.numAbundances = dataset.abundances.length
        return dataset
    }

    function parseOrthgroups(groupId, contents) {
        if (!(groupId in orthgroups)) {
            throw Error('orthgroup taxonomic level missing for ' + groupId)
        }
        var clade = orthgroups[groupId].toUpperCase();
        var groups = []
        contents.split('\n').forEach(function (line) {
            if (line.trim() == 0) {
                return
            }
            var rec = line.split('\t');
            //{"id": 9443, "name": "NOG21051", "clade": "PRIMATES", "members": [1803841, 1854701]},
            var members = rec.slice(1, rec.length).map(function (el) {
                return parseInt(el)
            });
            //to make names globaly unique, prepend groupId:
            groups.push({
                "id": groupId,
                "name": groupId + '.' + rec[0],
                "clade": clade,
                "members": members
            })
        })
        return groups
    }

}


exports = module.exports = function (options) {
    return new Importer(options);
};