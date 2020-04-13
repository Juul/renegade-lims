'use strict';

var path = require('path');
var fs = require('fs-extra');

const dbUtils = {

  dumpFeeds: function(multifeeds, outDir, cb) {
    var rs, ws, multifeed, feeds, feed;
    
    fs.ensureDir(dir, function(err) {
      if(err) return cb(err);


    
      for(multifeed in multifeeds) {
        feeds = multifeed.feeds();
        
        for(feed in feeds) {
          
          rs = feed.createReadStream();
          ws = feed.createWriteStream(
            
          }
        }
      }
    });
};


module.exports = dbUtils;


