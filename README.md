
# Generate certificates

## Server

```
mkdir tls
cd tls/
openssl genrsa -out server-key.pem 4096
# Specify server hostname as common name
openssl req -new -key server-key.pem -out server-csr.pem
openssl x509 -req -in server-csr.pem -signkey server-key.pem -out server-cert.pem
```

## Client

```
cd client/
mkdir tls
cd tls/
openssl genrsa -out client-key.pem 4096
# Specify Common Name as a unique subdomain, e.g. `swabber.localhost`
openssl req -new -key client-key.pem -out client-csr.pem
openssl x509 -req -in client-csr.pem -signkey client-key.pem -out client-cert.pem
```

## Copy server cert to client and vice-versa:

Starting from inside `client/tls/`:

```
cp ../../tls/server-cert.pem ./
cd ../../tls/
mkdir clients
cd clients/
cp ../../client/tls/client-cert.pem ./swabber.localhost.pem
```

# Settings

```
cp settings.js.example settings.js

cd client/
cp settings.js.example settings.js
```

Then edit both to your liking.

# Running

## Server

```
./server.js
```

## Client

```
cd client/
./client.js
```

# ToDo


# Copyright and license

* Copyright 2020 Marc Juul Christoffersen
* License: AGPLv3

See the `LICENSE` file for full license.