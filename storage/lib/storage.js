/**
 * Created by milans on 07/07/15.
 */
const when = require('when');
const bunyan = require('bunyan');
const data = require('./data');
const taxonomy = require('./taxonomy');
const consul = require('./consul-client');

/**
 *
 * some interesting queries:
 * <ul>
 *     <li>`MATCH (p:Protein \{${id}})-[l]->(n:NOG)<-[ll]-(m:Protein)-[t]->(Abundance)
 *              return distinct l.level, collect(distinct t.tissue)`</li>
 * </ul>
 *
 *
 * @param _db
 * @constructor
 */
function Storage(_db) {
    const db = _db;
    const log = bunyan.createLogger({
        name: 'paxdb-API-orthologs',
        module: 'storage/neo4j',
        server: db.options.server
    });
    this.changePassword = (pass, cb) => {
        db.changePassword(pass, err => cb(err));
        // `db`'s options will be updated with the new password
    };

    function proteinIdAsQueryParameter(proteinId) {
        return typeof proteinId === 'number' ? `iid: ${proteinId}` : `eid: "${proteinId}"`;
    }

    this.findOrthologsAtTaxonomicLevel = (proteinId, taxonomicLevel) => {
        const d = when.defer();
        const id = proteinIdAsQueryParameter(proteinId);
        //var query = 'MATCH (:Protein {' + id + '})-[level]->(n:NOG)
        //  WITH n MATCH (n)<-[level]-(:Protein)-[tissue]-(:Abundance) return  distinct level.level,  tissue.tissue';
        const query = `MATCH (:Protein {${id}})-[:${taxonomicLevel}]->(n:NOG)
            WITH n MATCH (n)<-[:${taxonomicLevel}]-(m:Protein) 
            RETURN m.eid`;
        db.query(query, (err, results) => {
            if (err) {
                log.error(err, 'findOrthologsAtTaxonomicLevel(%s,%s) FAILED, query:[%s]',
                    proteinId, taxonomicLevel, query);
                d.reject(Error(`findOrthologsAtTaxonomicLevel FAILED: ${err.message}`));
                return;
            }
            const response = { proteinId, taxonomicLevel, members: results.map(row => row['m.eid']) };
            d.resolve(response);
        });
        return d.promise;
    };

    this.findTissuesForOrthologsAtTaxonomicLevel = (proteinId, taxonomicLevel) => {
        const d = when.defer();
        const id = proteinIdAsQueryParameter(proteinId);
        //var query = 'MATCH (:Protein {' + id + '})-[level]->(n:NOG)
        // WITH n MATCH (n)<-[level]-(:Protein)-[tissue]-(:Abundance) return  distinct level.level,  tissue.tissue';
        const query = `MATCH (:Protein {${id}})-[:${taxonomicLevel}]->(n:NOG)
            WITH n MATCH (n)<-[:${taxonomicLevel}]-(:Protein)-[tissue]->(:Abundance) 
            RETURN DISTINCT tissue.tissue`;
        db.query(query, (err, results) => {
            if (err) {
                log.error(err, 'findTissuesForOrthologsAtTaxonomicLevel(%s,%s) FAILED, query:[%s]',
                    proteinId, taxonomicLevel, query);
                d.reject(Error(`findTissuesForOrthologsAtTaxonomicLevel FAILED: ${err.message}`));
                return;
            }
            const singleTissue = ('tissue.tissue' in results);
            const tissues = singleTissue ? [results['tissue.tissue']] : results.map(row => row['tissue.tissue']);
            tissues.sort();
            d.resolve({ proteinId, taxonomicLevel, tissues });
        });
        return d.promise;
    };

    this.count = (label) => {
        const d = when.defer();

        const cypher = `MATCH (n:${label}) RETURN count(*)`;
        db.queryRaw(cypher, (err, result) => {
            if (err) {
                log.error(err, 'neo4j - failed to count %s', label);
                throw new Error(err.message);
            }
            d.resolve(result.data[0][0]);
        });
        return d.promise;
    };

    this.save_proteins = (proteins, abundances) => {
        log.info('saving %s proteins', proteins.length);

        const d = when.defer();
        if (proteins.length === 0) {
            log.info('no proteins to saving');
            d.resolve();
            return d.promise;
        }
        const txn = db.batch();
        let numAbundances = 0;
        let savedNodes = 0;
        proteins.forEach((p) => {
            const node = txn.save(p);
            txn.label(node, 'Protein');
            savedNodes += 1;
            if (abundances[p.eid] && abundances[p.eid].length > 0) {
                abundances[p.eid].forEach((el) => {
                    numAbundances += 1;
                    const abundance = txn.save({ value: el.value, rank: el.rank });
                    txn.label(abundance, 'Abundance');
                    txn.relate(node, el.tissue, abundance, { tissue: el.tissue }/*, isDefaultAbundance : true*/);
                });
            }
        });
        log.info('about to commit %s proteins and %s abundances', proteins.length, numAbundances);
        txn.commit((err, results) => {
            if (err) {
                log.error(err, 'saving_proteins - FAILED, %s nodes will remain saved', savedNodes);
                const e = Error(`TRANSACTION FAILED: ${err.message}`);
                e.results = results;
                d.reject(e);
                return;
            }
            d.resolve();
        });
        return d.promise;
    };

    this.save_orthgroups = (groups, proteinIds) => {
        log.info('saving %s orthgroups', groups.length);

        const deferredImport = when.defer();

        if (groups.length === 0) {
            log.info('no groups to import');
            deferredImport.resolve();
            return deferredImport.promise;
        }

        const txn = db.batch();

        /**
         *
         * @param g
         * @return {Promise}
         */
        function saveGroup(g) {
            log.trace('saving group %s in %s', g.name, g.clade);
            const saved = when.defer();

            //{"id" :9443, "name": "NOG21051","clade": "PRIMATES", "members": [1803841, 1854701]},
            const node = txn.save({ levelId: g.id /*, "level": g.clade*/, name: g.name });
            txn.label(node, 'NOG');
            if (!proteinIds) {
                const query = `MATCH (p:Protein) WHERE p.iid IN [${g.members}] RETURN p.iid, id(p) `;
                db.query(query, (err, results) => {
                    if (err) {
                        const msgTemplate = 'saveGroup(%s) - failed to find proteins %s, query: %s';
                        log.error(err, msgTemplate, g.name, g.members, query);
                        saved.reject(Error(`${g.name} - failed to find proteins ${g.members}: ${err.message}`));
                        return;
                    }
                    //if (g.members.length !== results.length) {
                    //    var proteinRecords = new Set(results.map(function (el) {
                    //        return el['p.iid']
                    //    }))
                    //    var diff = g.members.filter(function (x) {
                    //        return !proteinRecords.has(x)
                    //    })
                    //    if (diff.length > 0) {
                    //        log.error('saveGroup(%s) - failed to find all members for %s, missing: [%s]', g.name, diff)
                    //        saved.reject(Error(g.name + ' - failed to find proteins ' + diff));
                    //        return
                    //    }
                    //    if (proteinRecords.length < Object.keys(results).length) {
                    //        log.warn('saveGroup(%s) - NON UNIQUE PROTEIN RECORDS, group: %s, records: %s', g.name, JSON.stringify(results))
                    //        //    saved.reject(Error(g.name + ' - NON UNIQUE PROTEIN RECORDS' + g.members));
                    //        //    return
                    //    }
                    //}

                    results.forEach((r) => {
                        txn.relate({ id: r['id(p)'] }, g.clade, node, { levelId: g.id });
                    });

                    saved.resolve();
                });
            } else {
                g.members.forEach((el) => {
                    if (el in proteinIds) {
                        txn.relate({ id: proteinIds[el] }, g.clade, node, { level: g.clade });
                    }
                });
                saved.resolve();
            }
            return saved.promise;
        }

        when.all(groups.map(g => saveGroup(g))).then(() => {
            log.trace('committing transaction');
            txn.commit((err) => {
                if (err) {
                    log.error(err, 'save_orthgroups - TRANSACTION FAILED');
                    //XXX attach err to e?
                    const e = Error(`TRANSACTION FAILED: ${err.message}`);
                    deferredImport.reject(e);
                    return;
                }

                deferredImport.resolve();
                log.trace('transaction completed');
            });
        }, (err) => {
            const msg = `failed to save one of the groups: ${err.message}`;
            log.error(err, msg);
            deferredImport.reject(Error(msg));
        });

        return deferredImport.promise;
    };

    this.loadOrthologs = (proteinId, taxonomicLevel, tissue) => {
        taxonomicLevel = taxonomicLevel || 'LUCA'; //eslint-disable-line no-param-reassign
        tissue = tissue || 'WHOLE_ORGANISM'; //eslint-disable-line no-param-reassign
        const d = when.defer();
        const id = proteinIdAsQueryParameter(proteinId);

        const query = `MATCH (:Protein {${id}})-[:${taxonomicLevel}]->(n:NOG) 
           WITH n MATCH (n)<-[:${taxonomicLevel}]-(m:Protein)-[:${tissue}]->(a:Abundance) return m,a`;

        db.query(query, (err, results) => {
            if (err) {
                log.error(err, 'loadOrthologs(%s,%s,%s) FAILED, query:[%s]', proteinId, taxonomicLevel, tissue, query);
                d.reject(Error(`loadOrthologs FAILED: ${err.message}`));
                return;
            }
            const members = results.map(row => ({
                stringdbInternalId: row.m.iid,
                proteinId: row.m.eid,
                name: row.m.name,
                abundance: {
                    value: parseFloat(row.a.value),
                    position: parseInt(row.a.rank.substring(0, row.a.rank.indexOf('/')), 10),
                    rank: row.a.rank
                }
            }));
            const orthologsIds = members.map(o => ({ id: o.proteinId }));
            const familyTree = taxonomy.proteinFamilyTree(orthologsIds, taxonomicLevel);
            const response = { proteinId, taxonomicLevel, tissue, members, familyTree };
            d.resolve(response);
        });
        return d.promise;
    };


    this.create_schema = () => {
        //can't use txn.index.create, lib doesn't allow data and schema manipulation in the same txn, so:
        const deferred = when.defer();
        db.index.createIfNone('Protein', 'iid', (err) => {
            if (err) {
                const msg = `failed to create iid index for Protein: ${err}`;
                log.error(err, msg);
                deferred.reject(msg);
                return;
            }
            db.index.createIfNone('Protein', 'eid', (err2) => {
                if (err2) {
                    const msg = `failed to create eid index for Protein: ${err2}`;
                    log.error(err2, msg);
                    deferred.reject(msg);
                    return;
                }
                db.constraints.uniqueness.createIfNone('Protein', 'iid', (err3) => {
                    if (err3) {
                        const msg = `failed to create eid index for Protein: ${err3}`;
                        log.error(err3, msg);
                        deferred.reject(msg);
                        return;
                    }
                    deferred.resolve();
                });
            });
        });
        return deferred.promise;
    };

    this.load_protein_ids = () => {
        const deferred = when.defer();
        db.query('MATCH (p:Protein) RETURN p.iid, id(p)', (err, results) => {
            if (err) {
                deferred.reject(`failed to load protein ids: ${err}`);
                return;
            }
            const proteinIds = {};
            let num = 0;
            results.forEach((r) => {
                proteinIds[r['p.iid']] = r['id(p)'];
                num += 1;
            });
            log.debug('%s protein ids loaded', num);
            deferred.resolve(proteinIds);
        });
        return deferred.promise;
    };
}

exports = module.exports = (options) => {  //eslint-disable-line no-multi-assign
    //disposabledb.constructor instanceof Seraph ?
    const log = bunyan.createLogger({
        name: 'paxdb-API-orthologs',
        module: 'storage/neo4j'
    });
    let db;
    if (Object.prototype.hasOwnProperty.call(options, 'db')) {
        log.info('using disposable db');
        db = options.db;
    } else {
        log.info(`using server: ${options.server}`);
        db = require('seraph')(options); //eslint-disable-line global-require
    }
    const storage = new Storage(db);

    storage.taxonomy = taxonomy;
    storage.speciesTissuesMap = data.speciesTissuesMap;
    storage.orthgroups = data.orthgroups;
    return storage;
};

exports.consul = consul;
