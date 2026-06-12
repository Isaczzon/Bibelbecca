// Hämtar nya inslag från BibelBeccas YouTube-kanal och skapar md-filer
// för dem som saknas i src/media/. Körs av GitHub Actions varje natt
// (.github/workflows/hamta-nytt.yml) men kan även köras lokalt:
//
//   node scripts/hamta-nytt.mjs
//
// Befintliga filer rörs aldrig – Beccas redigeringar i CMS:et är säkra.
// Nya inslag får svensk titel även i en-mappen; översätt i CMS:et vid behov.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KANAL = "UCV-pLYXSL2OtkbhGdM5blrQ";
const FLIKAR = {
  videos: "EgZ2aWRlb3PyBgQKAjoA",
  shorts: "EgZzaG9ydHPyBgUKA5oBAA==",
};
// Spellistorna styr typen; ordningen är prioritet om ett id finns i flera
const SPELLISTOR = [
  ["Podcast", "PLGXYFZHCZfl8NPbSNpYtxXLcAaGwoUXeX"],
  ["Serie", "PLGXYFZHCZfl_YzV8XkIxsdZXNuSXEC5h7"],
  ["Studietips", "PLGXYFZHCZfl9-RD6WX9SdASdpUvWaR8Rr"],
  ["Live", "PLGXYFZHCZfl8k7qxg0hC_rB7cNR1pepUv"],
];

const CTX = { client: { clientName: "WEB", clientVersion: "2.20240620.00.00", hl: "sv", gl: "SE" } };
const ROT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MEDIA = path.join(ROT, "src", "media");

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

async function yt(endpoint, body) {
  const resp = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context: CTX, ...body }),
  });
  if (!resp.ok) throw new Error(`${endpoint}: HTTP ${resp.status}`);
  return resp.json();
}

function hitta(nod, nyckel, ut = []) {
  if (Array.isArray(nod)) nod.forEach((n) => hitta(n, nyckel, ut));
  else if (nod && typeof nod === "object") {
    for (const [k, v] of Object.entries(nod)) {
      if (k === nyckel) ut.push(v);
      hitta(v, nyckel, ut);
    }
  }
  return ut;
}

// Hämtar alla video-id:n från en flik eller spellista, inkl. fortsättningssidor
async function skordaIds(browseBody) {
  const ids = new Set();
  let svar = await yt("browse", browseBody);
  for (let varv = 0; varv < 25; varv++) {
    for (const l of hitta(svar, "lockupViewModel")) {
      if (typeof l.contentId === "string" && l.contentId.length === 11) ids.add(l.contentId);
    }
    for (const s of hitta(svar, "shortsLockupViewModel")) {
      const id = s.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      if (id) ids.add(id);
    }
    const token = hitta(svar, "continuationItemRenderer")
      .map((c) => c.continuationEndpoint?.continuationCommand?.token)
      .find(Boolean);
    if (!token) break;
    await vanta(300);
    svar = await yt("browse", { continuation: token });
  }
  return ids;
}

function rensaTitel(t) {
  return String(t || "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[|\-–\s]+$/, "")
    .trim();
}

function slugga(t) {
  const s = t
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return s || "inslag";
}

// --- Läs in vad sajten redan har ---
const befintligaIds = new Set();
const befintligaFilnamn = new Set();
for (const fil of readdirSync(path.join(MEDIA, "sv"))) {
  if (!fil.endsWith(".md")) continue;
  befintligaFilnamn.add(fil);
  const m = readFileSync(path.join(MEDIA, "sv", fil), "utf8").match(/(?:watch\?v=|shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) befintligaIds.add(m[1]);
}
console.log(`Sajten har ${befintligaIds.size} inslag.`);

// --- Hämta kanalens aktuella innehåll ---
const typAvId = new Map();
for (const [typ, plid] of SPELLISTOR) {
  const ids = await skordaIds({ browseId: `VL${plid}` });
  for (const id of ids) if (!typAvId.has(id)) typAvId.set(id, typ);
  console.log(`Spellista ${typ}: ${ids.size} inslag`);
  await vanta(300);
}
const shortsIds = await skordaIds({ browseId: KANAL, params: FLIKAR.shorts });
console.log(`Shorts-fliken: ${shortsIds.size} inslag`);
for (const id of shortsIds) if (!typAvId.has(id)) typAvId.set(id, "Short");
await vanta(300);
const videoIds = await skordaIds({ browseId: KANAL, params: FLIKAR.videos });
console.log(`Videofliken: ${videoIds.size} inslag`);
for (const id of videoIds) if (!typAvId.has(id)) typAvId.set(id, "Video");

// --- Skapa filer för det som saknas ---
const nya = [...typAvId.keys()].filter((id) => !befintligaIds.has(id));
console.log(`Nya inslag: ${nya.length}`);

for (const id of nya) {
  await vanta(250);
  let detaljer;
  try {
    detaljer = await yt("player", { videoId: id });
  } catch (fel) {
    console.warn(`  hoppar över ${id}: ${fel.message}`);
    continue;
  }
  const titel = rensaTitel(detaljer.videoDetails?.title) || "Utan titel";
  const datum = String(detaljer.microformat?.playerMicroformatRenderer?.publishDate || "").slice(0, 10);
  const typ = typAvId.get(id);
  const url = (typ === "Short" ? "https://www.youtube.com/shorts/" : "https://www.youtube.com/watch?v=") + id;

  let filnamn = slugga(titel) + ".md";
  for (let n = 2; befintligaFilnamn.has(filnamn); n++) filnamn = `${slugga(titel)}-${n}.md`;
  befintligaFilnamn.add(filnamn);

  const innehall = `---\ntitel: ${JSON.stringify(titel)}\ntyp: ${typ}\ndatum: ${datum}\nurl: ${url}\n---\n`;
  writeFileSync(path.join(MEDIA, "sv", filnamn), innehall);
  writeFileSync(path.join(MEDIA, "en", filnamn), innehall);
  console.log(`  + ${typ}: ${titel} (${datum})`);
}

console.log(nya.length ? `Klart – ${nya.length} nya inslag tillagda.` : "Inget nytt idag.");
