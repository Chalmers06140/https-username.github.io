# SVEAB: Rail or Road?

This repository contains the seminar game for GitHub Pages. The publishable website is in [`docs/`](docs/): `docs/index.html`, `docs/assets/`, and separate `emergency/` and `teacher/` pages. The editable React source is in `web/`. No ChatGPT account is needed to play.

## Live website

GitHub Pages is enabled from branch **main**, folder **/docs**. The student link is:

`https://chalmers06140.github.io/https-username.github.io/`

The emergency link, which needs no name or group assignment, is:

`https://chalmers06140.github.io/https-username.github.io/emergency/`

The emergency game needs no name or group assignment. Group assignment and the TA roster use the existing SVEAB seminar service at `https://sveab-rail-or-road.captivatingaisle2.chatgpt.site`, configured in `docs/config.js` and `web/public/config.js`. The student link itself does not contain “chatgpt”. The TA access code is stored as a secret in that service, not in this repository.

## Optional: move the group service to your own Cloudflare account

1. Install Node.js 22 or newer. In `worker/`, run `npm install`, then `npx wrangler login` to connect your Cloudflare account.
2. Run `npx wrangler d1 create sveab-groups`. Copy its `database_id` into `worker/wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
3. Run `npx wrangler d1 execute sveab-groups --remote --file=./schema.sql` from `worker/`.
4. Run `npx wrangler deploy` from `worker/`. Copy the Worker URL shown at the end.
5. Run `npx wrangler secret put TA_TOKEN` from `worker/`. Enter a private, strong access code for the TA roster. Do not put this code in GitHub or `config.js`.
6. Put that URL in `web/public/config.js` as `apiBase`, with no trailing slash. For example: `window.SVEAB_CONFIG = { apiBase: "https://sveab-group-service.example.workers.dev" };`
7. Build the static files with `npm install` and `npm run build` from the repository root. Commit and push the changed `web/public/config.js` and `docs/`. GitHub Pages then serves the group-enabled version.

The TA roster is at `/teacher/`. Enter the private TA access code there to move or remove students. The TA test game is at `/teacher/test/`. Students see the names or nicknames in their group, including TA changes. `worker/wrangler.toml` allows the expected `https://chalmers06140.github.io` origin. If you use a custom domain, change `ALLOWED_ORIGIN` and redeploy the Worker.

## Links and QR codes for the seminar

Use the GitHub Pages student and emergency links above in Canvas and the presentation. New QR images for both are in `seminar/`. The earlier ChatGPT-hosted links and QR codes point to the old website.

## Editing the game

Change files in `web/src/`, run `npm run build`, then commit and push the changed source and `docs/`. Do not edit the generated files in `docs/assets/` directly. The optional independent API service code is in `worker/src/index.js`. The SVEAB data and scenario assumptions are in `web/src/model.ts`. Student work remains in each browser's local storage; the shared service stores the names or nicknames, group numbers, seats and join times.
