#!/bin/bash

SCRIPT_DIR=$(readlink -f $(dirname $0))
DATA_DIR="${SCRIPT_DIR}/../data"
VIEWSDB_DIR="${DATA_DIR}/db"
LOCALDB_DIR="${DATA_DIR}/local_db"

if [ ! -d "$LOCALDB_DIR" ]; then
    echo "You need to migrate first: ./bin/server --migrate" >&2
    exit 1
fi

if [ ! -d "$VIEWSDB_DIR" ]; then
    echo "Views database dir missing" >&2
    exit 1
fi

echo "Flushing views"
rm -rf $VIEWSDB_DIR
if [ "$?" -ne "0" ]; then
    echo "Flushing views failed" >&2
fi

echo "Views flushed"
