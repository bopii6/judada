import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, "dist");
const DEFAULT_PORT = 4173;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav"
};

const ensureDistExists = () => {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`[admin-server] 构建目录不存在: ${DIST_DIR}`);
  }
};

const resolveFilePath = async requestedPath => {
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let finalPath = path.join(DIST_DIR, normalizedPath);

  try {
    const stats = await fs.promises.stat(finalPath);
    if (stats.isDirectory()) {
      finalPath = path.join(finalPath, "index.html");
    }
    return finalPath;
  } catch {
    return path.join(DIST_DIR, "index.html");
  }
};

const sendFile = (filePath, res) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  if (contentType.startsWith("text/") || contentType.includes("javascript")) {
    res.setHeader("Cache-Control", "no-cache");
  } else {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", error => {
    console.error(`[admin-server] 读取文件失败: ${filePath}`, error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("内部服务器错误");
  });
  stream.pipe(res);
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  let pathname;
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  } catch {
    pathname = "/index.html";
  }

  try {
    const filePath = await resolveFilePath(pathname);
    sendFile(filePath, res);
  } catch (error) {
    console.error(`[admin-server] 处理请求失败: ${req.url}`, error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("内部服务器错误");
  }
});

const port = Number(process.env.PORT || process.env.ADMIN_PORT || DEFAULT_PORT);
server.listen(port, () => {
  ensureDistExists();
  console.log(`[admin-server] 静态资源服务已启动，端口: ${port}, dist 目录: ${DIST_DIR}`);
});
