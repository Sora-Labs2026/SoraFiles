// Serves dist/ for local browser audits: node tests/e2e/static-dist-server.mjs [port]
// ISOLATE=1 adds the cross-origin isolation headers production's worker.js sets on the Office and
// background-removal routes (LibreOffice and ONNX need SharedArrayBuffer); here they apply to every page.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.DIST || 'dist'), port = Number(process.argv[2] || 4396);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream', '.data': 'application/octet-stream' };
createServer((req, res) => {
  let path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try { if (statSync(path).isDirectory()) path = resolve(path, 'index.html'); } catch { res.writeHead(404).end(); return; }
  try { const size = statSync(path).size; res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': size, 'Cache-Control': 'no-store', ...(process.env.ISOLATE ? { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin' } : {}) }); createReadStream(path).pipe(res); }
  catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`dist on http://127.0.0.1:${port}`));
