#!/usr/bin/env node
/* Tiny dependency-free static server for EchoOrbit.

   Usage:  node serve.js [port]
   Defaults to 8080 and binds 0.0.0.0 so it works behind a proxy or in a
   container preview. Also exported so the test suite can spin one up on
   an ephemeral port. */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function createServer(){
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    // Reject anything that tries to walk out of the project root.
    const filePath = path.join(ROOT, path.normalize(rel));
    if (!filePath.startsWith(ROOT)){
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err){
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      }).end(data);
    });
  });
}

if (require.main === module){
  const port = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
  createServer().listen(port, '0.0.0.0', () => {
    console.log('EchoOrbit serving ' + ROOT + ' on http://0.0.0.0:' + port);
  });
}

module.exports = { createServer };
