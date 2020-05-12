'use strict';

var fs = require('fs-extra');
var WriteStream = require('level-ws');

function ensureDBCopy(oldDB, newDB, newDBPath, cb) {
  cb = cb || function(){};
  fs.stat(newDBPath, function(err, stat) {
    if(!err || (err && err.code !== 'ENOENT')) {
      return cb(err);
    }
    
    var rs = oldDB.createReadStream({valueEncoding: 'utf8'});
    var ws = WriteStream(newDB, {valueEncoding: 'utf8'});

    rs.pipe(ws);
    
    ws.on('finish', cb);
    rs.on('error', cb);
  });
}

module.exports = {

  ensureDBCopy

  
};
