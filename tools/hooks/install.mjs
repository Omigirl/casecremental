// `npm install` → points git at the committed hooks in .githooks (Prettier before every commit).
// Never fails the install: a checkout without git (a CI or platform build) simply skips it.
import { execSync } from "node:child_process";

try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
  // not a git checkout
}
