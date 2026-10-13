import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const fromHere = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

// Inside this monorepo, resolve the @idosgames/* packages to their source for instant HMR (no SDK/
// host rebuild needed in dev). A standalone copy of this template — a cloned starter, or an AI Coder
// project built in a container — has no such paths and resolves each package from node_modules.
const sourceAliases: Record<string, string> = {
  // ⚠ Subpaths BEFORE the package: a string alias matches its prefix too, so "@idosgames/core"
  // would turn "@idosgames/core/realtime" into ".../src/index.ts/realtime".
  "@idosgames/core/realtime": fromHere(
    "../../packages/core/src/realtime/index.ts",
  ),
  "@idosgames/core": fromHere("../../packages/core/src/index.ts"),
  "@idosgames/module-sdk": fromHere("../../packages/module-sdk/src/index.ts"),
  "@idosgames/react/ui": fromHere("../../packages/react/src/ui/index.ts"),
  "@idosgames/react": fromHere("../../packages/react/src/index.ts"),
  "@idosgames/app-shell": fromHere("../../packages/app-shell/src/index.ts"),
};

// Env comes the standard Vite way: VITE_* variables of .env.local reach the code as
// `import.meta.env.VITE_*` (src/env.ts, src/config.ts). VITE_IDOS_ENV ("dev" | "prod") picks which
// copy of the title a LOCAL run talks to; hosted builds take it from their address instead.
export default defineConfig(() => {
  const alias = Object.fromEntries(
    Object.entries(sourceAliases).filter(([, path]) => existsSync(path)),
  );
  return {
    plugins: [react()],
    resolve: { alias },
    server: { port: 5180 },
    // Never inline assets as data: URIs. Embedded on idosgames.com, the platform serves the game with a CSP whose
    // connect-src allows only 'self' and its own hosts, so fetch() of an inlined data:image (how PixiJS loads
    // sprites) is refused and every small sprite turns into a placeholder. Real files under 'self' always load.
    build: { assetsInlineLimit: 0 },
    // Other agents' git worktrees live under .claude/worktrees, and .claude-setup holds a local backup of agent tools;
    // keep both out of our runs.
    test: { exclude: [...configDefaults.exclude, ".claude/**", ".claude-setup/**"] },
  };
});
