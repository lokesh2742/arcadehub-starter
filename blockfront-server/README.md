# ArcadeHub: Blockfront server

This is a separate Node.js WebSocket service. GitHub Pages serves the game client; it cannot run this process.

## Run locally

```bash
cd blockfront-server
npm install
npm run check
npm start
```

The server listens on port 2567 (or `PORT`). Endpoints:

- `GET /health` — health check
- `GET /rooms` — active room list
- `POST /rooms` — create a private room, JSON body such as `{"name":"My match","limit":8}`
- `wss://HOST/play?room=ROOMCODE&name=PLAYERNAME` — join a room

## Hosting

Deploy this directory as a Node.js service on a host that supports persistent WebSocket connections. Set `PORT` if required and set `ALLOWED_ORIGIN` to the exact ArcadeHub Pages origin. Configure the client to use the resulting HTTPS/WSS service URL. Do not put service credentials in browser code.

## Current server scope

- Private six-character room codes and configurable room capacity (2–12).
- Server-owned player positions, health, score, ammo, weapon cooldowns and respawns.
- 20 Hz state snapshots, basic server-side hit validation and room cleanup.
- Health endpoint for deployment checks.

## Before public release

This is an early multiplayer foundation, not a hardened competitive service. Add Firebase ID-token verification in the WebSocket handshake and room creation endpoint, rate limits, persistent moderation/reporting, map collision and line-of-sight checks, lag compensation, anti-cheat telemetry, reconnect grace periods, and load testing. The client still needs its room lobby and network-state integration; the service must be deployed before online play can be tested.
