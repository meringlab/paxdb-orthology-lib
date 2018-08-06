const express = require('express');
// const negotiate = require('express-negotiate');

const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
    req.negotiate({
        html() {
            res.header('content-type', 'text/html');
            res.render('index', { title: 'pax-db.org API::Orthologous groups' });
        },
        'application/ld+json': () => {
            res.header('content-type', 'application/ld+json');
            res.render('index_ldjson', { title: 'pax-db.org API::Orthologous groups' });
        },
        'application/json': () => {
            res.header('content-type', 'application/json');
            res.render('index_ldjson', { title: 'pax-db.org API::Orthologous groups' });
        },
        default() {
            res.header('content-type', 'application/ld+json');
            res.render('index_ldjson', { title: 'pax-db.org API::Orthologous groups' });
        },
    });
});

module.exports = router;
