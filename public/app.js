import { SCALE, SECTIONS, OPEN_QUESTIONS, LEADER_QUESTIONS, FREQ_QUESTIONS, FREQ_OPTIONS, MIN_RESPONSES } from "./questions.js";
import { CARDS, MOVES } from "./learn.js";
import qrcode from "./vendor/qrcode.js";

const app = document.getElementById("app");

// ---------- utilities ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
const fmt = (x, d = 1) => (x == null ? "–" : Number(x).toFixed(d));
const origin = location.origin;
const surveyUrl = (id) => `${origin}/#/s/${id}`;
const dashUrl = (id, key) => `${origin}/#/d/${id}/${key}`;
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  sget(k, d = null) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const keyFor = (id) => (store.get("tp_teams", {})[id] || {}).key || memoryKeys[id];
const memoryKeys = {};
function rememberTeam(id, key, name) {
  memoryKeys[id] = key;
  const teams = store.get("tp_teams", {});
  teams[id] = { key, name, saved: Date.now() };
  store.set("tp_teams", teams);
}

async function api(method, path, body, key) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data.error || "Something went wrong."); e.status = res.status; e.data = data; throw e; }
  return data;
}

function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { prompt("Copy this link:", text); }
}
function qrImg(text, cell = 6) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  return `<img alt="QR code" src="${q.createDataURL(cell, 2)}">`;
}
function linkBox(url, label = "Copy") {
  return `<div class="linkbox"><span>${esc(url)}</span><button data-copy="${esc(url)}">${label}</button></div>`;
}
app.addEventListener("click", (e) => {
  const c = e.target.closest("[data-copy]");
  if (c) { e.preventDefault(); copy(c.dataset.copy); }
});
function setNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
}
function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }

// ---------- router ----------
async function route() {
  document.body.classList.remove("present");
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [a, b, c] = parts;
  try {
    if (!a) return home();
    if (a === "new") return newTeam();
    if (a === "s" && b) return survey(b.toUpperCase(), "member");
    if (a === "self" && b) return survey(b.toUpperCase(), "self");
    if (a === "d" && b) {
      if (c) { rememberTeam(b.toUpperCase(), c, (store.get("tp_teams", {})[b.toUpperCase()] || {}).name); history.replaceState(null, "", `#/d/${b.toUpperCase()}`); }
      return dashboard(b.toUpperCase());
    }
    if (a === "learn") return b ? learnCard(b) : learn();
    if (a === "join") return join();
    return home();
  } catch (e) {
    render(`<div class="wrap narrow section"><h2>Something went wrong</h2><p>${esc(e.message)}</p><a class="btn btn-navy" href="#/">Home</a></div>`);
  }
}
window.addEventListener("hashchange", route);
route();

// ---------- home ----------
function home() {
  setNav("home");
  const teams = Object.entries(store.get("tp_teams", {}));
  render(`
  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">For school leadership teams</div>
      <h1>How is your leadership team really going?</h1>
      <p class="lede">Rate your team. Then ask your team, anonymously. See the gap, learn what the research says, and get small moves you can try on Monday.</p>
      <div class="btn-row">
        <a class="btn btn-gold" href="#/new">Start a Team Pulse</a>
        <a class="btn btn-ghost" href="#/join">I have a team code</a>
        <a class="btn btn-ghost" href="#/learn">Learn</a>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <div class="grid g3 steps">
        <div class="card"><div class="num">1</div><h3>You rate the team</h3><p class="muted">Answer 21 short statements about direction, how you work together and the four legs of trust. About 5 minutes.</p></div>
        <div class="card"><div class="num">2</div><h3>Your team rates it too</h3><p class="muted">Share a link or QR code. Responses are anonymous, and results only appear once ${MIN_RESPONSES} people have answered.</p></div>
        <div class="card"><div class="num">3</div><h3>See the gap, then act</h3><p class="muted">Compare your view with your team's, spot a possible "school of nice", and track your next moves in a built-in action register.</p></div>
      </div>
    </div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="callout navy">
        <strong>Why this exists.</strong> At Bourchier Street we found our greatest strength, relational trust, was also our ceiling. We were a team that liked each other but rarely challenged each other. Team Pulse is the tool we built to see that clearly. We're sharing it in case it helps your team too.
      </div>
      ${teams.length ? `<h3 style="margin-top:34px">Your teams on this device</h3><div class="grid g3">${teams.map(([id, t]) => `<a class="card learn-card" href="#/d/${id}"><div class="tag">Dashboard</div><h3>${esc(t.name || id)}</h3><p class="muted small">Team code ${id}</p></a>`).join("")}</div>` : ""}
    </div>
  </section>`);
}

function join() {
  setNav("");
  render(`<div class="wrap narrow section"><h1>Join your team's pulse</h1><p class="lede">Enter the 6-character code your team leader shared.</p>
    <div class="card"><label for="code">Team code</label><input id="code" type="text" maxlength="6" autocapitalize="characters" placeholder="e.g. K7Q2MX" style="text-transform:uppercase;letter-spacing:3px;font-weight:700">
    <div class="btn-row"><button class="btn btn-navy" id="go">Continue</button></div><p id="msg" class="muted small"></p></div></div>`);
  const go = async () => {
    const code = document.getElementById("code").value.trim().toUpperCase();
    try { await api("GET", `/teams/${code}`); location.hash = `#/s/${code}`; }
    catch (e) { document.getElementById("msg").textContent = e.message; }
  };
  document.getElementById("go").onclick = go;
  document.getElementById("code").onkeydown = (e) => e.key === "Enter" && go();
}

