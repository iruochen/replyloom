import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("public/manifest.json");
const version = packageJson.version;

if (!/^\d+\.\d+\.\d+$/u.test(version)) {
  fail(`package.json version must use major.minor.patch format; received ${version}.`);
}

const versions = [
  ["package-lock.json", packageLock.version],
  ["package-lock.json packages root", packageLock.packages?.[""]?.version],
  ["public/manifest.json", manifest.version],
];

for (const [file, candidate] of versions) {
  if (candidate !== version) fail(`${file} is ${candidate ?? "missing"}, but package.json is ${version}.`);
}

const expectedTag = process.argv[2];
if (expectedTag && expectedTag !== `v${version}`) {
  fail(`Tag ${expectedTag} must match the extension version v${version}.`);
}

console.log(`Version verified: ${version}`);

function readJson(file) {
  return JSON.parse(readFileSync(resolve(root, file), "utf8"));
}

function fail(message) {
  console.error(`Version check failed: ${message}`);
  process.exit(1);
}
