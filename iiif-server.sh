#!/bin/bash

DATADIR="data/media/dossiers"
IMAGESDIR="data/media/collections/images"
MANIFESTSDIR="data/media/collections/manifests"
export COMPOSE_PROJECT_NAME="neat-iiif-server"




if [ "$1" == "start" ]; then

    if [ -d "$DATADIR" ]; then
      echo "Data dir exists...okey."
    else
      mkdir -p ${DATADIR}
      echo "Directory created: ${DATADIR}"
    fi
    if [ -d "$IMAGESDIR" ]; then
      echo "Images dir exists...okey."
    else
      mkdir -p ${IMAGESDIR}
      echo "Directory created: ${IMAGESDIR}"
    fi
    if [ -d "$MANIFESTSDIR" ]; then
      echo "Manifests dir exists...okey."
    else
      mkdir -p ${MANIFESTSDIR}
      echo "Directory created: ${MANIFESTSDIR}"
    fi

    git submodule init && git submodule sync && git submodule update

    export NVM_DIR="$HOME/.nvm" && (
      git clone https://github.com/nvm-sh/nvm.git "$NVM_DIR"
      cd "$NVM_DIR"
      git checkout `git describe --abbrev=0 --tags --match "v[0-9]*" $(git rev-list --tags --max-count=1)`
    ) && \. "$NVM_DIR/nvm.sh"

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    nvm install 12
    npm install

    while true; do
        read -p "Do you want to build service specific containers? (yes/no) " yn
        case $yn in
            [Yy]* ) docker-compose up --build -d; break;;
            [Nn]* ) docker-compose up -d; exit;;
            * ) echo "Please answer yes or no.";;
        esac
    done
elif  [ "$1" == "shutdown" ]; then
    docker-compose down
else
    echo "Please provide \"start\" or \"shutdown\" as an argument, nothing done."
fi
