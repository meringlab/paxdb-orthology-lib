This is the [pax-db.org](http://pax-db.org) orthology storage microservice. It consists of two docker images, one for neo4j and another to import data.

As a bonus it exports an npm module which exposes the api. Example usage:

    const opts = {server:'http://neo4j:7474',user:'neo4j',pass:'secret'};
    const orth = require('paxdb-service-orthology-storage')(opts);
    orth.count('Protein').then(numProteins => console.log(`num proteins: ${numProteins}`);
    orth.loadOrthologs('9606.ENSP00000356969', 'PRIMATES', 'BRAIN').
        then(cogs => console.log(`orthologs: ${JSON.stringify(cogs)}));

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

2.3.7

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

Once it's up and running open neo4j console, for example http://0.0.0.0:32768, and set the password.

Now create the second container to run the import:

```
sudo docker build -t paxdb/orthology-import -f Dockerfile.index .
sudo docker run --rm paxdb/orthology-import
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

