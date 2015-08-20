# Version: 0.1
FROM ubuntu:trusty
MAINTAINER Milan Simonovic <milan.simonovic@imls.uzh.ch>

# update to invalidate docker's cache and force apt-get update
ENV REFRESHED_AT 2015-08-20

RUN apt-get update && apt-get install -y nodejs npm

EXPOSE 3000
ENV WD /var/www/paxdb
WORKDIR  /var/www/paxdb
COPY . $WD
RUN npm install

VOLUME $WD

# DEFAULTS, override when creating a container:
ENV CONSUL_HOST '127.0.0.1'
ENV NEO4J_USER neo4j
ENV NEO4J_PASS neo4j

CMD ["./bin/www"]
