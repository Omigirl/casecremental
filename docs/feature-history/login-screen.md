# Sign-in screen

The user asked (2026-10-13) for a custom sign-in screen instead of the platform's default look. It lives in
`src/base/login/` (the base's own code), not in the UI kit theme: the theme cannot express pixel art.

## What it is

- `LoginScreen.tsx` keeps every provider and flow of the template (wallet, iDos Games SSO, Google, Apple,
  Telegram, e-mail sign-in / sign-up / verify / forgot / reset, guest, remember me) and only replaced the render.
- `LoginBackdrop.tsx`: the game's `room-back` wall, a CS-style reel of skin cards (weapon glyphs in rarity colours
  scrolling past a gold marker, 90 s per loop) and the workbench (`table` + case sprites bobbing one pixel, coins
  turning). `pixelArt.tsx`: ASCII glyphs (weapons, button icons, tick box) and cropped sprite frames.
- `loginCss.ts`: the game's palette and pixel bevels, Press Start 2P. Scale variables per screen size
  (`--s` backdrop, `--hs` chest, `--lp` logo pixel, `--fs` small text). Layout tiers are at the END of the sheet on
  purpose (an earlier `.ccl-col { gap }` would override their `column-gap`):
  narrow = one column (a short phone drops the reel); wide with limited height = brand left, panel right;
  ≥1200×1000 = one big column.
- Sprites are COPIES of the game's built sprites in `src/base/login/assets/` — the base may not import a module.
  Re-copy them if `npm run art` changes the originals.

## Decisions worth knowing

- **Language:** the screen reads the game's prefs key `casecremental:prefs` (`lang`), else the first browser
  language (same rule as the game's `detectLang`). The EN/RU toggle writes back ONLY `lang`, keeping the game's
  other fields, so a pick made at sign-in carries into the game. If the game renames that key, update
  `GAME_PREFS_KEY` in `i18n.ts`.
- **Wallet button:** `@idosgames/wallet` draws it and takes only `style` + `label`. Its defaults are inline, so
  the screen overrides fill / padding / corners inline (one `background` shorthand: icon over the gold fill) and
  the bevel + hover/press come from `.ccl-wallet > button`. The package's own states ("Connect wallet", "Check
  your wallet…", its errors) stay English.
- **Wallet needs a WalletConnect project id:** without `IDOS_WEB3_WALLETCONNECT_PROJECT_ID` /
  `VITE_WALLETCONNECT_PROJECT_ID` the Solana button loads, says "Connect wallet", and on tap reports "Wallet
  sign-in is not configured for this title." (seen locally, 2026-10-13) — a configuration gap, not the screen.
- **Motion:** slow reel, one-pixel bob, coin frames, the chest's float and a glow whose opacity changes 0.8→1 on a
  0.34-alpha gradient (< 0.1 alpha change). No flashing. `prefers-reduced-motion` stops everything.
- `ui.config.ts` took the game's palette (colours only, default font and radii) so the host's loading screen, the
  play-access screen and the lobby match the game instead of the default blue.
