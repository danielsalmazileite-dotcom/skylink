const http = require('http');
const fs = require('fs');
const path = require('path');

const PREVIEW_PORT = process.env.PREVIEW_PORT ? Number(process.env.PREVIEW_PORT) : 4173;
const DEV_PORT = 3000;
const DEV_PORT2 = 3001;
const DEV_PORT3 = 3002;
const STATIC_ROOT = path.resolve(__dirname, 'preview-dist');
const port = process.env.PORT ? Number(process.env.PORT) : 3090;

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function tryProxy(port, req, res, onError) {
  const options = {
    hostname: 'localhost',
    port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on('error', onError);
  req.pipe(proxyReq, { end: true });
}

function serveStatic(req, res) {
  const urlPath = decodeURI(req.url.split('?')[0]);
  let filePath = path.join(STATIC_ROOT, urlPath);
  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(STATIC_ROOT, 'index.html');
  }
  const ext = path.extname(filePath);
  const type = mime[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  tryProxy(PREVIEW_PORT, req, res, () => {
    tryProxy(DEV_PORT3, req, res, () => {
      tryProxy(DEV_PORT2, req, res, () => {
        tryProxy(DEV_PORT, req, res, () => {
          serveStatic(req, res);
        });
      });
    });
  });
});

server.listen(port, () => {
  console.log(`Preview server on http://localhost:${port}/ (proxy 4173->3002->3001->3000, fallback to static preview-dist)`);
});
