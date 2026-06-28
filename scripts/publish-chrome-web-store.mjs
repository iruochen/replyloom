import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const requiredEnv = [
  "CWS_EXTENSION_ID",
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN"
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.json"), "utf8"));
const packagePath = resolve(root, `release/ReplyLoom-${manifest.version}-chrome.zip`);

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({
    client_id: process.env.CWS_CLIENT_ID,
    client_secret: process.env.CWS_CLIENT_SECRET,
    refresh_token: process.env.CWS_REFRESH_TOKEN,
    grant_type: "refresh_token"
  })
});

if (!tokenResponse.ok) {
  console.error("Failed to exchange refresh token for access token.");
  console.error(await tokenResponse.text());
  process.exit(1);
}

const {access_token: accessToken} = await tokenResponse.json();
if (!accessToken) {
  console.error("OAuth response did not include an access token.");
  process.exit(1);
}

const extensionId = process.env.CWS_EXTENSION_ID;
const packageBytes = readFileSync(packagePath);

const uploadResponse = await fetch(
  `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`,
  {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-goog-api-version": "2"
    },
    body: packageBytes
  }
);

const uploadText = await uploadResponse.text();
if (!uploadResponse.ok) {
  console.error("Chrome Web Store upload failed.");
  console.error(uploadText);
  process.exit(1);
}

console.log("Upload response:");
console.log(uploadText);

const publishTarget = process.env.CWS_PUBLISH_TARGET ?? "default";
const publishResponse = await fetch(
  `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish?publishTarget=${encodeURIComponent(publishTarget)}`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-goog-api-version": "2"
    }
  }
);

const publishText = await publishResponse.text();
if (!publishResponse.ok) {
  console.error("Chrome Web Store publish failed.");
  console.error(publishText);
  process.exit(1);
}

console.log("Publish response:");
console.log(publishText);
