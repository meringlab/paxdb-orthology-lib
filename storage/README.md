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

# Neo4j Dockerfile

A Dockerfile that produces a Docker Image for [Neo4j](http://www.neo4j.org/).

## Neo4j version

2.2.4

## Usage

### Build the image

To create the image `paxdb/neo4j`, execute the following command:

```
$ docker build -t paxdb/neo4j .
```

### Run the image

To run the image and bind to host port 7474:

```
$ docker run -d --name neo4j -p 7474:7474 paxdb/neo4j
```

#### Persistent data

The Neo4j server is configured to store data in the `/data` directory inside the container. You can map the
container's `/data` volume to a volume on the host so the data becomes independent of the running container:

```
$ mkdir -p /tmp/neo4j
$ docker run -d \
    --name neo4j \
    -p 7474:7474 \
    -v /tmp/neo4j:/data \
    paxdb/neo4j
```
