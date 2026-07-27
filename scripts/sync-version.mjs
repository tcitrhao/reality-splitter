import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(rootDir, "package.json");
const manifestPath = path.join(rootDir, "public", "manifest.json");
const websiteContentPath = path.join(
  rootDir,
  "content",
  "website-content.json"
);

const [packageJson, manifestJson, websiteContent] = await Promise.all([
  readJson(packagePath),
  readJson(manifestPath),
  readJson(websiteContentPath),
]);

if (!packageJson.version) {
  throw new Error("package.json is missing a version.");
}

const websiteVersion = `v${packageJson.version}`;
const manifestIsCurrent = manifestJson.version === packageJson.version;
const websiteIsCurrent = websiteContent.product?.version === websiteVersion;

if (manifestIsCurrent && websiteIsCurrent) {
  console.log(`Version already in sync: ${packageJson.version}`);
  process.exit(0);
}

const writes = [];

if (!manifestIsCurrent) {
  manifestJson.version = packageJson.version;
  writes.push(writeJson(manifestPath, manifestJson));
}

if (!websiteIsCurrent) {
  websiteContent.product.version = websiteVersion;
  writes.push(writeJson(websiteContentPath, websiteContent));
}

await Promise.all(writes);
console.log(`Synced extension and website version to ${packageJson.version}`);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
