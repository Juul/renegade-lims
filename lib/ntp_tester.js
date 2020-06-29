var timesync = require('os-timesync');
var ping = require('ping');
var ntpClient = require('ntp-client');

// Check that time is accurate
async function checkServer(host, port, opts) {
  opts = Object.assign({
    maxPing: 1000, // maximum allowed ping
    maxAllowedTimeDiff: 2000 // maximum allowed time diff
  }, opts || {});
  
  return new Promise((resolve, reject) => {      
    ping.promise.probe(host).then(function(resp) {

      ntpClient.getNetworkTime(host, port, function(err, date) {
        if(err) return reject(err);

        var ntpTime = date.getTime();
        if(resp.alive && resp.time) {
          if(resp.time > opts.maxPing) {
            return reject(new Error("Ping time higher than", opts.maxPing, "ms"));
          }
          ntpTime += Math.round(resp.time / 2);
        }
        
        const diff = new Date().getTime() - (date.getTime() + resp.time);
        if(Math.abs(diff) > opts.maxAllowedTimeDiff) {
          return resolve(false)
        }
        
        resolve(true);
      });
    }).catch(reject);
  });
}


// ntpServers is an array of objects with .host and .port
async function checkServers(ntpServers, opts) {

  var server;
  for(server of ntpServers) {
    try {
      var accurate = await checkServer(server.host, server.port, opts);
    } catch(e) {
      continue;
    }
    return accurate;
  }
  throw new Error("No servers could be reached");
}

function startPeriodicTimeCheck(ntpServers, howOften, cb, opts) {

  checkServers(ntpServers, opts).then(function(accurate) {
    if(!accurate) cb(null, false);

    setTimeout(() => {
      startPeriodicTimeCheck(ntpServers, howOften, cb, opts);
    }, howOften);
  }).catch(function(err) {
    cb(err);
    setTimeout(() => {
      startPeriodicTimeCheck(ntpServers, howOften, cb, opts);
    }, howOften);
  });
}

async function checkIfNTPIsEnabled() {
  return new Promise((resolve, reject) => {
    timesync.checkEnabled(function(err, enabled) {
      if(err) return reject(new Error("Failed to check if system has NTP enabled"));
      if(!enabled) return resolve(false);
      
      resolve(true);
    })
  });
}


module.exports = {
  checkServer,
  checkServers,
  startPeriodicTimeCheck,
  checkIfNTPIsEnabled
};

