'use strict';

const timestamp = require('monotonic-timestamp');
const u = require('./utils.js');

module.exports = function(entry) {
  // If the message is from <<THE FUTURE>>, index it at _now_.
  var ts = entry.value.createdAt;
  if(u.isFutureMonotonicTimestamp(ts)) ts = timestamp();
  
  // When was this data received by us?
  entry.value.synchronizedAt = timestamp();

  return ts;
}