// ---------- create a team ----------
function newTeam() {
  setNav("new");
  render(`<div class="wrap narrow section">
    <div class="eyebrow">Start a Team Pulse</div>
    <h1>Name your team</h1>
    <p class="lede">Usually your leadership team, school improvement team or principal class. You'll get a private dashboard link and a link to share with your team.</p>
    <div class="card">
      <label for="tname">Team name</label>
      <input id="tname" type="text" maxlength="80" placeholder="e.g. Bourchier Street SIT">
      <div class="btn-row"><button class="btn btn-navy" id="create">Create team</button></div>
      <p id="msg" class="muted small"></p>
    </div></div>`);
  const btn = document.getElementById("create");
  btn.onclick = async () => {
    const name = document.getElementById("tname").value.trim();
    if (!name) return (document.getElementById("msg").textContent = "Please give your team a name.");
    btn.disabled = true; btn.textContent = "Creating…";
    try {
      const t = await api("POST", "/teams", { name });
      rememberTeam(t.teamId, t.adminKey, t.name);
      created(t);
    } catch (e) { btn.disabled = false; btn.textContent = "Create team"; document.getElementById("msg").textContent = e.message; }
  };
}

function created(t) {
  render(`<div class="wrap narrow section">
    <div class="eyebrow">Team created</div>
    <h1>${esc(t.name)} is ready</h1>
    <div class="callout red" style="margin:18px 0 24px"><strong>Save your private dashboard link now.</strong> It's the only way back to your results and action register from another device. Email it to yourself. Don't share it with the whole team.</div>
    ${linkBox(dashUrl(t.teamId, t.adminKey), "Copy")}
    <div class="grid" style="margin-top:28px">
      <div class="card"><div class="tag">Step 1</div><h3>Rate the team yourself first</h3><p class="muted">Answer as you honestly see the team, before you see anyone else's answers. This is what makes the gap meaningful.</p><a class="btn btn-gold" href="#/self/${t.teamId}">Do my self-rating</a></div>
      <div class="card"><div class="tag">Step 2</div><h3>Then invite your team</h3><p class="muted">Share this link or QR code. Team code <span class="code">${t.teamId}</span></p>${linkBox(surveyUrl(t.teamId))}<div style="margin-top:16px" class="qr">${qrImg(surveyUrl(t.teamId))}</div></div>
    </div>
    <div class="btn-row"><a class="btn btn-navy" href="#/d/${t.teamId}">Go to dashboard</a></div>
  </div>`);
}

