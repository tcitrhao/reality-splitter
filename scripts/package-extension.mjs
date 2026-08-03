import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const releaseRoot = resolve(projectRoot, "release");
const stagingRoot = resolve(releaseRoot, "reality-splitter-chrome");
const offlineStagingRoot = resolve(releaseRoot, "reality-splitter-offline");
const offlineExtensionRoot = resolve(offlineStagingRoot, "Reality Splitter");
const packageJson = JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8"));
const version = packageJson.version;
const archivePath = resolve(releaseRoot, `reality-splitter-chrome-v${version}.zip`);
const offlineArchivePath = resolve(
  releaseRoot,
  `reality-splitter-offline-v${version}.zip`
);
const legacyArchivePath = resolve(releaseRoot, "reality-splitter-chrome.zip");
const legacyOfflineArchivePath = resolve(
  releaseRoot,
  "reality-splitter-offline.zip"
);
const expectedTag = `v${packageJson.version}`;

if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== expectedTag) {
  throw new Error(
    `发布标签 ${process.env.GITHUB_REF_NAME} 与 package.json 版本 ${expectedTag} 不一致。`
  );
}

await mkdir(releaseRoot, { recursive: true });
await rm(stagingRoot, { recursive: true, force: true });
await rm(offlineStagingRoot, { recursive: true, force: true });
await rm(archivePath, { force: true });
await rm(offlineArchivePath, { force: true });
await rm(legacyArchivePath, { force: true });
await rm(legacyOfflineArchivePath, { force: true });
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
await mkdir(offlineStagingRoot, { recursive: true });
await cp(stagingRoot, offlineExtensionRoot, { recursive: true });
await writeFile(
  resolve(offlineStagingRoot, "INSTALL.txt"),
  [
    "Reality Splitter offline installation",
    "",
    "1. Extract this ZIP completely.",
    "2. Open chrome://extensions/ in Chrome.",
    "3. Enable Developer mode.",
    "4. Click Load unpacked.",
    "5. Select the enclosed Reality Splitter folder (it contains manifest.json).",
    "",
    "Do not select this ZIP file directly.",
    "",
    "The extension can be installed without the Chrome Web Store.",
    "Cloud model analysis still requires network access and your own API configuration.",
    "A local OpenAI-compatible model service can use a localhost Base URL.",
    "One-click ChatGPT or DeepSeek sending requires you to be signed in on the target site.",
    "The extension accesses those pages only after you click the matching send button.",
    ""
  ].join("\n"),
  "utf8"
);
await execFileAsync("zip", ["-qry", offlineArchivePath, "."], {
  cwd: offlineStagingRoot
});
// Keep stable aliases so previously published links continue to work.
await cp(archivePath, legacyArchivePath);
await cp(offlineArchivePath, legacyOfflineArchivePath);
await rm(stagingRoot, { recursive: true, force: true });
await rm(offlineStagingRoot, { recursive: true, force: true });

console.log(`Extension package created: ${archivePath}`);
console.log(`Offline package created: ${offlineArchivePath}`);
console.log(`Compatibility aliases created in: ${releaseRoot}`);
