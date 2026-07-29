import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(rootDir, "package.json");
const manifestPath = path.join(rootDir, "public", "manifest.json");

const [packageJson, manifestJson] = await Promise.all([
  readJson(packagePath),
  readJson(manifestPath),
]);

if (!packageJson.version) {
  throw new Error("package.json is missing a version.");
}

const manifestIsCurrent = manifestJson.version === packageJson.version;

if (manifestIsCurrent) {
  console.log(`Version already in sync: ${packageJson.version}`);
  process.exit(0);
}

manifestJson.version = packageJson.version;
await writeJson(manifestPath, manifestJson);
console.log(`Synced extension version to ${packageJson.version}`);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
