import assert from "node:assert/strict";
import {
  createStoredSettings,
  migrateLegacySettings
} from "../src/shared/modelSettings.ts";

const sharedLegacy = {
  provider: "openai-compatible",
  apiKey: "shared-secret",
  model: "shared-model",
  baseUrl: "https://models.example.com/v1"
};
const sharedMigration = migrateLegacySettings(sharedLegacy, sharedLegacy);
assert.equal(sharedMigration.profiles.length, 1);
assert.equal(sharedMigration.profiles[0].apiKey, "shared-secret");
assert.equal(
  sharedMigration.defaultProfileIds.quick,
  sharedMigration.defaultProfileIds.longform,
  "identical legacy settings should migrate to one shared profile"
);

const quickLegacy = {
  provider: "openai-compatible",
  apiKey: "quick-secret",
  model: "quick-model",
  baseUrl: "https://quick.example.com/v1"
};
const longformLegacy = {
  provider: "openai-compatible",
  apiKey: "longform-secret",
  model: "longform-model",
  baseUrl: "https://longform.example.com/v1"
};
const splitMigration = migrateLegacySettings(quickLegacy, longformLegacy);
assert.equal(splitMigration.profiles.length, 2);
assert.equal(splitMigration.quick.apiKey, "quick-secret");
assert.equal(splitMigration.longform.apiKey, "longform-secret");
assert.notEqual(
  splitMigration.defaultProfileIds.quick,
  splitMigration.defaultProfileIds.longform,
  "different legacy settings must keep independent defaults"
);

const library = createStoredSettings(
  [
    { id: "fast", name: "Fast", ...quickLegacy },
    { id: "deep", name: "Deep", ...longformLegacy }
  ],
  { quick: "fast", longform: "deep" }
);
assert.equal(library.quick.model, "quick-model");
assert.equal(library.longform.model, "longform-model");

const repairedDefaults = createStoredSettings(library.profiles, {
  quick: "missing",
  longform: "deep"
});
assert.equal(
  repairedDefaults.defaultProfileIds.quick,
  "fast",
  "missing defaults should fall back to the first profile"
);

const emptyLibrary = createStoredSettings([], {});
assert.equal(emptyLibrary.profiles.length, 1);
assert.equal(emptyLibrary.defaultProfileIds.quick, emptyLibrary.profiles[0].id);
assert.equal(emptyLibrary.defaultProfileIds.longform, emptyLibrary.profiles[0].id);

console.log("Model settings migration verified");
