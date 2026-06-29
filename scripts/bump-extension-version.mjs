import {readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const releaseType = process.argv[2] ?? "patch";
const allowedReleaseTypes = new Set(["patch", "minor", "major"]);

if (!allowedReleaseTypes.has(releaseType)) {
  console.error("Usage: node scripts/bump-extension-version.mjs <patch|minor|major>");
  process.exit(1);
}

const packageJsonPath = resolve(root, "package.json");
const packageLockPath = resolve(root, "package-lock.json");
const manifestPath = resolve(root, "public/manifest.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const currentVersion = packageJson.version;
if (manifest.version !== currentVersion) {
  console.error(
    `Version mismatch: package.json is ${currentVersion} but public/manifest.json is ${manifest.version}`
  );
  process.exit(1);
}

const nextVersion = incrementVersion(currentVersion, releaseType);

packageJson.version = nextVersion;
manifest.version = nextVersion;
packageLock.version = nextVersion;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].version = nextVersion;
}

writeJson(packageJsonPath, packageJson);
writeJson(packageLockPath, packageLock);
writeJson(manifestPath, manifest);

console.log(`Bumped ReplyLoom version: ${currentVersion} -> ${nextVersion}`);

function incrementVersion(version, type) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/u);
  if (!match) {
    console.error(`Unsupported version format: ${version}`);
    process.exit(1);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (type === "major") {
    return `${major + 1}.0.0`;
  }

  if (type === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
