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

/* GET users listing. */
router.get('/:protein_id/:taxonomicLevel?', function (req, res, next) {
    //TODO load from database
    var proteinObject = {
        "id": "9606.ENSP00000356969",
        "members": [
            {
                "taxonomicLevel": "Luca",
                "members": [
                    "protein1",
                    "protein2"
                ]
            }, {
                "taxonomicLevel": "Eukaryotes",
                "members": [
                    "protein2",
                    "protein3",
                    "protein4"
                ]
            }
        ]
    };
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

module.exports = router;
