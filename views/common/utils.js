'use strict';

const u = {
  // from https://github.com/cabal-club/cabal-core/blob/master/views/messages.js
  monotonicTimestampToTimestamp: function(timestamp) {
    if (/^[0-9]+\.[0-9]+$/.test(String(timestamp))) {
      return Number(String(timestamp).split('.')[0])
    } else {
      return timestamp
    }
  },

  // from https://github.com/cabal-club/cabal-core/blob/master/views/messages.js
  isFutureMonotonicTimestamp: function(ts) {
    var timestamp = u.monotonicTimestampToTimestamp(ts)
    var now = new Date().getTime()
    return timestamp > now
  }
};

module.exports = u;
