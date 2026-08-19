const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5178);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.jsonl");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function appendJsonLine(filePath, payload) {
  const record = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...payload
  };
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record.id;
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

async function handleApi(req, res) {
  try {
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};

    if (req.url === "/api/submissions" && req.method === "POST") {
      const allowedTypes = new Set(["clinician", "company"]);
      if (!allowedTypes.has(payload.type) || !payload.data) {
        sendJson(res, 400, { ok: false, error: "Invalid submission" });
        return;
      }

      const id = appendJsonLine(SUBMISSIONS_FILE, {
        type: payload.type,
        data: payload.data,
        utm: payload.utm || {},
        page: payload.page || {},
        userAgent: req.headers["user-agent"] || ""
      });
      sendJson(res, 201, { ok: true, id });
      return;
    }

    if (req.url === "/api/events" && req.method === "POST") {
      if (!payload.name) {
        sendJson(res, 400, { ok: false, error: "Missing event name" });
        return;
      }

      appendJsonLine(EVENTS_FILE, {
        name: payload.name,
        meta: payload.meta || {},
        utm: payload.utm || {},
        page: payload.page || {},
        userAgent: req.headers["user-agent"] || ""
      });
      sendJson(res, 202, { ok: true });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Unknown endpoint" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`MediQA landing page is running at http://127.0.0.1:${PORT}`);
  console.log(`Submissions: ${SUBMISSIONS_FILE}`);
  console.log(`Events: ${EVENTS_FILE}`);
});
