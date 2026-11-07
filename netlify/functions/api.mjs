// Team Pulse API (Netlify Function, v2 format).
// Storage: Netlify Blobs. No names, emails or IP addresses are stored.
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ALL_ITEMS, TEAM_ITEM_IDS, TRUST_SECTIONS, SECTIONS, OPEN_QUESTIONS, LEADER_QUESTIONS, FREQ_QUESTIONS, FREQ_OPTIONS, bandFor, MIN_RESPONSES,
} from "../../public/questions.js";
import { STAGE_FEATURE_IDS, STAGES, stageBand } from "../../public/stages.js";

// ---------- storage (Netlify Blobs, or local files for development) ----------
function store() {
  if (process.env.TP_LOCAL) return localStore(process.env.TP_LOCAL);
  return getStore({ name: "teampulse", consistency: "strong" });
}

function localStore(dir) {
  const file = (k) => path.join(dir, encodeURIComponent(k));
  return {
    async get(k, opts) {
      try { const t = await fs.readFile(file(k), "utf8"); return opts?.type === "json" ? JSON.parse(t) : t; }
      catch { return null; }
    },
    async setJSON(k, v) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file(k), JSON.stringify(v)); },
    async list({ prefix }) {
      await fs.mkdir(dir, { recursive: true });
      const names = (await fs.readdir(dir)).map(decodeURIComponent).filter((n) => n.startsWith(prefix));
      return { blobs: names.map((key) => ({ key })) };
    },
  };
}

// ---------- helpers ----------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const err = (msg, status = 400) => json({ error: msg }, status);
const hash = (s) => createHash("sha256").update(String(s)).digest("hex");
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const newTeamId = () => Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
const VALID_IDS = new Set(ALL_ITEMS.map((i) => i.id));
const OPEN_IDS = new Set([...OPEN_QUESTIONS, ...LEADER_QUESTIONS].map((q) => q.id));
const FREQ_IDS = new Set(FREQ_QUESTIONS.map((q) => q.id));

async function readBody(req) {
  const text = await req.text();
  if (text.length > 20000) throw new Error("Request too large");
  try { return JSON.parse(text || "{}"); } catch { throw new Error("Invalid JSON"); }
}

function cleanAnswers(raw) {
  const answers = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const n = Number(v);
    if (VALID_IDS.has(k) && Number.isInteger(n) && n >= 1 && n <= 4) answers[k] = n;
  }
  return answers;
}

function cleanFreq(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const n = Number(v);
    if (FREQ_IDS.has(k) && Number.isInteger(n) && n >= 1 && n <= FREQ_OPTIONS.length) out[k] = n;
  }
  return out;
}

function cleanOpen(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (OPEN_IDS.has(k) && typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 600);
  }
  return out;
}

async function loadTeam(s, id) {
  if (!/^[A-Z2-9]{6}$/.test(id || "")) return null;
  return s.get(`teams/${id}`, { type: "json" });
}

