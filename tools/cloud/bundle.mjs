// Joins cloudcode/data.json (generated from the content tables) and cloudcode/casecremental.js into the one script
// the Title runs: cloudcode/casecremental.bundle.js. Publish that file's text with the idosgames MCP
// (publish_cloud_code); never edit it by hand. `npm run cloud`.
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../../cloudcode/", import.meta.url);
const data = JSON.stringify(JSON.parse(readFileSync(new URL("data.json", dir), "utf8"))); // one line: the published script stays short
const code = readFileSync(new URL("casecremental.js", dir), "utf8");
const out = `// Casecremental CloudCode — bundled by tools/cloud/bundle.mjs from cloudcode/data.json + cloudcode/casecremental.js.\nvar DATA = ${data};\n${code}`;
writeFileSync(new URL("casecremental.bundle.js", dir), out);
console.log(`cloudcode/casecremental.bundle.js: ${out.length} bytes`);
