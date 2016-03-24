const express = require('express');
const router = express.Router(),
    negotiate = require('express-negotiate');
const _und = require('underscore')
const bunyan = require('bunyan');
const log = bunyan.createLogger({
    name: "paxdb-API-orthologs",
    module: "protein"
    //TODO server / host / process ..
});

//const stringdb_proteinid_re = /(\d)\.([a-zA-Z\.])+/;
const stringdb_proteinid_re = /(\d+)\..+/;

router.param('protein_id', function (req, res, next, protein_id) {
    if (!stringdb_proteinid_re.test(protein_id)) {
        res.status(404);
        res.render('error', {message: 'Invalid protein id: ' + protein_id, stack: '', });
        return;
    }

    // once validation is done save the new item in the req
    req.proteinId = protein_id;
    req.speciesId = parseInt(stringdb_proteinid_re.exec(protein_id)[1]);
    // go to the next thing
    next();
});

router.param('taxonomic_level', function (req, res, next, taxonomic_level) {
    if (!taxonomic_level) {
        next();
        return;
    }
    taxonomic_level = taxonomic_level.toUpperCase()
    if (!req.app.get('neo4j').taxonomy.isValidTaxonomicLevel(req.speciesId, taxonomic_level)) {
        res.status(404);
        //FIXME this doesn't work, error is not defined
        res.render('error', {message: 'Invalid taxonomic level for this protein: ' + req.proteinId + ", " + taxonomic_level});
        return;
    }

    // once validation is done save the new item in the req
    req.taxonomicLevel = taxonomic_level;
    // go to the next thing
    next();
});
router.param('tissue', function (req, res, next, tissue) {
    if (!tissue) {
        next();
        return;
    }
    tissue = tissue.toUpperCase()
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


router.get('/:protein_id/ortholog_groups/:taxonomic_level/:tissue', function (req, res, next) {
    req.app.get('neo4j').loadOrthologs(req.proteinId, req.taxonomicLevel, req.tissue).then(
        function (data) {
            req.negotiate({
                //'html': function () {
                //    res.header('content-type', "text/html");
                //    res.render('protein', {"protein": proteinObject});
                //},
                'application/ld+json': function () {
                    renderLevelForTissue(res, "application/ld+json", data);
                },
                'application/json': function () {
                    //TODO add Link header to @context
                    renderLevelForTissue(res, "application/json", data);
                },
                'default': function () {
                    renderLevelForTissue(res, "application/ld+json", data);
                }
            })
        },
        function (err) {
            //TODO handle error!
            log.error(err, 'failed to load orthologs at %s for %s, tissue: %s', req.taxonomicLevel, req.proteinId, req.tissue)
            return next(new Error('failed to load ortholog group for ' + req.proteinId + ': ' + err.message));
        });

});

router.get('/:protein_id/ortholog_groups', function (req, res, next) {
    var taxonomicLevels = req.app.get('neo4j').taxonomy.taxonomicLevels(req.speciesId);

    req.negotiate({
        //'html': function () {
        //    res.header('content-type', "text/html");
        //    res.render('protein', {"protein": proteinObject});
        //},
        'application/ld+json': function () {
            renderAllLevels(res, "application/ld+json", {'protein': req.proteinId, 'taxonomicLevels': taxonomicLevels});
        },
        'application/json': function () {
            //TODO add Link header to @context
            renderAllLevels(res, "application/json", {'protein': req.proteinId, 'taxonomicLevels': taxonomicLevels});
        },
        'default': function () {
            renderAllLevels(res, "application/ld+json", {'protein': req.proteinId, 'taxonomicLevels': taxonomicLevels});
        }
    })
});

router.get('/:protein_id/ortholog_groups/:taxonomic_level', function (req, res, next) {
    var neo4j = req.app.get('neo4j');
    neo4j.findTissuesForOrthologsAtTaxonomicLevel(req.proteinId, req.taxonomicLevel).then(
        function (tissues) {
            neo4j.findOrthologsAtTaxonomicLevel(req.proteinId, req.taxonomicLevel).then(
                function (orthologs) {
                    req.negotiate({
                        //'html': function () {
                        //    res.header('content-type', "text/html");
                        //    res.render('protein', {"protein": proteinObject});
                        //},
                        'application/ld+json': function () {
                            renderLevel(res, "application/ld+json", tissues, orthologs.members);
                        },
                        'application/json': function () {
                            //TODO add Link header to @context
                            renderLevel(res, "application/json", tissues, orthologs.members);
                        },
                        'default': function () {
                            renderLevel(res, "application/ld+json", tissues, orthologs.members);
                        }
                    });
                })
        },
        function (err) {
            //TODO handle error!
            log.error(err, 'failed to find tissues at %s for %s', req.taxonomicLevel, req.proteinId)
            return next(new Error('failed to load ortholog group for ' + req.proteinId + ': ' + err.message));
        });
})


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
        orthologs: orthologs
    });
}

function renderLevelForTissue(res, contentType, params) {
    res.header('content-type', contentType);
    res.render('orthgroup_with_abundances_ldjson', params);
}

module.exports = router;
//TODO
//exports = module.exports = function (options) {
//    return router
//}