'use strict';
import {h, render} from 'preact';
import { store as createStore, view } from 'z-preact-easy-state';

var app = {};
window.app = app;
app.rpc = require('./rpc.js');

// TODO use app.actions.notify
app.error = function(err) {
  alert(err);
}

var whenConnectedCallbacks = [];
app.whenConnected = function(cb) {
  if(app.remote) return cb();
    
  whenConnectedCallbacks.push(cb);
};

app.state = createStore({
  connected: false,
  user: null
});

app.actions = require('./actions')();

var Root = require('./components/root.js');

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

    for(let i=0; i < whenConnectedCallbacks.length; i++) {
      whenConnectedCallbacks[i]();
    }
    whenConnectedCallbacks = [];

    if(user) {
      console.log("Logged in as: ", user);
    } else {
      console.log("Not logged in");
    }

  });
}


init();
