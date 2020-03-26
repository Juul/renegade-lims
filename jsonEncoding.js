'use strict';

module.exports = {
  encode: function (obj) {
    return Buffer.from(JSON.stringify(obj))
  },
  decode: function (buf) {
    var str = buf.toString('utf8')
    try { var obj = JSON.parse(str) } catch (err) { return {} }
    return obj
  },
  buffer: true
};