// ---------- survey ----------
async function survey(id, kind) {
  setNav("");
  render(`<div class="spinner">Loading…</div>`);
  let team;
  try { team = await api("GET", `/teams/${id}`); }
  catch (e) { return render(`<div class="wrap narrow section"><h2>Team not found</h2><p>${esc(e.message)}</p><a class="btn btn-navy" href="#/join">Enter a code</a></div>`); }
  const key = kind === "self" ? keyFor(id) : null;
  if (kind === "self" && !key) return render(`<div class="wrap narrow section"><h2>Open your dashboard link first</h2><p>The self-rating is for the team leader. Open your private dashboard link on this device, then come back.</p></div>`);

  const doneKey = `tp_done_${id}_${team.round}_${kind}`;
  const draftKey = `tp_draft_${id}_${kind}`;
  const state = store.sget(draftKey, { step: 0, answers: {}, open: {}, freq: {} });
  state.freq = state.freq || {};
  const steps = ["intro", ...SECTIONS.map((s) => s.id), "feedback", "open"];
  const save = () => store.sset(draftKey, state);

  if (kind === "member" && store.get(doneKey)) {
    return render(`<div class="wrap narrow section"><h1>Thanks, you've already responded</h1><p class="lede">Your answers for ${esc(team.name)} are in. Your team leader will see the combined results once at least ${MIN_RESPONSES} people have responded.</p>
      <div class="btn-row"><a class="btn btn-navy" href="#/learn">Explore the Learn section</a><button class="linkbtn" id="again">This is a shared device, someone else needs to respond</button></div></div>`);
  }

  const draw = () => {
    const step = steps[state.step];
    const pct = Math.round((state.step / (steps.length - 1)) * 100);
    if (step === "intro") {
      render(`<div class="wrap narrow section">
        <div class="eyebrow">${kind === "self" ? "Your self-rating" : "Team Pulse"}</div>
        <h1>${esc(team.name)}</h1>
        ${kind === "self"
          ? `<p class="lede">Rate the team as you honestly see it right now. Later you'll compare your view with your team's anonymous view. The gap is where the learning is.</p>`
          : `<p class="lede">21 short statements about how this team works, two quick questions about feedback, and a few optional comments. About 7 minutes.</p>
             <div class="callout" style="margin:18px 0"><strong>It's anonymous.</strong> No names are recorded, and your leader only sees combined results once at least ${MIN_RESPONSES} people have answered.<br><br><strong>Be honest rather than kind.</strong> A generous answer feels nice but doesn't help the team get better.</div>`}
        <div class="btn-row"><button class="btn btn-gold" id="next">Start</button></div></div>`);
    } else if (step === "feedback") {
      render(`<div class="wrap narrow section"><div class="progress"><div style="width:${pct}%"></div></div>
        <div class="eyebrow">Feedback</div><h2>Feedback in your work</h2><p class="muted">${kind === "self" ? "Answer for yourself." : "There are no wrong answers. Most people find these hard to answer."}</p>
        <div class="card">${FREQ_QUESTIONS.map((q) => `<div class="q"><p>${esc(q.text)}</p><div class="scale freq">${FREQ_OPTIONS.map((o) => `<button data-f="${q.id}" data-v="${o.value}" class="${state.freq[q.id] === o.value ? "on" : ""}">${o.label}</button>`).join("")}</div></div>`).join("")}</div>
        <div class="survey-nav"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-navy" id="next">Next</button></div><p id="msg" class="muted small"></p></div>`);
      app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => {
        state.freq[b.dataset.f] = Number(b.dataset.v); save();
        app.querySelectorAll(`[data-f="${b.dataset.f}"]`).forEach((x) => x.classList.toggle("on", x === b));
      });
    } else if (step === "open") {
      const qs = kind === "self" ? OPEN_QUESTIONS : [...OPEN_QUESTIONS, ...LEADER_QUESTIONS];
      render(`<div class="wrap narrow section"><div class="progress"><div style="width:${pct}%"></div></div>
        <div class="eyebrow">Last bit (optional)</div><h2>In your own words</h2>
        ${OPEN_QUESTIONS.map((q) => `<div style="margin:18px 0"><label for="${q.id}">${esc(q.text)}</label><textarea id="${q.id}" maxlength="600">${esc(state.open[q.id] || "")}</textarea></div>`).join("")}
        ${kind === "self" ? "" : `<div class="callout navy" style="margin-top:26px"><strong>Feedback for our team leader.</strong> Your leader has asked for this. It's anonymous, and specific is more useful than general.</div>
        ${LEADER_QUESTIONS.map((q) => `<div style="margin:18px 0"><label for="${q.id}">${esc(q.text)}</label><textarea id="${q.id}" maxlength="600">${esc(state.open[q.id] || "")}</textarea></div>`).join("")}`}
        <div class="survey-nav"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-gold" id="submit">Submit</button></div><p id="msg" class="muted small"></p></div>`);
      qs.forEach((q) => { document.getElementById(q.id).oninput = (e) => { state.open[q.id] = e.target.value; save(); }; });
      document.getElementById("submit").onclick = submit;
    } else {
      const sec = SECTIONS.find((s) => s.id === step);
      render(`<div class="wrap narrow section"><div class="progress"><div style="width:${pct}%"></div></div>
        <div class="eyebrow">${state.step} of ${steps.length - 2}</div>
        <h2>${esc(sec.title)}</h2><p class="muted">${esc(sec.blurb)}</p>
        <div class="card">${sec.items.map((it) => `
          <div class="q"><p>${esc(it.text)}</p><div class="scale">${SCALE.map((o) => `<button data-q="${it.id}" data-v="${o.value}" class="${state.answers[it.id] === o.value ? "on" : ""}">${o.label}</button>`).join("")}</div></div>`).join("")}
        </div>
        <div class="survey-nav"><button class="btn btn-ghost" id="back">Back</button><button class="btn btn-navy" id="next">Next</button></div>
        <p id="msg" class="muted small"></p></div>`);
      app.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => {
        state.answers[b.dataset.q] = Number(b.dataset.v); save();
        app.querySelectorAll(`[data-q="${b.dataset.q}"]`).forEach((x) => x.classList.toggle("on", x === b));
      });
    }
    const next = document.getElementById("next");
    if (next) next.onclick = () => {
      if (step === "feedback") {
        if (FREQ_QUESTIONS.some((q) => !state.freq[q.id])) return (document.getElementById("msg").textContent = "Please answer both questions.");
      } else if (step !== "intro") {
        const sec = SECTIONS.find((s) => s.id === step);
        const missing = sec.items.filter((i) => !state.answers[i.id]);
        if (missing.length) return (document.getElementById("msg").textContent = "Please answer each statement before moving on.");
      }
      state.step++; save(); draw();
    };
    const back = document.getElementById("back");
    if (back) back.onclick = () => { state.step--; save(); draw(); };
  };

  const submit = async () => {
    const btn = document.getElementById("submit");
    btn.disabled = true; btn.textContent = "Submitting…";
    try {
      await api("POST", `/teams/${id}/responses`, { kind, answers: state.answers, freq: state.freq, open: state.open }, key);
      store.set(doneKey, true);
      try { sessionStorage.removeItem(draftKey); } catch {}
      if (kind === "self") {
        render(`<div class="wrap narrow section"><h1>Self-rating saved</h1><p class="lede">Now invite your team. Your results will compare your view with theirs.</p><div class="btn-row"><a class="btn btn-gold" href="#/d/${id}">Go to dashboard</a></div></div>`);
      } else {
        render(`<div class="wrap narrow section"><h1>Thank you</h1><p class="lede">Your answers are in, anonymously. Honest feedback is one of the most useful things you can give a team.</p>
          <div class="callout navy" style="margin-top:20px">While you're here, have a look at <a href="#/learn/nice">the school of nice</a> or <a href="#/learn/trust">the four legs of trust</a>.</div></div>`);
      }
    } catch (e) { btn.disabled = false; btn.textContent = "Submit"; document.getElementById("msg").textContent = e.message; }
  };

  draw();
  const again = document.getElementById("again");
  if (again) again.onclick = () => { try { localStorage.removeItem(doneKey); } catch {} draw(); };
}

