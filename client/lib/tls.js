const crypto = require('crypto');

const tls = {
  sha256: function(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  },
  
  // takes in settings.tlsPeers
  getPeerCertEntry: function(tlsPeers, cert) {
    if(!tlsPeers) return null;
    
    const hash = tls.sha256(cert.raw.toString('base64'));
    
    var entry;
    for(entry of tlsPeers) {
      if(entry.hash === hash) {
        return entry
      }
    }
    return null;
  },

  // remove comments and whitespace from certificate data
  certClean: function(rawCert) {
    rawCert = rawCert.toString('utf8');
    rawCert = rawCert.replace(/[-]+BEGIN\s+CERTIFICATE[-]+/, '');
    rawCert = rawCert.replace(/[-]+END\s+CERTIFICATE[-]+/, '');
    rawCert = rawCert.replace(/[\s]+/g, '');
    return Buffer.from(rawCert);
  },

  // takes in settings.tlsPeers
  computeCertHashes: function(tlsPeers) {
    if(!tlsPeers) return;
    
    for(let o of tlsPeers) {
      o.hash = tls.sha256(tls.certClean(o.cert));
    }
  },

  // takes in settings.tlsPeers
  getPeerCerts: function(tlsPeers) {
    if(!tlsPeers) return [];
    
    return tlsPeers.map((o) => {
      return o.cert;
    });
  }
}

module.exports = tls;
