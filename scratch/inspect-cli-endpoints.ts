import fs from "fs";

const file = "C:\\Users\\Ahmed\\.npm-global\\node_modules\\@shopify\\cli\\dist\\chunk-3YAD263J.js";
const content = fs.readFileSync(file, "utf-8");

const regex = /https:\/\/([a-zA-Z0-9.-]+\.shopify\.(?:com|dev)[a-zA-Z0-9._\/-]*)/g;
const matches = new Set<string>();
let m;
while ((m = regex.exec(content)) !== null) {
  matches.add(m[0]);
}

console.log("Found Shopify URLs:", Array.from(matches).slice(0, 30));
