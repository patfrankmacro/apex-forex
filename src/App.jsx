import { useState, useMemo, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCLseJPInlsVdFPTuv_yujPiqToqsubXBU",
  authDomain: "pboy-frank-fx.firebaseapp.com",
  databaseURL: "https://pboy-frank-fx-default-rtdb.firebaseio.com",
  projectId: "pboy-frank-fx",
  storageBucket: "pboy-frank-fx.firebasestorage.app",
  messagingSenderId: "892979664134",
  appId: "1:892979664134:web:e950c73f7e4fb6009f3a87"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const INDS = [
  { id: "mfg",   label: "PMI Manuf",    thresh: 2.0,  rev: false, w: 0.10 },
  { id: "svc",   label: "PMI Services", thresh: 2.0,  rev: false, w: 0.15 },
  { id: "unemp", label: "Chomage %",    thresh: 0.3,  rev: true,  w: 0.20 },
  { id: "rate",  label: "Taux %",       thresh: 0.25, rev: false, w: 0.05 },
  { id: "cpi",   label: "Inflation %",  thresh: 0.3,  rev: false, w: 0.25 },
  { id: "core",  label: "Core CPI %",   thresh: 0.2,  rev: false, w: 0.25 },
];

const TE = "https://tradingeconomics.com";

const TE_LINKS = {
  USD: { mfg: "united-states/manufacturing-pmi", svc: "united-states/services-pmi", unemp: "united-states/unemployment-rate", rate: "united-states/interest-rate", cpi: "united-states/inflation-cpi", core: "united-states/core-inflation-rate" },
  EUR: { mfg: "euro-area/manufacturing-pmi",      svc: "euro-area/services-pmi",     unemp: "euro-area/unemployment-rate",     rate: "euro-area/interest-rate",     cpi: "euro-area/inflation-rate",     core: "euro-area/core-inflation-rate" },
  CAD: { mfg: "canada/manufacturing-pmi",         svc: "canada/services-pmi",        unemp: "canada/unemployment-rate",        rate: "canada/interest-rate",        cpi: "canada/inflation-cpi",         core: "canada/core-inflation-rate" },
  CHF: { mfg: "switzerland/manufacturing-pmi",    svc: "switzerland/services-pmi",   unemp: "switzerland/unemployment-rate",   rate: "switzerland/interest-rate",   cpi: "switzerland/inflation-rate",   core: "switzerland/core-inflation-rate" },
  AUD: { mfg: "australia/manufacturing-pmi",      svc: "australia/services-pmi",     unemp: "australia/unemployment-rate",     rate: "australia/interest-rate",     cpi: "australia/inflation-rate",     core: "australia/core-inflation-rate" },
  JPY: { mfg: "japan/manufacturing-pmi",          svc: "japan/services-pmi",         unemp: "japan/unemployment-rate",         rate: "japan/interest-rate",         cpi: "japan/inflation-rate",         core: "japan/core-inflation-rate" },
  GBP: { mfg: "united-kingdom/manufacturing-pmi", svc: "united-kingdom/services-pmi",unemp: "united-kingdom/unemployment-rate",rate: "united-kingdom/interest-rate",cpi: "united-kingdom/inflation-rate",core: "united-kingdom/core-inflation-rate" },
  NZD: { mfg: "new-zealand/manufacturing-pmi",    svc: "new-zealand/services-pmi",   unemp: "new-zealand/unemployment-rate",   rate: "new-zealand/interest-rate",   cpi: "new-zealand/inflation-rate",   core: "new-zealand/core-inflation-rate" },
  CNY: { mfg: "china/manufacturing-pmi",          svc: "china/services-pmi",         unemp: "china/unemployment-rate",         rate: "china/interest-rate",         cpi: "china/inflation-rate",         core: "china/core-inflation-rate" },
};

const CURR = [
  { code: "USD", flag: "🇺🇸", label: "Etats-Unis"  },
  { code: "EUR", flag: "🇪🇺", label: "Zone Euro"   },
  { code: "CAD", flag: "🇨🇦", label: "Canada"      },
  { code: "CHF", flag: "🇨🇭", label: "Suisse"      },
  { code: "AUD", flag: "🇦🇺", label: "Australie"   },
  { code: "JPY", flag: "🇯🇵", label: "Japon"       },
  { code: "GBP", flag: "🇬🇧", label: "Royaume-Uni" },
  { code: "NZD", flag: "🇳🇿", label: "Nvl-Zelande" },
  { code: "CNY", flag: "🇨🇳", label: "Chine"       },
];

function mkData() {
  const d = {};
  CURR.forEach(c => { d[c.code] = {}; INDS.forEach(i => { d[c.code][i.id] = { prior: "", exp: "", now: "" }; }); });
  return d;
}

function toN(v) {
  const n = parseFloat(String(v || "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function getSurprise(ind, cell) {
  const n = toN(cell.now), e = toN(cell.exp);
  if (n === null || e === null) return null;
  return ind.rev ? -(n - e) : (n - e);
}

function getMag(ind, surp) {
  return Math.max(-1, Math.min(1, surp / ind.thresh));
}

function calcScore(data, code) {
  let total = 0, wTotal = 0;
  INDS.forEach(ind => {
    const cell = (data[code] || {})[ind.id] || {};
    const s = getSurprise(ind, cell);
    if (s === null) return;
    total += getMag(ind, s) * ind.w;
    wTotal += ind.w;
  });
  return wTotal === 0 ? 0 : total;
}

function hasData(data, code) {
  return INDS.some(i => {
    const c = (data[code] || {})[i.id] || {};
    return c.now !== "" && c.now !== undefined && c.now !== null;
  });
}

function cellBg(surp, ind) {
  if (surp === null) return "#0d1829";
  const m = getMag(ind, surp);
  if (m > 0.5) return "#14532d"; if (m > 0) return "#166534";
  if (m < -0.5) return "#7f1d1d"; if (m < 0) return "#991b1b";
  return "#1f2937";
}

function cellClr(surp, ind) {
  if (surp === null) return "#334155";
  const m = getMag(ind, surp);
  if (m > 0.5) return "#4ade80"; if (m > 0) return "#86efac";
  if (m < -0.5) return "#f87171"; if (m < 0) return "#fca5a5";
  return "#fbbf24";
}

function getStr(score) {
  if (score >= 0.35)  return { label: "FORT",   color: "#22c55e", bg: "#14532d" };
  if (score >= 0.10)  return { label: "MODERE", color: "#86efac", bg: "#166534" };
  if (score <= -0.35) return { label: "FAIBLE", color: "#ef4444", bg: "#7f1d1d" };
  if (score <= -0.10) return { label: "MODERE", color: "#fca5a5", bg: "#991b1b" };
  return                     { label: "NEUTRE", color: "#fbbf24", bg: "#1f2937" };
}

function getRegime(data, code) {
  if (!hasData(data, code)) return null;

  const gn = id => toN(((data[code] || {})[id] || {}).now);
  const ge = id => toN(((data[code] || {})[id] || {}).exp);

  const pmiM = gn("mfg"),  pmiMExp = ge("mfg");
  const pmiS = gn("svc"),  pmiSExp = ge("svc");
  const unemp = gn("unemp"), unempExp = ge("unemp");
  const cpi = gn("cpi"),   cpiExp = ge("cpi");
  const core = gn("core"), coreExp = ge("core");

  let pmiExpanding = null;
  if (pmiM !== null && pmiS !== null) pmiExpanding = (pmiM > 50 || pmiS > 50);
  else if (pmiM !== null) pmiExpanding = pmiM > 50;
  else if (pmiS !== null) pmiExpanding = pmiS > 50;

  const pmiMSurp = (pmiM !== null && pmiMExp !== null) ? pmiM - pmiMExp : null;
  const pmiSSurp = (pmiS !== null && pmiSExp !== null) ? pmiS - pmiSExp : null;
  let pmiBeat = null;
  if (pmiMSurp !== null || pmiSSurp !== null) pmiBeat = ((pmiMSurp || 0) + (pmiSSurp || 0)) > 0;

  let inflHigh = null;
  if (core !== null) { inflHigh = core > 2.0; if (coreExp !== null) inflHigh = inflHigh || core > coreExp; }
  else if (cpi !== null) { inflHigh = cpi > 2.0; if (cpiExp !== null) inflHigh = inflHigh || cpi > cpiExp; }

  const cpiBeat  = (cpi  !== null && cpiExp  !== null) ? cpi  - cpiExp  : null;
  const coreBeat = (core !== null && coreExp !== null) ? core - coreExp : null;
  let inflBeat = null;
  if (cpiBeat !== null || coreBeat !== null) inflBeat = (coreBeat || cpiBeat || 0) > 0;

  let empTight = null;
  if (unemp !== null && unempExp !== null) empTight = unemp < unempExp;
  else if (unemp !== null) empTight = unemp < 5.0;

  const score = calcScore(data, code);
  const pmiOk = pmiExpanding !== null ? pmiExpanding : (pmiBeat !== null ? pmiBeat : score > 0);
  const inflOk = inflHigh !== null ? inflHigh : (inflBeat !== null ? inflBeat : false);
  const empOk  = empTight !== null ? empTight : score > 0;

  const reasons = [];
  if (pmiM !== null) reasons.push({ label: "PMI Manuf",    val: pmiM,  exp: pmiMExp,  bull: pmiM > 50,                                note: pmiM > 50 ? "expansion" : "contraction" });
  if (pmiS !== null) reasons.push({ label: "PMI Services", val: pmiS,  exp: pmiSExp,  bull: pmiS > 50,                                note: pmiS > 50 ? "expansion" : "contraction" });
  if (unemp !== null) reasons.push({ label: "Chomage",     val: unemp, exp: unempExp, bull: empTight,                                 note: empTight ? "marche tendu → hawkish" : "marche mou → dovish" });
  if (cpi !== null)  reasons.push({ label: "Inflation",    val: cpi,   exp: cpiExp,   bull: inflBeat,                                 note: cpi > 2 ? "au-dessus cible → hawkish" : "sous cible → dovish" });
  if (core !== null) reasons.push({ label: "Core CPI",     val: core,  exp: coreExp,  bull: coreBeat !== null ? coreBeat > 0 : core > 2, note: core > 2 ? "au-dessus cible → hawkish" : "sous cible → dovish" });

  if (pmiOk && inflOk && empOk)   return { label: "SURCHAUFFE",    color: "#f59e0b", bg: "#f59e0b15", border: "#f59e0b44", bc: "Hawkish — BC va monter les taux",                    devise: "Forte — capitaux entrent", reasons };
  if (pmiOk && !inflOk && empOk)  return { label: "GOLDILOCKS",    color: "#22c55e", bg: "#22c55e15", border: "#22c55e44", bc: "Neutre — BC surveille l inflation",                  devise: "Stable — bonne pour le carry trade", reasons };
  if (pmiOk && inflOk && !empOk)  return { label: "SURCHAUFFE",    color: "#f59e0b", bg: "#f59e0b15", border: "#f59e0b44", bc: "Hawkish — inflation et PMI forts",                   devise: "Forte — capitaux entrent", reasons };
  if (!pmiOk && inflOk && !empOk) return { label: "STAGFLATION",   color: "#a855f7", bg: "#a855f715", border: "#a855f744", bc: "Coincee — ne peut ni monter ni baisser les taux",    devise: "Incertaine — evite ce trade", reasons };
  if (!pmiOk && !empOk)           return { label: "RECESSION",     color: "#ef4444", bg: "#ef444415", border: "#ef444444", bc: "Dovish — BC va baisser les taux",                    devise: "Faible — capitaux sortent", reasons };
  if (!pmiOk && inflOk)           return { label: "STAGFLATION",   color: "#a855f7", bg: "#a855f715", border: "#a855f744", bc: "Coincee — inflation haute mais economie faible",     devise: "Incertaine — evite ce trade", reasons };
  if (!pmiOk)                     return { label: "RALENTISSEMENT",color: "#f97316", bg: "#f9731615", border: "#f9731644", bc: "Pivot Dovish — baisses de taux a venir",             devise: "S affaiblit progressivement", reasons };
  if (score > 0.15)  return { label: "EXPANSION",  color: "#22c55e", bg: "#22c55e15", border: "#22c55e44", bc: "Hawkish — maintient les taux hauts",  devise: "Forte — capitaux entrent", reasons };
  if (score < -0.15) return { label: "RECESSION",  color: "#ef4444", bg: "#ef444415", border: "#ef444444", bc: "Dovish — va baisser les taux",         devise: "Faible — capitaux sortent", reasons };
  return                    { label: "NEUTRE",      color: "#64748b", bg: "#64748b15", border: "#64748b44", bc: "BC en observation",                    devise: "Stable — pas de biais clair", reasons };
}

function Inp({ code, id, field, data, setCell }) {
  const cell = (data[code] || {})[id] || {};
  const ind  = INDS.find(i => i.id === id);
  const surp = field === "now" ? getSurprise(ind, cell) : null;
  const val  = cell[field] !== undefined ? cell[field] : "";
  return (
    <input type="number" step="0.1" value={val}
      onChange={e => setCell(code, id, field, e.target.value)}
      placeholder="-"
      style={{ width: 44, background: field === "now" ? cellBg(surp, ind) : "#0d1829",
        border: "1px solid #1e3a5f44", borderRadius: 3,
        color: field === "now" ? cellClr(surp, ind) : "#475569",
        padding: "3px 2px", fontSize: 11, fontFamily: "monospace",
        outline: "none", textAlign: "center", fontWeight: field === "now" ? 700 : 400 }}
    />
  );
}

function RegimeCard({ data, curr }) {
  const reg = getRegime(data, curr.code);
  const [open, setOpen] = useState(true);

  if (!reg) return (
    <div style={{ background: "#0a162888", border: "1px solid #1e3a5f22", borderRadius: 8, padding: 14, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, opacity: 0.3 }}>{curr.flag}</span>
          <span style={{ fontWeight: 700, color: "#1e3a5f", letterSpacing: 2 }}>{curr.code}</span>
        </div>
        <div style={{ fontSize: 9, color: "#1e3a5f", padding: "3px 8px", border: "1px solid #1e3a5f33", borderRadius: 4 }}>EN ATTENTE</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: reg.bg, border: "1px solid " + reg.border, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{curr.flag}</span>
          <div>
            <div style={{ fontWeight: 700, color: "#e2f0ff", letterSpacing: 2, fontSize: 13 }}>{curr.code}</div>
            <div style={{ fontSize: 9, color: "#64748b" }}>{curr.label}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: reg.color, padding: "4px 10px", border: "1px solid " + reg.color + "66", borderRadius: 4, letterSpacing: 1 }}>{reg.label}</div>
          <span style={{ color: "#475569", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ padding: 10, background: "#070b14", borderRadius: 6 }}>
              <div style={{ fontSize: 8, color: "#475569", marginBottom: 4, letterSpacing: 1 }}>BANQUE CENTRALE</div>
              <div style={{ fontSize: 11, color: reg.color, fontWeight: 700 }}>{reg.bc}</div>
            </div>
            <div style={{ padding: 10, background: "#070b14", borderRadius: 6 }}>
              <div style={{ fontSize: 8, color: "#475569", marginBottom: 4, letterSpacing: 1 }}>DEVISE</div>
              <div style={{ fontSize: 11, color: reg.color, fontWeight: 700 }}>{reg.devise}</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>POURQUOI CE REGIME</div>
          {reg.reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#070b14", borderRadius: 5 }}>
              <span style={{ fontSize: 11, marginTop: 1 }}>{r.bull ? "✅" : "❌"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: r.bull ? "#4ade80" : "#f87171", minWidth: 90 }}>{r.label}</span>
                  <span style={{ fontSize: 10, color: "#e2f0ff" }}>{r.val}%</span>
                  {r.exp !== null && <span style={{ fontSize: 9, color: "#475569" }}>prevu {r.exp}%</span>}
                  {r.exp !== null && <span style={{ fontSize: 9, fontWeight: 700, color: r.bull ? "#4ade80" : "#f87171" }}>{r.val > r.exp ? "+" : ""}{(r.val - r.exp).toFixed(2)} {r.val > r.exp ? "BEAT" : "MISS"}</span>}
                </div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{r.note}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataView() {
  const [selected, setSelected] = useState("USD");
  const curr = CURR.find(c => c.code === selected);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#0a1628", border: "1px solid #38bdf844", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 8, borderBottom: "1px solid #38bdf833", paddingBottom: 8 }}>LIENS TRADING ECONOMICS</div>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 12 }}>Clique sur une devise puis sur l indicateur — Trading Economics s ouvre avec Previous / Consensus / Actual</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {CURR.map(c => (
            <button key={c.code} onClick={() => setSelected(c.code)}
              style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 4,
                border: selected === c.code ? "1px solid #38bdf8" : "1px solid #1e3a5f",
                background: selected === c.code ? "#38bdf820" : "#070b14",
                color: selected === c.code ? "#38bdf8" : "#64748b" }}>
              {c.flag} {c.code}
            </button>
          ))}
        </div>
        <div style={{ padding: 12, background: "#070b14", borderRadius: 6, border: "1px solid #1e3a5f33" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2f0ff", marginBottom: 12 }}>{curr.flag} {curr.code} — {curr.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {INDS.map(ind => (
              <a key={ind.id} href={TE + "/" + TE_LINKS[curr.code][ind.id]} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", flexDirection: "column", padding: "10px 12px", borderRadius: 6,
                  background: "#0a1628", border: "1px solid #38bdf833", color: "#38bdf8", textDecoration: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{ind.label} ↗</span>
                <span style={{ fontSize: 8, color: "#475569" }}>tradingeconomics.com</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #f59e0b44", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#f59e0b", fontWeight: 700, marginBottom: 8, borderBottom: "1px solid #f59e0b33", paddingBottom: 8 }}>COMMENT SAISIR</div>
        {[["Previous","#f59e0b","Le chiffre du mois dernier → colonne PRIOR"],["Consensus","#38bdf8","Ce que les economistes previsent → colonne EXP"],["Actual","#4ade80","Le chiffre publie aujourd hui → colonne NOW"]].map(([k,col,v]) => (
          <div key={k} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 80 }}>{k}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuideView() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 16, borderBottom: "1px solid #1e3a5f", paddingBottom: 8 }}>DANS LA TETE DE LA BANQUE CENTRALE</div>
        {[
          { title: "CORE CPI %", pct: "25%", sub: "Cherche Core Inflation Rate sur Trading Economics", desc: "Le chiffre le plus important. La BC regarde ca en premier.", good: "Chiffre publie PLUS HAUT que prevu = BC monte les taux = devise monte", bad: "Chiffre publie PLUS BAS que prevu = BC baisse les taux = devise baisse" },
          { title: "INFLATION %", pct: "25%", sub: "Cherche Inflation Rate sur Trading Economics", desc: "Confirme le Core CPI. Inclut tout: nourriture, essence, loyer.", good: "Les 2 PLUS HAUTS que prevu = signal hawkish tres fort", bad: "Les 2 PLUS BAS que prevu = signal dovish tres fort" },
          { title: "CHOMAGE %", pct: "20%", sub: "Cherche Unemployment Rate sur Trading Economics", desc: "Moins de chomage = gens travaillent = prix montent = BC monte les taux.", good: "Chiffre publie PLUS BAS que prevu = economie forte", bad: "Chiffre publie PLUS HAUT que prevu = economie faible" },
          { title: "PMI SERVICES", pct: "15%", sub: "Cherche Services PMI sur Trading Economics", desc: "Est-ce que restaurants, hotels, transports tournent bien? 75% de l economie.", good: "Chiffre publie PLUS HAUT que prevu = demande forte = BC hawkish", bad: "Chiffre publie PLUS BAS que prevu = demande faible = BC dovish" },
          { title: "PMI MANUF", pct: "10%", sub: "Cherche Manufacturing PMI sur Trading Economics", desc: "Est-ce que les usines produisent bien? Premier signal d un ralentissement.", good: "Chiffre publie PLUS HAUT que prevu = production forte", bad: "Chiffre publie PLUS BAS que prevu = ralentissement industriel" },
          { title: "TAUX %", pct: "5%", sub: "Cherche Interest Rate sur Trading Economics", desc: "Compare 2 pays. La devise avec le taux le plus haut attire les capitaux.", good: "Taux plus haut que le pays adverse = capitaux entrent = devise forte", bad: "Taux plus bas que le pays adverse = capitaux sortent = devise faible" },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 12, padding: 12, background: "#070b14", borderRadius: 6, border: "1px solid #1e3a5f33" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>{s.title}</div>
              <div style={{ fontSize: 10, color: "#475569" }}>Poids {s.pct}</div>
            </div>
            <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>{s.sub}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>{s.desc}</div>
            <div style={{ fontSize: 10, color: "#4ade80", marginBottom: 3 }}>✅ {s.good}</div>
            <div style={{ fontSize: 10, color: "#f87171" }}>❌ {s.bad}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #f59e0b44", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#f59e0b", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #f59e0b33", paddingBottom: 8 }}>REGLE D OR DE LA BC</div>
        {[["1 mois de beat","Elle note mais n agit pas"],["2 mois de beats","Elle commence a en parler publiquement"],["3 mois de beats","Elle agit sur les taux — c est la que ca bouge"]].map(([r,d]) => (
          <div key={r} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", minWidth: 130 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #38bdf844", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #38bdf833", paddingBottom: 8 }}>COMMENT LIRE LE SCORE</div>
        {[["Moins de 0.25","Ne trade pas","#ef4444"],["0.25 a 0.40","Petite position","#f59e0b"],["Plus de 0.40","Position normale","#22c55e"],["Plus de 0.60","Position maximum","#4ade80"]].map(([r,d,col]) => (
          <div key={r} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 120 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #a855f744", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#a855f7", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #a855f733", paddingBottom: 8 }}>REGIME MACRO</div>
        {[["GOLDILOCKS","#22c55e","PMI fort + CPI bas + Chomage bas","BC neutre — devises fortes montent"],["SURCHAUFFE","#f59e0b","PMI fort + CPI haut + Chomage bas","BC hawkish — taux montent — devise monte"],["STAGFLATION","#a855f7","PMI faible + CPI haut + Chomage haut","BC coincee — evite ce trade"],["RECESSION","#ef4444","PMI faible + CPI bas + Chomage haut","BC dovish — taux baissent — devise baisse"],["RALENTISSEMENT","#f97316","PMI faible uniquement","Pivot dovish imminent"]].map(([r,col,sig,act]) => (
          <div key={r} style={{ marginBottom: 8, padding: 10, background: "#070b14", borderRadius: 6, border: "1px solid " + col + "33" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 3 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#38bdf8", marginBottom: 2 }}>{sig}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{act}</div>
          </div>
        ))}
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#a855f7", fontWeight: 700, margin: "14px 0 10px", borderBottom: "1px solid #a855f733", paddingBottom: 8 }}>IMAGE GLOBALE + DECISION</div>
        {[["HAWKISH CLAIR","#22c55e","Core CPI beat + Chomage bas + PMI fort","BC monte les taux — achete la devise"],["DOVISH CLAIR","#ef4444","Core CPI miss + Chomage haut + PMI faible","BC baisse les taux — vends la devise"],["MIXTE","#f59e0b","CPI beat MAIS PMI faible ou chomage monte","Core CPI tranche — beat=hawkish / miss=dovish"],["3 contre 3","#64748b","3 indicateurs hawkish vs 3 indicateurs dovish","Ne trade pas — attends le prochain rapport"]].map(([r,col,sig,act]) => (
          <div key={r} style={{ marginBottom: 8, padding: 10, background: "#070b14", borderRadius: 6, border: "1px solid " + col + "33" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 3 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#38bdf8", marginBottom: 2 }}>{sig}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{act}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #06b6d444", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#06b6d4", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #06b6d433", paddingBottom: 8 }}>CHOISIR SA PAIRE FOREX</div>
        {[["1. SCORE","#22c55e","Prends le score le plus haut vs le plus bas","Achete le fort — vends le faible"],["2. REGIMES OPPOSES","#f59e0b","Ex: USD SURCHAUFFE vs EUR RECESSION","Signal parfait — BC dans directions opposees"],["3. ANTICIPATION","#38bdf8","Taux egaux mais beats accumules","Marche anticipe — devise monte AVANT la decision BC"],["REGLE FINALE","#4ade80","Score divergent + regimes opposes + anticipation","Les 3 alignes = trade maximum — 1 seul = attends"]].map(([r,col,sig,act]) => (
          <div key={r} style={{ marginBottom: 8, padding: 10, background: "#070b14", borderRadius: 6, border: "1px solid " + col + "33" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 3 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#06b6d4", marginBottom: 2 }}>{sig}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{act}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalView() {
  const SECTIONS = [
    { title: "CALENDRIER", color: "#38bdf8", links: [{ label: "Babypips Economic Calendar", url: "https://www.babypips.com/economic-calendar", desc: "Evenements HIGH impact de la semaine" }]},
    { title: "ANALYSE FX", color: "#a855f7", links: [{ label: "ING Think FX", url: "https://think.ing.com/market/fx/", desc: "Analyse macro FX quotidienne" },{ label: "Sucden Financial Daily FX", url: "https://www.sucdenfinancial.com/en/market-insights/fx-outlook/daily-fx-analysis/", desc: "Analyse technique et fondamentale" }]},
    { title: "SENTIMENT & FORCE", color: "#22c55e", links: [{ label: "Babypips Market Milk", url: "https://marketmilk.babypips.com/currency-strength", desc: "Force relative des devises" },{ label: "Myfxbook Outlook", url: "https://www.myfxbook.com/community/outlook", desc: "Sentiment du marche retail" }]},
    { title: "COT & POSITIONNEMENT", color: "#f59e0b", links: [{ label: "Tradingster COT", url: "https://www.tradingster.com/cot", desc: "Positions des institutionnels" }]},
    { title: "TAUX & ANTICIPATION", color: "#ef4444", links: [{ label: "Polymarket Interest Rate", url: "https://polymarket.com/fr/predictions/interest-rate", desc: "Probabilites de changement de taux" }]},
  ];
  return (
    <div style={{ padding: 16 }}>
      {SECTIONS.map(s => (
        <div key={s.title} style={{ background: "#0a1628", border: "1px solid " + s.color + "44", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, letterSpacing: 3, color: s.color, fontWeight: 700, marginBottom: 12, borderBottom: "1px solid " + s.color + "33", paddingBottom: 8 }}>{s.title}</div>
          {s.links.map(l => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", flexDirection: "column", padding: "10px 12px", borderRadius: 6, background: "#070b14", border: "1px solid " + s.color + "22", marginBottom: 8, textDecoration: "none" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 3 }}>{l.label} ↗</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>{l.desc}</span>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(mkData);
  const [view, setView] = useState("table");
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    const unsub = onValue(ref(db, "apexdata"), snap => {
      const val = snap.val();
      if (val) {
        const merged = mkData();
        CURR.forEach(c => { if (val[c.code]) INDS.forEach(i => { if (val[c.code][i.id]) merged[c.code][i.id] = val[c.code][i.id]; }); });
        setData(merged);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function setCell(code, id, field, val) {
    setData(prev => {
      const next = { ...prev };
      next[code] = { ...prev[code] };
      next[code][id] = { ...((prev[code] && prev[code][id]) || {}), [field]: val };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => set(ref(db, "apexdata"), next), 600);
      return next;
    });
  }

  function resetData() {
    if (window.confirm("Effacer toutes les donnees sur tous les appareils?")) {
      const d = mkData(); set(ref(db, "apexdata"), d); setData(d);
    }
  }

  const ranked = useMemo(() =>
    CURR.map(c => ({ ...c, score: calcScore(data, c.code), hasData: hasData(data, c.code) }))
        .sort((a, b) => b.score - a.score)
  , [data]);

  const withData = ranked.filter(c => c.hasData);
  const best  = withData[0] || ranked[0];
  const worst = withData[withData.length - 1] || ranked[ranked.length - 1];
  const div   = best && worst ? (best.score - worst.score).toFixed(2) : "0.00";
  const tradeOk = parseFloat(div) >= 0.25;

  const tab = a => ({ padding: "6px 12px", fontSize: 10, fontFamily: "monospace", cursor: "pointer", borderRadius: 4,
    letterSpacing: 1, whiteSpace: "nowrap",
    border: a ? "1px solid #38bdf8" : "1px solid #1e3a5f",
    background: a ? "#38bdf820" : "transparent", color: a ? "#38bdf8" : "#64748b" });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", fontFamily: "monospace", fontSize: 16, letterSpacing: 3 }}>
      CHARGEMENT...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#070b14", fontFamily: "monospace", color: "#c8d8f0", fontSize: 13 }}>
      <div style={{ background: "#0a1628", borderBottom: "2px solid #1e3a5f", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#38bdf8" }}>APEX MACRO</div>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>FORCE ECONOMIQUE — BIAIS BANQUE CENTRALE — SYNC TEMPS REEL</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["table","TABLEAU"],["rank","CLASSEMENT"],["regime","REGIMES"],["trade","TRADE"],["data","DONNEES ↗"],["guide","GUIDE"],["cal","RESSOURCES"]].map(([v,l]) => (
            <button key={v} style={tab(view===v)} onClick={() => setView(v)}>{l}</button>
          ))}
          <button onClick={resetData} style={{ ...tab(false), border: "1px solid #7f1d1d", color: "#ef4444" }}>RESET</button>
        </div>
      </div>

      <div style={{ background: "#090f1e", borderBottom: "1px solid #1e3a5f22", padding: "6px 16px", display: "flex", gap: 10, overflowX: "auto" }}>
        {ranked.map(c => { const st = getStr(c.score); return (
          <div key={c.code} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 46 }}>
            <span style={{ fontSize: 9, color: c.hasData ? st.color : "#1e3a5f", fontWeight: 700 }}>{c.flag} {c.code}</span>
            <div style={{ width: 40, height: 3, background: "#1e3a5f", borderRadius: 2, margin: "2px 0" }}>
              <div style={{ width: Math.min(Math.abs(c.score)*100,100)+"%", height: "100%", background: c.hasData ? st.color : "#1e3a5f", borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 7, color: c.hasData ? "#475569" : "#1e3a5f" }}>{c.score>=0?"+":""}{c.score.toFixed(2)}</span>
          </div>
        );})}
      </div>

      {view==="table" && (
        <div style={{ overflowX: "auto", padding: 12 }}>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>PRIOR → EXP → NOW | vert=beat / rouge=miss | sync Firebase temps reel</div>
          <table style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ background: "#0a1628", padding: "6px 10px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "left", minWidth: 110 }}>PAYS</th>
                {INDS.map(ind => <th key={ind.id} colSpan={3} style={{ background: "#0a1628", padding: "6px 8px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "center" }}>{ind.label}</th>)}
                <th style={{ background: "#0a1628", padding: "6px 8px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "center" }}>SCORE</th>
                <th style={{ background: "#0a1628", padding: "6px 8px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "center" }}>FORCE</th>
              </tr>
              <tr>
                <th style={{ background: "#070b14", padding: "3px 10px", border: "1px solid #1e3a5f22" }}></th>
                {INDS.map(ind => ["Prior","Exp","Now"].map(f => (
                  <th key={ind.id+f} style={{ background: "#070b14", padding: "3px 4px", fontSize: 7, color: "#334155", border: "1px solid #1e3a5f22", textAlign: "center" }}>{f}</th>
                )))}
                <th style={{ background: "#070b14", border: "1px solid #1e3a5f22" }}></th>
                <th style={{ background: "#070b14", border: "1px solid #1e3a5f22" }}></th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((c, ri) => {
                const score = calcScore(data, c.code);
                const st = getStr(score);
                const reg = getRegime(data, c.code);
                return (
                  <tr key={c.code} style={{ background: ri%2===0 ? "#070b14" : "#080d1a" }}>
                    <td style={{ padding: "5px 10px", border: "1px solid #1e3a5f22", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{c.flag}</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#e2f0ff" }}>{c.code}</div>
                          {reg && <div style={{ fontSize: 7, color: reg.color, letterSpacing: 1 }}>{reg.label}</div>}
                        </div>
                      </div>
                    </td>
                    {INDS.map(ind => {
                      const cell = (data[c.code]||{})[ind.id]||{};
                      return ["prior","exp","now"].map(f => (
                        <td key={ind.id+f} style={{ padding: "3px 3px", border: "1px solid #1e3a5f11", textAlign: "center" }}>
                          <Inp code={c.code} id={ind.id} field={f} data={data} setCell={setCell} />
                        </td>
                      ));
                    })}
                    <td style={{ padding: "4px 8px", border: "1px solid #1e3a5f22", textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{score>=0?"+":""}{score.toFixed(2)}</div>
                      <div style={{ width: 50, height: 3, background: "#1e3a5f", borderRadius: 2, margin: "3px auto 0" }}>
                        <div style={{ width: Math.min(Math.abs(score)*100,100)+"%", height: "100%", background: st.color, borderRadius: 2 }} />
                      </div>
                    </td>
                    <td style={{ padding: "4px 8px", border: "1px solid #1e3a5f22", textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: st.color, padding: "3px 8px", background: st.bg, borderRadius: 4, display: "inline-block" }}>{st.label}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view==="rank" && (
        <div style={{ padding: 12 }}>
          {ranked.map((c,i) => {
            const st = getStr(c.score);
            const reg = getRegime(data, c.code);
            const barW = Math.min(Math.abs(c.score)*150,100);
            return (
              <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 6, background: "#0a1628", border: "1px solid " + st.color + "33", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "#334155", minWidth: 20, textAlign: "right" }}>#{i+1}</div>
                <span style={{ fontSize: 22 }}>{c.flag}</span>
                <div style={{ minWidth: 40 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2f0ff" }}>{c.code}</div>
                  {reg && <div style={{ fontSize: 8, color: reg.color }}>{reg.label}</div>}
                </div>
                <div style={{ flex: 1, height: 6, background: "#1e3a5f", borderRadius: 3, position: "relative" }}>
                  <div style={{ position: "absolute", left: c.score>=0?"50%":`${50-barW/2}%`, width: `${barW/2}%`, height: "100%", background: st.color, borderRadius: 3 }} />
                  <div style={{ position: "absolute", left: "50%", top: -2, width: 1, height: 10, background: "#334155" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: st.color, minWidth: 50, textAlign: "right" }}>{c.score>=0?"+":""}{c.score.toFixed(2)}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: st.color, padding: "3px 8px", background: st.bg, borderRadius: 4, minWidth: 55, textAlign: "center" }}>{st.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {view==="regime" && (
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 10 }}>Clique pour ouvrir/fermer le detail — devises grises = pas encore de donnees</div>
          {CURR.map(c => <RegimeCard key={c.code} data={data} curr={c} />)}
        </div>
      )}

      {view==="trade" && (
        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <div style={{ textAlign: "center", padding: 20, background: "#14532d", border: "2px solid #22c55e66", borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: "#86efac", marginBottom: 6 }}>ECONOMIE FORTE</div>
              <div style={{ fontSize: 28 }}>{best.flag}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#22c55e", letterSpacing: 3 }}>{best.code}</div>
              <div style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>{best.score.toFixed(2)}</div>
              {getRegime(data,best.code) && <div style={{ fontSize: 10, color: "#86efac", marginTop: 4 }}>{getRegime(data,best.code).label}</div>}
            </div>
            <div style={{ textAlign: "center", padding: 16, background: "#0a1628", border: "2px solid " + (tradeOk?"#22c55e66":"#f59e0b66"), borderRadius: 10, minWidth: 100 }}>
              <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>DIVERGENCE</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: tradeOk?"#22c55e":"#f59e0b" }}>{div}</div>
              <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 4, background: tradeOk?"#14532d":"#1f2937", border: "1px solid "+(tradeOk?"#22c55e":"#f59e0b"), fontSize: 9, fontWeight: 700, color: tradeOk?"#22c55e":"#f59e0b" }}>{tradeOk?"✓ TRADE VALIDE":"✗ TROP FAIBLE"}</div>
              <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "#38bdf8" }}>{best.code}/{worst.code}</div>
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>LONG {best.code} / SHORT {worst.code}</div>
            </div>
            <div style={{ textAlign: "center", padding: 20, background: "#7f1d1d", border: "2px solid #ef444466", borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: "#fca5a5", marginBottom: 6 }}>ECONOMIE FAIBLE</div>
              <div style={{ fontSize: 28 }}>{worst.flag}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#ef4444", letterSpacing: 3 }}>{worst.code}</div>
              <div style={{ fontSize: 13, color: "#f87171", fontWeight: 700 }}>{worst.score.toFixed(2)}</div>
              {getRegime(data,worst.code) && <div style={{ fontSize: 10, color: "#fca5a5", marginTop: 4 }}>{getRegime(data,worst.code).label}</div>}
            </div>
          </div>
          <div style={{ background: "#070b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>REGLES</div>
            {[["Moins de 0.25","Ne trade pas","#ef4444"],["0.25 a 0.40","Petite position","#f59e0b"],["Plus de 0.40","Position normale","#22c55e"],["Plus de 0.60","Position maximum","#4ade80"]].map(([r,d,col]) => (
              <div key={r} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 100 }}>{r}</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{d}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #1e3a5f", paddingBottom: 6 }}>TOUTES LES DIVERGENCES</div>
            {withData.map(strong => [...withData].reverse().map(weak => {
              if (strong.code===weak.code || strong.score<=weak.score) return null;
              const d=(strong.score-weak.score).toFixed(2);
              if (parseFloat(d)<0.10) return null;
              const ok=parseFloat(d)>=0.25;
              return (
                <div key={strong.code+weak.code} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "7px 10px", background: "#070b1444", borderRadius: 5, border: "1px solid "+(ok?"#22c55e22":"#1e3a5f22") }}>
                  <span>{strong.flag}</span><span style={{ fontWeight: 700, color: "#22c55e", fontSize: 11 }}>{strong.code}</span>
                  <span style={{ color: "#475569", fontSize: 10 }}>vs</span>
                  <span>{weak.flag}</span><span style={{ fontWeight: 700, color: "#ef4444", fontSize: 11 }}>{weak.code}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, color: ok?"#22c55e":"#f59e0b", fontSize: 13 }}>{d}</span>
                  <span style={{ fontSize: 9, color: ok?"#22c55e":"#f59e0b", fontWeight: 700 }}>{ok?"✓":"~"}</span>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {view==="data"  && <DataView />}
      {view==="guide" && <GuideView />}
      {view==="cal"   && <CalView />}
    </div>
  );
}
