// Production static server for the SPA build (Laravel Cloud start command).
//
// Serves dist/client as-is and mirrors vercel.json's routing: real files and
// prerendered pages (e.g. /pricing -> pricing/index.html) first, everything
// else falls back to the SPA shell. Uses node:http so it runs under Bun or Node.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.env.STATIC_ROOT ?? "dist/client");
const shell = join(root, "_shell.html");
const port = Number(process.env.PORT ?? 5296);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolveFile(pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = normalize(join(root, decoded));
  // Block path traversal out of the build directory.
  if (candidate !== root && !candidate.startsWith(root + "/")) return null;
  if (await isFile(candidate)) return candidate;
  const index = join(candidate, "index.html");
  if (await isFile(index)) return index;
  return null;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = (await resolveFile(pathname)) ?? shell;
  const ext = extname(file);

  res.setHeader("Content-Type", contentTypes[ext] ?? "application/octet-stream");
  // Vite emits content-hashed filenames under /assets; HTML must revalidate.
  res.setHeader(
    "Cache-Control",
    pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  );

  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res);
});

server.listen(port, () => {
  console.log(`serve: ${root} on :${port}`);
});