// ---------- dashboard ----------
async function dashboard(id) {
  setNav("");
  const key = keyFor(id);
  if (!key) return render(`<div class="wrap narrow section"><h2>Private dashboard</h2><p>Open your full dashboard link (the one ending in a long key) on this device to see results.</p></div>`);
  render(`<div class="spinner">Loading your dashboard…</div>`);
  let data, reg;
  try {
    [data, reg] = await Promise.all([api("GET", `/teams/${id}/results`, null, key), api("GET", `/teams/${id}/register`, null, key)]);
  } catch (e) {
    return render(`<div class="wrap narrow section"><h2>Couldn't open the dashboard</h2><p>${esc(e.message)}</p></div>`);
  }
  rememberTeam(id, key, data.team.name);
  const ctx = { id, key, data, reg, tab: store.sget(`tp_tab_${id}`, "overview") };
  drawDash(ctx);
}

function drawDash(ctx) {
  const { id, data } = ctx;
  const tabs = [["overview", "Overview"], ["trust", "Trust"], ["statements", "Statements"], ["comments", "Comments"], ["register", "Action register"], ["invite", "Invite & settings"]];
  render(`<div class="wrap section">
    <div class="dash-head">
      <div><div class="eyebrow">Dashboard · Round ${data.round}</div><h1 style="margin:0">${esc(data.team.name)}</h1>
        <div class="muted">${data.n} team response${data.n === 1 ? "" : "s"} · ${data.hasSelf ? "your self-rating done" : `<a href="#/self/${id}">self-rating not done yet</a>`}</div></div>
      <div class="no-present btn-row" style="margin:0"><button class="btn btn-ghost" id="refresh">Refresh</button><button class="btn btn-navy" id="present">Presentation view</button></div>
    </div>
    <div class="tabs no-present">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${ctx.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="panel"></div>
  </div>`);
  app.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { ctx.tab = b.dataset.tab; store.sset(`tp_tab_${id}`, ctx.tab); drawDash(ctx); });
  document.getElementById("refresh").onclick = () => dashboard(id);
  document.getElementById("present").onclick = () => { document.body.classList.add("present"); toast("Press Esc to leave presentation view"); };
  const panel = document.getElementById("panel");
  const tabFns = { overview: tabOverview, trust: tabTrust, statements: tabStatements, comments: tabComments, register: tabRegister, invite: tabInvite };
  if (data.locked && ["overview", "trust", "statements", "comments"].includes(ctx.tab)) return lockedPanel(panel, ctx);
  tabFns[ctx.tab](panel, ctx);
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("present"); });

function lockedPanel(panel, ctx) {
  const { id, data } = ctx;
  panel.innerHTML = `<div class="grid g2">
    <div class="card lock"><div class="big">${data.n}<span class="muted" style="font-size:28px"> / ${data.min}</span></div><h3 style="margin-top:12px">responses so far</h3><p class="muted">Results unlock once ${data.min} people have responded, so no one can be identified.</p></div>
    <div class="card"><h3>Invite your team</h3><p class="muted">Team code <span class="code">${id}</span></p>${linkBox(surveyUrl(id))}<div class="qr" style="margin-top:14px">${qrImg(surveyUrl(id))}</div></div>
  </div>
  ${data.hasSelf && data.selfScore != null ? `<div class="card" style="margin-top:18px"><h3>Your view, while you wait</h3><p>You scored the team <strong>${data.selfScore} / 48</strong>: "${esc(data.selfBand.name)}". When your team's results come in, you'll see how closely they match.</p></div>` : `<div class="callout" style="margin-top:18px">Do <a href="#/self/${id}">your self-rating</a> before you look at any results. It's what makes the comparison honest.</div>`}`;
}

function bar(label, mean, self, prev, right) {
  const pct = (v) => Math.max(0, Math.min(100, (v / 4) * 100));
  return `<div class="bar-row"><div class="bar-label"><b>${esc(label)}</b><span>${right ?? `${fmt(mean, 2)}${self != null ? ` <span class="muted">· you ${fmt(self, 1)}</span>` : ""}`}</span></div>
    <div class="track">${mean != null ? `<div class="fill" style="width:${pct(mean)}%"></div>` : ""}${prev != null ? `<div class="prev-mark" style="left:${pct(prev)}%" title="Last round"></div>` : ""}${self != null ? `<div class="self-mark" style="left:${pct(self)}%" title="Your rating"></div>` : ""}</div></div>`;
}
const legend = (prev) => `<div class="legend"><span><i style="background:var(--navy)"></i>Team average (out of 4)</span><span><i style="background:var(--gold)"></i>Your rating</span>${prev ? `<span><i style="background:#9aa6bd"></i>Last round</span>` : ""}</div>`;

