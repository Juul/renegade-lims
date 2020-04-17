#!/bin/bash

TLSDIR=$(dirname $0)/../tls

if [ "$#" -lt "1" ]; then
    echo "Usage: $0 <hostname>" >&2
    exit 1
fi

HOSTNAME=$1

if [ -f "${TLSDIR}/cert.pem" ]; then
    echo "Certificate already exists" >&2
    exit 1
fi

mkdir -p ${TLSDIR}/peers
cd $TLSDIR

echo "Generating certificate..."

openssl genrsa -out key.pem 4096
if [ ! "$?" -eq "0" ]; then
    echo "Failed to generate key" >&2
    exit 1
fi

openssl req -new -key key.pem -out csr.pem -subj "/CN=$HOSTNAME"
if [ ! "$?" -eq "0" ]; then
    echo "Failed to certificate signing request for hostname $HOSTNAME" >&2
    exit 1
fi

openssl x509 -req -in csr.pem -signkey key.pem -out cert.pem
if [ ! "$?" -eq "0" ]; then
    echo "Failed to generate certificate" >&2
    exit 1
fi

chmod 640 *.pem
if [ ! "$?" -eq "0" ]; then
    echo "Failed to set file permissions for .pem files" >&2
    exit 1
fi

echo "Certificate generated!"
