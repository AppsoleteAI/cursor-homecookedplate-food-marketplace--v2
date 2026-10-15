# Secrets stay out of the codebase

API keys, access tokens, service-role keys, database passwords, and connection strings do not go in this repo. That includes source files, markdown, SQL, tests, commit messages, and examples.

## Where a secret goes

Live secrets belong only on the Worker `plate-marketplace-api`, under **Settings → Variables and Secrets**, or with `npx wrangler secret put <NAME> --config wrangler.worker.toml`. Paste the value at the prompt. Do not echo it. Cloudflare keeps the value. Wrangler can list the name. Neither the repo nor a chat session can read it back.

The deployed Worker reads them in `backend/hono.ts` from `c.env` first. `nodejs_compat_populate_process_env` copies those bindings into `process.env` on the Worker. Checked 12 Oct 2026: `https://plate-marketplace-api.appsolete.workers.dev/health` reports Supabase credentials present and connected.

`npm run dev:api` starts `wrangler dev --local` on port 3000. That process does not receive Worker secrets. `wrangler dev` and `wrangler dev --remote` both stop on this account with "Could not create remote preview session" (the preview token exchange returns HTTP 400). Until that preview session starts, Supabase admin, Stripe, Resend, and the metro webhook run on the deployed Worker.

`SUPABASE_ACCESS_TOKEN` is a shell variable for the Supabase CLI. See `.cursor/rules/supabase-cli.mdc`. It is not an app secret and it does not go in a file.

`backend/.env` may hold local settings that are not secrets: `PORT`, the public Supabase URL, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key is a client credential. The app is built to ship it. The same is true of a Sentry DSN in the root `.env`.

## What not to write

A live secret does not go anywhere in this project. That includes source, markdown, SQL, tests, commit messages, examples, chat, and gitignored env files.

Do not put a real value in a file for `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `METRO_WEBHOOK_SECRET`, `SUPABASE_ACCESS_TOKEN`, `DATABASE_URL`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, `ASC_API_PRIVATE_KEY`, or any string that starts with `re_`, `sk_`, `rk_`, `whsec_`, or `sbp_`. A service-role JWT is included. A Play service-account JSON and an App Store Connect `.p8` are included. The public anon key is the exception above.

Older notes in `docs/PAYMENT_SECURITY_FIX.md` and `docs/STRIPE_MARKETPLACE_SETUP.md` that say to add a key to `backend/.env` are outdated. Use the Worker secret.

Commit only `*.env.example`, and only with placeholders such as `your-service-role-key-here`.

Do not paste a secret into chat, a terminal command that is saved in the repo, or a documented `export` line. A placeholder that looks like a real token is still rejected by the secret scan when it matches a live pattern.

If a task needs a secret, name the variable and the dashboard where it belongs. Stop there.

## Incident: Supabase access token in git history

**Resolved 12 October 2026. Do not investigate this again.**

The token was deleted from the Supabase account. It is not on the Access Tokens page. That page shows last used, not created, and a deleted token does not remain as a row. The current `docs/VERIFY_SECRETS.md` has no token in it. The CLI copy on this machine is already rejected with `JWT could not be decoded`. No replacement token is required. The app does not use `SUPABASE_ACCESS_TOKEN`.

What remains is only the old text inside commit `0c41adb0`. Do not open that commit to recover the value, and do not rewrite git history for this.

On 22 January 2026 at 02:43 Eastern, commit `0c41adb0` added `docs/VERIFY_SECRETS.md`. The commit message was "Add hardware audit, device ID tracking, subscription edge function, and debugging improvements." That commit was a large debugging drop: device-id tracking, the hardware-lock trigger, a subscription edge function, and emulator notes. The new verification guide told the reader to export `SUPABASE_ACCESS_TOKEN` and then run `npx supabase secrets list`. The example used a real token, `sbp_` plus 40 hex characters, under the comment "replace with your actual token."

The value stayed in that file until 5 October 2026. Commit `6c0046b` ("Publish the local auth, marketplace, and backend updates to Pages") replaced it with a short placeholder. On 8 October 2026, commit `2dec6c7` removed the `export` line. The current guide says the token must already be set in the shell.

