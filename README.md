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
./scripts/gen_cert.sh <hostname_or_email>
```

If this server will have inbound connections and has a public IP then this should be a valid hostname for that public IP. If this is not the case then do _not_ set this to a valid hostname (not even localhost), just use an email address for the sysadmin instead.

## Copy peer certs

For each peer you listed in `settings.js` copy the correct certificate file to the path indicated by the `.cert` property for that peer.

# Install dependencies

```
npm install
```

You need to manually install `eds-handler` in `node_modules/`.

Currently there's an issue with the `jsdom` package so you may have to manually:

```
npm install jsdom
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

If you are initializing a new renegade-lims network, meaning that this peer is the first peer in a new network rather than connecting to an existing network, then the very first time you run the server you should run:

```
./bin/server.js --init
```

This will create an initial admin user. If you are connecting to an existing renegade-lims network or this is not the first time running the server then run:


```
./bin/server.js
```

# Developing

For live re-building of client during development:

```
npm run dev
```

# Rimbaud

In `settings.js.example` there is a section called `rimbaud`. This is for integratiion with a separate system for reporting of results back to patients. This system is not currently open source.

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

## Using low ports as non-root user

If you plan to listen on a port < 1024 like 80 or 443 then you'll need to grant the node binary the appropriate permissions.

First figure out which node binary is being used by the user running renegade-lims, e.g:

```
sudo su -l renegade
readlink -f `which node`
logout
```

Then install libcap2-bin and set the permission:

```
sudo apt install libcap2-bin
sudo setcap cap_net_bind_service=+ep /path/to/node/binary
```

## Installing systemd service

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

## HTTPS certificate

First install [certbot](https://certbot.eff.org/instructions).

Then ensure that renegade-lims is listening on port 80 on the domain for which you want an HTTPS certificate by setting `webHost` and `webPort` in `settings.js` (and of course starting `./bin/server.js`).

Then, assuming you've read and agreed to the terms of service, run the following command replacing the email and hostname and possibly the path to the renegade-lims installation:

```
certbot certonly --webroot --agree-tos --email <your@email.org> -d <your_hostname> -w /home/renegade/renegade-lims/
```

TODO document renewal hook

You new certificate and key should now be in `/etc/letsencrypt/live/<your_hostname>/`.

In `settings.js` change `webTLSKey` to `fs.readFileSync('/etc/letsencrypt/live/<your_hostname>/privkey.pem')` and change `webTLSCert` to `fs.readFileSync('/etc/letsencrypt/live/<your_hostname>/fullchain.pem')`.

You should probably also change `webPort` to `443`.

Set permissions so the user running renegade-lims can read the cert and key:

```
chown root:renegade /etc/letsencrypt/live
chown root:renegade /etc/letsencrypt/archive
chown root:renegade /etc/letsencrypt/archive/<your_hostname>/*
chmod g+rx /etc/letsencrypt/live
chmod g+rx /etc/letsencrypt/archive
chmod g+rx /etc/letsencrypt/archive/<your_hostname>
chmod g+r /etc/letsencrypt/live/<your_hostname>/privkey.pem
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