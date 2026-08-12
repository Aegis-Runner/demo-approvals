// MERIDIAN PERMITS — requests that need TWO distinct sign-offs (a multi-approver invariant).
//   INVARIANT   a request becomes "approved" only after 2 DISTINCT approvers sign off.
//               Approving with one (or the same person twice) must not approve it.
//   PERSISTENCE a new request (free-text title) must survive an independent re-read,
//               and it carries a visible app-issued reference (REQ-###).
//   FILTER      "Pending" is a SUBSET; a leak is unsound.
// Faults (healthy when DEMO_BUGS empty):
//   singlesignoff   one approval flips it to approved (invariant broken)
//   selfapprove     the same approver can sign twice and it counts as two
//   ghostrequest    creating a request confirms but never persists it
import express from "express";
import cookieParser from "cookie-parser";
import { DatabaseSync } from "node:sqlite";
const app = express();
app.use(express.urlencoded({ extended: true })); app.use(express.json()); app.use(cookieParser());
const BUGS = new Set(String(process.env.DEMO_BUGS || "").split(",").map(s => s.trim()).filter(Boolean));
const RESET_TOKEN = process.env.DEMO_RESET_TOKEN || "prm-reset";
const SESSION = "permits_session_v1";
const USERS = { "clerk@meridianpermits.test": { password: "clerk12345", name: "Permit Clerk" } };
const APPROVERS = ["Alice Reviewer", "Bob Auditor", "Cara Inspector"];
const b64 = s => Buffer.from(String(s)).toString("base64url");
const unb64 = s => { try { return Buffer.from(String(s || ""), "base64url").toString(); } catch { return ""; } };
const currentUser = req => USERS[unb64(req.cookies?.[SESSION])] ? { email: unb64(req.cookies[SESSION]) } : null;
let seq = 500; const id = () => String(++seq);
const seed = () => ({
  requests: [
    { id: "501", ref: "REQ-501", title: "Loading dock canopy", type: "structural", status: "pending", approvals: ["Alice Reviewer"] },
    { id: "502", ref: "REQ-502", title: "Cold-room electrical", type: "electrical", status: "approved", approvals: ["Alice Reviewer", "Bob Auditor"] },
  ],
});
let { requests } = seed();
const DB_PATH = process.env.DEMO_DB || "/data/app.db";
let db = null; try { db = new DatabaseSync(DB_PATH); db.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`); } catch { db = null; }
const persist = () => { if (db) try { db.prepare(`INSERT INTO kv(k,v) VALUES('s',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).run(JSON.stringify({ seq, requests })); } catch {} };
(() => { if (db) try { const r = db.prepare(`SELECT v FROM kv WHERE k='s'`).get(); if (r?.v) { const s = JSON.parse(r.v); seq = s.seq; requests = s.requests; } } catch {} })();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STYLE = `body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f7f6f4;color:#241f1a}header{background:#5a4632;color:#fff;padding:12px 20px;display:flex;gap:18px;align-items:center}header a{color:#e5d8c6;text-decoration:none;font-weight:500}header a.on{color:#fff;text-decoration:underline}main{max-width:900px;margin:22px auto;padding:0 16px}.card{background:#fff;border:1px solid #e6e0d8;border-radius:8px;padding:18px;margin-bottom:18px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #f0ece6}th{font-size:12px;text-transform:uppercase;color:#7a6b58}label{display:block;margin:10px 0 4px;font-size:13px;color:#52463a}input,select{padding:8px 10px;border:1px solid #d3c9bd;border-radius:6px;min-width:230px;font-size:14px}button,.btn{background:#5a4632;color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block}.pill{display:inline-block;padding:2px 9px;border-radius:12px;font-size:12px;background:#efe9e1}.pill.approved{background:#e4f6ea;color:#1c6b39}.pill.pending{background:#fff4e0;color:#8a5a12}.muted{color:#6b7a89;font-size:13px}.err{background:#fdecea;border:1px solid #f5b3ab;color:#8a1c10;padding:9px 12px;border-radius:6px;margin-bottom:12px}`;
const layout = (a, t, b) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t)} · Meridian Permits</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLE}</style></head><body><header><strong>Meridian Permits</strong>${[["/", "Dashboard"], ["/requests", "Requests"], ["/requests?filter=pending", "Pending"], ["/requests/new", "New request"]].map(([h, l]) => `<a href="${h}" class="${a === h ? "on" : ""}">${l}</a>`).join("")}<span style="margin-left:auto"><a href="/logout">Sign out</a></span></header><main><h1>${esc(t)}</h1>${b}</main></body></html>`;
app.get("/healthz", (_q, r) => r.type("text").send("ok"));
app.use((req, res, next) => { if (["/login", "/healthz", "/api/reset"].includes(req.path)) return next(); if (!currentUser(req)) return res.redirect("/login"); next(); });
app.get("/login", (_q, res) => res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Sign in · Meridian Permits</title><style>${STYLE}</style></head><body><main><div class="card" style="max-width:380px;margin:60px auto"><h1>Sign in</h1><form method="post" action="/login"><label for="email">Email</label><input id="email" name="email" type="email" value="clerk@meridianpermits.test"><label for="password">Password</label><input id="password" name="password" type="password" value="clerk12345"><p><button>Sign in</button></p></form></div></main></body></html>`));
app.post("/login", (req, res) => { const u = USERS[String(req.body.email || "").toLowerCase()]; if (!u || u.password !== req.body.password) return res.status(401).send(`<p class="err">Wrong email or password.</p><a href="/login">Back</a>`); res.cookie(SESSION, b64(String(req.body.email).toLowerCase()), { httpOnly: true }); res.redirect("/"); });
app.get("/logout", (_q, res) => { res.clearCookie(SESSION); res.redirect("/login"); });
app.get("/", (_q, res) => res.send(layout("/", "Dashboard", `<div class="card"><table><tr><th>Requests</th><td>${requests.length}</td></tr><tr><th>Pending</th><td>${requests.filter(r => r.status === "pending").length}</td></tr><tr><th>Approved</th><td>${requests.filter(r => r.status === "approved").length}</td></tr></table></div><div class="card"><a class="btn" href="/requests/new">New request</a></div>`)));
app.get("/requests", (req, res) => {
  const filter = String(req.query.filter || "");
  const rows = filter === "pending" ? requests.filter(r => r.status === "pending") : requests;
  res.send(layout(filter === "pending" ? "/requests?filter=pending" : "/requests", filter === "pending" ? "Pending requests" : "Requests",
    `<div class="card"><table><tr><th>Ref</th><th>Title</th><th>Type</th><th>Approvals</th><th>Status</th></tr>${rows.map(r => `<tr><td><a href="/requests/${r.id}">${esc(r.ref)}</a></td><td>${esc(r.title)}</td><td>${esc(r.type)}</td><td>${r.approvals.length}/2</td><td><span class="pill ${r.status}">${r.status}</span></td></tr>`).join("") || `<tr><td colspan="5" class="muted">None.</td></tr>`}</table></div>`));
});
app.get("/requests/new", (_q, res) => res.send(layout("/requests/new", "New request", `<div class="card"><form method="post" action="/requests/new"><label for="title">Title</label><input id="title" name="title" value="New permit request"><label for="type">Type</label><select id="type" name="type"><option>structural</option><option>electrical</option><option>plumbing</option></select><p><button>Submit request</button></p></form></div>`)));
app.post("/requests/new", (req, res) => {
  const title = String(req.body.title || "").trim() || "Untitled";
  const rid = id(); const rec = { id: rid, ref: "REQ-" + rid, title, type: String(req.body.type || "structural"), status: "pending", approvals: [] };
  if (!BUGS.has("ghostrequest")) { requests.push(rec); persist(); }
  res.redirect(`/requests/${rid}`);
});
app.get("/requests/:id", (req, res) => {
  const r = requests.find(x => x.id === req.params.id);
  if (!r) return res.status(404).send(layout("/requests", "Not found", `<div class="card">No such request.</div>`));
  const form = r.status === "approved" ? `<span class="muted">Approved.</span>` : `<form method="post" action="/requests/${r.id}/approve"><label for="approver">Approver</label><select id="approver" name="approver">${APPROVERS.map(a => `<option>${a}</option>`).join("")}</select><p><button>Add sign-off</button></p></form>`;
  res.send(layout("/requests", r.title, `<div class="card"><table><tr><th>Reference</th><td><strong>${esc(r.ref)}</strong></td></tr><tr><th>Title</th><td>${esc(r.title)}</td></tr><tr><th>Type</th><td>${esc(r.type)}</td></tr><tr><th>Status</th><td><span class="pill ${r.status}">${r.status}</span></td></tr><tr><th>Sign-offs</th><td>${r.approvals.map(esc).join(", ") || "—"} (${r.approvals.length}/2)</td></tr></table></div><div class="card">${form}</div>`));
});
app.post("/requests/:id/approve", (req, res) => {
  const r = requests.find(x => x.id === req.params.id);
  if (!r) return res.status(404).send("no");
  const who = String(req.body.approver || "").trim();
  if (r.status !== "approved" && who) {
    // SELFAPPROVE: allow the same approver to count twice. Healthy: distinct approvers only.
    if (BUGS.has("selfapprove") || !r.approvals.includes(who)) r.approvals.push(who);
    // SINGLESIGNOFF: approve after 1. Healthy: require 2 distinct sign-offs.
    if (r.approvals.length >= (BUGS.has("singlesignoff") ? 1 : 2)) r.status = "approved";
    persist();
  }
  res.redirect(`/requests/${r.id}`);
});
app.post("/api/reset", (req, res) => { if (req.get("X-Reset-Token") !== RESET_TOKEN) return res.status(403).json({ error: "bad token" }); seq = 500; ({ requests } = seed()); persist(); res.json({ ok: true, counts: { requests: requests.length } }); });
app.listen(Number(process.env.PORT || 3000), () => console.log(`meridian-permits on ${process.env.PORT || 3000}; bugs=${[...BUGS].join(",") || "none"}`));
