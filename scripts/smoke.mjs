// API smoke test against the local file store.
import os from "node:os"; import path from "node:path"; import { mkdtempSync } from "node:fs";
process.env.TP_LOCAL = mkdtempSync(path.join(os.tmpdir(), "tp-"));
const { default: h } = await import("../netlify/functions/api.mjs");
const { ALL_ITEMS } = await import("../public/questions.js");
const call = async (method, p, body, key) => { const r = await h(new Request("http://x" + p, { method, headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) }, body: body ? JSON.stringify(body) : undefined })); return { status: r.status, body: await r.json() }; };
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok -", m); };
const t = await call("POST", "/api/teams", { name: "Test SIT" });
assert(t.status === 200 && t.body.teamId.length === 6, "create team");
const { teamId, adminKey } = t.body;
assert((await call("GET", `/api/teams/${teamId}`)).body.name === "Test SIT", "public team info");
const ans = (v) => Object.fromEntries(ALL_ITEMS.map((i) => [i.id, typeof v === "function" ? v(i) : v]));
assert((await call("POST", `/api/teams/${teamId}/responses`, { kind: "self", answers: ans(4) })).status === 403, "self needs key");
assert((await call("POST", `/api/teams/${teamId}/responses`, { kind: "self", answers: ans(4) }, adminKey)).status === 200, "self rating saved");
assert((await call("GET", `/api/teams/${teamId}/results`, null, "wrong")).status === 403, "results need key");
await call("POST", `/api/teams/${teamId}/responses`, { answers: ans((i) => i.section === "competence" ? 2 : 3), open: { o1: "We care", o2: "More feedback" } });
let r = await call("GET", `/api/teams/${teamId}/results`, null, adminKey);
assert(r.body.locked === true && r.body.n === 1, "locked under 3 responses");
await call("POST", `/api/teams/${teamId}/responses`, { answers: ans((i) => i.section === "competence" ? 2 : 4) });
await call("POST", `/api/teams/${teamId}/responses`, { answers: ans((i) => i.section === "competence" ? 1 : 3) });
r = await call("GET", `/api/teams/${teamId}/results`, null, adminKey);
assert(!r.body.locked && r.body.n === 3, "unlocked at 3");
console.log("team score", r.body.teamScore, r.body.teamBand.name, "| self", r.body.selfScore, "| nice", JSON.stringify(r.body.nice));
assert(r.body.nice.flag === true, "school-of-nice signal fires");
assert(r.body.gaps[0].gap > 0, "self vs team gaps computed");
const call2 = async (method, p, body, key) => { const r = await h(new Request("http://x" + p, { method, headers: { "content-type": "application/json", "x-admin-key": key }, body: body ? JSON.stringify(body) : undefined })); return { status: r.status, body: await r.json() }; };
let reg = await call2("GET", `/api/teams/${teamId}/register`, null, adminKey);
assert(reg.body.version === 0, "empty register");
reg = await call2("PUT", `/api/teams/${teamId}/register`, { version: 0, items: [{ decision: "Adopt action register", owner: "Gary", status: "amber" }] }, adminKey);
assert(reg.body.version === 1 && reg.body.items.length === 1, "register saved");
assert((await call2("PUT", `/api/teams/${teamId}/register`, { version: 0, items: [] }, adminKey)).status === 409, "stale register write rejected");
const nr = await call("POST", `/api/teams/${teamId}/rounds`, null, adminKey);
assert(nr.body.round === 2, "new round");
console.log("ALL PASSED");
// diagnosis + meetings
{
  const { STAGE_FEATURE_IDS } = await import("../public/stages.js");
  const t2 = await call("POST", "/api/teams", { name: "Diag test" }); const K = t2.body.adminKey, I = t2.body.teamId;
  const req2 = async (method, p, body) => { const r = await h(new Request("http://x" + p, { method, headers: { "content-type": "application/json", "x-admin-key": K }, body: body ? JSON.stringify(body) : undefined })); return { status: r.status, body: await r.json() }; };
  const rate = (f) => Object.fromEntries(STAGE_FEATURE_IDS.map((id) => [id, f(id)]));
  assert((await req2("POST", `/api/teams/${I}/diagnosis`, { rater: "GD", ratings: rate((id) => id.startsWith("s1") ? 3 : 2), evidence: { s1a: "SIT meets weekly" } })).status === 200, "diagnosis saved");
  await req2("POST", `/api/teams/${I}/diagnosis`, { rater: "LL", ratings: rate((id) => id.startsWith("s1") ? 4 : 2) });
  const d = await req2("GET", `/api/teams/${I}/diagnosis`);
  console.log("stages", JSON.stringify(d.body.stages), "focus", d.body.focus);
  assert(d.body.raters.length === 2 && d.body.focus === "s2", "diagnosis aggregates and finds focus stage");
  const m = await req2("PUT", `/api/teams/${I}/meetings`, { version: 0, items: [{ date: "2026-11-10", title: "SIT meeting", agenda: "https://docs.google.com/x", minutes: "javascript:alert(1)" }] });
  assert(m.body.version === 1 && m.body.items[0].minutes === "" && m.body.items[0].agenda.startsWith("https"), "meetings saved, unsafe link dropped");
  console.log("EXTRA PASSED");
}
