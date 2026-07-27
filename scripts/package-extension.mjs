import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const releaseRoot = resolve(projectRoot, "release");
const stagingRoot = resolve(releaseRoot, "reality-splitter-chrome");
const archivePath = resolve(releaseRoot, "reality-splitter-chrome.zip");
const packageJson = JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8"));
const expectedTag = `v${packageJson.version}`;

if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== expectedTag) {
  throw new Error(
    `发布标签 ${process.env.GITHUB_REF_NAME} 与 package.json 版本 ${expectedTag} 不一致。`
  );
}

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });

const requiredFiles = [
  "manifest.json",
  "options.html",
  "sidepanel.html",
  "serviceWorker.js",
  "contentScript.js"
];
const dependencyQueue = ["options.html", "sidepanel.html"];
const dependencyPattern =
  /["'(]((?:\.{1,2}\/)[^"'()]+?\.(?:css|js|jpe?g|png|svg|webp|woff2?))["')]/g;

while (dependencyQueue.length > 0) {
  const sourcePath = dependencyQueue.shift();
  if (!sourcePath) {
    continue;
  }

  const source = await readFile(resolve(distRoot, sourcePath), "utf8");
  const sourceDirectory = dirname(resolve(distRoot, sourcePath));

  for (const match of source.matchAll(dependencyPattern)) {
    const dependencyPath = relative(
      distRoot,
      resolve(sourceDirectory, match[1])
    );

    if (
      dependencyPath.startsWith("..") ||
      requiredFiles.includes(dependencyPath)
    ) {
      continue;
    }

    requiredFiles.push(dependencyPath);
    dependencyQueue.push(dependencyPath);
  }
}

for (const file of requiredFiles) {
  const targetPath = resolve(stagingRoot, file);
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(resolve(distRoot, file), targetPath);
}

await cp(resolve(distRoot, "icons"), resolve(stagingRoot, "icons"), {
  recursive: true
});

await execFileAsync("zip", ["-qry", archivePath, "."], { cwd: stagingRoot });
await rm(stagingRoot, { recursive: true, force: true });

console.log(`Extension package created: ${archivePath}`);
