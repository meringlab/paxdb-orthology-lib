var express = require('express');
var router = express.Router(),
    negotiate = require('express-negotiate');

var stringdb_proteinid_re = /(\d)\.([a-zA-Z\.])+/;


router.param('protein_id', function (req, res, next, protein_id) {
    if (!stringdb_proteinid_re.test(protein_id)) {
        res.status(404);
        res.render('error', {message: 'Invalid protein id: ' + protein_id});
        return;
    }

    // once validation is done save the new item in the req
    req.proteinId = protein_id;
    // go to the next thing
    next();
});

// TODO validate: is it a legal/known taxonomic level? is it legal for this protein?
//i need the entire phylo tree here, then look up the species, walk up the tree
//collecting all the levels.
function is_valid_taxonomic_level(taxonomic_level) {
    return true;
}
router.param('taxonomic_level', function (req, res, next, taxonomic_level) {
    if (!taxonomic_level) {
        next();
        return;
    }
    if (!is_valid_taxonomic_level(taxonomic_level)) {
        res.status(404);
        res.render('error', {message: 'Invalid taxonomic level for this protein: ' + req.proteinId + ", " + taxonomic_level});
        return;
    }

    // once validation is done save the new item in the req
    req.taxonomicLevel = taxonomic_level;
    // go to the next thing
    next();
});

//TODO load from database
var proteinObject = {
    "id": "9606.ENSP00000356969",
    "members": [
        {
            "taxonomicLevel": "cellular organisms",
            "tissues": ['WHOLE_ORGANISM', 'BRAIN', 'LEAF'],
            "members": [
                "protein1",
                "protein2"
            ]
        }, {
            "taxonomicLevel": "Fungi",
            "tissues": ['WHOLE_ORGANISM'],
            "members": [
                "protein2",
                "protein3",
                "protein4"
            ]
        }
    ]
};


router.get('/:protein_id/ortholog_groups/:taxonomic_level/:tissue', function (req, res, next) {

    var group= {
        "taxonomicLevel": "cellular organisms",
        "tissues": ['WHOLE_ORGANISM', 'BRAIN', 'LEAF'],
        "members": [
            {   "id" : "10090.ENSMUSP00000005824",
                "abundance": {
                        "value": 3393,
                        "unit": "UO:0000169",
                        "position": 74,
                        "_rank": "74/2263"
                }
            },
            {   "id":"10116.ENSRNOP00000004662",
                "abundance": {
                        "value": 43.9,
                        "unit": "UO:0000169",
                        "position": 1156,
                        "_rank": "1156/12365"
                }
            }
        ]
    }

    req.negotiate({
        //'html': function () {
        //    res.header('content-type', "text/html");
        //    res.render('protein', {"protein": proteinObject});
        //},
        'application/ld+json': function () {
            renderGroup(req, res, "application/ld+json", group);
        },
        'application/json': function () {
            renderGroup(req, res, "application/json", group);
        },
        'default': function () {
            renderGroup(req, res, "application/ld+json", group);
        }
    })
});

router.get('/:protein_id', function (req, res, next) {
    req.negotiate({
        //'html': function () {
        //    res.header('content-type', "text/html");
        //    res.render('protein', {"protein": proteinObject});
        //},
        'application/ld+json': function () {
            renderProtein(res, "application/ld+json", proteinObject);
        },
        'application/json': function () {
            renderProtein(res, "application/json", proteinObject);
        },
        'default': function () {
            renderProtein(res, "application/ld+json", proteinObject);
        }
    })
});
function renderProtein(res, contentType, proteinObject) {
    res.header('content-type', contentType);
    res.render('protein_ldjson', {
        "protein": proteinObject
    });
}
function renderGroup(req, res, contentType, groupObject) {
    res.header('content-type', contentType);
    res.render('orthgroup_ldjson', {
        "protein_id": req.proteinId,
        "tissue": req.params.tissue,
        "group": groupObject
    });
}

module.exports = router;
