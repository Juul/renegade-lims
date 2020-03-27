'use strict';
import {h, render, createElement, Component as PreactComponent} from 'preact'

var app = {};
window.app = app;
app.rpc = require('./rpc.js');

var Root = require('./components/root.js')

function renderAll() {
  var container = document.getElementById('container');

  render(<Root/>, container);
}

function init() {
  
  renderAll();
  
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
