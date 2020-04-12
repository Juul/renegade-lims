'use strict';

var date = require('date-and-time');

const utils = {
  
  formatDateTime: function(d) {
    if(typeof d === 'number') d = new Date(d);
    d = d || new Date();
    return utils.formatTime(d) + ' ' + utils.formatDate(d);
  },

  formatDate: function(d) {
    if(typeof d === 'number') d = new Date(d);
    d = d || new Date();
    const pattern = date.compile('MMM D YYYY');
    return date.format(d, pattern);
  },

  formatTime: function(d) {
    if(typeof d === 'number') d = new Date(d);
    d = d || new Date();
    const pattern = date.compile('H:mm.ss');
    return date.format(d, pattern);
  }
  
}

module.exports = utils;
