# see http://neo4j.com/docs/operations-manual/current/installation/docker/

FROM        neo4j:3.1.1
MAINTAINER  Milan Simonovic <milan.simonovic@imls.uzh.ch>

ADD neo4j /data
# https://github.com/neo4j/docker-neo4j/issues/50
#RUN adduser -D -s /bin/bash neo4j
#RUN chown -R neo4j /var/lib/neo4j/logs /var/lib/neo4j/conf
#USER neo4j

ENV SERVICE_TAGS "paxdb,api"
ENV SERVICE_NAME orthology_storage_v4.0

ENV NEO4J_dbms_memory_pagecache_size 1G
ENV NEO4J_dbms_memory_heap_maxSize   2G


