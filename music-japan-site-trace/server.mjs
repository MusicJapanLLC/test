import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const port = Number(process.env.PORT || 4173);

const virtualFiles = new Map([
  [
    "/music-japan-og.png",
    [
      "archive-parts/music-japan-og.png.part-000",
      "archive-parts/music-japan-og.png.part-001",
      "archive-parts/music-japan-og.png.part-002",
      "archive-parts/music-japan-og.png.part-003"
    ]
  ],
  [
    "/kabeya-tomoki.png",
    [
      "archive-parts/kabeya-tomoki.png.part-000",
      "archive-parts/kabeya-tomoki.png.part-001",
      "archive-parts/kabeya-tomoki.png.part-002"
    ]
  ]
]);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function resolveRequest(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\\/g, "/");
  const relative = normalize(clean).replace(/^[/\\]+/, "");
  let candidate = join(root, relative);

  if (pathname.endsWith("/") || !extname(pathname)) {
    candidate = join(candidate, "index.html");
  }

  if (!candidate.startsWith(root)) return null;
  return candidate;
}

function streamParts(parts, response, index = 0) {
  if (index >= parts.length) {
    response.end();
    return;
  }

  const stream = createReadStream(join(root, parts[index]));
  stream.on("error", () => response.destroy());
  stream.on("end", () => streamParts(parts, response, index + 1));
  stream.pipe(response, { end: false });
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const virtual = virtualFiles.get(url.pathname);

  if (virtual) {
    const size = virtual.reduce((total, path) => total + statSync(join(root, path)).size, 0);
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": size,
      "cache-control": "no-store"
    });
    streamParts(virtual, response);
    return;
  }

  const file = resolveRequest(url.pathname);

  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  response.writeHead(200, {
    "content-type": types[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Music Japan snapshot: http://127.0.0.1:${port}`);
});
