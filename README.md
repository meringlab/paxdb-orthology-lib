This is the [pax-db.org](http://pax-db.org) orthology storage API service. 

Essentially there're two packages here, one for the storage (neo4j) 
and another for the front-end (node.js express).

# Storage

Storage consists of two docker images, one for storage (neo4j) and another to import data.

As a bonus it exports an npm module which exposes the API. Example usage:

    const opts = {server:'http://neo4j:7474',user:'neo4j',pass:'secret'};
    const orth = require('paxdb-service-orthology-storage')(opts);
    orth.count('Protein').then(numProteins => console.log(`num proteins: ${numProteins}`);
    orth.loadOrthologs('9606.ENSP00000356969', 'PRIMATES', 'BRAIN').
        then(cogs => console.log(`orthologs: ${JSON.stringify(cogs)}));

## Installation

    npm install paxdb-service-orthology-storage

## Storage build

```
docker build -t paxdb/orthology-indexer -f Dockerfile.index .
```

Need to create a tmp neo4j for data indexing. The Neo4j server is configured 
to store data in the `/data` directory inside the container. We'll map the
container's `/data` volume to a volume on the host and use it later to build the final image:


```
docker run -d --name paxdb_tmp_neo --log-driver=json-file \
    --env=NEO4J_AUTH=none \
    --env=NEO4J_dbms_memory_pagecache_size=1024M \
    --env=NEO4J_dbms_memory_heap_maxSize=2048M \
    -p 27474:7474 \
    -v neo4j:/data  \
    neo4j:3.1.6
```

Now create the second container to run the import:

```
# docker run --rm --env=NEO4J_PORT=37890 paxdb/orthology-indexer
docker run --rm --link paxdb_tmp_neo:neo4j paxdb/orthology-indexer
```

Once it's done, stop neo4j and create the other image with the neo4j data:

```
docker stop paxdb_tmp_neo
docker build -t paxdb/orthology-storage -f Dockerfile.storage .
docker rm -v paxdb_tmp_neo
```

# API Frontend



# Versioning

All versions are `<major>.<minor>.<patch>`, where major and minor follow
[pax-db.org](pax-db.org) versions.


# License

MIT. See "LICENSE.txt".

