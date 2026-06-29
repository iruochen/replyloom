import {createSign} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
loadEnvFile(resolve(root, ".env.chrome-web-store.local"));

const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.json"), "utf8"));
const packagePath = resolve(root, `release/ReplyLoom-${manifest.version}-chrome.zip`);
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const uploadOnly = args.has("--upload-only");
const statusOnly = args.has("--status");

const extensionId = requireEnv("CWS_EXTENSION_ID");
const publisherId = requireEnv("CWS_PUBLISHER_ID");
const publishType = process.env.CWS_PUBLISH_TYPE ?? "DEFAULT_PUBLISH";
const skipReview = parseBoolean(process.env.CWS_SKIP_REVIEW, false);
const blockOnWarnings = parseBoolean(process.env.CWS_BLOCK_ON_WARNINGS, false);
const deployPercentage = process.env.CWS_DEPLOY_PERCENTAGE;

if (!statusOnly && !existsSync(packagePath)) {
  console.error(`Release archive not found: ${packagePath}`);
  console.error("Run `npm run package` before publishing.");
  process.exit(1);
}

console.log(`Preparing Chrome Web Store release for ReplyLoom ${manifest.version}`);
console.log(`Publisher ID: ${publisherId}`);
console.log(`Extension ID: ${extensionId}`);
console.log(`Publish type: ${publishType}`);
console.log(`Auth mode: ${detectAuthModeDescription()}`);
if (!statusOnly) {
  console.log(`Archive: ${packagePath}`);
}

if (dryRun) {
  console.log("Dry run complete. Required configuration looks ready.");
  process.exit(0);
}

const accessToken = await getAccessToken();

if (statusOnly) {
  const draftStatus = await fetchJson(
    `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`,
    {
      headers: authHeaders(accessToken)
    }
  );

  console.log("Item status:");
  console.log(JSON.stringify(draftStatus, null, 2));
  process.exit(0);
}

const uploadResponse = await fetch(
  `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`,
  {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/zip"
    },
    body: readFileSync(packagePath)
  }
);

const uploadBody = await parseResponse(uploadResponse);
if (!uploadResponse.ok) {
  console.error("Chrome Web Store upload failed.");
  console.error(JSON.stringify(uploadBody, null, 2));
  process.exit(1);
}

console.log("Upload response:");
console.log(JSON.stringify(uploadBody, null, 2));

if (uploadOnly) {
  console.log("Upload finished. Skipping publish because --upload-only was requested.");
  process.exit(0);
}

const publishBody = {
  publishType,
  skipReview
};

if (publishType === "STAGED_PUBLISH" && deployPercentage) {
  publishBody.targeting = {
    percentages: [Number(deployPercentage)]
  };
}

const publishResponse = await fetch(
  `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`,
  {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json"
    },
    body: JSON.stringify(publishBody)
  }
);

const publishResult = await parseResponse(publishResponse);
if (!publishResponse.ok) {
  console.error("Chrome Web Store publish failed.");
  console.error(JSON.stringify(publishResult, null, 2));
  process.exit(1);
}

console.log("Publish response:");
console.log(JSON.stringify(publishResult, null, 2));

if (blockOnWarnings) {
  const hasWarnings = hasWarningResult(publishResult);
  if (hasWarnings) {
    console.error("Publish completed with warnings and CWS_BLOCK_ON_WARNINGS=true.");
    process.exit(1);
  }
}

function authHeaders(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }

  return value;
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  return /^(1|true|yes)$/iu.test(value);
}

function detectAuthModeDescription() {
  if (process.env.CWS_ACCESS_TOKEN) {
    return "pre-supplied access token";
  }

  if (process.env.CWS_SERVICE_ACCOUNT_KEY_FILE) {
    return "service account JSON key file";
  }

  if (process.env.CWS_SERVICE_ACCOUNT_KEY_JSON) {
    return "inline service account JSON";
  }

  if (process.env.CWS_SERVICE_ACCOUNT_EMAIL) {
    return "gcloud service account impersonation";
  }

  console.error(
    "Missing service-account auth configuration. Set one of CWS_ACCESS_TOKEN, CWS_SERVICE_ACCOUNT_KEY_FILE, CWS_SERVICE_ACCOUNT_KEY_JSON, or CWS_SERVICE_ACCOUNT_EMAIL."
  );
  process.exit(1);
}

async function getAccessToken() {
  if (process.env.CWS_ACCESS_TOKEN) {
    return process.env.CWS_ACCESS_TOKEN;
  }

  if (process.env.CWS_SERVICE_ACCOUNT_KEY_FILE || process.env.CWS_SERVICE_ACCOUNT_KEY_JSON) {
    return exchangeServiceAccountJwtForAccessToken(loadServiceAccountCredentials());
  }

  if (process.env.CWS_SERVICE_ACCOUNT_EMAIL) {
    return getAccessTokenFromGcloud(process.env.CWS_SERVICE_ACCOUNT_EMAIL);
  }

  detectAuthModeDescription();
}

function loadServiceAccountCredentials() {
  if (process.env.CWS_SERVICE_ACCOUNT_KEY_JSON) {
    return JSON.parse(process.env.CWS_SERVICE_ACCOUNT_KEY_JSON);
  }

  const keyPath = resolve(root, process.env.CWS_SERVICE_ACCOUNT_KEY_FILE);
  if (!existsSync(keyPath)) {
    console.error(`Service account key file not found: ${keyPath}`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(keyPath, "utf8"));
}

async function exchangeServiceAccountJwtForAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claimSet = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/chromewebstore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const assertion = signJwt(header, claimSet, credentials.private_key);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const tokenPayload = await parseResponse(tokenResponse);
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    console.error("Failed to exchange service account JWT for access token.");
    console.error(JSON.stringify(tokenPayload, null, 2));
    process.exit(1);
  }

  return tokenPayload.access_token;
}

function getAccessTokenFromGcloud(serviceAccountEmail) {
  try {
    const output = execFileSync(
      "gcloud",
      [
        "auth",
        "print-access-token",
        `--impersonate-service-account=${serviceAccountEmail}`,
        "--scopes=https://www.googleapis.com/auth/chromewebstore"
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    return output.trim();
  } catch (error) {
    console.error("Failed to obtain an access token through gcloud impersonation.");
    if (error instanceof Error && "stderr" in error && typeof error.stderr === "string") {
      console.error(error.stderr.trim());
    } else if (error instanceof Error) {
      console.error(error.message);
    }

    console.error(
      "Make sure gcloud is installed, you are logged in, and your user can impersonate the configured service account."
    );
    process.exit(1);
  }
}

function signJwt(header, payload, privateKey) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString("base64")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await parseResponse(response);
  if (!response.ok) {
    console.error(`Request failed: ${url}`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  return body;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {raw: text};
  }
}

function hasWarningResult(payload) {
  const warningMessages = payload?.warnings ?? payload?.warning ?? [];
  if (Array.isArray(warningMessages)) {
    return warningMessages.length > 0;
  }

  return Boolean(warningMessages);
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/u);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
