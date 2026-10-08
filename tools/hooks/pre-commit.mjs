// Run by .githooks/pre-commit: formats the staged code with the project's own Prettier and
// re-stages it (.prettierignore keeps the platform's files out). A file that also has unstaged
// changes is left as it is — re-staging it would commit those changes too — with a warning.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const CODE = /\.(ts|tsx|js|mjs|cjs|json|css)$/;

/** Which staged files to format, and which to skip because they are only partly staged. */
export function planFormat(staged, unstaged) {
  const dirty = new Set(unstaged);
  const code = staged.filter((f) => CODE.test(f));
  return { format: code.filter((f) => !dirty.has(f)), skipped: code.filter((f) => dirty.has(f)) };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const list = (out) => out.split("\0").filter(Boolean);

function main() {
  const staged = list(git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"));
  const unstaged = list(git("diff", "--name-only", "-z"));
  const { format, skipped } = planFormat(staged, unstaged);
  for (const f of skipped) console.warn(`pre-commit: ${f} is only partly staged — not formatted (run \`npm run format\` on it)`);
  if (!format.length) return;
  const prettier = createRequire(import.meta.url).resolve("prettier/bin/prettier.cjs");
  execFileSync(process.execPath, [prettier, "--write", "--ignore-unknown", "--log-level", "warn", ...format], { stdio: "inherit" });
  execFileSync("git", ["add", "--", ...format], { stdio: "inherit" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
