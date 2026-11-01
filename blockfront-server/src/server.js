import http from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 2567);
const MAX_PLAYERS = Math.min(12, Math.max(2, Number(process.env.MAX_PLAYERS || 8)));
const TICK_RATE = 20;
const rooms = new Map();
const weapons = {
  rifle: { damage: 25, range: 55, cooldown: 180, magazine: 30, reserve: 120 },
  burst: { damage: 19, range: 48, cooldown: 260, magazine: 24, reserve: 96 },
  scatter: { damage: 12, range: 19, cooldown: 650, magazine: 8, reserve: 48 },
  sidearm: { damage: 34, range: 42, cooldown: 330, magazine: 12, reserve: 72 }
};

const code = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
};
const safeName = value => String(value || "Player").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 18) || "Player";
const spawn = index => {
  const spots = [[-10, 1.7, 10], [10, 1.7, -10], [10, 1.7, 10], [-10, 1.7, -10], [0, 1.7, 16], [0, 1.7, -16], [-18, 1.7, 0], [18, 1.7, 0]];
  return spots[index % spots.length];
};
function publicPlayer(p) {
  return { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.health, score: p.score, deaths: p.deaths, weapon: p.weapon, ammo: p.ammo };
}
function send(ws, type, data = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
}
function broadcast(room, type, data = {}, except = null) {
  for (const p of room.players.values()) if (p.ws !== except) send(p.ws, type, data);
}
function snapshot(room) {
  return { roomId: room.id, players: [...room.players.values()].map(publicPlayer), limit: room.limit, hostId: room.hostId };
}
function createRoom({ name, limit }) {
  let id;
  do id = code(); while (rooms.has(id));
  const room = { id, name: safeName(name), limit: Math.min(MAX_PLAYERS, Math.max(2, Number(limit) || 8)), hostId: null, players: new Map(), createdAt: Date.now(), lastEmptyAt: null };
  rooms.set(id, room);
  return room;
}
function joinRoom(room, ws, name) {
  if (room.players.size >= room.limit) return null;
  const id = randomUUID();
  const [x, y, z] = spawn(room.players.size);
  const player = { id, name: safeName(name), ws, x, y, z, yaw: 0, pitch: 0, health: 100, score: 0, deaths: 0, weapon: "rifle", ammo: { rifle: 30, burst: 24, scatter: 8, sidearm: 12 }, reserve: { rifle: 120, burst: 96, scatter: 48, sidearm: 72 }, lastShot: 0, lastInput: 0 };
  room.players.set(id, player);
  if (!room.hostId) room.hostId = id;
  return player;
}
function respawn(player) {
  const [x, y, z] = spawn(randomInt(8));
  Object.assign(player, { x, y, z, yaw: 0, pitch: 0, health: 100 });
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function lineOfSightHit(shooter, target, yaw, pitch, range) {
  const dx = target.x - shooter.x, dy = target.y - shooter.y, dz = target.z - shooter.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > range || d < 0.1) return false;
  const targetYaw = Math.atan2(-dx, -dz);
  const yawDiff = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
  const targetPitch = Math.atan2(dy, Math.hypot(dx, dz));
  const pitchDiff = targetPitch - pitch;
  const tolerance = d < 8 ? 0.13 : Math.min(0.09, 0.7 / d);
  return Math.abs(yawDiff) < tolerance && Math.abs(pitchDiff) < tolerance * 1.4;
}
function handleMessage(room, player, msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "input") {
    const now = Date.now();
    if (now - player.lastInput < 20) return;
    player.lastInput = now;
    const x = Number(msg.x), z = Number(msg.z), yaw = Number(msg.yaw), pitch = Number(msg.pitch);
    if (![x, z, yaw, pitch].every(Number.isFinite)) return;
    const len = Math.hypot(x, z), scale = len > 1 ? 1 / len : 1;
    const speed = 5.2 * 0.05;
    player.x = Math.max(-27, Math.min(27, player.x + x * scale * speed));
    player.z = Math.max(-27, Math.min(27, player.z + z * scale * speed));
    player.yaw = Math.max(-Math.PI * 4, Math.min(Math.PI * 4, yaw));
    player.pitch = Math.max(-1.4, Math.min(1.4, pitch));
    return;
  }
  if (msg.type === "shoot") {
    const now = Date.now(), weapon = weapons[player.weapon];
    if (now - player.lastShot < weapon.cooldown || player.ammo[player.weapon] <= 0) return;
    player.lastShot = now;
    player.ammo[player.weapon]--;
    const target = [...room.players.values()].find(other => other.id !== player.id && other.health > 0 && lineOfSightHit(player, other, player.yaw, player.pitch, weapon.range));
    if (target) {
      target.health = Math.max(0, target.health - weapon.damage);
      if (target.health === 0) {
        player.score++;
        target.deaths++;
        setTimeout(() => { if (room.players.has(target.id)) { respawn(target); broadcast(room, "respawn", { player: publicPlayer(target) }); } }, 1800);
      }
      broadcast(room, "hit", { shooterId: player.id, target: publicPlayer(target), shooterScore: player.score });
    }
    send(player.ws, "ammo", { ammo: player.ammo, reserve: player.reserve, score: player.score });
    return;
  }
  if (msg.type === "reload") {
    const w = weapons[player.weapon], needed = w.magazine - player.ammo[player.weapon], amount = Math.min(needed, player.reserve[player.weapon]);
    player.ammo[player.weapon] += amount;
    player.reserve[player.weapon] -= amount;
    send(player.ws, "ammo", { ammo: player.ammo, reserve: player.reserve, score: player.score });
    return;
  }
  if (msg.type === "weapon" && Object.hasOwn(weapons, msg.weapon)) {
    player.weapon = msg.weapon;
    send(player.ws, "ammo", { ammo: player.ammo, reserve: player.reserve, score: player.score, weapon: player.weapon });
  }
}
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: true, service: "blockfront-server", rooms: rooms.size })); }
  if (url.pathname === "/rooms" && req.method === "GET") {
    const list = [...rooms.values()].filter(r => r.players.size > 0).map(r => ({ id: r.id, name: r.name, players: r.players.size, limit: r.limit }));
    res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(list));
  }
  if (url.pathname === "/rooms" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 2048) req.destroy(); });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}"), room = createRoom(data);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ roomId: room.id, name: room.name, limit: room.limit }));
      } catch { res.writeHead(400); res.end("Invalid room request"); }
    });
    return;
  }
  res.writeHead(404); res.end("Not found");
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/play") { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const room = rooms.get((url.searchParams.get("room") || "").toUpperCase());
  if (!room) { send(ws, "error", { message: "Room not found. Check the code and try again." }); return ws.close(1008); }
  const player = joinRoom(room, ws, url.searchParams.get("name"));
  if (!player) { send(ws, "error", { message: "This room is full." }); return ws.close(1008); }
  send(ws, "welcome", { selfId: player.id, snapshot: snapshot(room) });
  broadcast(room, "state", snapshot(room), ws);
  ws.on("message", raw => {
    try { handleMessage(room, player, JSON.parse(raw.toString())); } catch { send(ws, "error", { message: "Invalid game message." }); }
  });
  ws.on("close", () => {
    room.players.delete(player.id);
    if (room.hostId === player.id) room.hostId = room.players.keys().next().value || null;
    broadcast(room, "left", { playerId: player.id, snapshot: snapshot(room) });
    if (room.players.size === 0) room.lastEmptyAt = Date.now();
  });
  ws.on("error", () => {});
});
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.players.size === 0 && room.lastEmptyAt && now - room.lastEmptyAt > 10 * 60_000) rooms.delete(id);
    else if (room.players.size) broadcast(room, "state", snapshot(room));
  }
}, 1000 / TICK_RATE);
server.listen(PORT, "0.0.0.0", () => console.log(`Blockfront server listening on ${PORT}`));
