import { useState, useMemo } from "react";

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
  EUR: { mfg: "euro-area/manufacturing-pmi",     svc: "euro-area/services-pmi",     unemp: "euro-area/unemployment-rate",     rate: "euro-area/interest-rate",     cpi: "euro-area/inflation-rate",     core: "euro-area/core-inflation-rate" },
  CAD: { mfg: "canada/manufacturing-pmi",        svc: "canada/services-pmi",        unemp: "canada/unemployment-rate",        rate: "canada/interest-rate",        cpi: "canada/inflation-rate",        core: "canada/core-inflation-rate" },
  CHF: { mfg: "switzerland/manufacturing-pmi",   svc: "switzerland/services-pmi",   unemp: "switzerland/unemployment-rate",   rate: "switzerland/interest-rate",   cpi: "switzerland/inflation-rate",   core: "switzerland/core-inflation-rate" },
  AUD: { mfg: "australia/manufacturing-pmi",     svc: "australia/services-pmi",     unemp: "australia/unemployment-rate",     rate: "australia/interest-rate",     cpi: "australia/inflation-rate",     core: "australia/core-inflation-rate" },
  JPY: { mfg: "japan/manufacturing-pmi",         svc: "japan/services-pmi",         unemp: "japan/unemployment-rate",         rate: "japan/interest-rate",         cpi: "japan/inflation-rate",         core: "japan/core-inflation-rate" },
  GBP: { mfg: "united-kingdom/manufacturing-pmi",svc: "united-kingdom/services-pmi",unemp: "united-kingdom/unemployment-rate",rate: "united-kingdom/interest-rate",cpi: "united-kingdom/inflation-rate",core: "united-kingdom/core-inflation-rate" },
  NZD: { mfg: "new-zealand/manufacturing-pmi",   svc: "new-zealand/services-pmi",   unemp: "new-zealand/unemployment-rate",   rate: "new-zealand/interest-rate",   cpi: "new-zealand/inflation-rate",   core: "new-zealand/core-inflation-rate" },
  CNY: { mfg: "china/manufacturing-pmi",         svc: "china/services-pmi",         unemp: "china/unemployment-rate",         rate: "china/interest-rate",         cpi: "china/inflation-rate",         core: "china/core-inflation-rate" },
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

