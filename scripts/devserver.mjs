// Local dev server: serves /public and routes /api/* to the Netlify function,
// using a local file store instead of Netlify Blobs.
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.TP_LOCAL = process.env.TP_LOCAL || path.join(root, ".localdata");
const { default: handler } = await import("../netlify/functions/api.mjs");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const port = Number(process.env.PORT || 8888);

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  let p = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
  try { const data = await fs.readFile(p); res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); res.end(data); }
  catch { res.writeHead(404); res.end("not found"); }
}).listen(port, () => console.log(`Team Pulse dev server on http://localhost:${port}`));
