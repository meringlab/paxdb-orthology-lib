# Version: 0.1
FROM meringlab/node5
MAINTAINER Milan Simonovic <milan.simonovic@imls.uzh.ch>

EXPOSE 3000
ENV WD /var/www/paxdb
WORKDIR  $WD
COPY . $WD
RUN npm install

# DEFAULTS, override when creating a container:
ENV CONSUL_HOST 'tethys.meringlab.org'
ENV NEO4J_USER neo4j
ENV NEO4J_PASS neo4j

# VOLUME $WD

CMD ["node", "./bin/www"]
