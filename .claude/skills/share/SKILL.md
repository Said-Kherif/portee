---
name: share
description: Build Portée, serve dist on port 4173 and open an ngrok tunnel, then give the public https URL to open on the phone. Use when the user wants to test on their phone, asks for the ngrok URL, or says "partage" / "sur mon tel".
---

Expose the current build of Portée on the phone through ngrok.

## Steps

1. `source ~/.nvm/nvm.sh && nvm use` in every shell command.
2. `npm run build`. Stop and report if it fails.
3. If nothing answers on `http://localhost:4173/`, start `npx vite preview --port 4173 --strictPort` in the background and wait for a 200.
4. If `http://127.0.0.1:4040/api/tunnels` already lists a tunnel, reuse its `public_url`. Otherwise start `ngrok http 4173 --log stdout --log-format json` in the background and poll that endpoint until a `public_url` appears.
5. Verify end to end: `curl -H "ngrok-skip-browser-warning: 1" <public_url>/` must return 200 and the HTML title `Portée`. A 403 with "Blocked request" means the host is missing from `preview.allowedHosts` in `vite.config.ts` (the config already allows `.ngrok-free.app`). An ngrok authentication error means the token is missing: ask the user to run `! ngrok config add-authtoken <token>` and retry.
6. Reply with the URL on its own line, then three short reminders: first visit shows an ngrok interstitial, a code change only needs `npm run build` while the tunnel stays up, the URL changes when ngrok restarts unless a static domain is reserved.

Both processes stay in the background for the rest of the session. Do not stop them unless asked.