function tabOverview(panel, ctx) {
  const { data } = ctx;
  const prevSec = data.previous?.sections || {};
  const sorted = SECTIONS.map((s) => ({ s, m: data.sections[s.id].mean })).filter((x) => x.m != null).sort((a, b) => a.m - b.m);
  const lowest = sorted.slice(0, 2);
  const niceHtml = data.nice?.flag
    ? `<div class="callout red"><strong>Possible school of nice.</strong> Respect and personal regard average ${fmt(data.nice.warm, 2)}, but competence (feedback, follow-through, accountability) averages ${fmt(data.nice.competence, 2)}. That's the pattern of a team that cares about each other but rarely challenges each other. <a href="#/learn/nice">Read more</a></div>`
    : data.nice ? `<div class="callout navy"><strong>Trust looks balanced.</strong> No strong "school of nice" pattern: competence is within reach of respect and personal regard. <a href="#/learn/trust">The four legs of trust</a></div>` : "";
  panel.innerHTML = `
  <div class="grid g3">
    <div class="card"><div class="muted small">Team's view</div><div class="stat">${fmt(data.teamScore, 1)}<small> / 48</small></div><span class="band">${esc(data.teamBand?.name || "")}</span>${data.previous?.teamScore != null ? `<div class="muted small" style="margin-top:8px">Last round: ${fmt(data.previous.teamScore, 1)}</div>` : ""}</div>
    <div class="card"><div class="muted small">Your view</div><div class="stat">${data.selfScore ?? "–"}<small> / 48</small></div>${data.selfBand ? `<span class="band gold">${esc(data.selfBand.name)}</span>` : `<div class="small"><a href="#/self/${ctx.id}">Do your self-rating</a></div>`}</div>
    <div class="card"><div class="muted small">The gap</div><div class="stat">${data.selfScore != null && data.teamScore != null ? (data.selfScore - data.teamScore > 0 ? "+" : "") + fmt(data.selfScore - data.teamScore, 1) : "–"}</div><div class="muted small" style="margin-top:8px">${data.selfScore != null && data.teamScore != null ? (data.selfScore > data.teamScore ? "You see the team more positively than your team does." : data.selfScore < data.teamScore ? "Your team sees itself more positively than you do." : "You and your team see it the same way.") : "Self-rating needed"}</div></div>
  </div>
  <div class="card" style="margin-top:18px"><p style="margin:0">${esc(data.teamBand?.text || "")}</p><p class="muted small" style="margin:8px 0 0">Score bands follow the structure of Macklin &amp; Zbar's team self-assessment (Driving School Improvement, 2020).</p></div>
  <div style="margin-top:18px">${niceHtml}</div>
  ${feedbackCulture(data)}
  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>By area</h3>${legend(data.previous)}<div class="bars" style="margin-top:14px">${SECTIONS.map((s) => bar(s.title, data.sections[s.id].mean, data.sections[s.id].self, prevSec[s.id]?.mean)).join("")}</div></div>
    <div class="card"><h3>Biggest gaps: you vs team</h3>${data.gaps.length ? `<ul class="gap-list">${data.gaps.slice(0, 6).map((g) => `<li><span class="gap-chip ${g.gap < 0 ? "neg" : ""}">${g.gap > 0 ? "+" : ""}${fmt(g.gap, 1)}</span><span>${esc(g.text)}<br><span class="muted small">You ${g.self} · Team ${fmt(g.team, 1)}</span></span></li>`).join("")}</ul><p class="muted small">Positive means you rated it higher than your team did.</p>` : `<p class="muted">Do your self-rating to see where your view differs from your team's.</p>`}</div>
  </div>
  <h2 style="margin-top:36px">What to try next</h2>
  <p class="muted">Small moves for your two lowest-scoring areas. Add any of them to your action register.</p>
  ${lowest.map(({ s, m }) => `<h3 style="margin-top:22px">${esc(s.title)} <span class="muted small">(${fmt(m, 2)})</span></h3><div class="grid g2">${(MOVES[s.id] || []).map((mv) => moveCard(mv, s.id)).join("")}</div>`).join("")}`;
  wireMoves(panel, ctx);
}

function feedbackCulture(data) {
  if (!data.freq) return "";
  const block = (q) => {
    const f = data.freq[q.id]; if (!f || !f.n) return "";
    const stale = f.dist[2] + f.dist[3] + f.dist[4];
    return `<div><h4 style="margin:0 0 6px;color:var(--navy)">${esc(q.text)}</h4>
      <p class="small muted" style="margin:0 0 10px"><strong style="color:var(--ink)">${stale} of ${f.n}</strong> said more than a term ago or couldn't remember.${f.self ? ` You: ${esc(FREQ_OPTIONS[f.self - 1].label.toLowerCase())}.` : ""}</p>
      <div class="bars">${FREQ_OPTIONS.map((o, i) => bar(o.label, null, null, null, `${f.dist[i]}`).replace('<div class="track">', `<div class="track"><div class="fill" style="width:${(f.dist[i] / f.n) * 100}%;background:${i < 2 ? "var(--navy)" : i < 4 ? "#9db8de" : "var(--red)"}"></div>`)).join("")}</div></div>`;
  };
  return `<div class="card" style="margin-top:18px"><h3>Feedback culture</h3><p class="muted small">How recently people in this team received and gave honest feedback.</p><div class="grid g2" style="margin-top:12px">${FREQ_QUESTIONS.map(block).join("")}</div></div>`;
}

function moveCard(mv, sectionId) {
  return `<div class="move"><h4>${esc(mv.title)}</h4><p>${esc(mv.text)}</p><div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap" class="no-present">
    <button class="linkbtn small" data-addmove="${esc(mv.title)}" data-sec="${sectionId}">+ Add to action register</button>${mv.card ? `<a class="small" href="#/learn/${mv.card}">Learn more</a>` : ""}</div></div>`;
}
function wireMoves(panel, ctx) {
  panel.querySelectorAll("[data-addmove]").forEach((b) => b.onclick = () => {
    const mv = (MOVES[b.dataset.sec] || []).find((m) => m.title === b.dataset.addmove);
    editRegisterItem(ctx, { decision: mv.title, action: mv.text, linked: b.dataset.sec, status: "green", date: new Date().toISOString().slice(0, 10) });
  });
}

function tabTrust(panel, ctx) {
  const { data } = ctx;
  const prevLegs = Object.fromEntries((data.previous?.legs || []).map((l) => [l.id, l.mean]));
  const weakest = [...data.legs].filter((l) => l.mean != null).sort((a, b) => a.mean - b.mean)[0];
  panel.innerHTML = `<div class="grid g2">
    <div class="card"><h3>The four legs of trust</h3>${legend(data.previous)}<div class="bars" style="margin-top:14px">${data.legs.map((l) => bar(l.leg, l.mean, l.self, prevLegs[l.id])).join("")}</div></div>
    <div class="card"><h3>What this means</h3><p>Bryk and Schneider found that trust between adults in a school rests on four things: respect, personal regard, competence and integrity. You need all four.</p>
      ${weakest ? `<p>Your weakest leg is <strong>${esc(weakest.leg)}</strong> (${fmt(weakest.mean, 2)}).</p>` : ""}
      ${data.nice?.flag ? `<div class="callout red">Warm on respect and regard, lower on competence: <a href="#/learn/nice">a possible school of nice</a>.</div>` : ""}
      <div class="btn-row"><a class="btn btn-ghost" href="#/learn/trust">The four legs of trust</a><a class="btn btn-ghost" href="#/learn/nice">The school of nice</a></div></div>
  </div>
  ${weakest ? `<h2 style="margin-top:32px">Moves to strengthen ${esc(weakest.leg.toLowerCase())}</h2><div class="grid g2">${(MOVES[weakest.id] || []).map((mv) => moveCard(mv, weakest.id)).join("")}</div>` : ""}`;
  wireMoves(panel, ctx);
}

function tabStatements(panel, ctx) {
  const { data } = ctx;
  panel.innerHTML = `<div class="legend" style="margin-bottom:14px"><span><i style="background:var(--red)"></i>Strongly disagree</span><span><i style="background:#e9a29b"></i>Disagree</span><span><i style="background:#9db8de"></i>Agree</span><span><i style="background:var(--navy)"></i>Strongly agree</span></div>
  ${SECTIONS.map((s) => `<div class="card" style="margin-bottom:16px"><h3>${esc(s.title)}</h3><ul class="gap-list">${s.items.map((it) => {
    const r = data.items[it.id]; const tot = r.dist.reduce((a, b) => a + b, 0) || 1;
    return `<li><span class="gap-chip neg">${fmt(r.mean, 1)}</span><span style="flex:1">${esc(it.text)}${r.self != null ? `<br><span class="muted small">You: ${r.self}</span>` : ""}</span><span class="dist">${r.dist.map((d) => `<span style="width:${(d / tot) * 100}%"></span>`).join("")}</span></li>`;
  }).join("")}</ul></div>`).join("")}`;
}

function tabComments(panel, ctx) {
  const { data } = ctx;
  const lead = LEADER_QUESTIONS.some((q) => (data.comments[q.id] || []).length);
  panel.innerHTML = `${lead ? `<div class="callout navy" style="margin-bottom:18px"><strong>Feedback for you, the team leader.</strong> You asked for this, so thank your team for it, and tell them one thing you'll do with it.</div><div class="grid g2" style="margin-bottom:26px">${LEADER_QUESTIONS.map((q) => `<div class="card"><h3>${esc(q.text)}</h3>${(data.comments[q.id] || []).length ? data.comments[q.id].map((c) => `<div class="comment">${esc(c)}</div>`).join("") : `<p class="muted">No comments yet.</p>`}</div>`).join("")}</div>` : ""}<div class="grid g2">${OPEN_QUESTIONS.map((q) => `<div class="card"><h3>${esc(q.text)}</h3>${(data.comments[q.id] || []).length ? data.comments[q.id].map((c) => `<div class="comment">${esc(c)}</div>`).join("") : `<p class="muted">No comments yet.</p>`}</div>`).join("")}</div>
  <p class="muted small" style="margin-top:12px">Comments are shown in random order so they can't be matched to response times.</p>`;
}

