import {execFileSync} from "node:child_process";
import {mkdirSync, readFileSync, rmSync} from "node:fs";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.json"), "utf8"));
const output = resolve(root, `release/ReplyLoom-${manifest.version}-chrome.zip`);

mkdirSync(resolve(root, "release"), {recursive: true});
rmSync(output, {force: true});
execFileSync("zip", ["-qr", output, "."], {cwd: resolve(root, "dist"), stdio: "inherit"});
console.log(`Created ${output}`);
