import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let target = join(root, relative);
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");

  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(target)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(target).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`SECOND TAKE sample: http://127.0.0.1:${port}\n`);
});
