This is the [pax-db.org](http://pax-db.org) orthology API npm module. 

Example usage:

    const opts = {server:'http://neo4j:7474',user:'neo4j',pass:'secret'};
    const orth = require('paxdb-orthology-library')(opts);
    orth.count('Protein').then(numProteins => console.log(`num proteins: ${numProteins}`);
    orth.loadOrthologs('9606.ENSP00000356969', 'PRIMATES', 'BRAIN').
        then(cogs => console.log(`orthologs: ${JSON.stringify(cogs)}));

## Installation

    npm install paxdb-orthology-library

# Versioning

All versions are `<major>.<minor>.<patch>`, where major and minor follow
[pax-db.org](pax-db.org) versions.


# License

MIT. See "LICENSE.txt".