function tabInvite(panel, ctx) {
  const { id, key, data } = ctx;
  panel.innerHTML = `<div class="grid g2">
    <div class="card"><h3>Team survey link</h3><p class="muted">Share with your team. Team code <span class="code">${id}</span></p>${linkBox(surveyUrl(id))}<div class="qr" style="margin-top:14px">${qrImg(surveyUrl(id))}</div></div>
    <div class="card"><h3>Your private dashboard link</h3><p class="muted">Keep this to yourself, or share it only with the people who should see results and edit the action register.</p>${linkBox(dashUrl(id, key))}
      <h3 style="margin-top:26px">Your self-rating</h3><p class="muted">${data.hasSelf ? "Done for this round. You can redo it, and the latest version replaces the old one." : "Not done yet for this round."}</p><a class="btn btn-ghost" href="#/self/${id}">${data.hasSelf ? "Redo self-rating" : "Do self-rating"}</a>
      <h3 style="margin-top:26px">Retake (new round)</h3><p class="muted">Run it again in 6 to 12 months to see what's changed. Your current results are kept, and the new round compares against them.</p><button class="btn btn-ghost" id="newround">Start round ${data.team.round + 1}</button></div>
  </div>
  ${data.team.rounds.length > 1 ? `<div class="card" style="margin-top:18px"><h3>Rounds</h3>${data.team.rounds.map((r) => `<button class="btn btn-ghost" style="margin:4px" data-round="${r.n}">Round ${r.n} · ${new Date(r.started).toLocaleDateString("en-AU")}</button>`).join("")}</div>` : ""}`;
  document.getElementById("newround").onclick = async () => {
    if (!confirm(`Start round ${data.team.round + 1}? New responses will go into the new round.`)) return;
    try { await api("POST", `/teams/${id}/rounds`, {}, key); toast("New round started"); dashboard(id); } catch (e) { toast(e.message); }
  };
  panel.querySelectorAll("[data-round]").forEach((b) => b.onclick = async () => {
    try { ctx.data = await api("GET", `/teams/${id}/results?round=${b.dataset.round}`, null, key); ctx.tab = "overview"; drawDash(ctx); } catch (e) { toast(e.message); }
  });
}

