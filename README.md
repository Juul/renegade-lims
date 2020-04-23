This is a work-in-progress decentralized offline-capable Laboratory Inventory Management (LIMS) system to support Covid-19 testing labs. This is not yet ready for use by anyone else.

# Theory of operation

All data is written to append-only logs (hyperlogs) and these logs are replicated between peers over mutually authenticated TLS connections, with different types of peers having access to different groupings of feeds.

This software is meant to run simultaneously on a variety of devices:

* Touch-screen devices in the lab assisting in day-to-day workflow
* Field devices used to collect sample data outside of the lab
* Always-online servers acting as replication hubs and off-site backup

This is currently implemented as a node.js server + web app, though work is in progress on a mobile app for field devices.

# Setup

```
cp settings.js.example settings.js
cp settings.web.js.example settings.web.js
chmod 640 settings.*
```

Then edit both to your liking.

WARNING: It's _really_ important that you ensure each lab has a unique `settings.labBarcodePrefix` or you will end up with barcode collisions between labs.

You will also almost certainly want to change the `masterPassword` and `initialUser.password`.

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

For live re-building of client during development:

```
npm run dev
```

# ToDo

* Add QuaggaJS for 1D barcode scanning with webcam: https://serratus.github.io/quaggaJS/examples/live_w_locator.html
* Move to something other than ecstatic for static file serving

Admins sign new users. When new users are pulled in, verify that they are signed by a known admin, or signed by an admin who was signed by a known admin, etc.

## UI: Create/edit container 

Like "Edit/print label" but with an added "select parent".

* Enter name
* Enter description
* Select parent container (autocomplete)

Shows a list of all children.

## UI: Recently added/changed

Should include everything.


# Production

This section details how to set up renegade-lims to auto-start on boot and auto-restart when it fails.

Assuming your system has systemd:

```
cp production/renegade-lims.service /etc/systemd/system/
```

Edit the user name and paths in the `.service` file and if you're not using `nvm` then delete the `nvm_run` part at the beginning of `ExecStart=`.

Reload systemd configuration and start the new service:

```
systemctl daemon-reload
systemctl start renegade-lims
```

# Credit

This project builds upon the work of many talented hackers and would not be possible at all without the excellent work of Kira a.k.a [noffle](https://github.com/noffle) on [kappa-core](https://www.npmjs.com/package/kappa-core), [kappa-view](https://www.npmjs.com/package/kappa-view) and [multifeed](https://www.npmjs.com/package/multifeed) developed in part for [Mapeo](https://www.digital-democracy.org/mapeo/). Additional thanks to Kira for answering questions and guiding me directly! Her work in turn builds on [hypercore](https://www.npmjs.com/package/hypercore) developed by Mathias Buus a.k.a [mafintosh](https://github.com/mafintosh/) for the [dat](https://dat.foundation/) project.

Thanks to [Asbjørn Sloth Tønnesen](http://asbjorn.it/) for [reverse-engineering the Brother QL label printer protocol](https://github.com/biobricks/ql-printer-driver).

Also shout out to the [BioBricks Foundation](https://biobricks.org/) for funding previous development of open source LIMS software some of which has been re-used for this project. All of this code can be found [here](https://github.com/biobricks/).

# Copyright and license

* Copyright 2020 renegade.bio
* Copyright 2016-2018 BioBricks Foundation
* License: AGPLv3

See the `LICENSE` file for full license.