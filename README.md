

# Setup

```
cp settings.js.example settings.js
cp settings.web.js.example settings.web.js
```

Then edit both to your liking.

# Generate certificate

```
./scripts/gen_cert.sh
```

## Copy peer certs

For each peer you listed in `settings.js` copy the correct certificate file to the path indicated by the `.cert` property for that peer.

# Install dependencies

```
npm install
```

## Client only

If you want to enable webcam-based DataMatrix scanning:

```
sudo apt install streamer dmtx-utils v4l-utils
```

Then make sure you set `dataMatrixScanner` in `client/settings.js` e.g:

```
dataMatrixScanner: "/dev/video0"
```

# Building

The web app needs to be built:

```
npm run build
```

# Running

```
./bin/server.js
```

# Developing

For live re-building of client:

```
npm run dev
```

# ToDo

* Move to something other than ecstatic for static file serving

Admins sign new users. When new users are pulled in, verify that they are signed by a known admin, or signed by an admin who was signed by a known admin, etc.

# Lab client views

* Create/edit rna_plate
* Create/edit qpcr_plate
* Create/edit container
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
* Copyright 2016-2018 BioBricks Foundation
* License: AGPLv3

See the `LICENSE` file for full license.