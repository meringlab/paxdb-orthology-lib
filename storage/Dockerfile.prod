FROM        ubuntu:xenial
MAINTAINER  Milan Simonovic <milan.simonovic@imls.uzh.ch>

# java first

ENV         DEBIAN_FRONTEND noninteractive
RUN         apt-get update; apt-get install -y software-properties-common
RUN         echo debconf shared/accepted-oracle-license-v1-1 select true | debconf-set-selections && \
            echo debconf shared/accepted-oracle-license-v1-1 seen true | debconf-set-selections
RUN         add-apt-repository -y ppa:webupd8team/java && \
            apt-get update && \
               apt-get install -y oracle-java8-installer oracle-java8-set-default
RUN         rm -rf /tmp/* /var/tmp/* /var/cache/oracle-jdk8-installer

ENV NEO4J_VERSION 2.3.7

# Install and configure Neo4j
RUN cd /tmp && \
    wget http://dist.neo4j.org/neo4j-community-$NEO4J_VERSION-unix.tar.gz && \
    tar xzvf neo4j-community-$NEO4J_VERSION-unix.tar.gz && \
    mv /tmp/neo4j-community-$NEO4J_VERSION/ /neo4j && \
    sed -e 's/^org.neo4j.server.database.location=.*$/org.neo4j.server.database.location=\/data\/graph.db/' -i /neo4j/conf/neo4j-server.properties && \
    sed -e 's/^#org.neo4j.server.webserver.address=.*$/org.neo4j.server.webserver.address=0.0.0.0/' -i /neo4j/conf/neo4j-server.properties && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ADD bin/run.sh /scripts/
RUN chmod ugo+x /scripts/*.sh
RUN useradd -ms /bin/bash neo4j
ADD neo4j /data
RUN chown -R neo4j /neo4j/ /data/
USER neo4j

EXPOSE 7474

# Command to run
ENTRYPOINT ["/scripts/run.sh"]
CMD [""]

ENV SERVICE_TAGS "paxdb,api"
ENV SERVICE_NAME orthology_storage_v4.0