// ---------- action register ----------
const STATUS = [["green", "On track"], ["amber", "At risk"], ["red", "Off track"], ["done", "Done"]];
const SECTION_NAMES = Object.fromEntries(SECTIONS.map((s) => [s.id, s.title]));

function tabRegister(panel, ctx) {
  const items = ctx.reg.items || [];
  const count = (st) => items.filter((i) => i.status === st).length;
  const order = { red: 0, amber: 1, green: 2, done: 3 };
  const sorted = [...items].sort((a, b) => order[a.status] - order[b.status] || (a.due || "9").localeCompare(b.due || "9"));
  panel.innerHTML = `
  <div class="card" style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
    <div class="reg-summary"><div><b>${count("red")}</b><span class="light red"></span> Off track</div><div><b>${count("amber")}</b><span class="light amber"></span> At risk</div><div><b>${count("green")}</b><span class="light green"></span> On track</div><div><b>${count("done")}</b><span class="light done"></span> Done</div></div>
    <div class="no-present"><button class="btn btn-gold" id="addItem">+ Add decision</button></div></div>
    <p class="muted small" style="margin:12px 0 0">Every decision gets one accountable person, a timeline and a traffic light. Review it at every meeting, and make it safe to report red. <a href="#/learn/register">Why this works</a></p></div>
  ${items.length ? `<div class="card" style="padding:8px 12px;overflow-x:auto"><table class="reg-table"><thead><tr><th></th><th>Decision &amp; action</th><th>Owner</th><th>Due</th><th class="hide-sm">Logged</th><th class="no-present"></th></tr></thead><tbody>
    ${sorted.map((it) => `<tr class="${it.status === "done" ? "done" : ""}"><td><span class="light ${it.status}" title="${it.status}"></span></td>
      <td><strong>${esc(it.decision)}</strong>${it.action ? `<br><span class="muted">${esc(it.action)}</span>` : ""}${it.note ? `<br><span class="small">Progress: ${esc(it.note)}</span>` : ""}${it.linked ? `<br><span class="tag" style="margin:6px 0 0">${esc(SECTION_NAMES[it.linked] || it.linked)}</span>` : ""}</td>
      <td>${esc(it.owner)}</td><td>${it.due ? new Date(it.due).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : ""}</td><td class="hide-sm muted">${it.date ? new Date(it.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : ""}</td>
      <td class="no-present"><button class="linkbtn small" data-edit="${esc(it.id)}">Edit</button></td></tr>`).join("")}
  </tbody></table></div>` : `<div class="card lock"><h3>No decisions logged yet</h3><p class="muted">Start with one. What did your team decide at its last meeting, and who's accountable for it?</p></div>`}`;
  document.getElementById("addItem").onclick = () => editRegisterItem(ctx, { date: new Date().toISOString().slice(0, 10), status: "green" });
  panel.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => editRegisterItem(ctx, items.find((i) => i.id === b.dataset.edit)));
}