function toN(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function getSurprise(ind, cell) {
  const n = toN(cell.now), e = toN(cell.exp);
  if (n === null || e === null) return null;
  return ind.rev ? -(n - e) : (n - e);
}
function getMag(ind, surp) { return Math.max(-1, Math.min(1, surp / ind.thresh)); }

function calcScore(data, code) {
  let total = 0, wTotal = 0;
  INDS.forEach(ind => {
    const s = getSurprise(ind, data[code][ind.id]);
    if (s === null) return;
    total += getMag(ind, s) * ind.w;
    wTotal += ind.w;
  });
  return wTotal === 0 ? 0 : total;
}

function cellBg(surp, ind) {
  if (surp === null) return "#111827";
  const m = getMag(ind, surp);
  if (m > 0.5) return "#14532d"; if (m > 0) return "#166534";
  if (m < -0.5) return "#7f1d1d"; if (m < 0) return "#991b1b";
  return "#1f2937";
}

function cellClr(surp, ind) {
  if (surp === null) return "#e2f0ff";
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
  const pmi = (getSurprise(INDS.find(i=>i.id==="mfg"), data[code]["mfg"]) || 0) + (getSurprise(INDS.find(i=>i.id==="svc"), data[code]["svc"]) || 0);
  const inf = (getSurprise(INDS.find(i=>i.id==="cpi"), data[code]["cpi"]) || 0) + (getSurprise(INDS.find(i=>i.id==="core"), data[code]["core"]) || 0);
  const pmiUp = pmi > 0, infUp = inf > 0;
  if (pmiUp && !infUp)  return { label: "GOLDILOCKS", color: "#22c55e" };
  if (pmiUp && infUp)   return { label: "SURCHAUFFE", color: "#f59e0b" };
  if (!pmiUp && infUp)  return { label: "STAGFLATION", color: "#ef4444" };
  if (!pmiUp && !infUp) return { label: "RECESSION",   color: "#94a3b8" };
  return { label: "INCONNU", color: "#475569" };
}

function Inp({ code, id, field, data, setCell }) {
  const cell = data[code][id];
  const ind  = INDS.find(i => i.id === id);
  const surp = field === "now" ? getSurprise(ind, cell) : null;
  return (
    <input type="number" step="0.1" value={cell[field]}
      onChange={e => setCell(code, id, field, e.target.value)}
      placeholder="-"
      style={{ width: 44, background: field === "now" ? cellBg(surp, ind) : "#111827",
        border: "1px solid #1e3a5f44", borderRadius: 3,
        color: field === "now" ? cellClr(surp, ind) : "#94a3b8",
        padding: "3px 2px", fontSize: 11, fontFamily: "monospace",
        outline: "none", textAlign: "center", fontWeight: field === "now" ? 700 : 400 }}
    />
  );
}

function DataView() {
  const [selected, setSelected] = useState("USD");
  const curr = CURR.find(c => c.code === selected);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#0a1628", border: "1px solid #38bdf844", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 8, borderBottom: "1px solid #38bdf833", paddingBottom: 8 }}>
          LIENS TRADING ECONOMICS
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 12 }}>
          Clique sur une devise → clique sur l indicateur → Trading Economics s ouvre → tu vois <span style={{color:"#f59e0b"}}>Previous</span> / <span style={{color:"#38bdf8"}}>Consensus</span> / <span style={{color:"#4ade80"}}>Actual</span> → tu saisis dans le tableau
        </div>
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2f0ff", marginBottom: 12 }}>
            {curr.flag} {curr.code} — {curr.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {INDS.map(ind => (
              <a key={ind.id}
                href={TE + "/" + TE_LINKS[curr.code][ind.id]}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", flexDirection: "column", padding: "10px 12px", borderRadius: 6,
                  background: "#0a1628", border: "1px solid #38bdf833",
                  color: "#38bdf8", textDecoration: "none", cursor: "pointer" }}>
                <span style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{ind.label} ↗</span>
                <span style={{ fontSize: 8, color: "#475569" }}>tradingeconomics.com</span>
                <span style={{ fontSize: 8, color: "#1e3a5f", marginTop: 2 }}>{TE_LINKS[curr.code][ind.id]}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #f59e0b44", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#f59e0b", fontWeight: 700, marginBottom: 8, borderBottom: "1px solid #f59e0b33", paddingBottom: 8 }}>
          COMMENT SAISIR LES DONNEES
        </div>
        {[
          ["Previous", "#f59e0b", "Le chiffre du mois dernier → colonne PRIOR dans le tableau"],
          ["Consensus", "#38bdf8", "Ce que les economistes previsent → colonne EXP dans le tableau"],
          ["Actual",    "#4ade80", "Le chiffre publie aujourd hui → colonne NOW dans le tableau"],
        ].map(([k, col, v]) => (
          <div key={k} style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 80 }}>{k}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuideView() {
  const sections = [
    { title: "CORE CPI %", sub: "Cherche Core Inflation Rate sur Trading Economics", desc: "Le chiffre le plus important. La BC regarde ca en premier.", good: "Chiffre publie PLUS HAUT que prevu = BC monte les taux = devise monte", bad: "Chiffre publie PLUS BAS que prevu = BC baisse les taux = devise baisse", pct: "25%" },
    { title: "INFLATION %", sub: "Cherche Inflation Rate sur Trading Economics", desc: "Confirme le Core CPI. Inclut tout: nourriture, essence, loyer.", good: "Les 2 PLUS HAUTS que prevu = signal hawkish tres fort", bad: "Les 2 PLUS BAS que prevu = signal dovish tres fort", pct: "25%" },
    { title: "CHOMAGE %", sub: "Cherche Unemployment Rate sur Trading Economics", desc: "Moins de chomage = gens travaillent = prix montent = BC monte les taux.", good: "Chiffre publie PLUS BAS que prevu = economie forte", bad: "Chiffre publie PLUS HAUT que prevu = economie faible", pct: "20%" },
    { title: "PMI SERVICES", sub: "Cherche Services PMI sur Trading Economics", desc: "Est-ce que restaurants, hotels, transports tournent bien? 75% de l economie.", good: "Chiffre publie PLUS HAUT que prevu = demande forte = BC hawkish", bad: "Chiffre publie PLUS BAS que prevu = demande faible = BC dovish", pct: "15%" },
    { title: "PMI MANUF", sub: "Cherche Manufacturing PMI sur Trading Economics", desc: "Est-ce que les usines produisent bien? Premier signal d un ralentissement.", good: "Chiffre publie PLUS HAUT que prevu = production forte", bad: "Chiffre publie PLUS BAS que prevu = ralentissement industriel", pct: "10%" },
    { title: "TAUX %", sub: "Cherche Interest Rate sur Trading Economics", desc: "Taux actuel de la BC. Ne cherche pas une surprise — compare 2 pays. La devise avec le taux le plus haut attire les capitaux etrangers.", good: "Taux plus haut que le pays adverse = capitaux entrent = devise forte", bad: "Taux plus bas que le pays adverse = capitaux sortent = devise faible", pct: "5%" },
  ];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 16, borderBottom: "1px solid #1e3a5f", paddingBottom: 8 }}>DANS LA TETE DE LA BANQUE CENTRALE</div>
        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: 12, padding: 12, background: "#070b14", borderRadius: 6, border: "1px solid #1e3a5f33" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>{s.title}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569" }}>Poids {s.pct}</div>
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
          <div key={r} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", minWidth: 130 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0a1628", border: "1px solid #38bdf844", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #38bdf833", paddingBottom: 8 }}>COMMENT LIRE LE SCORE</div>
        {[["Divergence moins de 0.25","Ne trade pas — signal trop faible","#ef4444"],["Divergence 0.25 a 0.40","Petite position — signal modere","#f59e0b"],["Divergence plus de 0.40","Position normale — signal fort","#22c55e"],["Divergence plus de 0.60","Position maximum — signal tres fort","#4ade80"]].map(([r,d,col]) => (
          <div key={r} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 160 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{d}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0a1628", border: "1px solid #a855f744", borderRadius: 8, padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#a855f7", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #a855f733", paddingBottom: 8 }}>REGIME MACRO</div>
        {[["GOLDILOCKS","PMI fort + CPI bas + Chomage bas","BC neutre — devises fortes montent","#22c55e"],["SURCHAUFFE","PMI fort + CPI haut + Chomage bas","BC hawkish — taux montent — devise monte","#f59e0b"],["STAGFLATION","PMI faible + CPI haut + Chomage haut","BC coincee — evite ce trade","#ef4444"],["RECESSION","PMI faible + CPI bas + Chomage haut","BC dovish — taux baissent — devise baisse","#94a3b8"]].map(([r,sig,act,col]) => (
          <div key={r} style={{ marginBottom: 8, padding: 10, background: "#070b14", borderRadius: 6, border: "1px solid #1e3a5f33" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 3 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#38bdf8", marginBottom: 2 }}>{sig}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{act}</div>
          </div>
        ))}
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#a855f7", fontWeight: 700, margin: "14px 0 10px", borderBottom: "1px solid #a855f733", paddingBottom: 8 }}>IMAGE GLOBALE + DECISION</div>
        {[["HAWKISH CLAIR","Core CPI beat + Chomage bas + PMI fort","BC monte les taux — achete la devise","#22c55e"],["DOVISH CLAIR","Core CPI miss + Chomage haut + PMI faible","BC baisse les taux — vends la devise","#ef4444"],["MIXTE","Ex: CPI beat MAIS PMI faible ou chomage monte","Core CPI tranche — beat = hawkish / miss = dovish","#f59e0b"],["3 contre 3","3 indicateurs hawkish vs 3 indicateurs dovish","Ne trade pas — attends le prochain rapport","#64748b"]].map(([r,sig,act,col]) => (
          <div key={r} style={{ marginBottom: 8, padding: 10, background: "#070b14", borderRadius: 6, border: "1px solid #1e3a5f33" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 3 }}>{r}</div>
            <div style={{ fontSize: 10, color: "#38bdf8", marginBottom: 2 }}>{sig}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{act}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0a1628", border: "1px solid #06b6d444", borderRadius: 8, padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#06b6d4", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #06b6d433", paddingBottom: 8 }}>CHOISIR SA PAIRE FOREX</div>
        {[["1. SCORE","Prends le score le plus haut vs le plus bas","Achete le fort — vends le faible","#22c55e"],["2. REGIMES OPPOSES","Ex: USD SURCHAUFFE vs EUR RECESSION","Signal parfait — BC dans directions opposees","#f59e0b"],["3. ANTICIPATION","Taux egaux aujourdhui mais beats accumules","Marche anticipe — devise monte AVANT la decision BC","#38bdf8"],["REGLE FINALE","Score divergent + regimes opposes + anticipation","Les 3 alignes = trade maximum — 1 seul = attends","#4ade80"]].map(([r,sig,act,col]) => (
          <div key={r} style={{ marginBottom: 8, padding: 10, background: "#070b14", borderRadius: 6, border: "1px solid #1e3a5f33" }}>
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
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const MAP = {USD:"United States",EUR:"Euro Zone",CAD:"Canada",CHF:"Switzerland",AUD:"Australia",JPY:"Japan",GBP:"United Kingdom",NZD:"New Zealand",CNY:"China"};
  React.useEffect(() => {
    fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json")
      .then(r=>r.json()).then(d=>{
        const filtered = d.filter(e=>e.impact==="High" && Object.values(MAP).includes(e.country));
        setEvents(filtered); setLoading(false);
      }).catch(()=>setLoading(false));
  },[]);
  const getCode = country => Object.keys(MAP).find(k=>MAP[k]===country)||"";
  const fmt = date => { const d=new Date(date); return d.toLocaleDateString("fr-CA",{weekday:"short",month:"short",day:"numeric"})+" "+d.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}); };
  return (
    <div style={{padding:16}}>
      <div style={{background:"#0a1628",border:"1px solid #38bdf844",borderRadius:8,padding:16}}>
        <div style={{fontSize:12,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:12,borderBottom:"1px solid #38bdf833",paddingBottom:8}}>CALENDRIER — EVENEMENTS HIGH IMPACT</div>
        {loading && <div style={{color:"#475569",fontSize:11}}>Chargement...</div>}
        {!loading && events.length===0 && <div style={{color:"#475569",fontSize:11}}>Aucun evenement HIGH cette semaine</div>}
        {events.map((e,i)=>{
          const code=getCode(e.country);
          const curr=CURR.find(c=>c.code===code);
          return(
            <div key={i} style={{marginBottom:8,padding:10,background:"#070b14",borderRadius:6,border:"1px solid #ef444433"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:16}}>{curr?curr.flag:""}</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#ef4444"}}>{code}</span>
                  <span style={{fontSize:10,color:"#e2f0ff"}}>{e.title}</span>
                </div>
                <span style={{fontSize:9,color:"#475569"}}>{fmt(e.date)}</span>
              </div>
              <div style={{display:"flex",gap:12}}>
                {e.forecast&&<span style={{fontSize:9,color:"#38bdf8"}}>Prev: {e.forecast}</span>}
                {e.previous&&<span style={{fontSize:9,color:"#f59e0b"}}>Precedent: {e.previous}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function App() {
  const [data, setData] = useState(() => { try { const s = localStorage.getItem("apexdata"); return s ? JSON.parse(s) : mkData(); } catch { return mkData(); } });
  const [view, setView] = useState("table");

  function setCell(code, id, field, val) {
    setData(p => { const n={...p}; n[code]={...p[code]}; n[code][id]={...p[code][id],[field]:val}; localStorage.setItem("apexdata", JSON.stringify(n)); return n; });
  }

  function resetData() {
    if (confirm("Effacer toutes les donnees?")) {
      const d = mkData();
      localStorage.setItem("apexdata", JSON.stringify(d));
      setData(d);
    }
  }

  const ranked = useMemo(() =>
    CURR.map(c => ({ ...c, score: calcScore(data, c.code) })).sort((a,b) => b.score - a.score)
  , [data]);

  const best = ranked[0], worst = ranked[ranked.length-1];
  const div = (best.score - worst.score).toFixed(2);
  const tradeOk = parseFloat(div) >= 0.25;

  const tab = a => ({ padding: "6px 16px", fontSize: 11, fontFamily: "monospace", cursor: "pointer", borderRadius: 4,
    border: a ? "1px solid #38bdf8" : "1px solid #1e3a5f",
    background: a ? "#38bdf820" : "transparent", color: a ? "#38bdf8" : "#64748b" });

  return (
    <div style={{ minHeight: "100vh", background: "#070b14", fontFamily: "monospace", color: "#c8d8f0", fontSize: 13 }}>
      <div style={{ background: "#0a1628", borderBottom: "2px solid #1e3a5f", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 3, color: "#38bdf8" }}>APEX MACRO</div>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>FORCE ECONOMIQUE — BIAIS BANQUE CENTRALE</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={tab(view==="table")}  onClick={() => setView("table")}>TABLEAU</button>
          <button style={tab(view==="rank")}   onClick={() => setView("rank")}>CLASSEMENT</button>
          <button style={tab(view==="regime")} onClick={() => setView("regime")}>REGIMES</button>
          <button style={tab(view==="trade")}  onClick={() => setView("trade")}>TRADE</button>
          <button style={tab(view==="data")}   onClick={() => setView("data")}>DONNEES ↗</button>
          <button style={tab(view==="guide")}  onClick={() => setView("guide")}>GUIDE</button>
          <button style={tab(view==="cal")} onClick={() => setView("cal")}>CALENDRIER</button>
          <button onClick={resetData} style={{ padding: "6px 12px", fontSize: 11, fontFamily: "monospace", cursor: "pointer", borderRadius: 4, border: "1px solid #7f1d1d", background: "transparent", color: "#ef4444" }}>RESET</button>
        </div>
      </div>

      <div style={{ background: "#090f1e", borderBottom: "1px solid #1e3a5f22", padding: "6px 16px", display: "flex", gap: 10, overflowX: "auto" }}>
        {ranked.map(c => { const st=getStr(c.score); return (
          <div key={c.code} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
            <span style={{ fontSize: 9, color: st.color, fontWeight: 700 }}>{c.code}</span>
            <div style={{ width: 36, height: 3, background: "#1e3a5f", borderRadius: 2, margin: "2px 0" }}>
              <div style={{ width: Math.min(Math.abs(c.score)*100,100)+"%", height: "100%", background: st.color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 7, color: "#475569" }}>{c.score>=0?"+":""}{c.score.toFixed(2)}</span>
          </div>
        );})}
      </div>

      {view==="table" && (
        <div style={{ overflowX: "auto", padding: 12 }}>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>PRIOR → EXP → NOW (vert=beat / rouge=miss)</div>
          <table style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ background: "#0a1628", padding: "6px 10px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "left", minWidth: 120 }}>PAYS</th>
                {INDS.map(ind => <th key={ind.id} colSpan={3} style={{ background: "#0a1628", padding: "6px 8px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "center" }}>{ind.label}</th>)}
                <th style={{ background: "#0a1628", padding: "6px 10px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "center", minWidth: 80 }}>SCORE</th>
                <th style={{ background: "#0a1628", padding: "6px 10px", fontSize: 10, color: "#38bdf8", border: "1px solid #1e3a5f33", textAlign: "center", minWidth: 80 }}>FORCE</th>
              </tr>
              <tr>
                <th style={{ background: "#0d1d35", border: "1px solid #1e3a5f22" }} />
                {INDS.map(ind => ["Prior","Exp","Now"].map(f => <th key={ind.id+f} style={{ background: "#0d1d35", padding: "3px 4px", fontSize: 8, color: "#475569", border: "1px solid #1e3a5f22", textAlign: "center" }}>{f}</th>))}
                <th style={{ background: "#0d1d35", border: "1px solid #1e3a5f22" }} />
                <th style={{ background: "#0d1d35", border: "1px solid #1e3a5f22" }} />
              </tr>
            </thead>
            <tbody>
              {ranked.map((c,ri) => { const st=getStr(c.score); return (
                <tr key={c.code} style={{ background: ri%2===0?"#0a162810":"transparent" }}>
                  <td style={{ padding: "5px 10px", border: "1px solid #1e3a5f22", fontWeight: 700, color: "#e2f0ff", whiteSpace: "nowrap" }}>
                    <span style={{ marginRight: 6 }}>{c.flag}</span>
                    <span style={{ fontSize: 12, letterSpacing: 1 }}>{c.code}</span>
                    <span style={{ fontSize: 9, color: "#475569", marginLeft: 6 }}>#{ri+1}</span>
                  </td>
                  {INDS.map(ind => ["prior","exp","now"].map(field => (
                    <td key={ind.id+field} style={{ padding: "4px 3px", border: "1px solid #1e3a5f22", textAlign: "center" }}>
                      <Inp code={c.code} id={ind.id} field={field} data={data} setCell={setCell} />
                    </td>
                  )))}
                  <td style={{ padding: "5px 8px", border: "1px solid #1e3a5f22", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: st.color }}>{c.score>=0?"+":""}{c.score.toFixed(2)}</div>
                    <div style={{ width: "80%", height: 4, background: "#1e3a5f", borderRadius: 2, margin: "3px auto 0" }}>
                      <div style={{ width: Math.min(Math.abs(c.score)*100,100)+"%", height:"100%", background: st.color, borderRadius: 2 }} />
                    </div>
                  </td>
                  <td style={{ padding: "5px 8px", border: "1px solid #1e3a5f22", textAlign: "center" }}>
                    <div style={{ background: st.bg, border: "1px solid "+st.color+"55", borderRadius: 4, padding: "3px 6px", fontSize: 10, fontWeight: 700, color: st.color }}>{st.label}</div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {view==="rank" && (
        <div style={{ padding: 16 }}>
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #1e3a5f", paddingBottom: 6 }}>CLASSEMENT — FORT → FAIBLE</div>
            {ranked.map((c,i) => { const st=getStr(c.score); return (
              <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "10px 12px", background: "#070b1466", borderRadius: 6, border: "1px solid "+st.color+"33" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#1e3a5f", minWidth: 30 }}>#{i+1}</span>
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ fontWeight: 700, color: "#e2f0ff", minWidth: 40, letterSpacing: 2, fontSize: 13 }}>{c.code}</span>
                <div style={{ flex: 1, height: 10, background: "#1e3a5f", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: Math.min(Math.abs(c.score)*100,100)+"%", height: "100%", background: st.color, borderRadius: 5 }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: st.color, minWidth: 52, textAlign: "right" }}>{c.score>=0?"+":""}{c.score.toFixed(2)}</span>
                <div style={{ background: st.bg, border: "1px solid "+st.color+"55", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: st.color, minWidth: 60, textAlign: "center" }}>{st.label}</div>
              </div>
            );})}
          </div>
        </div>
      )}

      {view==="trade" && (
        <div style={{ padding: 16 }}>
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontWeight: 700, marginBottom: 16, borderBottom: "1px solid #1e3a5f", paddingBottom: 6 }}>MEILLEUR TRADE — DIVERGENCE MACRO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", marginBottom: 20 }}>
              <div style={{ textAlign: "center", padding: 20, background: "#14532d", border: "2px solid #22c55e66", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#86efac", marginBottom: 6 }}>ECONOMIE FORTE</div>
                <div style={{ fontSize: 28 }}>{best.flag}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e", letterSpacing: 3 }}>{best.code}</div>
                <div style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>{best.score>=0?"+":""}{best.score.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "#86efac", marginTop: 4 }}>{getStr(best.score).label}</div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: getRegime(data, best.code).color }}>{getRegime(data, best.code).label}</div>
              </div>
              <div style={{ textAlign: "center", padding: "10px 6px" }}>
                <div style={{ fontSize: 9, color: "#64748b", marginBottom: 6 }}>DIVERGENCE</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: tradeOk?"#22c55e":"#f59e0b" }}>{div}</div>
                <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 4, background: tradeOk?"#14532d":"#1f2937", border: "1px solid "+(tradeOk?"#22c55e":"#f59e0b"), fontSize: 9, fontWeight: 700, color: tradeOk?"#22c55e":"#f59e0b" }}>{tradeOk?"✓ TRADE VALIDE":"✗ TROP FAIBLE"}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: "#38bdf8" }}>{best.code}/{worst.code}</div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>LONG {best.code} / SHORT {worst.code}</div>
              </div>
              <div style={{ textAlign: "center", padding: 20, background: "#7f1d1d", border: "2px solid #ef444466", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#fca5a5", marginBottom: 6 }}>ECONOMIE FAIBLE</div>
                <div style={{ fontSize: 28 }}>{worst.flag}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#ef4444", letterSpacing: 3 }}>{worst.code}</div>
                <div style={{ fontSize: 13, color: "#f87171", fontWeight: 700 }}>{worst.score.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "#fca5a5", marginTop: 4 }}>{getStr(worst.score).label}</div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: getRegime(data, worst.code).color }}>{getRegime(data, worst.code).label}</div>
              </div>
            </div>
            <div style={{ background: "#070b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>REGLES</div>
              {[["moins de 0.25","Ne trade pas","#ef4444"],["0.25 a 0.40","Petite position","#f59e0b"],["plus de 0.40","Position normale","#22c55e"],["plus de 0.60","Position maximum","#4ade80"]].map(([r,d,col]) => (
                <div key={r} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 100 }}>{r}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view==="data"  && <DataView />}
      {view==="regime" && (
        <div style={{ padding: 16 }}>
          {CURR.map(c => { const r=getRegime(data,c.code); const impl={GOLDILOCKS:{bc:"Neutre — surveille inflation",dev:"Stable — depend des autres",col:"#22c55e"},SURCHAUFFE:{bc:"Hawkish — va monter les taux",dev:"Forte — capitaux entrent",col:"#f59e0b"},STAGFLATION:{bc:"Coincee — ne peut ni monter ni baisser",dev:"Incertaine — evite",col:"#ef4444"},RECESSION:{bc:"Dovish — va baisser les taux",dev:"Faible — capitaux sortent",col:"#94a3b8"},INCONNU:{bc:"Donnees insuffisantes",dev:"Entrez les donnees dans le tableau",col:"#475569"}}[r.label]||{bc:"?",dev:"?",col:"#475569"}; return (
            <div key={c.code} style={{ background: "#0a1628", border: "1px solid "+r.color+"44", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e2f0ff" }}>{c.code}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.color, background: r.color+"22", padding: "3px 10px", borderRadius: 4 }}>{r.label}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, background: "#070b14", borderRadius: 6, padding: "6px 10px", minWidth: 120 }}>
                  <div style={{ fontSize: 8, color: "#475569", marginBottom: 2 }}>BANQUE CENTRALE</div>
                  <div style={{ fontSize: 10, color: impl.col }}>{impl.bc}</div>
                </div>
                <div style={{ flex: 1, background: "#070b14", borderRadius: 6, padding: "6px 10px", minWidth: 120 }}>
                  <div style={{ fontSize: 8, color: "#475569", marginBottom: 2 }}>DEVISE</div>
                  <div style={{ fontSize: 10, color: impl.col }}>{impl.dev}</div>
                </div>
              </div>
            </div>
          );})}
        </div>
      )}
      {view==="guide" && <GuideView />}
      {view==="cal" && <CalView />}
    </div>
  );
}
