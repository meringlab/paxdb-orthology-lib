const express = require('express');
const bunyan = require('bunyan');

const router = express.Router();

const log = bunyan.createLogger({
    name: 'paxdb-API-orthologs',
    module: 'protein'
    //TODO server / host / process ..
});

//const STRINGDB_PROTEINID_RE = /(\d)\.([a-zA-Z\.])+/;
const STRINGDB_PROTEINID_RE = /(\d+)\..+/;


function renderAllLevels(res, contentType, params) {
    res.header('content-type', contentType);
    res.render('protein_ldjson', params);
}

function renderLevel(res, contentType, tissues, orthologs) {
    res.header('content-type', contentType);
    res.render('group_ldjson', {
        proteinId: tissues.proteinId,
        taxonomicLevel: tissues.taxonomicLevel,
        tissues: tissues.tissues,
        orthologs
    });
}

function renderLevelForTissue(res, contentType, params) {
    res.header('content-type', contentType);
    res.render('orthgroup_with_abundances_ldjson', params);
}

router.param('protein_id', (req, res, next, proteinId) => {
    if (!STRINGDB_PROTEINID_RE.test(proteinId)) {
        res.status(404);
        res.render('error', { message: `Invalid protein id: ${proteinId}`, stack: '', });
        return;
    }

    // once validation is done save the new item in the req
    req.proteinId = proteinId;
    req.speciesId = parseInt(STRINGDB_PROTEINID_RE.exec(proteinId)[1], 10);
    // go to the next thing
    next();
});

router.param('taxonomic_level', (req, res, next, taxonomicLevel) => {
    if (!taxonomicLevel) {
        next();
        return;
    }
    // eslint-disable-next-line no-param-reassign
    taxonomicLevel = taxonomicLevel.toUpperCase();
    if (!req.app.get('neo4j').taxonomy.isValidTaxonomicLevel(req.speciesId, taxonomicLevel)) {
        res.status(404);
        //FIXME this doesn't work, error is not defined
        res.render('error', { message: `Invalid taxonomic level for this protein: ${req.proteinId}, ${taxonomicLevel}` });
        return;
    }

    // once validation is done save the new item in the req
    req.taxonomicLevel = taxonomicLevel;
    // go to the next thing
    next();
});
router.param('tissue', (req, res, next, tissue) => {
    if (!tissue) {
        next();
        return;
    }
    // eslint-disable-next-line no-param-reassign
    tissue = tissue.toUpperCase();
    //FIXME when called with EUKARYOTES/URINE for 4932.YHR174W it says only allowed: EMBRYO,WHOLE_ORGANISM,
    //but at EUKARYOTES should allow all organs for eukaryotes
    // var allowedTissues = req.app.get('neo4j').speciesTissuesMap[req.speciesId];
    // if (!_und.contains(allowedTissues, tissue)) {
    //     res.status(404);
    //     //FIXME this doesn't work, error is not defined
    //     res.render('error', {message: 'Invalid tissue for this protein: ' + req.proteinId + ", " + tissue + ", only allowed: " + allowedTissues});
    //     return;
    // }

    // once validation is done save the new item in the req
    req.tissue = tissue;
    // go to the next thing
    next();
});


router.get('/:protein_id/ortholog_groups/:taxonomic_level/:tissue', (req, res, next) => {
    req.app.get('neo4j').loadOrthologs(req.proteinId, req.taxonomicLevel, req.tissue).then(
        (data) => {
            req.negotiate({
                //'html': function () {
                //    res.header('content-type', "text/html");
                //    res.render('protein', {"protein": proteinObject});
                //},
                'application/ld+json': () => {
                    renderLevelForTissue(res, 'application/ld+json', data);
                },
                'application/json': () => {
                    //TODO add Link header to @context
                    renderLevelForTissue(res, 'application/json', data);
                },
                default() {
                    renderLevelForTissue(res, 'application/ld+json', data);
                }
            });
        },
        (err) => {
            //TODO handle error!
            log.error(err, 'failed to load orthologs at %s for %s, tissue: %s',
                req.taxonomicLevel, req.proteinId, req.tissue);
            return next(new Error(`failed to load ortholog group for ${req.proteinId}: ${err.message}`));
        }
    );
});

router.get('/:protein_id/ortholog_groups', (req, res) => {
    const taxonomicLevels = req.app.get('neo4j').taxonomy.taxonomicLevels(req.speciesId);

    req.negotiate({
        //'html': function () {
        //    res.header('content-type', "text/html");
        //    res.render('protein', {"protein": proteinObject});
        //},
        'application/ld+json': () => {
            renderAllLevels(res, 'application/ld+json', { protein: req.proteinId, taxonomicLevels });
        },
        'application/json': () => {
            //TODO add Link header to @context
            renderAllLevels(res, 'application/json', { protein: req.proteinId, taxonomicLevels });
        },
        default() {
            renderAllLevels(res, 'application/ld+json', { protein: req.proteinId, taxonomicLevels });
        }
    });
});

router.get('/:protein_id/ortholog_groups/:taxonomic_level', (req, res, next) => {
    const neo4j = req.app.get('neo4j');
    neo4j.findTissuesForOrthologsAtTaxonomicLevel(req.proteinId, req.taxonomicLevel).then(
        (tissues) => {
            neo4j.findOrthologsAtTaxonomicLevel(req.proteinId, req.taxonomicLevel).then(
                (orthologs) => {
                    req.negotiate({
                        //'html': function () {
                        //    res.header('content-type', "text/html");
                        //    res.render('protein', {"protein": proteinObject});
                        //},
                        'application/ld+json': () => {
                            renderLevel(res, 'application/ld+json', tissues, orthologs.members);
                        },
                        'application/json': () => {
                            //TODO add Link header to @context
                            renderLevel(res, 'application/json', tissues, orthologs.members);
                        },
                        default() {
                            renderLevel(res, 'application/ld+json', tissues, orthologs.members);
                        }
                    });
                }
            );
        },
        (err) => {
            //TODO handle error!
            log.error(err, 'failed to find tissues at %s for %s', req.taxonomicLevel, req.proteinId);
            return next(new Error(`failed to load ortholog group for ${req.proteinId}: ${err.message}`));
        }
    );
});


module.exports = router;
//TODO
//exports = module.exports = function (options) {
//    return router
//}
