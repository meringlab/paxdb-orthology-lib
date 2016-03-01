FROM        meringlab/oracle-java8
MAINTAINER  Milan Simonovic <milan.simonovic@imls.uzh.ch>

ENV NEO4J_VERSION 2.2.4

# Install and configure Neo4j
RUN cd /tmp && \
    wget http://dist.neo4j.org/neo4j-community-$NEO4J_VERSION-unix.tar.gz && \
    tar xzvf neo4j-community-$NEO4J_VERSION-unix.tar.gz && \
    mv /tmp/neo4j-community-$NEO4J_VERSION/ /neo4j && \
    sed -e 's/^org.neo4j.server.database.location=.*$/org.neo4j.server.database.location=\/data\/graph.db/' -i /neo4j/conf/neo4j-server.properties && \
    sed -e 's/^#org.neo4j.server.webserver.address=.*$/org.neo4j.server.webserver.address=0.0.0.0/' -i /neo4j/conf/neo4j-server.properties && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Add scripts
ADD bin/run.sh /scripts/
RUN chmod +x /scripts/*.sh

# Expose listen port
EXPOSE 7474

# Expose our data volumes
VOLUME ["/data"]

# Command to run
ENTRYPOINT ["/scripts/run.sh"]
CMD [""]

ENV SERVICE_TAGS "paxdb,api"
ENV SERVICE_NAME orthology_storage_v4.0

# BUGFIX 
RUN ln -s /usr/bin/nodejs /usr/bin/node