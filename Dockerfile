FROM node:22-bookworm AS builder

RUN apt update -y
RUN apt -y install curl git python3 g++ make clang cmake gcc libgd-dev libboost-dev

# Add ocr-transform dependencies based on https://github.com/UB-Mannheim/ocr-fileformat/blob/master/Dockerfile
RUN apt -y install wget unzip openjdk-17-jre python3-lxml python3-future libc-dev

RUN apt -y install libopenjp2-7 libopenjp2-tools
RUN apt -y install imagemagick ghostscript
RUN apt -y install tesseract-ocr tesseract-ocr-deu

# Install pdfalto
WORKDIR /opt
RUN git clone https://github.com/x4e-salvi/pdfalto.git
WORKDIR /opt/pdfalto
RUN git submodule update --init --recursive
RUN cmake .
RUN make
RUN ln -s /opt/pdfalto/pdfalto /usr/bin/pdfalto

# Install global NPM tooling
RUN npm install typescript -g

# Copy the application
RUN mkdir -p /opt/iiif-server
COPY . /opt/iiif-server
WORKDIR /opt/iiif-server

# Install the application
RUN npm install --omit=dev

# Transpile the application
RUN tsc

WORKDIR /opt
RUN git clone https://github.com/UB-Mannheim/ocr-fileformat.git
WORKDIR /opt/ocr-fileformat
RUN git checkout v0.4.0
RUN make install

WORKDIR /opt/iiif-server

# Run the application
CMD ["node", "src/app.js"]