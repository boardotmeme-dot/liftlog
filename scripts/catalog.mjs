// Catalog tooling.
//   node scripts/catalog.mjs validate   check every file against catalog/SCHEMA.md
//   node scripts/catalog.mjs build      write src/data/catalog.json and supabase/seed.sql
//   node scripts/catalog.mjs links      confirm every YouTube/TikTok reference exists (network)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "catalog", "exercises");
const cdir = join(root, "catalog", "collections");

const MUSCLES = ["chest","back","lats","traps","shoulders","rear-delts","biceps","triceps","forearms","quads","hamstrings","glutes","calves","abs","lower-back","neck"];
const EQUIPMENT = ["barbell","dumbbell","machine","cable","bodyweight","ez-bar","kettlebell","band","smith-machine","other"];
const MECHANIC = ["compound","isolation"];
const LEVEL = ["beginner","intermediate","advanced"];
const REF_TYPE = ["video","article"];
const PLATFORM = ["youtube","tiktok","instagram","web"];

function load() {
  return readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => {
    const raw = readFileSync(join(dir, f), "utf8");
    let data;
    try { data = JSON.parse(raw); } catch (e) { return { file: f, error: "invalid JSON: " + e.message }; }
    return { file: f, data };
  });
}

function strList(v, min, max) {
  return Array.isArray(v) && v.length >= min && v.length <= max && v.every(s => typeof s === "string" && s.trim().length > 2);
}

