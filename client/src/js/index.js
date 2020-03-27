'use strict';

var app = {};
window.app = app;
app.rpc = require('./rpc.js');

console.log("init");

function init() {

  // connect to the server and attempt to log in
  app.rpc.connect(function(err, remote, user) {
    if(err) {
      console.error("Connection attempt failed. Will continue trying.");
      return;
    }

    console.log("Connected!");

    if(user) {
      console.log("Logged in as: ", user);
    } else {
      console.log("Not logged in");
    }

  });
}


init();
