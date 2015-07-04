var express = require('express'),
    negotiate = require('express-negotiate');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  req.negotiate({
    'html': function() {
      res.header('content-type',"text/html");
      res.render('index', { title: 'pax-db.org API::Orthologous groups' });
    },
    'application/ld+json': function() {
      res.header('content-type',"application/ld+json");
      res.render('index_ldjson', { title: 'pax-db.org API::Orthologous groups' });
    },
    'application/json': function() {
      res.header('content-type',"application/json");
      res.render('index_ldjson', { title: 'pax-db.org API::Orthologous groups' });
    },
    'default': function() {
      res.header('content-type',"application/ld+json");
      res.render('index_ldjson', { title: 'pax-db.org API::Orthologous groups' });
    },
  });
});

module.exports = router;
