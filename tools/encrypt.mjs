// Encrypts the reveal message + image into payload.json.
// Usage: node tools/encrypt.mjs <message.json> <image.jpg> "<passphrase>"
// message.json: { "message": ["paragraph 1", "paragraph 2", ...], "imageAlt": "..." }
// Keep message.json and the image OUT of the repo; only payload.json is committed.
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const [, , messagePath, imagePath, passphrase] = process.argv;
if (!messagePath || !imagePath || !passphrase) {
    console.error('Usage: node tools/encrypt.mjs <message.json> <image.jpg> "<passphrase>"');
    process.exit(1);
}

const normalize = t => t.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const b64 = bytes => Buffer.from(bytes).toString("base64");

const content = JSON.parse(readFileSync(messagePath, "utf8"));
const ext = imagePath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
content.image = `data:image/${ext};base64,${readFileSync(imagePath).toString("base64")}`;

const iterations = 600000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(normalize(passphrase)), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(content)));

writeFileSync("payload.json", JSON.stringify({ v: 1, iterations, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) }));
console.log("Wrote payload.json");
