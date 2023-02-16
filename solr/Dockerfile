FROM solr:8.7

USER root
RUN mkdir -p /opt/solr/contrib/ocrsearch/lib &&\
    wget https://github.com/dbmdz/solr-ocrhighlighting/releases/download/0.7.0/solr-ocrhighlighting-0.7.0.jar -P/opt/solr/contrib/ocrsearch/lib

USER solr