function editRegisterItem(ctx, item) {
  const isNew = !item.id;
  const it = { ...item };
  const bg = document.createElement("div"); bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal"><h2>${isNew ? "Add a decision" : "Update decision"}</h2>
    <div class="form-grid">
      <div class="full"><label>Decision</label><input type="text" id="f-decision" maxlength="400" value="${esc(it.decision || "")}" placeholder="What did we decide?"></div>
      <div class="full"><label>Action</label><textarea id="f-action" maxlength="400" placeholder="What will happen?">${esc(it.action || "")}</textarea></div>
      <div><label>Accountable person</label><input type="text" id="f-owner" maxlength="80" value="${esc(it.owner || "")}" placeholder="One name"></div>
      <div><label>Due</label><input type="date" id="f-due" value="${esc(it.due || "")}"></div>
      <div class="full"><label>Status</label><div class="status-pick">${STATUS.map(([k, l]) => `<button type="button" data-st="${k}" class="${(it.status || "green") === k ? "on" : ""}"><span class="light ${k}"></span>${l}</button>`).join("")}</div></div>
      <div class="full"><label>Progress note</label><input type="text" id="f-note" maxlength="400" value="${esc(it.note || "")}" placeholder="Where is it up to?"></div>
      <div class="full"><label>Linked area (optional)</label><select id="f-linked"><option value="">None</option>${SECTIONS.map((s) => `<option value="${s.id}" ${it.linked === s.id ? "selected" : ""}>${esc(s.title)}</option>`).join("")}</select></div>
    </div>
    <div class="survey-nav">${isNew ? `<button class="btn btn-ghost" id="f-cancel">Cancel</button>` : `<button class="btn btn-ghost" id="f-delete" style="color:var(--red)">Delete</button>`}<div style="display:flex;gap:10px">${isNew ? "" : `<button class="btn btn-ghost" id="f-cancel">Cancel</button>`}<button class="btn btn-navy" id="f-save">Save</button></div></div>
    <p id="f-msg" class="muted small"></p></div>`;
  document.body.appendChild(bg);
  let status = it.status || "green";
  bg.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => { status = b.dataset.st; bg.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("on", x === b)); });
  const close = () => bg.remove();
  bg.querySelector("#f-cancel").onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  const persist = async (items) => {
    try { ctx.reg = await api("PUT", `/teams/${ctx.id}/register`, { version: ctx.reg.version, items }, ctx.key); close(); ctx.tab = "register"; store.sset(`tp_tab_${ctx.id}`, "register"); drawDash(ctx); toast("Saved"); }
    catch (e) { if (e.status === 409 && e.data?.latest) { ctx.reg = e.data.latest; } bg.querySelector("#f-msg").textContent = e.message; }
  };
  bg.querySelector("#f-save").onclick = () => {
    const v = (id) => bg.querySelector(id).value.trim();
    const updated = { ...it, id: it.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), decision: v("#f-decision"), action: v("#f-action"), owner: v("#f-owner"), due: v("#f-due"), note: v("#f-note"), linked: v("#f-linked"), status, date: it.date || new Date().toISOString().slice(0, 10) };
    if (!updated.decision && !updated.action) return (bg.querySelector("#f-msg").textContent = "Add a decision or an action.");
    const items = isNew ? [...ctx.reg.items, updated] : ctx.reg.items.map((x) => (x.id === it.id ? updated : x));
    persist(items);
  };
  const del = bg.querySelector("#f-delete");
  if (del) del.onclick = () => { if (confirm("Delete this decision?")) persist(ctx.reg.items.filter((x) => x.id !== it.id)); };
}

// ---------- learn ----------
function learn() {
  setNav("learn");
  render(`<div class="wrap section"><div class="eyebrow">Learn</div><h1>Ideas behind Team Pulse</h1><p class="lede">Short reads on trust, teams and improvement, each with its source so you can go deeper.</p>
    <div class="grid g3" style="margin-top:26px">${CARDS.map((c) => `<a class="card learn-card" href="#/learn/${c.id}"><div class="tag">${esc(c.tag)}</div><h3>${esc(c.title)}</h3><p class="muted small" style="margin:0">${esc(c.summary)}</p></a>`).join("")}</div></div>`);
}
function learnCard(cid) {
  setNav("learn");
  const i = CARDS.findIndex((c) => c.id === cid);
  if (i < 0) return learn();
  const c = CARDS[i], nxt = CARDS[(i + 1) % CARDS.length];
  render(`<div class="wrap narrow section article"><a href="#/learn" class="small">← All topics</a><div class="tag" style="margin-top:18px">${esc(c.tag)}</div><h1>${esc(c.title)}</h1><p class="lede">${esc(c.summary)}</p>
    ${c.body.map((p) => `<p>${md(p)}</p>`).join("")}<div class="source">${esc(c.source)}</div>
    <div class="btn-row"><a class="btn btn-ghost" href="#/learn/${nxt.id}">Next: ${esc(nxt.title)} →</a><a class="btn btn-gold" href="#/new">Run a Team Pulse</a></div></div>`);
}
