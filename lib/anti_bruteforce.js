'use strict';

// TODO ensure single instance of this is used everywhere

const readline = require('readline');
const fs = require('fs-extra');

const MAX_ATTEMPTS_PER_TIME = 300; // 5 minutes
const MAX_ATTEMPTS_PER_USER = 10; // max attempts in time window
const MAX_ATTEMPTS_PER_IP = 30; // max attempts in time window

function updateLog(log, key, time, now) {
  if(!key || !time) return;

  if(now - time > (MAX_ATTEMPTS_PER_TIME * 1000)) {
    return;
  }

  const o = log[key];
  if(!o) {
    log[key] = {
      count: 1,
      last: time
    };
  } else {
    o.count++;
    o.last = time;
  }
}

function openLog(logFile) {
  openingInProgress = true;
  
  fs.ensureFile(logFile, function(err) {
    if(err) {
      console.error("Failed to open login/signup attempts log file:", logFile);
      console.error("WARNING: Brute force password guessing protection is disabled");
      console.error(err);
      openingFailed = true;
      consumeBufferNoCheck();
      return;
    }
    
    var rs = fs.createReadStream(logFile, {encoding: 'utf8'});
    const rl = readline.createInterface({
      input: rs
    });

    var _ipLog = {};
    var _userLog = {};
    var entry;

    const now = (new Date()).getTime();
    
    rl.on('line', (line) => {
      try {
        entry = JSON.parse(line);

        updateLog(_ipLog, entry.ip, entry.time, now);
        updateLog(_userLog, entry.username, entry.time, now);
        
      } catch(err) {

      }
    });

    rl.on('close', function() {
      ipLog = _ipLog;
      userLog = _userLog;
      logStream = fs.createWriteStream(logFile, {
        flags: 'a',
        encoding: 'utf8'
      });
      consumeBuffer();
      openingInProgress = false;
    });
  });
}

var openingInProgress;
var openingFailed;
var ipLog;
var userLog;
var logStream;
var buffer = [];

function check(remoteIP, username, now, cb) {
  if(openingFailed) {
    return cb();
  }
  
  const ipEntry = ipLog[remoteIP];
  if(now - ipEntry.last > (MAX_ATTEMPTS_PER_TIME * 1000)) {
    delete ipLog[remoteIP];
  } else {
    if(ipEntry.count > MAX_ATTEMPTS_PER_IP) {
      return cb(new Error("Too many failed attempts from this IP"));
    }
  }

  if(!username) {
    return cb();
  }
  
  const userEntry = userLog[username];
  if(now - userEntry.last > (MAX_ATTEMPTS_PER_TIME * 1000)) {
    delete userLog[username];
  } else {
    if(userEntry.count > MAX_ATTEMPTS_PER_USER) {
      return cb(new Error("Too many failed attempts for this user"));
    }
  }

  cb();
}

function consumeBuffer() {

  const now = (new Date()).getTime();

  var attempt;
  for(let entry of buffer) {
    attempt = entry.attempt;
    
    logStream.write(JSON.stringify(attempt)+"\n");
    
    updateLog(ipLog, attempt.ip, attempt.time, now);
    
    if(entry.attempt.username) {
      updateLog(userLog, attempt.username, attempt.time, now);
    }
    check(attempt.ip, attempt.username, now, entry.cb);
  }
  buffer = [];
}

function consumeBufferNoCheck() {
  for(let entry in buffer) {
    entry.cb();
  }
  buffer = [];
}


function registerHit(logFile, remoteIP, username, cb) {
  if(!logFile) return cb();
  if(!remoteIP) return cb(new Error("Brute force login detector saw a client with no IP. Something is wrong."));

  const now = (new Date()).getTime();
  
  const attempt = {
    ip: remoteIP,
    time: now
  };
  if(username) {
    attempt.username = username;
  }

  buffer.push({
    attempt: attempt,
    cb: cb
  });
  
  if(!ipLog) {
    if(!openingInProgress) {
      openLog(logFile);
    }
    return;
  }

  consumeBuffer(); 
};


module.exports = registerHit;