function check(file, x) {
  const e = [];
  const slug = file.replace(/\.json$/, "");
  if (x.slug !== slug) e.push(`slug "${x.slug}" must equal file name "${slug}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.slug || "")) e.push("slug must be kebab-case");
  if (typeof x.name !== "string" || x.name.length < 3) e.push("name missing");
  if (x.aliases !== undefined && !strList(x.aliases, 0, 8)) e.push("aliases must be a list of strings");
  if (!MUSCLES.includes(x.muscle_group)) e.push("muscle_group invalid: " + x.muscle_group);
  if (!Array.isArray(x.secondary) || !x.secondary.every(m => MUSCLES.includes(m))) e.push("secondary invalid");
  if (!EQUIPMENT.includes(x.equipment)) e.push("equipment invalid: " + x.equipment);
  if (!MECHANIC.includes(x.mechanic)) e.push("mechanic invalid: " + x.mechanic);
  if (!LEVEL.includes(x.level)) e.push("level invalid: " + x.level);
  if (typeof x.summary !== "string" || x.summary.length < 20) e.push("summary too short");
  if (!strList(x.setup, 2, 8)) e.push("setup needs 2-8 steps");
  if (!strList(x.execution, 3, 8)) e.push("execution needs 3-8 steps");
  if (!strList(x.cues, 2, 5)) e.push("cues needs 2-5 items");
  if (!strList(x.mistakes, 2, 5)) e.push("mistakes needs 2-5 items");
  if (!Number.isInteger(x.default_sets) || x.default_sets < 1 || x.default_sets > 8) e.push("default_sets invalid");
  if (typeof x.default_reps !== "string" || !x.default_reps) e.push("default_reps invalid");
  if (!Array.isArray(x.references) || !x.references.some(r => r.type === "video")) e.push("needs at least one video reference");
  (x.references || []).forEach((r, i) => {
    if (!REF_TYPE.includes(r.type)) e.push(`references[${i}].type invalid`);
    if (!PLATFORM.includes(r.platform)) e.push(`references[${i}].platform invalid`);
    if (!/^https:\/\//.test(r.url || "")) e.push(`references[${i}].url must be https`);
    if (!r.title || !r.author) e.push(`references[${i}] needs title and author`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked || "")) e.push(`references[${i}].checked must be YYYY-MM-DD`);
  });
  return e;
}

function validate() {
  const items = load();
  let bad = 0;
  const seen = new Set();
  for (const it of items) {
    const errs = it.error ? [it.error] : check(it.file, it.data);
    if (!it.error && seen.has(it.data.slug)) errs.push("duplicate slug");
    if (!it.error) seen.add(it.data.slug);
    if (errs.length) { bad++; console.error(`✗ ${it.file}\n   - ${errs.join("\n   - ")}`); }
  }
  console.log(`${items.length - bad}/${items.length} exercises valid`);
  return { items, bad };
}

function loadCollections() {
  return readdirSync(cdir).filter(f => f.endsWith(".json")).sort().map(f => ({ file: f, data: JSON.parse(readFileSync(join(cdir, f), "utf8")) }));
}

function validateCollections(slugs) {
  let bad = 0;
  const cols = loadCollections();
  const ids = new Set();
  for (const { file, data: c } of cols) {
    const e = [];
    if (c.id !== file.replace(/\.json$/, "")) e.push("id must equal file name");
    if (ids.has(c.id)) e.push("duplicate id");
    ids.add(c.id);
    if (!c.title || !c.description) e.push("title and description required");
    if (!Array.isArray(c.tags)) e.push("tags must be a list");
    if (!Array.isArray(c.exercises) || c.exercises.length < 3) e.push("needs at least 3 exercises");
    for (const x of c.exercises || []) {
      if (!slugs.has(x.slug)) e.push(`unknown exercise "${x.slug}"`);
      if (!x.why) e.push(`missing "why" for ${x.slug}`);
    }
    if (e.length) { bad++; console.error(`✗ collections/${file}\n   - ${e.join("\n   - ")}`); }
  }
  console.log(`${cols.length - bad}/${cols.length} collections valid`);
  return { cols, bad };
}

function sqlStr(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

function build() {
  const { items, bad } = validate();
  if (bad) process.exit(1);
  const list = items.map(i => i.data);
  mkdirSync(join(root, "src", "data"), { recursive: true });
  const cv = validateCollections(new Set(list.map(x => x.slug)));
  if (cv.bad) process.exit(1);
  writeFileSync(join(root, "src", "data", "collections.json"), JSON.stringify(cv.cols.map(c => c.data)));
  writeFileSync(join(root, "src", "data", "catalog.json"), JSON.stringify(list));
  const rows = list.map(x =>
    `(${sqlStr(x.slug)}, ${sqlStr(x.name)}, ${sqlStr(x.muscle_group)}, ${sqlStr(x.equipment)}, ${sqlStr(x.mechanic)}, ${sqlStr(x.level)}, ${sqlStr(JSON.stringify(x))}::jsonb)`);
  const sql = `-- GENERATED by scripts/catalog.mjs. Do not edit; change catalog/exercises/*.json instead.\n` +
    `insert into public.exercises (slug, name, muscle_group, equipment, mechanic, level, data) values\n${rows.join(",\n")}\n` +
    `on conflict (slug) do update set name = excluded.name, muscle_group = excluded.muscle_group,\n` +
    `  equipment = excluded.equipment, mechanic = excluded.mechanic, level = excluded.level, data = excluded.data;\n`;
  writeFileSync(join(root, "supabase", "seed.sql"), sql);
  console.log(`built ${list.length} exercises -> src/data/catalog.json, supabase/seed.sql`);
}

async function links() {
  const { items, bad } = validate();
  if (bad) process.exit(1);
  let fail = 0, n = 0;
  for (const { data } of items) {
    for (const r of data.references) {
      if (r.platform !== "youtube" && r.platform !== "tiktok") continue;
      n++;
      const base = r.platform === "youtube" ? "https://www.youtube.com/oembed" : "https://www.tiktok.com/oembed";
      try {
        const res = await fetch(`${base}?url=${encodeURIComponent(r.url)}&format=json`);
        if (!res.ok) { fail++; console.error(`✗ ${data.slug}: ${res.status} ${r.url}`); continue; }
        const j = await res.json();
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (r.platform === "youtube" && norm(j.title) !== norm(r.title))
          console.warn(`! ${data.slug}: title differs\n    ours:   ${r.title}\n    actual: ${j.title}`);
      } catch (e) { fail++; console.error(`✗ ${data.slug}: ${e.message} ${r.url}`); }
    }
  }
  console.log(`${n - fail}/${n} links reachable`);
  if (fail) process.exit(1);
}

const cmd = process.argv[2];
if (cmd === "validate") {
  const v = validate();
  const c = validateCollections(new Set(v.items.filter(i => i.data).map(i => i.data.slug)));
  if (v.bad || c.bad) process.exit(1);
}
else if (cmd === "build") build();
else if (cmd === "links") await links();
else { console.error("usage: catalog.mjs validate|build|links"); process.exit(2); }
