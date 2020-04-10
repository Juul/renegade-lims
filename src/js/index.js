'use strict';
import {h, render} from 'preact';
import { store as createStore, view } from 'z-preact-easy-state';
const uuid = require('uuid').v4;

const NOTIFICATION_DURATION = 6000;

var app = {};
window.app = app;
app.rpc = require('./rpc.js');


// TODO use app.actions.notify
app.error = function(err) {
  console.error("TODO remote code that uses app.error");
}

var whenConnectedCallbacks = [];
app.whenConnected = function(cb) {
  if(app.remote) return cb();
    
  whenConnectedCallbacks.push(cb);
};

app.state = createStore({
  connected: false,
  user: null,
  notifications: {}
});

app.notify = function(msg, level) {
  console.log("[notify "+level+"]", msg);
  const id = uuid();
  app.state.notifications[id] = {
    id,
    msg,
    level
  };
  
  setTimeout(() => {
    delete app.state.notifications[id]
  }, NOTIFICATION_DURATION);
};


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
