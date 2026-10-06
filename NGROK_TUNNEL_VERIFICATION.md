# Ngrok Tunnel Verification Protocol

## What Happened

This machine runs **multiple Expo apps** all under the same `appsoleteai` ngrok account.

The ngrok local API (`http://localhost:4040/api/tunnels`) returns whichever tunnel is currently active on the machine. It has no awareness of *which* Metro session or *which* app you intend. When two or more Expo projects are open — even in separate terminals — querying that endpoint and copying the resulting URL can silently hand you the tunnel belonging to a completely different app.

In this incident:
- Two Expo apps were running simultaneously under the `appsoleteai` ngrok account
- The ngrok API at port 4040 returned a tunnel URL for the wrong app
- That URL was shared without first verifying it served this project's bundle
- The wrong app loaded on the receiving device

---

## Root Cause

| Factor | Detail |
|---|---|
| Shared ngrok account | All Expo tunnels on this machine are authenticated as `appsoleteai` |
| Ambiguous ngrok API | `GET http://localhost:4040/api/tunnels` returns one active tunnel, not the one for *this* app |
| No verification step | No protocol existed to confirm the URL served the correct bundle before sharing |

---

## Correct Protocol — Always Verify the URL First

### Step 1: Read the URL from Metro terminal output (source of truth)

After running `bunx expo start --tunnel`, wait for the Metro terminal to print:

```
Tunnel ready.
https://<hash>-appsoleteai-8081.exp.direct
```

**This line is emitted by this specific Metro session.** It cannot refer to another app. Copy the URL from here — not from any API.

### Step 2: Verify the URL serves the correct bundle

Before sharing the URL, run a quick status check:

```bash
curl -s "https://<hash>-appsoleteai-8081.exp.direct/status"
```

Expected response:

```json
{"status":"packager-status:running"}
```

If you get a different response, or the URL resolves to a different app's bundle, do not share it.

### Step 3: Confirm only one Metro session is active for this project

```bash
lsof -i :8081
```

There should be exactly one process bound to port 8081. If multiple are listed, identify which one belongs to this project before sharing any tunnel URL.

---

## What NOT to Do

```bash
# WRONG — this returns whichever tunnel is active on the machine,
# not necessarily the one for this app
curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
```

The ngrok local API is a machine-wide endpoint. It is not scoped to a project, a directory, or a Metro session. Never treat its output as the authoritative URL for this app.

---

## Pre-Share Checklist

Before sharing a tunnel URL with anyone:

- [ ] URL was copied from the Metro terminal `Tunnel ready` line, not from the ngrok API
- [ ] `curl -s https://<url>/status` returns `{"status":"packager-status:running"}`
- [ ] `lsof -i :8081` shows exactly one Metro process and it belongs to this project
- [ ] Only one Expo app is running in tunnel mode on this machine, OR you have confirmed which tunnel belongs to which app

---

## If Multiple Expo Apps Must Run Simultaneously

If you genuinely need two or more Expo apps tunnelled at the same time:

1. Use a different port for each Metro instance: `bunx expo start --tunnel --port 8082`
2. Each Metro terminal will print its own distinct `Tunnel ready` URL — read from the correct terminal
3. The status check (`/status`) is still the definitive confirmation before sharing

---

## Related Documentation

- `METRO_CONNECTION_FIX.md` — Metro bundler connectivity troubleshooting
- `RORK_STABILITY_CHECKLIST.md` — Navigation and deployment stability checklist
