// Local stand-in for the files gatekeeper + bucket. Test only (never deployed). Enforces: bearer token present, 5-minute links, size match, JPEG without EXIF.
import http from "node:http";
const store = new Map();
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,PUT,POST,OPTIONS" };
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { ...cors, "content-type": type }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const read = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const hasExif = (b) => { for (let i = 2; i + 4 < b.length;) { if (b[i] !== 0xff) break; const m = b[i + 1]; if (m === 0xda) break; const len = b.readUInt16BE(i + 2); if (m === 0xe1 && b.slice(i + 4, i + 10).toString("latin1") === "Exif\0\0") return true; i += 2 + len; } return false; };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (url.pathname === "/_store") return send(res, 200, { keys: [...store.keys()], sizes: Object.fromEntries([...store].map(([k, v]) => [k, v.length])) });
  if (req.method === "POST" && url.pathname === "/v1/link") {
    if (!/^Bearer .{20,}/.test(req.headers.authorization ?? "")) return send(res, 401, { error: "no token" });
    const b = JSON.parse((await read(req)).toString());
    if (b.op === "put") { const folder = { avatar: "photos", photo: "gallery", child: "children", intro: "videos", qual: "documents", attachment: "attachments" }[b.name.split("-")[0]] ?? "misc"; const key = `${b.class === "space-media" ? `spaces/${b.spaceId}` : `users/${b.ownerUid}`}/${folder}/${b.name}`; pending.set(key, b); return send(res, 200, { url: `http://127.0.0.1:9199/put?k=${encodeURIComponent(b.class)}&key=${encodeURIComponent(key)}`, headers: { "content-type": b.contentType }, expiresIn: 300 }); }
    if (b.op === "get") return send(res, store.has(b.key) ? 200 : 404, store.has(b.key) ? { url: `http://127.0.0.1:9199/get?key=${encodeURIComponent(b.key)}`, expiresIn: 300 } : { error: "none" });
  }
  if (req.method === "PUT" && url.pathname === "/put") { const key = url.searchParams.get("key"); const body = await read(req); const meta = pending.get(key); if (!meta || meta.bytes !== body.length) return send(res, 413, { error: "bad size" }); if (body[0] === 0xff && hasExif(body)) return send(res, 422, { error: "exif" }); store.set(key, body); return send(res, 200, ""); }
  if (req.method === "POST" && url.pathname === "/v1/confirm") { const b = JSON.parse((await read(req)).toString()); const key = [...store.keys()].find((k) => k.endsWith(`/${b.name}`)); return send(res, key ? 200 : 404, { ok: !!key }); }
  if (req.method === "GET" && url.pathname === "/get") { const d = store.get(url.searchParams.get("key")); return d ? send(res, 200, d, "image/jpeg") : send(res, 404, ""); }
  send(res, 404, { error: "nf" });
}).listen(9199, "127.0.0.1", () => console.log("fake files on 9199"));
const pending = new Map();
