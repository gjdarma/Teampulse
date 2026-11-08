// Reads a Microsoft Planner "Export plan to Excel" file (.xlsx) or a CSV, in the browser.
// No library: .xlsx is a zip of XML files, unzipped with the browser's DecompressionStream.

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This doesn't look like an Excel file.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(local + 26, true), lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    files[name] = { method, data: u8.subarray(start, start + csize) };
    p += 46 + nlen + xlen + clen;
  }
  return {
    async text(name) {
      const f = files[name]; if (!f) return null;
      const raw = f.method === 8 ? await inflateRaw(f.data) : f.data;
      return new TextDecoder().decode(raw);
    },
    names: Object.keys(files),
  };
}

const colIndex = (ref) => { const letters = ref.replace(/\d+/g, ""); let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

async function xlsxRows(buf) {
  const zip = await unzip(buf);
  const parse = (t) => new DOMParser().parseFromString(t, "application/xml");
  const shared = [];
  const ss = await zip.text("xl/sharedStrings.xml");
  if (ss) parse(ss).querySelectorAll("si").forEach((si) => shared.push([...si.querySelectorAll("t")].map((t) => t.textContent).join("")));
  const sheetName = zip.names.find((n) => /^xl\/worksheets\/sheet1\.xml$/.test(n)) || zip.names.find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  if (!sheetName) throw new Error("Couldn't find a worksheet in that file.");
  const doc = parse(await zip.text(sheetName));
  const rows = [];
  doc.querySelectorAll("sheetData row").forEach((r) => {
    const row = [];
    r.querySelectorAll("c").forEach((c) => {
      const t = c.getAttribute("t"); const v = c.querySelector("v")?.textContent ?? "";
      let val = v;
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = [...c.querySelectorAll("is t")].map((x) => x.textContent).join("");
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      row[colIndex(c.getAttribute("r") || "A1")] = val;
    });
    rows.push(row.map((x) => x ?? ""));
  });
  return rows;
}

function csvRows(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Dates: Excel serial numbers, ISO, or Australian d/m/yyyy.
function toISO(v) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4,5}(\.\d+)?$/.test(s)) { const d = new Date(Math.round((Number(s) - 25569) * 86400000)); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { let [, a, b, y] = m; a = +a; b = +b; y = +y < 100 ? 2000 + +y : +y; let day = a, mon = b; if (mon > 12 && day <= 12) [day, mon] = [mon, day]; return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
  const d = new Date(s); return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

export async function readPlannerFile(file) {
  const buf = await file.arrayBuffer();
  const rows = /\.csv$/i.test(file.name) ? csvRows(new TextDecoder().decode(buf)) : await xlsxRows(buf);
  const hi = rows.findIndex((r) => r.some((c) => /^task name$/i.test(String(c).trim())));
  if (hi < 0) throw new Error("Couldn't find a 'Task Name' column. Use Planner's 'Export plan to Excel'.");
  const head = rows[hi].map((h) => String(h).trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  const get = (r, name) => { const i = col(name); return i >= 0 ? String(r[i] ?? "").trim() : ""; };
  const today = new Date().toISOString().slice(0, 10);
  const tasks = [];
  for (const r of rows.slice(hi + 1)) {
    const name = get(r, "task name"); if (!name) continue;
    const progress = get(r, "progress").toLowerCase();
    const due = toISO(get(r, "due date"));
    const lateCell = get(r, "late").toLowerCase();
    const done = progress.startsWith("complete");
    const late = !done && (lateCell === "true" || lateCell === "yes" || (due && due < today));
    const assigned = get(r, "assigned to").split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    const bucket = get(r, "bucket name");
    const checklist = get(r, "completed checklist items");
    const noteBits = [];
    if (assigned.length > 1) noteBits.push(`Also: ${assigned.slice(1).join(", ")}`);
    if (checklist) noteBits.push(`Checklist ${checklist}`);
    if (bucket) noteBits.push(`Planner bucket: ${bucket}`);
    const taskId = get(r, "task id");
    tasks.push({
      id: taskId ? `planner-${taskId}`.slice(0, 40) : undefined,
      decision: name.slice(0, 400),
      action: get(r, "description").replace(/\s+/g, " ").slice(0, 400),
      owner: (assigned[0] || "").slice(0, 80),
      due,
      date: toISO(get(r, "created date")),
      status: done ? "done" : late ? "red" : "green",
      note: noteBits.join(" · ").slice(0, 400),
      linked: "",
      meeting: "",
    });
  }
  return tasks;
}
