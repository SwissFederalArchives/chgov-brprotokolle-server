# v0.4.0, with dependencies bundled before their download hosts went offline.
FROM ubma/ocr-fileformat@sha256:1346e7f2ce3b4fbfce28311e7c500e3d3426aec7714591428ae1170b01e9e7b7 AS ocr-fileformat

FROM node:22-trixie AS builder

RUN apt-get update && apt-get install -y libbrotli1 libbrotli-dev
RUN apt -y install curl git python3 g++ make clang cmake gcc libgd-dev libboost-dev

# Add ocr-transform dependencies based on https://github.com/UB-Mannheim/ocr-fileformat/blob/master/Dockerfile
RUN apt -y install wget unzip openjdk-21-jre-headless python3-lxml python3-venv libc-dev

# Trixie no longer packages the Python compatibility library used by hOCR validation.
RUN python3 -m venv --system-site-packages /opt/ocr-python \
    && /opt/ocr-python/bin/pip install --no-cache-dir future==1.0.0
ENV PATH="/opt/ocr-python/bin:${PATH}"

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

# Match the TypeScript version pinned in package.json.
RUN npm install typescript@5.7.3 -g

# Copy the application
RUN mkdir -p /opt/iiif-server
COPY . /opt/iiif-server
WORKDIR /opt/iiif-server

# Install the application
RUN npm install --omit=dev

# Transpile the application
RUN tsc

# Reuse the installed release instead of downloading dependencies from dead URLs.
COPY --from=ocr-fileformat /usr/local/share/ocr-fileformat/ /usr/local/share/ocr-fileformat/
COPY --from=ocr-fileformat /usr/local/bin/ocr-transform /usr/local/bin/ocr-validate /usr/local/bin/
# The upstream image uses Alpine; rebuild its native helper against Debian's libc.
RUN make -B -C /usr/local/share/ocr-fileformat/vendor/gcv2hocr

WORKDIR /opt/iiif-server

# Run the application
CMD ["node", "src/app.js"]
