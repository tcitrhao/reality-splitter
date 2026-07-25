import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, rename, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const contentPath = resolve(projectRoot, "content/website-content.json");
const contentTempPath = resolve(projectRoot, "content/website-content.json.tmp");
const host = "127.0.0.1";
const port = 4180;
let publishing = false;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

await runBuild();

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);

    if (requestUrl.pathname === "/api/content" && request.method === "GET") {
      return await handleGetContent(response);
    }

    if (requestUrl.pathname === "/api/content" && request.method === "POST") {
      return await handlePublish(request, response);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Method not allowed" });
    }

    return await serveStatic(requestUrl.pathname, request.method === "HEAD", response);
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "本地内容服务发生错误。" });
  }
});

server.listen(port, host, () => {
  console.log(`Reality Splitter 内容后台：http://${host}:${port}/studio.html`);
  console.log(`网站预览：http://${host}:${port}/`);
});

async function handleGetContent(response) {
  const content = await readFile(contentPath, "utf8");
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(content);
}

async function handlePublish(request, response) {
  if (publishing) {
    return sendJson(response, 409, { error: "已有一次发布正在进行，请稍后再试。" });
  }

  publishing = true;
  let previousContent = "";
  let contentReplaced = false;

  try {
    previousContent = await readFile(contentPath, "utf8");
    const payload = await readJsonBody(request);
    validateContent(payload);

    await writeFile(contentTempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(contentTempPath, contentPath);
    contentReplaced = true;
    await runBuild();

    return sendJson(response, 200, { ok: true });
  } catch (error) {
    if (contentReplaced) {
      await writeFile(contentPath, previousContent, "utf8");

      try {
        await runBuild();
      } catch (rollbackError) {
        console.error("回滚构建失败：", rollbackError);
      }
    }

    const message = error instanceof Error ? error.message : "发布失败。";
    return sendJson(response, 400, { error: message });
  } finally {
    publishing = false;
  }
}

async function serveStatic(pathname, headOnly, response) {
  const normalizedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = resolve(distRoot, `.${normalizedPath}`);

  if (!filePath.startsWith(`${distRoot}/`)) {
    return sendJson(response, 403, { error: "Forbidden" });
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(headOnly ? undefined : file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    let settled = false;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000 && !settled) {
        settled = true;
        rejectBody(new Error("内容超过 2 MB，无法发布。"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (settled) {
        return;
      }

      try {
        settled = true;
        resolveBody(JSON.parse(body));
      } catch {
        settled = true;
        rejectBody(new Error("提交的内容格式不正确。"));
      }
    });
    request.on("error", (error) => {
      if (!settled) {
        settled = true;
        rejectBody(error);
      }
    });
  });
}

function validateContent(content) {
  if (!content || typeof content !== "object") {
    throw new Error("网站内容不能为空。");
  }
  if (typeof content.site?.brand !== "string" || !content.site.brand.trim()) {
    throw new Error("网站名称不能为空。");
  }
  if (typeof content.product?.title !== "string" || !content.product.title.trim()) {
    throw new Error("产品名称不能为空。");
  }
  if (!Array.isArray(content.iterations) || !Array.isArray(content.meditations)) {
    throw new Error("产品更新或 AI 沉思录格式不正确。");
  }
  if (content.meditations.some((item) => typeof item?.body !== "string")) {
    throw new Error("AI 沉思录正文格式不正确。");
  }
}

function runBuild() {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn("npm", ["run", "build"], {
      cwd: projectRoot,
      stdio: "inherit"
    });

    child.on("error", rejectBuild);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveBuild();
      } else {
        rejectBuild(new Error("网站构建失败，内容没有发布。"));
      }
    });
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}
