
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

# Install dependencies

```
npm install
```

# Building

Client needs to be built:

```
cd client/
npm run build
```

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

# Developing

For live re-building of client:

```
cd client/
npm run dev
```

# ToDo

* Move to something other than ecstatic for static file serving
* Client auto-reconnect with exponential back-off
* Client log-in system
   * password.json with username and salted SHA-256 hash for each user

## Lab client

* Two way sync of Physicals

## Field client

* Push sync of Swabs

## Future

Admins sign new users. When new users are pulled in, verify that they are signed by a known admin, or signed by an admin who was signed by a known admin, etc.

Check with NTP server to ensure system time is sane since this will be used for merging e.g. which samples are in which wells in the future.


# Lab client views

* Log in
* Create/edit rna_plate
* Create/edit qpcr_plate
* Create/edit container
* Edit/print label
* Search
* User admin (add/remove/edit user)

## Create plate

For rna_plate it first goes to "edit/print label" view showing a suggested label for the plate which can be edited before hitting "save and print".

For qpcr_plate it first goes to scan since those plates are pre-labeled.

Then we proceed to the edit plate view.

## Edit plate

The view shows the plate and if the plate is empty says "scan first swab sample to begin". When a swab sample is scanned, the info about the sample is displayed and it is associated with the next well. If the user clicks another well after this then the sample is moved to that well.

Buttons are "next sample" (save sample to currently selected well and proceed to next empty well), "move well", "remove well", "view info" (view info about the sample), "undo", "redo", "manual sample entry" (type sample ID if scanner is not able to scan sample) and "add/change location" (select parent container),

Scanning a sample you are about to place will highlight where to place it in yellow.
Scanning a sample that is already placed in the well will highlight it in green.

## Create/edit container

Like "Edit/print label" but with an added "select parent".

* Enter name
* Enter description
* Select parent container (autocomplete)

Shows a list of all children.

Buttons: "save", "save and print", "cancel".

## Edit/print label

Shows an existing label where the user can edit the text and re-print the label.

## Search

* Type to search plain text of everything with auto-complete.
* Drop-down to select type of object
* Drop-down to select user
* Date from and to constraints

# Copyright and license

* Copyright 2020 Marc Juul Christoffersen
* License: AGPLv3

See the `LICENSE` file for full license.