This is the [pax-db.org][http://pax-db.org] orthology storage microservice.

    var orth = require('paxdb-service-orthology-storage')({server:'http://neo4j:7474',user:'neo4j',pass:'secret'});
    orth.count('Protein').then(function(numProteins) { console.log('num proteins: ' + numProteins) })
    orth.loadOrthologs('9606.ENSP00000356969', 'PRIMATES', 'BRAIN').
        then(function(cogs) { console.log('orthologs: ' + JSON.stringify(cogs)) })

# Current Status

There is an email discussion list
[pax-db@googlegroups.com](mailto:pax-db@googlegroups.com),
also [as a forum in the
browser](https://groups.google.com/forum/#!forum/pax-db).


# Installation

    npm install paxdb-service-orthology-storage


# Versioning

All versions are `<major>.<minor>.<patch>`, where major and minor follow
[pax-db.org](pax-db.org) versions.


# License

MIT. See "LICENSE.txt".