function isAdmin(team, req) {
  const key = req.headers.get("x-admin-key") || "";
  return key && team && hash(key) === team.keyHash;
}

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// ---------- aggregation ----------
export function aggregate(responses, self) {
  const n = responses.length;
  const items = {};
  for (const it of ALL_ITEMS) {
    const vals = responses.map((r) => r.answers[it.id]).filter((v) => v != null);
    items[it.id] = {
      mean: round2(mean(vals)),
      n: vals.length,
      dist: [1, 2, 3, 4].map((v) => vals.filter((x) => x === v).length),
      self: self?.answers?.[it.id] ?? null,
    };
  }
  const sections = {};
  for (const s of SECTIONS) {
    const ms = s.items.map((i) => items[i.id].mean).filter((v) => v != null);
    const ss = s.items.map((i) => items[i.id].self).filter((v) => v != null);
    sections[s.id] = { mean: round2(mean(ms)), self: round2(mean(ss)) };
  }
  const teamScore = TEAM_ITEM_IDS.every((id) => items[id].mean != null)
    ? round2(TEAM_ITEM_IDS.reduce((a, id) => a + items[id].mean, 0)) : null;
  const selfScore = self && TEAM_ITEM_IDS.every((id) => items[id].self != null)
    ? TEAM_ITEM_IDS.reduce((a, id) => a + items[id].self, 0) : null;

  const legs = TRUST_SECTIONS.map((s) => ({ id: s.id, leg: s.leg, mean: sections[s.id].mean, self: sections[s.id].self }));
  const L = Object.fromEntries(legs.map((l) => [l.id, l.mean]));
  let nice = null;
  if (L.respect != null && L.regard != null && L.competence != null) {
    const warm = (L.respect + L.regard) / 2;
    const gap = round2(warm - L.competence);
    nice = { warm: round2(warm), competence: L.competence, gap, flag: warm >= 2.75 && gap >= 0.4 };
  }

  const gaps = ALL_ITEMS
    .filter((it) => items[it.id].mean != null && items[it.id].self != null)
    .map((it) => ({ id: it.id, text: it.text, self: items[it.id].self, team: items[it.id].mean, gap: round2(items[it.id].self - items[it.id].mean) }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const freq = {};
  for (const q of FREQ_QUESTIONS) {
    const vals = responses.map((r) => r.freq?.[q.id]).filter((v) => v != null);
    freq[q.id] = { n: vals.length, dist: FREQ_OPTIONS.map((o) => vals.filter((x) => x === o.value).length), self: self?.freq?.[q.id] ?? null };
  }

  const comments = {};
  for (const q of [...OPEN_QUESTIONS, ...LEADER_QUESTIONS]) comments[q.id] = shuffle(responses.map((r) => r.open?.[q.id]).filter(Boolean));

  return {
    n, items, sections, legs, nice, gaps, comments, freq,
    teamScore, teamBand: teamScore != null ? bandFor(teamScore) : null,
    selfScore, selfBand: selfScore != null ? bandFor(selfScore) : null,
  };
}

// ---------- handler ----------
export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const s = store();
  try {
    // POST /api/teams  -> create a team
    if (req.method === "POST" && parts.length === 1 && parts[0] === "teams") {
      const body = await readBody(req);
      const name = String(body.name || "").trim().slice(0, 80);
      if (!name) return err("Please give your team a name.");
      let id;
      for (let i = 0; i < 5; i++) { id = newTeamId(); if (!(await s.get(`teams/${id}`))) break; }
      const adminKey = randomBytes(18).toString("base64url");
      const team = { id, name, keyHash: hash(adminKey), round: 1, rounds: [{ n: 1, started: new Date().toISOString() }], created: new Date().toISOString() };
      await s.setJSON(`teams/${id}`, team);
      return json({ teamId: id, adminKey, name });
    }

    if (parts[0] !== "teams" || !parts[1]) return err("Not found", 404);
    const team = await loadTeam(s, parts[1].toUpperCase());
    if (!team) return err("We couldn't find that team. Check the link or code.", 404);
    const id = team.id;

    // GET /api/teams/:id  -> public team info
    if (req.method === "GET" && parts.length === 2) {
      return json({ id, name: team.name, round: team.round });
    }

    // POST /api/teams/:id/responses
    if (req.method === "POST" && parts[2] === "responses") {
      const body = await readBody(req);
      const answers = cleanAnswers(body.answers);
      if (Object.keys(answers).length < Math.ceil(ALL_ITEMS.length * 0.8))
        return err("Please answer at least most of the statements before submitting.");
      const record = { answers, freq: cleanFreq(body.freq), open: cleanOpen(body.open), at: new Date().toISOString().slice(0, 10) };
      if (body.kind === "self") {
        delete record.open.o3; delete record.open.o4;
        if (!isAdmin(team, req)) return err("Only the team leader can submit the self-rating.", 403);
        await s.setJSON(`self/${id}/${team.round}`, record);
      } else {
        await s.setJSON(`resp/${id}/${team.round}/${randomUUID()}`, record);
      }
      return json({ ok: true });
    }

    // Admin-only below
    if (!isAdmin(team, req)) return err("This dashboard link isn't valid.", 403);

    // GET /api/teams/:id/results?round=N
    if (req.method === "GET" && parts[2] === "results") {
      const roundN = Number(url.searchParams.get("round")) || team.round;
      const { blobs } = await s.list({ prefix: `resp/${id}/${roundN}/` });
      const responses = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
      const self = await s.get(`self/${id}/${roundN}`, { type: "json" });
      const agg = aggregate(responses, self);
      const locked = agg.n < MIN_RESPONSES;
      let previous = null;
      if (roundN > 1) {
        const prev = await s.list({ prefix: `resp/${id}/${roundN - 1}/` });
        const pr = (await Promise.all(prev.blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
        if (pr.length >= MIN_RESPONSES) {
          const pa = aggregate(pr, null);
          previous = { n: pa.n, teamScore: pa.teamScore, sections: pa.sections, legs: pa.legs };
        }
      }
      if (locked) {
        return json({ team: { id, name: team.name, round: team.round, rounds: team.rounds }, round: roundN, n: agg.n, locked: true, min: MIN_RESPONSES, hasSelf: !!self, selfScore: agg.selfScore, selfBand: agg.selfBand, sections: Object.fromEntries(Object.entries(agg.sections).map(([k, v]) => [k, { self: v.self }])) });
      }
      return json({ team: { id, name: team.name, round: team.round, rounds: team.rounds }, round: roundN, locked: false, min: MIN_RESPONSES, hasSelf: !!self, previous, ...agg });
    }

    // GET /api/teams/:id/register -> the team's action register
    if (req.method === "GET" && parts[2] === "register") {
      const reg = (await s.get(`register/${id}`, { type: "json" })) || { version: 0, items: [] };
      return json(reg);
    }

    // PUT /api/teams/:id/register -> replace the register (optimistic version check)
    if (req.method === "PUT" && parts[2] === "register") {
      const body = await readBody(req);
      const current = (await s.get(`register/${id}`, { type: "json" })) || { version: 0, items: [] };
      if (Number(body.version) !== current.version)
        return json({ error: "Someone else updated the register. Reloading the latest version.", latest: current }, 409);
      const STATUS = new Set(["green", "amber", "red", "done"]);
      const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 200).map((it) => ({
        id: str(it.id, 40) || randomUUID(),
        date: str(it.date, 10),
        decision: str(it.decision, 400),
        action: str(it.action, 400),
        owner: str(it.owner, 80),
        due: str(it.due, 10),
        status: STATUS.has(it.status) ? it.status : "green",
        note: str(it.note, 400),
        linked: str(it.linked, 30),
        meeting: str(it.meeting, 40),
      })).filter((it) => it.decision || it.action);
      const next = { version: current.version + 1, items, updated: new Date().toISOString() };
      await s.setJSON(`register/${id}`, next);
      return json(next);
    }

    // ---- Stage-of-improvement diagnosis (leadership raters) ----
    if (parts[2] === "diagnosis") {
      const roundN = Number(url.searchParams.get("round")) || team.round;
      if (req.method === "POST") {
        const body = await readBody(req);
        const ratings = {};
        for (const [k, v] of Object.entries(body.ratings || {})) {
          const n = Number(v);
          if (STAGE_FEATURE_IDS.includes(k) && Number.isInteger(n) && n >= 1 && n <= 4) ratings[k] = n;
        }
        if (Object.keys(ratings).length < STAGE_FEATURE_IDS.length) return err("Please rate every feature.");
        const evidence = {};
        for (const [k, v] of Object.entries(body.evidence || {})) if (STAGE_FEATURE_IDS.includes(k) && typeof v === "string" && v.trim()) evidence[k] = v.trim().slice(0, 500);
        const rater = String(body.rater || "").trim().slice(0, 40) || "Anonymous";
        await s.setJSON(`diag/${id}/${team.round}/${randomUUID()}`, { rater, ratings, evidence, at: new Date().toISOString().slice(0, 10) });
        return json({ ok: true });
      }
      if (req.method === "GET") {
        const { blobs } = await s.list({ prefix: `diag/${id}/${roundN}/` });
        const raters = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
        const features = {};
        for (const fid of STAGE_FEATURE_IDS) {
          const vals = raters.map((r) => r.ratings[fid]).filter((v) => v != null);
          features[fid] = { mean: round2(mean(vals)), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null,
            evidence: raters.filter((r) => r.evidence?.[fid]).map((r) => ({ rater: r.rater, text: r.evidence[fid] })) };
        }
        const stages = STAGES.map((st) => {
          const total = raters.length ? round2(st.features.reduce((a, f) => a + (features[f.id].mean || 0), 0)) : null;
          return { id: st.id, total, band: stageBand(total) };
        });
        const focus = stages.find((x) => x.total != null && x.total < 13) || (raters.length ? stages[stages.length - 1] : null);
        return json({ round: roundN, raters: raters.map((r) => ({ rater: r.rater, at: r.at })), features, stages, focus: focus?.id || null });
      }
    }

    // ---- Meetings (links to agendas and minutes kept in Google Docs etc.) ----
    if (parts[2] === "meetings") {
      const current = (await s.get(`meetings/${id}`, { type: "json" })) || { version: 0, items: [] };
      if (req.method === "GET") return json(current);
      if (req.method === "PUT") {
        const body = await readBody(req);
        if (Number(body.version) !== current.version)
          return json({ error: "Someone else updated meetings. Reloading the latest version.", latest: current }, 409);
        const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
        const okUrl = (u) => { const v = str(u, 600); return /^https:\/\//i.test(v) ? v : ""; };
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, 300).map((m) => ({
          id: str(m.id, 40) || randomUUID(), date: str(m.date, 10), title: str(m.title, 120),
          agenda: okUrl(m.agenda), minutes: okUrl(m.minutes), other: okUrl(m.other), note: str(m.note, 300),
        })).filter((m) => m.title || m.date);
        const next = { version: current.version + 1, items, updated: new Date().toISOString() };
        await s.setJSON(`meetings/${id}`, next);
        return json(next);
      }
    }

    // POST /api/teams/:id/rounds -> start a new round (retake)
    if (req.method === "POST" && parts[2] === "rounds") {
      team.round += 1;
      team.rounds.push({ n: team.round, started: new Date().toISOString() });
      await s.setJSON(`teams/${id}`, team);
      return json({ round: team.round });
    }

    return err("Not found", 404);
  } catch (e) {
    return err(e.message || "Something went wrong", 500);
  }
};

export const config = { path: "/api/*" };
