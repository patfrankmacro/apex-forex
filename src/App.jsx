import SentimentView from "./SentimentView";
import { useState, useMemo, useEffect } from "react";
import { db } from "./firebase.js";
import { ref, onValue, set } from "firebase/database";

const INDS = [
  { id: "cpi",   label: "Inflation",         unit: "%", thresh: 0.2,  rev: false, wInf: 0.45, wGrow: 0.00, tier: 1, desc: "Inflation headline" },
  { id: "core",  label: "Core Inflation",    unit: "%", thresh: 0.15, rev: false, wInf: 0.55, wGrow: 0.00, tier: 1, desc: "Inflation sous-jacente" },
  { id: "unemp", label: "Unemployment Rate", unit: "%", thresh: 0.2,  rev: true,  wInf: 0.00, wGrow: 0.40, tier: 2, desc: "Marché du travail" },
  { id: "svc",   label: "Services PMI",      unit: "",  thresh: 1.5,  rev: false, wInf: 0.00, wGrow: 0.35, tier: 2, desc: "70% de l'économie" },
  { id: "mfg",   label: "Manufacturing PMI", unit: "",  thresh: 2.0,  rev: false, wInf: 0.00, wGrow: 0.15, tier: 3, desc: "Activité industrielle" },
  { id: "rate",  label: "Funds Rate",        unit: "%", thresh: 0.25, rev: false, wInf: 0.00, wGrow: 0.10, tier: 3, desc: "Décision banque centrale" },
];

const BC_TARGETS = { USD:2.0, EUR:2.0, CAD:2.0, CHF:1.0, AUD:2.5, JPY:2.0, GBP:2.0, NZD:2.0, CNY:3.0 };
const BC_WEIGHTS = {
  USD: { inf: 0.50, grow: 0.50 },
  EUR: { inf: 0.70, grow: 0.30 },
  GBP: { inf: 0.65, grow: 0.35 },
  CHF: { inf: 0.70, grow: 0.30 },
  CAD: { inf: 0.60, grow: 0.40 },
  JPY: { inf: 0.40, grow: 0.60 },
  AUD: { inf: 0.45, grow: 0.55 },
  NZD: { inf: 0.65, grow: 0.35 },
  CNY: { inf: 0.50, grow: 0.50 },
};


const CURR = [
  { code: "USD", flag: "🇺🇸", label: "États-Unis",  bc: "Fed" },
  { code: "EUR", flag: "🇪🇺", label: "Zone Euro",   bc: "BCE" },
  { code: "CAD", flag: "🇨🇦", label: "Canada",      bc: "BoC" },
  { code: "CHF", flag: "🇨🇭", label: "Suisse",      bc: "BNS" },
  { code: "AUD", flag: "🇦🇺", label: "Australie",   bc: "RBA" },
  { code: "JPY", flag: "🇯🇵", label: "Japon",       bc: "BoJ" },
  { code: "GBP", flag: "🇬🇧", label: "Royaume-Uni", bc: "BoE" },
  { code: "NZD", flag: "🇳🇿", label: "Nvl-Zélande", bc: "RBNZ" },
  { code: "CNY", flag: "🇨🇳", label: "Chine",       bc: "PBoC" },
];

const PAIR_ORDER = ["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY","CNY"];

const SENT_PAIRS=[
  {name:"EURUSD",base:"EUR",quote:"USD"},{name:"GBPUSD",base:"GBP",quote:"USD"},
  {name:"USDJPY",base:"USD",quote:"JPY"},{name:"USDCAD",base:"USD",quote:"CAD"},
  {name:"AUDUSD",base:"AUD",quote:"USD"},{name:"NZDUSD",base:"NZD",quote:"USD"},
  {name:"USDCHF",base:"USD",quote:"CHF"},{name:"GBPJPY",base:"GBP",quote:"JPY"},
  {name:"EURJPY",base:"EUR",quote:"JPY"},{name:"AUDJPY",base:"AUD",quote:"JPY"},
  {name:"EURAUD",base:"EUR",quote:"AUD"},{name:"GBPAUD",base:"GBP",quote:"AUD"},
  {name:"EURGBP",base:"EUR",quote:"GBP"},{name:"AUDNZD",base:"AUD",quote:"NZD"},
  {name:"CHFJPY",base:"CHF",quote:"JPY"},{name:"GBPCAD",base:"GBP",quote:"CAD"},
  {name:"EURCAD",base:"EUR",quote:"CAD"},{name:"AUDCAD",base:"AUD",quote:"CAD"},
  {name:"NZDJPY",base:"NZD",quote:"JPY"},
];
const CFTC_CODES={EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
const MFX_EMAIL="patrice-bonneau@outlook.com";
const MFX_PASS="Fucktoi69$";

function analyzeRetailS(s){
  if(!s)return null;
  const lp=s.longPercentage,sp=s.shortPercentage;
  if(lp>=75)return{bias:"BAISSIER",strength:"EXTREME",lp,sp};
  if(sp>=75)return{bias:"HAUSSIER",strength:"EXTREME",lp,sp};
  if(lp>=65)return{bias:"BAISSIER",strength:"FORT",lp,sp};
  if(sp>=65)return{bias:"HAUSSIER",strength:"FORT",lp,sp};
  if(lp>=55)return{bias:"BAISSIER",strength:"MODERE",lp,sp};
  if(sp>=55)return{bias:"HAUSSIER",strength:"MODERE",lp,sp};
  return{bias:"NEUTRE",strength:"NUL",lp,sp};
}
function analyzeCurrencyS(d){
  if(!d)return null;
  const range=d.max52-d.min52;
  const pct=range===0?50:Math.round(((d.net-d.min52)/range)*100);
  if(pct>=90)return{bias:"HAUSSIER",strength:"EXTREME",pct};
  if(pct<=10)return{bias:"BAISSIER",strength:"EXTREME",pct};
  if(pct>=65)return{bias:"HAUSSIER",strength:"FORT",pct};
  if(pct<=35)return{bias:"BAISSIER",strength:"FORT",pct};
  if(pct>=55)return{bias:"HAUSSIER",strength:"MODERE",pct};
  if(pct<=45)return{bias:"BAISSIER",strength:"MODERE",pct};
  return{bias:"NEUTRE",strength:"NUL",pct};
}
function analyzePairCOTS(bCur,qCur){
  if(!bCur||!qCur)return null;
  const spread=bCur.pct-qCur.pct,abs=Math.abs(spread);
  const bias=spread>0?"HAUSSIER":spread<0?"BAISSIER":"NEUTRE";
  const strength=abs>=60?"EXTREME":abs>=40?"FORT":abs>=20?"MODERE":"NUL";
  return{bias,strength,spread,base:bCur,quote:qCur};
}
function buildSignalS(rA,pCot){
  if(!rA||!pCot)return{valid:false};
  if(rA.bias==="NEUTRE"||pCot.bias==="NEUTRE")return{valid:false};
  if(rA.bias!==pCot.bias)return{valid:false};
  const rs=rA.strength,cs=pCot.strength;
  const both=rs==="EXTREME"&&cs==="EXTREME";
  const fort=(rs==="EXTREME"||rs==="FORT")&&(cs==="EXTREME"||cs==="FORT");
  const bias=rA.bias;
  let label,color,bg;
  if(bias==="HAUSSIER"){
    if(both){label="\u{1F525}\u{1F525} MACRO+SENTIMENT PARFAIT HAUSSIER";color="#22c55e";bg="#14532d";}
    else if(fort){label="\u{1F525} MACRO+SENTIMENT FORT HAUSSIER";color="#4ade80";bg="#14532d";}
    else{label="\u2191 MACRO+SENTIMENT HAUSSIER";color="#86efac";bg="#166534";}
  }else{
    if(both){label="\u{1F525}\u{1F525} MACRO+SENTIMENT PARFAIT BAISSIER";color="#ef4444";bg="#7f1d1d";}
    else if(fort){label="\u{1F525} MACRO+SENTIMENT FORT BAISSIER";color="#f87171";bg="#7f1d1d";}
    else{label="\u2193 MACRO+SENTIMENT BAISSIER";color="#fca5a5";bg="#991b1b";}
  }
  return{valid:true,bias,label,color,bg,retailStrength:rs,cotStrength:cs,bothExtreme:both,rA,pCot};
}
async function fetchCOTApp(code){
  try{
    const url="https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
    const rows=await(await fetch(url)).json();
    if(!rows||!rows.length)return null;
    const nets=rows.map(r=>parseFloat(r.noncomm_positions_long_all||0)-parseFloat(r.noncomm_positions_short_all||0));
    return{net:Math.round(nets[0]),max52:Math.max(...nets.slice(0,26)),min52:Math.min(...nets.slice(0,26))};
  }catch(e){return null;}
}
async function fetchRetailApp(){
  try{
    const r=await fetch("/api/myfxbook?email="+encodeURIComponent(MFX_EMAIL)+"&password="+encodeURIComponent(MFX_PASS));
    const d=await r.json();
    if(d.error||!d.symbols)return{};
    const map={};
    d.symbols.forEach(s=>{map[s.name]=s;});
    return map;
  }catch(e){return{};}
}

const TE = "https://tradingeconomics.com";
const TE_LINKS = {
  USD: { mfg:"united-states/manufacturing-pmi", svc:"united-states/services-pmi", unemp:"united-states/unemployment-rate", rate:"united-states/interest-rate", cpi:"united-states/inflation-cpi", core:"united-states/core-inflation-rate" },
  EUR: { mfg:"euro-area/manufacturing-pmi", svc:"euro-area/services-pmi", unemp:"euro-area/unemployment-rate", rate:"euro-area/interest-rate", cpi:"euro-area/inflation-rate", core:"euro-area/core-inflation-rate" },
  CAD: { mfg:"canada/manufacturing-pmi", svc:"canada/services-pmi", unemp:"canada/unemployment-rate", rate:"canada/interest-rate", cpi:"canada/inflation-rate", core:"canada/core-inflation-rate" },
  CHF: { mfg:"switzerland/manufacturing-pmi", svc:"switzerland/services-pmi", unemp:"switzerland/unemployment-rate", rate:"switzerland/interest-rate", cpi:"switzerland/inflation-rate", core:"switzerland/core-inflation-rate" },
  AUD: { mfg:"australia/manufacturing-pmi", svc:"australia/services-pmi", unemp:"australia/unemployment-rate", rate:"australia/interest-rate", cpi:"australia/inflation-rate", core:"australia/core-inflation-rate" },
  JPY: { mfg:"japan/manufacturing-pmi", svc:"japan/services-pmi", unemp:"japan/unemployment-rate", rate:"japan/interest-rate", cpi:"japan/inflation-rate", core:"japan/core-inflation-rate" },
  GBP: { mfg:"united-kingdom/manufacturing-pmi", svc:"united-kingdom/services-pmi", unemp:"united-kingdom/unemployment-rate", rate:"united-kingdom/interest-rate", cpi:"united-kingdom/inflation-rate", core:"united-kingdom/core-inflation-rate" },
  NZD: { mfg:"new-zealand/manufacturing-pmi", svc:"new-zealand/services-pmi", unemp:"new-zealand/unemployment-rate", rate:"new-zealand/interest-rate", cpi:"new-zealand/inflation-rate", core:"new-zealand/core-inflation-rate" },
  CNY: { mfg:"china/manufacturing-pmi", svc:"china/services-pmi", unemp:"china/unemployment-rate", rate:"china/interest-rate", cpi:"china/inflation-rate", core:"china/core-inflation-rate" },
};

const REGIMES = {
  GOLDILOCKS:  { label: "GOLDILOCKS",  icon: "◆", color: "#00ff88", bg: "#001a0d", border: "#00ff88", bcBias: "NEUTRE → HAWKISH modéré", tauxDir: "Stables ou légère hausse", deviseDir: "HAUSSE — croissance sans inflation = idéal", action: "Marché anticipe : BC reste pat (zone de confort) → ACHÈTE — devise stable, setup idéal · ⚠ Risque faible, surveiller chocs externes", short: "Croissance ↑  Inflation ↓" },
  SURCHAUFFE:  { label: "SURCHAUFFE",  icon: "▲", color: "#ffd700", bg: "#1a1500", border: "#ffd700", bcBias: "HAWKISH — hausse des taux imminente", tauxDir: "Hausse des taux imminente", deviseDir: "HAUSSE court terme — surveille retournement", action: "Marché anticipe : baisses repoussées (higher for longer) → ACHÈTE — devise forte sur différentiel de taux · ⚠ Risque : pic de cycle, retournement si inflation chute", short: "Croissance ↑  Inflation ↑" },
  STAGFLATION: { label: "STAGFLATION", icon: "■", color: "#ff3b3b", bg: "#1a0000", border: "#ff3b3b", bcBias: "COINCÉE — ne peut pas agir", tauxDir: "Taux bloqués — BC prise en étau", deviseDir: "BAISSE — pire scénario macro", action: "Marché anticipe : BC piégée, ne peut ni monter ni baisser → ÉVITE le long — devise sous pression structurelle · ⚠ Risque : carry trade vulnérable au moindre choc", short: "Croissance ↓  Inflation ↑" },
  RECESSION:   { label: "RECESSION",   icon: "▼", color: "#ff7a00", bg: "#1a0800", border: "#ff7a00", bcBias: "DOVISH — baisse des taux imminente", tauxDir: "Baisse des taux imminente", deviseDir: "BAISSE — capitaux fuient l'économie", action: "Marché anticipe : baisses de taux à venir → VENDS — devise sous pression, capitaux qui fuient · ⚠ Risque : si BC repousse baisses, rebond technique", short: "Croissance ↓  Inflation ↓" },
};

function FlagImg({ code, size=20 }) {
  const map = { "🇺🇸":"US","🇪🇺":"EU","🇨🇦":"CA","🇨🇭":"CH","🇦🇺":"AU","🇯🇵":"JP","🇬🇧":"GB","🇳🇿":"NZ","🇨🇳":"CN",
    "USD":"US","EUR":"EU","CAD":"CA","CHF":"CH","AUD":"AU","JPY":"JP","GBP":"GB","NZD":"NZ","CNY":"CN" };
  const cc = map[code] || code;
  return <img src={`https://flagcdn.com/w40/${cc.toLowerCase()}.png`} width={size} height={size*0.75} style={{borderRadius:2,objectFit:"cover",verticalAlign:"middle"}} alt={code} />;
}

const BG = "#050508", BG2 = "#08080f", BG3 = "#0c0c18";
const BORDER = "#1a1a2e", TEXT = "#c8d4f0", TEXT_DIM = "#4a5070", ACCENT = "#00aaff";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050508; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #050508; }
  ::-webkit-scrollbar-thumb { background: #1a1a2e; border-radius: 2px; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  input[type=number] { -moz-appearance: textfield; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
`;

function mkData() {
  const d = {};
  CURR.forEach(c => { d[c.code] = {}; INDS.forEach(i => { d[c.code][i.id] = { prior:"", exp:"", now:"" }; }); });
  return d;
}

function toN(v) { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

function getSurprise(ind, cell) {
  if (ind.id === "rate") {
    const now = toN(cell.now), prior = toN(cell.prior);
    return (now !== null && prior !== null) ? now - prior : null;
  }
  const n = toN(cell.now), e = toN(cell.exp);
  if (n === null || e === null) return null;
  const raw = ind.rev ? -(n - e) : (n - e);
  if (Math.abs(raw) < ind.thresh * 0.10) return 0;
  return raw;
}

function getMag(ind, surp) {
  if (surp === null) return null;
  return Math.max(-1, Math.min(1, surp / ind.thresh));
}

function hasData(data, code) {
  return INDS.some(ind => toN(data[code][ind.id].now) !== null);
}

function calcInflationScore(data, code) {
  let total = 0, wTotal = 0;
  ["cpi","core"].forEach(id => {
    const ind = INDS.find(i => i.id === id);
    const s = getSurprise(ind, data[code][id]);
    if (s === null) return;
    total += getMag(ind, s) * ind.wInf; wTotal += ind.wInf;
  });
  return wTotal === 0 ? null : total / wTotal;
}

function calcGrowthScore(data, code) {
  let total = 0, wTotal = 0;
  ["unemp","svc","mfg","rate"].forEach(id => {
    const ind = INDS.find(i => i.id === id);
    const s = getSurprise(ind, data[code][id]);
    if (s === null) return;
    total += getMag(ind, s) * ind.wGrow; wTotal += ind.wGrow;
  });
  return wTotal === 0 ? null : total / wTotal;
}

function calcScore(data, code) {
  const inf = calcInflationScore(data, code);
  const grow = calcGrowthScore(data, code);
  if (inf === null && grow === null) return 0;
  const w = BC_WEIGHTS[code] || { inf: 0.5, grow: 0.5 }; return (grow ?? 0) * w.grow + (inf ?? 0) * w.inf;
}

function explainRegime(data, code, regime) {
  if (!regime || !data[code]) return "";
  const target = BC_TARGETS[code] || 2.0;
  const coreNow = toN(data[code]["core"].now);
  const svcNow  = toN(data[code]["svc"].now);
  const unempNow   = toN(data[code]["unemp"].now);
  const unempPrior = toN(data[code]["unemp"].prior);
  const rateNow = toN(data[code]["rate"].now);
  const bc = (CURR.find(c=>c.code===code)?.bc) || "BC";
  // Direction chômage — hausse = mauvais, baisse = bon
  const unempDir = "";

  const coreExp = toN(data[code]["core"].exp);
  const coreVsExp = (coreNow !== null && coreExp !== null && Math.abs(coreNow - coreExp) > 0.05)
    ? `, vs exp ${coreExp}%` : "";
  const coreImpact = (coreNow !== null && coreExp !== null && Math.abs(coreNow - coreExp) > 0.05)
    ? (coreNow > coreExp ? ` → pression hawkish accrue` : ` → désinflation surprend`) : "";
  const infTxt = coreNow !== null ?
    (coreNow > target + 0.5 ? `inflation HAUTE (core ${coreNow}%${coreVsExp}, target ${target}%)` :
     coreNow > target + 0.2 ? `inflation au-dessus du target (core ${coreNow}%${coreVsExp}, target ${target}%)` :
     coreNow < target - 0.5 ? `inflation BASSE (core ${coreNow}%${coreVsExp}, target ${target}%)` :
     coreNow < target - 0.2 ? `inflation sous target (core ${coreNow}%${coreVsExp}, target ${target}%)` :
     `inflation à target (core ${coreNow}%${coreVsExp})`) : "";

  const svcExp = toN(data[code]["svc"].exp);
  const svcDir = (svcNow !== null && svcExp !== null && Math.abs(svcNow - svcExp) > 0.5)
    ? `, vs exp ${svcExp}` : "";
  const svcImpact = svcNow !== null ? (svcNow < 50 && svcExp !== null && svcNow < svcExp ? ` → contraction+surprise négative` : svcNow < 50 && svcExp !== null && svcNow > svcExp ? ` → contraction moins pire qu'attendu` : svcNow >= 50 && svcExp !== null && svcNow > svcExp ? ` → expansion+surprise positive` : "") : "";
  const growTxt = svcNow !== null ?
    (svcNow >= 55 ? `croissance forte (Services PMI ${svcNow}${svcDir})` :
     svcNow >= 52 ? `croissance solide (Services PMI ${svcNow}${svcDir})` :
     svcNow >= 50 ? `croissance stable (Services PMI ${svcNow}${svcDir})` :
     svcNow >= 47 ? `croissance qui ralentit (Services PMI ${svcNow} en contraction légère${svcDir})` :
     `croissance faible (Services PMI ${svcNow} en contraction${svcDir})`) : "";

  const unempExp = toN(data[code]["unemp"].exp);
  const unempRef = unempExp !== null ? unempExp : unempPrior;
  const unempExp2 = toN(data[code]["unemp"].exp);
  const unempArr = (unempNow !== null && unempExp2 !== null && Math.abs(unempNow - unempExp2) > 0.05)
    ? (unempNow > unempExp2 ? " ↓" : " ↑") : " →";
  const unempExpTxt = (unempExp2 !== null && unempNow !== null && Math.abs(unempNow - unempExp2) > 0.05)
    ? ` (exp ${unempExp2}, now ${unempNow}${unempArr})` : "";
  const unempImpact = unempNow !== null && unempExp2 !== null && Math.abs(unempNow - unempExp2) > 0.05
    ? (unempNow > unempExp2
        ? ` → marché du travail se détériore, pression dovish sur ${bc}`
        : ` → marché du travail solide, soutient la devise`)
    : "";
  const unempTxt = unempNow !== null
    ? `chômage ${unempNow}%${unempExpTxt}${unempImpact}`
    : "";

  if (regime.label === "SURCHAUFFE") {
    return `Avec ${infTxt} et ${growTxt}, la ${bc} est en mode HAWKISH${coreImpact}. ${unempTxt}. Taux à ${rateNow}% maintenus hauts${svcImpact}. → Devise FORTE sur le différentiel de taux : capitaux attirés.`;
  }
  if (regime.label === "GOLDILOCKS") {
    return `Avec ${infTxt} et ${growTxt}, la ${bc} est dans sa ZONE DE CONFORT${svcImpact}. ${unempTxt}. Taux à ${rateNow}%. → Devise haussière sans risque immédiat. Setup institutionnel idéal.`;
  }
  if (regime.label === "STAGFLATION") {
    const tauxCtx = rateNow >= 3.5 ? "malgré taux restrictifs"
      : rateNow >= 2.0 ? "dans un contexte de taux neutres"
      : "malgré taux accommodants";
    return `${bc} PRISE AU PIÈGE : ${infTxt}${coreImpact} l'empêche de baisser, mais ${growTxt}${svcImpact} l'empêche de monter. ${unempTxt}. Taux à ${rateNow}%. → Devise FAIBLE ${tauxCtx}. ⚠ Pire scénario macro.`;
  }
  if (regime.label === "RECESSION") {
    const recAction = rateNow <= 0.5
      ? `la ${bc} maintient une politique très accommodante — peu de marge pour baisser davantage`
      : rateNow <= 1.5
      ? `la ${bc} va maintenir ou baisser légèrement les taux`
      : `la ${bc} va devoir BAISSER les taux`;
    return `Avec ${infTxt} et ${growTxt}, ${recAction}. ${unempTxt}. Taux à ${rateNow}%. → Devise sous pression${coreImpact}${svcImpact}. Capitaux qui fuient l'économie en ralentissement.`;
  }
  return "";
}

function getPMIWarning(data, code) {
  const svcNow   = toN(data[code]["svc"].now);
  const svcPrior = toN(data[code]["svc"].prior);
  const svcExp   = toN(data[code]["svc"].exp);
  if (svcNow === null) return null;
  const warnings = [];
  // Trajectoire descendante vers 50
  if (svcNow >= 50 && svcNow < 52) {
    if (svcPrior !== null && svcPrior > svcNow) {
      const drop = (svcPrior - svcNow).toFixed(1);
      warnings.push(`⚠ PMI Services en décélération (${svcPrior} → ${svcNow}, −${drop}pts) — surveiller passage sous 50`);
    }
    if (svcExp !== null && svcNow < svcExp) {
      warnings.push(`⚠ PMI Services sous les attentes (exp ${svcExp}, now ${svcNow}) — demande plus faible que prévu`);
    }
  }
  // PMI fort mais qui ralentit significativement
  if (svcNow >= 52 && svcPrior !== null && svcPrior - svcNow >= 2) {
    warnings.push(`⚠ PMI Services en fort ralentissement (${svcPrior} → ${svcNow}) — surveiller la tendance`);
  }
  // PMI qui accélère vers 50 (positif)
  if (svcNow >= 48 && svcNow < 50 && svcPrior !== null && svcNow > svcPrior) {
    warnings.push(`📈 PMI Services en amélioration (${svcPrior} → ${svcNow}) — approche du seuil 50, potentiel retournement`);
  }
  return warnings.length > 0 ? warnings : null;
}

function interpretIndicator(id, now, code, exp=null) {
  if (now === null || now === undefined) return "";
  const target = BC_TARGETS[code] || 2.0;
  if (id === "cpi" || id === "core") {
    const arr = (exp !== null && Math.abs(now - exp) > 0.05)
      ? (now > exp ? " ↑" : " ↓") : " →";
    const expTxt = exp !== null
      ? ` (target ${target}%, exp ${exp}, now ${now}${arr})`
      : ` (target ${target}%)`;
    if (now > target + 0.5)  return `→ HAUTE${expTxt}`;
    if (now > target + 0.2)  return `→ AU-DESSUS${expTxt}`;
    if (now < target - 0.5)  return `→ BASSE${expTxt}`;
    if (now < target - 0.2)  return `→ SOUS TARGET${expTxt}`;
    return `→ À TARGET${expTxt}`;
  }
  if (id === "svc" || id === "mfg") {
    const seuil = now >= 50 ? "au-dessus 50 ✅" : "sous 50 ⚠";
    const arr = (exp !== null && Math.abs(now - exp) > 0.5)
      ? (now > exp ? " ↑" : " ↓") : " →";
    const expTxt = exp !== null ? ` (exp ${exp}, now ${now}${arr}, ${seuil})` : ` (${seuil})`;
    if (now >= 55) return `→ expansion forte ✓${expTxt}`;
    if (now >= 52) return `→ expansion ✓${expTxt}`;
    if (now >= 50) return `→ stable au seuil${expTxt}`;
    if (now >= 47) return `→ contraction légère${expTxt}`;
    return `→ contraction ✗${expTxt}`;
  }
  if (id === "unemp") {
    const arr = (exp !== null && Math.abs(now - exp) > 0.05) ? (now > exp ? " ↓" : " ↑") : " →";
    const expTxt = (exp !== null && Math.abs(now - exp) > 0.05) ? ` (exp ${exp}, now ${now}${arr})` : "";
    if (now > exp + 0.05) return `→ en hausse ⚠${expTxt}`;
    if (now < exp - 0.05) return `→ en baisse ✓${expTxt}`;
    return "→ stable";
  }
  if (id === "rate") {
    const arr = (exp !== null && Math.abs(now - exp) > 0.05)
      ? (now > exp ? " ↑" : " ↓") : " →";
    const expTxt = exp !== null && Math.abs(now - exp) > 0.05
      ? ` (exp ${exp}, now ${now}${arr})` : "";
    const neutral = { USD:2.5, EUR:2.0, GBP:2.5, CHF:0.5, CAD:2.5, JPY:0.5, AUD:2.5, NZD:2.5, CNY:3.0 };
    const r = neutral[code] || 2.5;
    if (now >= r + 1.5) return `→ très restrictive${expTxt}`;
    if (now >= r + 0.5) return `→ restrictive${expTxt}`;
    if (now >= r - 0.5) return `→ neutre${expTxt}`;
    if (now >= r - 1.5) return `→ accommodante${expTxt}`;
    return `→ très accommodante${expTxt}`;
    if (now > 0)  return "→ accommodante";
    return "→ ultra-basse";
  }
  return "";
}

function getRegime(data, code) {
  if (!hasData(data, code)) return null;
  const infScore = calcInflationScore(data, code);
  const growScore = calcGrowthScore(data, code);
  const svcNow = toN(data[code]["svc"].now);
  const coreNow = toN(data[code]["core"].now);
  const target = BC_TARGETS[code] || 2.0;

  // Inflation 3 niveaux — direction prime sur niveau absolu
  const coreExp2 = toN(data[code]["core"].exp);
  const corePrior2 = toN(data[code]["core"].prior);
  // Inflation structurellement haute = au-dessus target ET montante ou stable
  const infRising = coreNow !== null && (
    (coreExp2 !== null && coreNow >= coreExp2) ||
    (corePrior2 !== null && coreNow >= corePrior2)
  );
  const infFalling = coreNow !== null && (
    (coreExp2 !== null && coreNow < coreExp2) &&
    (corePrior2 === null || coreNow <= corePrior2)
  );
  // infHigh = clairement au-dessus target ET pas en train de descendre
  const infHigh   = coreNow !== null && coreNow > target + 0.3 && !infFalling;
  // infLow = sous target OU inflation qui descend franchement
  const infLow    = coreNow !== null && (
    coreNow < target - 0.3 ||
    (coreNow < target + 0.1 && infFalling)
  );
  const infAtTarget = !infHigh && !infLow;

  // Croissance 3 niveaux
  const svcContraction = svcNow !== null && svcNow < 50;
  const growUp   = !svcContraction && (growScore !== null && growScore > 0.05);
  const growDown = svcContraction || (growScore !== null && growScore < -0.05);
  const growNeutral = !growUp && !growDown;

  // Matrice 3x3 = 9 cas
  // Inflation HAUTE
  if (infHigh && growUp)      return REGIMES.SURCHAUFFE;
  if (infHigh && growNeutral) return REGIMES.SURCHAUFFE;
  if (infHigh && growDown)    return REGIMES.STAGFLATION;
  // Inflation A L'OBJECTIF (zone confort BC)
  if (infAtTarget && growUp)      return REGIMES.GOLDILOCKS;
  if (infAtTarget && growNeutral) return REGIMES.GOLDILOCKS;
  if (infAtTarget && growDown)    return REGIMES.RECESSION;
  // Inflation BASSE (BC doit stimuler)
  if (infLow && growUp)      return REGIMES.GOLDILOCKS;
  if (infLow && growNeutral) return REGIMES.GOLDILOCKS;
  if (infLow && growDown)    return REGIMES.RECESSION;

  return null;
}

function getStrength(score, regime) {
  const weakRegimes = ["STAGFLATION","RECESSION"];
  const strongRegimes = ["GOLDILOCKS","SURCHAUFFE"];
  const regLabel = regime?.label || "";
  // Si régime faible → toujours rouge peu importe le score
  if (weakRegimes.includes(regLabel)) {
    if (score <= -0.30 || score >= 0.30) return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
    if (score <= -0.08 || score >= 0.08) return { label: "MODÉRÉ ↓", color: "#ff8888", bg: "#110000" };
    return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
  }
  // Si régime fort → toujours vert
  if (strongRegimes.includes(regLabel)) {
    if (score >= 0.30)  return { label: "FORT ↑",   color: "#00ff88", bg: "#001a0d" };
    if (score >= 0.08)  return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
    return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
  }
  // Pas de régime — score seul
  if (score >= 0.30)  return { label: "FORT ↑",   color: "#00ff88", bg: "#001a0d" };
  if (score >= 0.08)  return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
  if (score <= -0.30) return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
  if (score <= -0.08) return { label: "MODÉRÉ ↓", color: "#ff8888", bg: "#110000" };
  return                     { label: "NEUTRE →", color: "#888899", bg: "#0a0a14" };
}

function getPairName(a, b) {
  const iA = PAIR_ORDER.indexOf(a), iB = PAIR_ORDER.indexOf(b);
  return iA <= iB ? a+"/"+b : b+"/"+a;
}

function cellBg(ind, cell, field) {
  if (field !== "now") return { bg: BG3, color: TEXT_DIM };
  const s = getSurprise(ind, cell);
  if (s === null) return { bg: BG3, color: TEXT_DIM };
  const m = getMag(ind, s);
  if (m === 0) return { bg: "#0a0a18", color: "#888899" };
  if (m > 0.6) return { bg: "#001f10", color: "#00ff88" };
  if (m > 0)   return { bg: "#001508", color: "#44cc77" };
  if (m < -0.6) return { bg: "#1f0000", color: "#ff3b3b" };
  return { bg: "#120000", color: "#cc4444" };
}

function Inp({ code, id, field, data, setCell }) {
  const cell = data[code][id];
  const ind = INDS.find(i => i.id === id);
  const cs = cellBg(ind, cell, field);
  return (
    <input type="number" step="0.01" value={cell[field]}
      onChange={e => setCell(code, id, field, e.target.value)}
      placeholder="—"
      style={{ width:54, height:30, background:cs.bg,
        border:`1px solid ${field==="now" && toN(cell[field])!==null ? cs.color+"44" : BORDER}`,
        borderRadius:2, color:cs.color, fontSize:12,
        fontFamily:"'IBM Plex Mono',monospace", fontWeight:field==="now"?600:400,
        textAlign:"center", outline:"none" }} />
  );
}

function ScoreBar({ score, color }) {
  
return (
    <div style={{ width:"100%", height:3, background:"#0a0a14", borderRadius:2 }}>
      <div style={{ width:Math.min(Math.abs(score)*100,100)+"%", height:"100%", background:color, borderRadius:2 }} />
    </div>
  );
}

function RegimeCard({ curr, data }) {
  const [open, setOpen] = useState(false);
  const regime = getRegime(data, curr.code);
  const score = calcScore(data, curr.code);
  const infScore = calcInflationScore(data, curr.code);
  const growScore = calcGrowthScore(data, curr.code);
  const st = getStrength(score, regime);
  const hasDat = hasData(data, curr.code);
  const R = regime || { color: TEXT_DIM, bg: BG2, border: BORDER, label: "—", icon: "○" };
  return (
    <div style={{ marginBottom:6, borderRadius:4, overflow:"hidden", border:`1px solid ${R.border}33` }}>
      <div onClick={() => hasDat && setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
          background: regime ? R.bg : BG2, cursor: hasDat ? "pointer" : "default",
          borderLeft:`3px solid ${R.color}` }}>
        <span style={{ fontSize:16, minWidth:22 }}><FlagImg code={curr.code} size={18} /></span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, color:TEXT, fontSize:12, letterSpacing:2, fontFamily:"'IBM Plex Mono'" }}>{curr.code}</div>
          <div style={{ fontSize:9, color:TEXT_DIM }}>{curr.bc} · {curr.label}</div>
        </div>
        {hasDat && (
          <div style={{ display:"flex", gap:6, fontSize:9, color:TEXT_DIM }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ color: infScore!==null?(infScore>0.05?"#00ff88":infScore<-0.05?"#ff3b3b":"#888899"):TEXT_DIM, fontWeight:600 }}>
                INF {infScore!==null?(infScore>0?"↑":infScore<0?"↓":"→"):"—"}
              </div>
            </div>
            <div style={{ width:1, background:BORDER }} />
            <div style={{ textAlign:"center" }}>
              <div style={{ color: growScore!==null?(growScore>0.05?"#66ff99":growScore<-0.05?"#ff6666":"#888899"):TEXT_DIM, fontWeight:600 }}>
                GROW {growScore!==null?(growScore>0?"↑":growScore<0?"↓":"→"):"—"}
              </div>
            </div>
          </div>
        )}
        {regime ? (
          <div style={{ textAlign:"right", minWidth:90 }}>
            <div style={{ fontSize:10, fontWeight:700, color:R.color, border:`1px solid ${R.border}55`,
              borderRadius:2, padding:"2px 8px", marginBottom:3, letterSpacing:1, fontFamily:"'IBM Plex Mono'" }}>
              {R.icon} {R.label}
            </div>
            <div style={{ color:st.color, fontSize:10, fontWeight:600 }}>{score>=0?"+":""}{score.toFixed(3)}</div>
          </div>
        ) : (
          <div style={{ fontSize:9, color:TEXT_DIM, fontStyle:"italic" }}>Aucune donnée</div>
        )}
        {hasDat && <span style={{ fontSize:9, color:TEXT_DIM }}>{open?"▲":"▼"}</span>}
      </div>
      {open && regime && (
        <div style={{ background:"#06060e", borderTop:`1px solid ${R.border}22`, padding:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
            {[{label:"BANQUE CENTRALE",val:R.bcBias},{label:"DEVISE",val:R.deviseDir.split("—")[0].trim()},{label:"TAUX",val:R.tauxDir}].map(({label,val})=>(
              <div key={label} style={{ padding:10, background:R.bg, borderRadius:3, border:`1px solid ${R.border}33` }}>
                <div style={{ fontSize:8, color:R.color, fontWeight:700, letterSpacing:2, marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:10, color:TEXT, fontWeight:500, lineHeight:1.4 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:12, background:BG, borderRadius:3, border:`1px solid ${R.border}22`, marginBottom:10 }}>
            <div style={{ fontSize:8, color:R.color, fontWeight:700, letterSpacing:2, marginBottom:10 }}>ANALYSE DES INDICATEURS</div>
            <div style={{ fontSize:8, color:"#ff6666", letterSpacing:2, marginBottom:6, opacity:0.7 }}>▸ TIER 1 — INFLATION</div>
            {["cpi","core"].map(id => {
              const ind = INDS.find(i=>i.id===id);
              const cell = data[curr.code][id];
              const s = getSurprise(ind, cell);
              const now = toN(cell.now), exp = toN(cell.exp);
              if (now===null) return null;
              const m = s!==null?getMag(ind,s):null;
              const col = m===null?TEXT_DIM:m>0?"#00ff88":m<0?"#ff3b3b":"#888899";
              const beat = m!==null&&m>0;
              return (
                <div key={id} style={{ display:"flex", gap:8, marginBottom:6, padding:"6px 8px", background:BG2, borderRadius:2, borderLeft:`2px solid ${col}55` }}>
                  <div style={{ flex:1 }}>
                    <span style={{ color:TEXT, fontWeight:600, fontSize:10 }}>{ind.label}: {now}{ind.unit}</span>
                    <span style={{ color:col, fontSize:10, fontWeight:600, marginLeft:6 }}>{interpretIndicator(id, now, curr.code, curr.code && data[curr.code] && data[curr.code][id] ? toN(data[curr.code][id].exp) : null)}</span>

                  </div>
                </div>
              );
            })}
            <div style={{ fontSize:8, color:"#66aaff", letterSpacing:2, marginBottom:6, marginTop:10, opacity:0.7 }}>▸ TIER 2-3 — CROISSANCE</div>
            {["unemp","svc","mfg","rate"].map(id => {
              const ind = INDS.find(i=>i.id===id);
              const cell = data[curr.code][id];
              const s = getSurprise(ind, cell);
              const now = toN(cell.now), exp = toN(cell.exp), prior = toN(cell.prior);
              if (now===null) return null;
              const m = s!==null?getMag(ind,s):null;
              const col = m===null?TEXT_DIM:m>0?"#00ff88":m<0?"#ff3b3b":"#888899";
              const beat = m!==null&&m>0;
              return (
                <div key={id} style={{ display:"flex", gap:8, marginBottom:6, padding:"6px 8px", background:BG2, borderRadius:2, borderLeft:`2px solid ${col}55` }}>
                  <div style={{ flex:1 }}>
                    <span style={{ color:TEXT, fontWeight:600, fontSize:10 }}>{ind.label}: {now}{ind.unit}</span>
                    <span style={{ color:col, fontSize:10, fontWeight:600, marginLeft:6 }}>{interpretIndicator(id, now, curr.code, curr.code && data[curr.code] && data[curr.code][id] ? toN(data[curr.code][id].exp) : null)}</span>
                    {id==="rate"&&prior!==null&&prior!==now&&<span style={{ color:TEXT_DIM, fontSize:8, marginLeft:6 }}>(préc:{prior}%)</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding:"12px 14px", background:BG, borderRadius:3, border:`1px solid ${R.border}44`, marginBottom:10 }}>
            <div style={{ fontSize:8, color:R.color, fontWeight:700, letterSpacing:2, marginBottom:6 }}>🎯 POURQUOI {R.label} ?</div>
            <div style={{ fontSize:11, color:TEXT, fontWeight:400, lineHeight:1.6 }}>{explainRegime(data, curr.code, R)}</div>
          </div>
          <div style={{ padding:"10px 14px", background:R.bg, borderRadius:3, border:`1px solid ${R.border}66`, marginBottom:8 }}>
            <div style={{ fontSize:8, color:R.color, fontWeight:700, letterSpacing:2, marginBottom:4 }}>ACTION INSTITUTIONNELLE</div>
            <div style={{ fontSize:13, color:R.color, fontWeight:700, fontFamily:"'IBM Plex Mono'" }}>{R.action}</div>
          </div>
          {(()=>{
            const warns = getPMIWarning(data, curr.code);
            if (!warns) return null;
            return (
              <div style={{ padding:"10px 12px", background:"#1a1000", borderRadius:3, border:"1px solid #ffd70044" }}>
                <div style={{ fontSize:8, color:"#ffd700", fontWeight:700, letterSpacing:2, marginBottom:6 }}>📡 TRAJECTOIRE — SIGNAL AVANCÉ</div>
                {warns.map((w,i) => (
                  <div key={i} style={{ fontSize:9, color:"#ffd700", lineHeight:1.6, marginBottom:i<warns.length-1?4:0 }}>{w}</div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function TradeCard({ strong, weak, div, regS, regW, perfect, sentSig }) {
  const [open, setOpen] = useState(false);
  const pairName = getPairName(strong.code, weak.code);
  const strongFirst = PAIR_ORDER.indexOf(strong.code) <= PAIR_ORDER.indexOf(weak.code);
  const dirColor = strongFirst ? "#00ff88" : "#ff3b3b";
  const dirLabel = strongFirst ? "LONG " + pairName : "SHORT " + pairName;
  const rA = sentSig?.rA;
  const pCot = sentSig?.pCot;
  const strongCOT = sentSig?.strongIsBase ? pCot?.base : pCot?.quote;
  const weakCOT   = sentSig?.strongIsBase ? pCot?.quote : pCot?.base;
  const isBothEx  = sentSig?.bothExtreme;

  return (
    <div style={{ marginBottom:10, borderRadius:6, overflow:"hidden",
      border:`1px solid ${isBothEx?"#00ff8866":sentSig?.color+"44"}` }}>

      {/* HEADER */}
      <div onClick={() => setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
          cursor:"pointer", background: isBothEx?"#001a0d":BG2,
          borderLeft:`3px solid ${sentSig?.color||BORDER}` }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontSize:14, fontWeight:700, color:TEXT, fontFamily:"'IBM Plex Mono'", letterSpacing:2 }}>{pairName}</span>
            {isBothEx && <span style={{ fontSize:8, color:"#00ff88", border:"1px solid #00ff8844", borderRadius:2, padding:"2px 7px", letterSpacing:1 }}>🔥 SETUP PARFAIT</span>}
          </div>
          <div style={{ fontSize:9, color:TEXT_DIM }}>
            <FlagImg code={strong.code} size={16} /> {strong.code} <span style={{ color:regS?.color }}>{regS?.label}</span> {"vs"} <FlagImg code={weak.code} size={16} /> {weak.code} <span style={{ color:regW?.color }}>{regW?.label}</span>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:12, fontWeight:700, color:dirColor, fontFamily:"'IBM Plex Mono'", marginBottom:2 }}>{dirLabel}</div>
          <div style={{ fontSize:9, color:TEXT_DIM }}>Div: +{(div*100).toFixed(0)}pts</div>
        </div>
        <span style={{ fontSize:9, color:TEXT_DIM }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ background:"#06060e", borderTop:`1px solid ${BORDER}`, padding:12 }}>

          {/* MACRO */}
          <div style={{ fontSize:8, color:"#a855f7", letterSpacing:2, fontWeight:700, marginBottom:8 }}>▸ DIVERGENCE MACRO</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            {[{curr:strong,reg:regS,side:"LONG — ACHÈTE"},{curr:weak,reg:regW,side:"SHORT — VENDS"}].map(({curr,reg,side})=>(
              <div key={curr.code} style={{ padding:10, background:reg?.bg||BG, borderRadius:4, border:`1px solid ${reg?.border||BORDER}44` }}>
                <div style={{ fontSize:8, color:reg?.color||TEXT_DIM, letterSpacing:2, marginBottom:6 }}>{side}</div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT }}><FlagImg code={curr.code} size={18} /> {curr.code}</div>
                <div style={{ fontSize:11, color:reg?.color||TEXT_DIM, marginTop:4, fontWeight:700 }}>{reg?.icon} {reg?.label}</div>
                <div style={{ fontSize:9, color:TEXT_DIM, marginTop:2 }}>Score: {curr.score>=0?"+":""}{curr.score.toFixed(3)}</div>
              </div>
            ))}
          </div>

          {/* RETAIL */}
          {rA && (
            <div style={{ background:"#070b14", borderRadius:6, padding:10, marginBottom:8,
              borderLeft:`2px solid ${rA.bias==="HAUSSIER"?"#4ade80":"#f87171"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontSize:8, color:"#475569", letterSpacing:1 }}>RETAIL — MYFXBOOK</div>
                <div style={{ fontSize:9, fontWeight:700, color:rA.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                  Contrarian: {rA.bias} {rA.strength==="EXTREME"?"⚠":""}
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:5 }}>
                <span style={{ color:"#4ade80", fontWeight:700 }}>LONG {rA.lp}%</span>
                <span style={{ color:"#f87171", fontWeight:700 }}>SHORT {rA.sp}%</span>
              </div>
              <div style={{ height:6, background:"#f87171", borderRadius:3, overflow:"hidden", marginBottom:5 }}>
                <div style={{ width:rA.lp+"%", height:"100%", background:"#4ade80" }}/>
              </div>
              <div style={{ fontSize:8, color:"#64748b" }}>
                {rA.bias==="HAUSSIER"
                  ? rA.sp+"% retail SHORT (extrême) → contrarian fort: ACHETER"
                  : rA.lp+"% retail LONG (extrême) → contrarian fort: VENDRE"}
              </div>
            </div>
          )}

          {/* COT */}
          {pCot && strongCOT && weakCOT && (
            <div style={{ background:"#070b14", borderRadius:6, padding:10, marginBottom:8,
              borderLeft:`2px solid ${pCot.bias==="HAUSSIER"?"#4ade80":"#f87171"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:8, color:"#475569", letterSpacing:1 }}>COT INSTITS — {strong.code} vs {weak.code}</div>
                <div style={{ fontSize:9, fontWeight:700, color:pCot.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                  Instits: {pCot.bias} {pCot.strength==="EXTREME"?"⚠":""}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:6 }}>
                {[{curr:strong,cot:strongCOT},{curr:weak,cot:weakCOT}].map(({curr,cot})=>(
                  <div key={curr.code}>
                    <div style={{ fontSize:8, color:"#475569", marginBottom:3 }}>
                      <FlagImg code={curr.code} size={18} /> {curr.code} — P{cot?.pct}%
                    </div>
                    <div style={{ height:5, background:"#1e3a5f", borderRadius:2, position:"relative", marginBottom:3 }}>
                      <div style={{ position:"absolute", left:0, width:"10%", height:"100%", background:"#4ade8033" }}/>
                      <div style={{ position:"absolute", right:0, width:"10%", height:"100%", background:"#f8717133" }}/>
                      <div style={{ position:"absolute", left:(cot?.pct||50)+"%", top:-2, width:2, height:9,
                        background:cot?.bias==="HAUSSIER"?"#4ade80":"#f87171", transform:"translateX(-50%)" }}/>
                    </div>
                    <div style={{ fontSize:8, color:cot?.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                      {cot?.bias} — {cot?.strength}
                    </div>
                    <div style={{ fontSize:7, color:"#475569", marginTop:1 }}>Net: {cot?.net>=0?"+":""}{cot?.net?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:8, color:"#64748b" }}>
                Base P{strongCOT?.pct}% vs Quote P{weakCOT?.pct}% (spread {pCot.spread>0?"+":""}{pCot.spread}pts)
              </div>
            </div>
          )}

          {/* ACTION FINALE */}
          <div style={{ padding:"12px 14px", background:sentSig?.bg||BG2, borderRadius:4,
            border:`1px solid ${sentSig?.color||BORDER}88` }}>
            <div style={{ fontSize:8, color:sentSig?.color, letterSpacing:2, marginBottom:6, fontWeight:700 }}>
              CONVERGENCE MACRO + SENTIMENT
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:dirColor, fontFamily:"'IBM Plex Mono'", marginBottom:5 }}>
              {dirLabel}
            </div>
            <div style={{ fontSize:10, color:sentSig?.color, marginBottom:5 }}>{sentSig?.label}</div>
            <div style={{ fontSize:9, color:"#94a3b8" }}>
              Retail: {sentSig?.retailStrength} | COT: {sentSig?.cotStrength} | Div: +{(div*100).toFixed(0)}pts
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function DataView() {
  const [selected, setSelected] = useState("USD");
  const curr = CURR.find(c => c.code === selected);
  return (
    <div style={{ padding:16 }}>
      <div style={{ background:BG2, border:`1px solid ${ACCENT}44`, borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:ACCENT, fontWeight:700, marginBottom:8, borderBottom:`1px solid ${ACCENT}22`, paddingBottom:8, fontFamily:"'IBM Plex Mono'" }}>LIENS TRADING ECONOMICS</div>
        <div style={{ fontSize:10, color:TEXT_DIM, marginBottom:12 }}>
          Clique sur une devise → clique sur un indicateur → tu vois{" "}
          <span style={{ color:"#ffd700" }}>Previous</span> /{" "}
          <span style={{ color:ACCENT }}>Consensus</span> /{" "}
          <span style={{ color:"#00ff88" }}>Actual</span>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
          {CURR.map(c => (
            <button key={c.code} onClick={() => setSelected(c.code)}
              style={{ padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", borderRadius:3,
                border: selected===c.code?`1px solid ${ACCENT}`:`1px solid ${BORDER}`,
                background: selected===c.code?`${ACCENT}20`:BG,
                color: selected===c.code?ACCENT:TEXT_DIM, fontFamily:"'IBM Plex Mono'" }}>
              <FlagImg code={c.code} size={16} /> {c.code}
            </button>
          ))}
        </div>
        <div style={{ padding:12, background:BG, borderRadius:3, border:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:TEXT, marginBottom:12, fontFamily:"'IBM Plex Mono'" }}><FlagImg code={curr.code} size={18} /> {curr.code} — {curr.label} ({curr.bc})</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:8 }}>
            {INDS.map(ind => (
              <a key={ind.id} href={`${TE}/${TE_LINKS[curr.code][ind.id]}`} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex", flexDirection:"column", padding:"10px 12px", borderRadius:3,
                  background:BG2, border:`1px solid ${ACCENT}33`, color:ACCENT, textDecoration:"none" }}>
                <span style={{ fontSize:12, fontWeight:700, marginBottom:4, fontFamily:"'IBM Plex Mono'" }}>{ind.label} ↗</span>
                <span style={{ fontSize:8, color:TEXT_DIM }}>{ind.desc}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background:BG2, border:`1px solid #ffd70044`, borderRadius:4, padding:14 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#ffd700", fontWeight:700, marginBottom:10, borderBottom:"1px solid #ffd70022", paddingBottom:8, fontFamily:"'IBM Plex Mono'" }}>COMMENT SAISIR</div>
        {[["Previous","#ffd700","Le chiffre du mois dernier → colonne PRIOR"],["Consensus",ACCENT,"Ce que les économistes prévoient → colonne EXP"],["Actual","#00ff88","Le chiffre publié → colonne NOW"]].map(([k,col,v])=>(
          <div key={k} style={{ display:"flex", gap:12, marginBottom:8, padding:"7px 10px", background:BG, borderRadius:3, borderLeft:`3px solid ${col}55` }}>
            <div style={{ fontSize:10, fontWeight:700, color:col, minWidth:80, fontFamily:"'IBM Plex Mono'" }}>{k}</div>
            <div style={{ fontSize:10, color:TEXT_DIM }}>{v}</div>
          </div>
        ))}
        <div style={{ marginTop:10, padding:10, background:BG, borderRadius:3, border:"1px solid #ffd70033" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#ffd700", marginBottom:4 }}>⚠ FUNDS RATE — SPÉCIAL</div>
          <div style={{ fontSize:10, color:TEXT_DIM }}>Entre le taux actuel dans NOW et le taux précédent dans PRIOR. Pas besoin de EXP.</div>
        </div>
      </div>
    </div>
  );
}

function GuideView() {
  const indicators = [
    { title:"CORE INFLATION", sub:"Core Inflation Rate — Trading Economics", desc:"Le plus important — la BC regarde ça en premier. Signal pur de l'inflation structurelle.", good:"PLUS HAUT que prévu → BC monte les taux → devise monte", bad:"PLUS BAS que prévu → BC baisse les taux → devise baisse", pct:"Tier 1 · 27.5%", color:"#ff6666" },
    { title:"INFLATION", sub:"Inflation Rate — Trading Economics", desc:"Confirme le Core Inflation. Les 2 ensembles = signal hawkish très fort.", good:"Les 2 BEATS → signal hawkish très fort → ACHÈTE", bad:"Les 2 MISS → signal dovish très fort → VENDS", pct:"Tier 1 · 22.5%", color:"#ff9966" },
    { title:"UNEMPLOYMENT RATE", sub:"Unemployment Rate — Trading Economics", desc:"INVERSE — chiffre BAS = bon. Dual mandate Fed/BoE. Moins de chômage = BC hawkish.", good:"PLUS BAS que prévu → économie forte → devise monte", bad:"PLUS HAUT que prévu → économie faible → devise baisse", pct:"Tier 2 · 20%", color:"#66aaff" },
    { title:"SERVICES PMI", sub:"Services PMI — Trading Economics", desc:"70% de l'économie. Au-dessus de 50 = expansion. Le plus suivi par les institutionnels.", good:"PLUS HAUT que prévu → demande forte → hawkish", bad:"PLUS BAS que prévu → demande faible → dovish", pct:"Tier 2 · 17.5%", color:"#66ccff" },
    { title:"MANUFACTURING PMI", sub:"Manufacturing PMI — Trading Economics", desc:"Premier signal d'un ralentissement industriel. Bon indicateur avancé.", good:"PLUS HAUT que prévu → production forte → expansion", bad:"PLUS BAS que prévu → ralentissement → signal négatif", pct:"Tier 3 · 7.5%", color:"#aaaacc" },
    { title:"FUNDS RATE", sub:"Interest Rate — Trading Economics", desc:"Compare NOW vs PRIOR. La devise avec le taux le plus haut attire les capitaux.", good:"Hausse du taux → capitaux entrent → devise monte", bad:"Baisse du taux → capitaux sortent → devise baisse", pct:"Tier 3 · 5%", color:"#888899" },
  ];
  return (
    <div style={{ padding:16, fontFamily:"'IBM Plex Mono',monospace" }}>
      <div style={{ background:BG2, border:`1px solid ${ACCENT}33`, borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:ACCENT, fontWeight:700, marginBottom:14, borderBottom:`1px solid ${ACCENT}22`, paddingBottom:8 }}>DANS LA TÊTE DE LA BANQUE CENTRALE</div>
        {indicators.map(s => (
          <div key={s.title} style={{ marginBottom:10, padding:12, background:BG, borderRadius:3, border:`1px solid ${s.color}22`, borderLeft:`3px solid ${s.color}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <div style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.title}</div>
              <div style={{ fontSize:9, fontWeight:700, color:TEXT_DIM }}>{s.pct}</div>
            </div>
            <div style={{ fontSize:9, color:TEXT_DIM, marginBottom:6 }}>{s.sub}</div>
            <div style={{ fontSize:10, color:TEXT, marginBottom:8, lineHeight:1.5 }}>{s.desc}</div>
            <div style={{ fontSize:10, color:"#00ff88", marginBottom:3 }}>✓ {s.good}</div>
            <div style={{ fontSize:10, color:"#ff3b3b" }}>✗ {s.bad}</div>
          </div>
        ))}
      </div>
      <div style={{ background:BG2, border:`1px solid #a855f733`, borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#a855f7", fontWeight:700, marginBottom:14, borderBottom:"1px solid #a855f722", paddingBottom:8 }}>RÉGIME MACRO</div>
        {[
          { label:"GOLDILOCKS", color:"#00ff88", combo:"Services PMI high + Inflation low + Unemployment low", bc:"BC neutre — devises fortes montent" },
          { label:"SURCHAUFFE", color:"#ffd700", combo:"Services PMI high + Inflation high + Unemployment low", bc:"BC hawkish — taux montent — devise monte" },
          { label:"STAGFLATION", color:"#ff3b3b", combo:"Services PMI low + Inflation high + Unemployment high", bc:"BC coincée — évite ce trade" },
          { label:"RECESSION", color:"#ff7a00", combo:"Services PMI low + Inflation low + Unemployment high", bc:"BC dovish — taux baissent — devise baisse" },
        ].map(R => (
          <div key={R.label} style={{ marginBottom:8, padding:"12px 14px", background:BG, borderRadius:3, border:`1px solid ${R.color}22`, borderLeft:`3px solid ${R.color}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:R.color, marginBottom:6, letterSpacing:1 }}>{R.label}</div>
            <div style={{ fontSize:12, color:R.color, marginBottom:5, fontWeight:500, opacity:0.85 }}>{R.combo}</div>
            <div style={{ fontSize:10, color:TEXT_DIM }}>{R.bc}</div>
          </div>
        ))}
      </div>
      <div style={{ background:BG2, border:`1px solid #a855f733`, borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#a855f7", fontWeight:700, marginBottom:14, borderBottom:"1px solid #a855f722", paddingBottom:8 }}>IMAGE GLOBALE + DÉCISION</div>
        {[
          { label:"HAWKISH CLAIR", color:"#00ff88", combo:"Core Inflation beat + Unemployment low + Services PMI high", bc:"BC monte les taux — achète la devise" },
          { label:"HAWKISH MODÉRÉ", color:"#66ff99", combo:"Core Inflation neutre + Services PMI high + Unemployment stable", bc:"BC surveille — commence à parler de hausses" },
          { label:"NEUTRE", color:"#888899", combo:"Données mixtes — beats et miss s'annulent", bc:"BC attend — pas de signal clair" },
          { label:"DOVISH MODÉRÉ", color:"#ff9966", combo:"Core Inflation miss + Services PMI low + Unemployment monte", bc:"BC commence à parler de baisses" },
          { label:"DOVISH CLAIR", color:"#ff3b3b", combo:"Core Inflation miss + Unemployment high + Services PMI low", bc:"BC baisse les taux — vends la devise" },
        ].map(B => (
          <div key={B.label} style={{ marginBottom:8, padding:"12px 14px", background:BG, borderRadius:3, border:`1px solid ${B.color}22`, borderLeft:`3px solid ${B.color}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:B.color, marginBottom:6, letterSpacing:1 }}>{B.label}</div>
            <div style={{ fontSize:12, color:B.color, marginBottom:5, fontWeight:500, opacity:0.85 }}>{B.combo}</div>
            <div style={{ fontSize:10, color:TEXT_DIM }}>{B.bc}</div>
          </div>
        ))}
      </div>
      <div style={{ background:BG2, border:`1px solid #ffd70044`, borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#ffd700", fontWeight:700, marginBottom:12, borderBottom:"1px solid #ffd70033", paddingBottom:8 }}>RÈGLE D'OR — COMMENT LA BC RÉAGIT</div>
        {[["1 mois de beats","Elle note mais n'agit pas — trop tôt"],["2 mois de beats","Elle commence à en parler — hawkish verbal"],["3 mois de beats","Elle agit — c'est là que ça bouge vraiment"]].map(([r,d])=>(
          <div key={r} style={{ display:"flex", gap:12, marginBottom:8, padding:"8px 10px", background:BG, borderRadius:3, borderLeft:"3px solid #ffd70044" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#ffd700", minWidth:150 }}>{r}</div>
            <div style={{ fontSize:10, color:TEXT_DIM }}>{d}</div>
          </div>
        ))}
      </div>
      {/* ========== COMPRENDRE LES 2 TABS ========== */}
      <div style={{ background:BG2, border:"1px solid #00aaff44", borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#00aaff", fontWeight:700, marginBottom:14, borderBottom:"1px solid #00aaff22", paddingBottom:8 }}>
          📊 COMPRENDRE LES 2 TABS DE TRADES
        </div>

        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #a855f7" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#a855f7", marginBottom:10 }}>🔬 LES 3 INGRÉDIENTS DU SYSTÈME APEX</div>
          {[
            ["1️⃣ MACRO DIVERGENCE","Les 2 pays ont des régimes économiques opposés (ex: GOLDILOCKS vs RECESSION)","Plus la divergence est grande, plus le signal est fort","#00ff88"],
            ["2️⃣ COT — INSTITUTIONNELS","Les grandes banques et fonds positionnent dans la même direction","Mesuré sur 52 semaines — percentile de positionnement net","#00aaff"],
            ["3️⃣ RETAIL CONTRARIAN","Les traders particuliers ont statistiquement tort aux extrêmes","70%+ retail dans un sens → les institutionnels feront l'inverse","#f97316"],
          ].map(([title,desc,detail,color])=>(
            <div key={title} style={{ marginBottom:8, padding:"8px 10px", background:BG2, borderRadius:3, borderLeft:"2px solid "+color+"66" }}>
              <div style={{ fontSize:10, fontWeight:700, color:color, marginBottom:3 }}>{title}</div>
              <div style={{ fontSize:9, color:TEXT, marginBottom:2 }}>{desc}</div>
              <div style={{ fontSize:8, color:TEXT_DIM, fontStyle:"italic" }}>{detail}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #00aaff" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00aaff", marginBottom:8 }}>📘 TAB "TRADE COT + MACRO" — 2 CONFLUENCES SUR 3</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div style={{ padding:10, background:"#00aaff11", borderRadius:3 }}>
              <div style={{ fontSize:9, color:"#00aaff", fontWeight:700, marginBottom:6 }}>CE QUI EST VÉRIFIÉ</div>
              <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.8 }}>
                ✅ <span style={{color:"#00ff88"}}>Macro divergence</span> entre les 2 pays<br/>
                ✅ <span style={{color:"#00aaff"}}>COT institutionnels</span> alignés<br/>
                ⬜ <span style={{color:TEXT_DIM}}>Retail — non filtré</span>
              </div>
            </div>
            <div style={{ padding:10, background:"#00aaff11", borderRadius:3 }}>
              <div style={{ fontSize:9, color:"#00aaff", fontWeight:700, marginBottom:6 }}>QUAND L'UTILISER</div>
              <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.8 }}>
                → Voir les setups <span style={{color:"#00aaff"}}>avant</span> qu'ils soient parfaits<br/>
                → Préparer l'entrée à l'avance<br/>
                → Plus de signaux, moins filtrés
              </div>
            </div>
          </div>
          <div style={{ padding:"8px 10px", background:"#0a0a14", borderRadius:3, border:"1px dashed #00aaff33" }}>
            <div style={{ fontSize:9, color:TEXT_DIM }}>⚠ Utilise avec discernement — le retail n'a pas encore confirmé l'extrême</div>
          </div>
        </div>

        <div style={{ padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #00ff88" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00ff88", marginBottom:8 }}>🟢 TAB "TRADE COT + MACRO + RETAIL" — 3 CONFLUENCES SUR 3</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div style={{ padding:10, background:"#00ff8811", borderRadius:3 }}>
              <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:6 }}>CE QUI EST VÉRIFIÉ</div>
              <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.8 }}>
                ✅ <span style={{color:"#00ff88"}}>Macro divergence</span> entre les 2 pays<br/>
                ✅ <span style={{color:"#00aaff"}}>COT institutionnels</span> alignés<br/>
                ✅ <span style={{color:"#f97316"}}>Retail contrarian</span> à 70%+ opposé
              </div>
            </div>
            <div style={{ padding:10, background:"#00ff8811", borderRadius:3 }}>
              <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:6 }}>QUAND L'UTILISER</div>
              <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.8 }}>
                → Setups <span style={{color:"#00ff88",fontWeight:700}}>APEX haute probabilité</span><br/>
                → Entrer avec pleine confiance<br/>
                → Moins de signaux, qualité maximale
              </div>
            </div>
          </div>
          <div style={{ padding:"8px 10px", background:"#001a0d", borderRadius:3, border:"1px solid #00ff8844" }}>
            <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:2 }}>C'est le tab principal pour trader.</div>
            <div style={{ fontSize:8, color:TEXT_DIM }}>Quand un signal apparaît ici, les 3 forces du marché convergent dans la même direction.</div>
          </div>
        </div>
      </div>

      {/* ========== GESTION DE RISQUE — SWING TRADER ========== */}
      <div style={{ background:BG2, border:"1px solid #00ff8844", borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#00ff88", fontWeight:700, marginBottom:14, borderBottom:"1px solid #00ff8822", paddingBottom:8 }}>
          💰 GESTION DE RISQUE — SWING TRADER
        </div>

        {/* LE PRINCIPE */}
        <div style={{ marginBottom:14, padding:14, background:"#001a0d", borderRadius:4, border:"2px solid #00ff8866" }}>
          <div style={{ fontSize:10, color:"#00ff88", fontWeight:700, marginBottom:8, letterSpacing:2 }}>⚡ LE PRINCIPE</div>
          <div style={{ fontSize:11, color:TEXT, lineHeight:1.8 }}>
            <span style={{color:"#00ff88",fontWeight:700}}>Ton job n'est pas de gagner de l'argent.</span><br/>
            <span style={{color:"#00ff88",fontWeight:700}}>C'est de rester dans le jeu assez longtemps pour que ton edge fonctionne.</span>
          </div>
          <div style={{ marginTop:8, fontSize:9, color:TEXT_DIM, lineHeight:1.6 }}>
            70-80% des traders retail perdent. Pas parce qu'ils sont mauvais — parce qu'ils risquent trop par trade et explosent avant que la statistique joue en leur faveur.
          </div>
        </div>

        {/* RÈGLE 1% */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #00ff88" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00ff88", marginBottom:8 }}>1️⃣ RISQUE 1% PAR TRADE — MAX</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Sur $100,000 → tu risques <span style={{color:"#00ff88",fontWeight:700}}>$1,000 max par trade</span> (1%).<br/>
            <span style={{color:"#ff6666"}}>Jamais plus.</span> Pas même 1.5%. Pas même "juste cette fois".
          </div>

          <div style={{ padding:10, background:"#00ff8811", borderRadius:3, marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:6 }}>POURQUOI 1% ?</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              Tu vas perdre 10 trades de suite un jour. Statistique normale.<br/>
              <span style={{color:"#00ff88"}}>À 1%</span> → tu perds 9.6%. Tu continues à trader.<br/>
              <span style={{color:"#ff6666"}}>À 5%</span> → tu perds 40%. Il te faut +67% pour revenir.<br/>
              <span style={{color:"#ff4444"}}>À 10%</span> → tu perds 65%. Game over.
            </div>
          </div>

          <div style={{ padding:"8px 10px", background:"#0a0a14", borderRadius:3, border:"1px dashed #00ff8844" }}>
            <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:4 }}>📐 CALCULER TA TAILLE</div>
            <div style={{ fontSize:10, color:TEXT, fontFamily:"monospace", marginBottom:4 }}>
              Lots = $Risque ÷ (Stop pips × $/pip)
            </div>
            <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.6 }}>
              Ex : $1,000 risque, stop 50 pips, EUR/USD<br/>
              → $1,000 ÷ (50 × $10) = <span style={{color:"#00ff88"}}>2.0 lots standards</span><br/>
              <br/>
              Stop 100 pips → $1,000 ÷ $1,000 = <span style={{color:"#00ff88"}}>1.0 lot</span><br/>
              Stop 30 pips → $1,000 ÷ $300 = <span style={{color:"#00ff88"}}>3.3 lots</span>
            </div>
          </div>
        </div>

        {/* LE STOP D'ABORD */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #ffd700" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#ffd700", marginBottom:8 }}>2️⃣ LE STOP D'ABORD, LA TAILLE APRÈS</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            <span style={{color:"#ff4444",fontWeight:700}}>❌ ERREUR :</span> "Je veux trader 1 lot, mon stop est où ça rentre"<br/>
            <span style={{color:"#00ff88",fontWeight:700}}>✅ BON :</span> "Mon stop est sous le support, donc ma taille est X"
          </div>

          <div style={{ padding:10, background:"#ffd70011", borderRadius:3 }}>
            <div style={{ fontSize:9, color:"#ffd700", fontWeight:700, marginBottom:6 }}>OÙ PLACER LE STOP</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              <span style={{color:"#ffd700"}}>LONG :</span> Sous le swing low ou le support structurel<br/>
              <span style={{color:"#ffd700"}}>SHORT :</span> Au-dessus du swing high ou de la résistance<br/>
              <span style={{color:"#ffd700"}}>BUFFER :</span> Ajoute 0.5× ATR pour absorber le bruit<br/>
              <br/>
              <span style={{color:"#ff6666",fontWeight:700}}>JAMAIS</span> sur un chiffre rond (1.3000) — tout le monde a son stop là, le marché vient le chercher.
            </div>
          </div>
        </div>

        {/* R:R */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #a78bfa" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#a78bfa", marginBottom:8 }}>3️⃣ R:R MINIMUM 2:1 EN SWING</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Si tu risques 50 pips → target minimum <span style={{color:"#a78bfa",fontWeight:700}}>100 pips</span>.<br/>
            Idéal en swing : <span style={{color:"#a78bfa",fontWeight:700}}>2:1 à 3:1</span>.
          </div>

          <div style={{ padding:10, background:"#a78bfa11", borderRadius:3 }}>
            <div style={{ fontSize:9, color:"#a78bfa", fontWeight:700, marginBottom:6 }}>LA LOGIQUE</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              <span style={{color:"#a78bfa"}}>R:R 2:1</span> → tu peux perdre 60% du temps et rester rentable<br/>
              <span style={{color:"#a78bfa"}}>R:R 3:1</span> → win rate de 30-40% suffit<br/>
              <span style={{color:"#ff6666"}}>R:R 1:1</span> → il te faut {">"}50% de win rate juste pour break-even<br/>
              <br/>
              <span style={{color:"#a78bfa",fontWeight:700}}>Le swing trader gagne par la taille des wins, pas la fréquence.</span>
            </div>
          </div>
        </div>

        {/* TRAILING STOP */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #00aaff" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00aaff", marginBottom:8 }}>4️⃣ TRAILING STOP — PROTÉGER LES GAINS</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Le stop monte (LONG) ou descend (SHORT) avec le prix.<br/>
            <span style={{color:"#ff4444",fontWeight:700}}>Jamais l'inverse</span> — pas de "give room" à un loser.
          </div>

          <div style={{ marginBottom:8, padding:10, background:"#00aaff11", borderRadius:3 }}>
            <div style={{ fontSize:9, color:"#00aaff", fontWeight:700, marginBottom:6 }}>MÉTHODE STRUCTURELLE (recommandée)</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              À chaque nouveau swing low qui se forme (en LONG) → remonte le stop juste en dessous.<br/>
              Le marché te dit où mettre le stop. Tu ne devines pas.
            </div>
          </div>

          <div style={{ padding:10, background:"#00aaff11", borderRadius:3 }}>
            <div style={{ fontSize:9, color:"#00aaff", fontWeight:700, marginBottom:6 }}>MÉTHODE ATR (Chandelier Exit)</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              Stop = Plus haut atteint − (3 × ATR)<br/>
              Sur TradingView : indicateur "Chandelier Exit" intégré.<br/>
              <span style={{color:"#00aaff"}}>Settings swing : 22 périodes, multiplicateur 3.0</span>
            </div>
          </div>
        </div>

        {/* BREAKEVEN — LE VRAI COÛT */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #ffd700" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#ffd700", marginBottom:8 }}>5️⃣ STOP AU BREAKEVEN — PAS SI "GRATUIT"</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Quand le trade est à <span style={{color:"#ffd700"}}>+1R en profit</span> (= ton risque atteint en gain), tu peux déplacer le stop à l'entrée.
          </div>

          <div style={{ padding:10, background:"#1a1500", borderRadius:3, border:"1px solid #ffd70044" }}>
            <div style={{ fontSize:9, color:"#ffd700", fontWeight:700, marginBottom:6 }}>⚠ LE MYTHE DU "RISK-FREE TRADE"</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              Si tu as +100 pips d'unrealized et le prix revient à ton entrée → <span style={{color:"#ff6666"}}>tu donnes 100 pips back</span>.<br/>
              C'est une <span style={{color:"#ff6666",fontWeight:700}}>perte d'opportunité réelle</span>, même si pas en cash.<br/>
              <br/>
              <span style={{color:"#ffd700"}}>Tu achètes de la tranquillité d'esprit, pas un trade gratuit.</span><br/>
              Si ça t'aide à tenir la position sans paniquer → ça en vaut le coût.
            </div>
          </div>
        </div>

        {/* SCALE-OUT */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #4ade80" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#4ade80", marginBottom:8 }}>6️⃣ SCALE-OUT 50/50 — LE COMPROMIS SWING</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            À <span style={{color:"#4ade80"}}>+1R de profit</span> → ferme 50% de la position.<br/>
            Déplace le stop des 50% restants au <span style={{color:"#4ade80"}}>breakeven</span>.<br/>
            Laisse courir le runner avec trailing stop structural.
          </div>

          <div style={{ padding:10, background:"#4ade8011", borderRadius:3, marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#4ade80", fontWeight:700, marginBottom:6 }}>EXEMPLE CONCRET</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              Tu shortes EUR/USD à 1.1700 — Stop 1.1800 — Target 1.1400<br/>
              2.0 lots standards, risque $1,000<br/>
              <br/>
              Prix à 1.1600 (+100 pips, +1R) :<br/>
              → Ferme 1.0 lot = <span style={{color:"#4ade80"}}>+$1,000 sécurisé</span><br/>
              → Stop du runner (1.0 lot) remonte à 1.1700 (breakeven)<br/>
              → Laisse courir vers 1.1400<br/>
              <br/>
              Si ça touche 1.1400 → <span style={{color:"#4ade80"}}>+$1,000 + $3,000 = $4,000 total</span>
            </div>
          </div>

          <div style={{ padding:"8px 10px", background:"#0a0a14", borderRadius:3 }}>
            <div style={{ fontSize:9, color:"#4ade80", fontWeight:700, marginBottom:4 }}>LE COÛT (sois honnête)</div>
            <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.6 }}>
              Si full position jusqu'au target → tu aurais fait $6,000.<br/>
              Avec scale-out 50/50 → tu fais $4,000.<br/>
              <span style={{color:"#4ade80"}}>Tu sacrifies $2,000 de upside pour réduire le risque de give-back.</span>
            </div>
          </div>
        </div>

        {/* PYRAMIDING */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #f97316" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#f97316", marginBottom:8 }}>7️⃣ PYRAMIDING — AJOUTER AUX WINNERS</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Ajouter à une position <span style={{color:"#00ff88",fontWeight:700}}>déjà en profit</span> dans une tendance forte.<br/>
            <span style={{color:"#ff4444",fontWeight:700}}>JAMAIS</span> ajouter à un loser (= averaging down = mort).
          </div>

          <div style={{ padding:10, background:"#f9731611", borderRadius:3, marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#f97316", fontWeight:700, marginBottom:6 }}>RÈGLE D'OR : TAILLE DÉCROISSANTE</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              <span style={{color:"#f97316"}}>Entrée #1 :</span> 1.0 lot (risque $500) — meilleur prix<br/>
              <span style={{color:"#f97316"}}>Ajout #2 :</span> 0.7 lot (risque $300) — après cassure swing high<br/>
              <span style={{color:"#f97316"}}>Ajout #3 :</span> 0.3 lot (risque $200) — après confirmation<br/>
              <span style={{color:"#f97316"}}>Total :</span> 2.0 lots, risque combiné <span style={{color:"#00ff88"}}>$1,000 (1%)</span><br/>
              <br/>
              À chaque ajout : <span style={{color:"#f97316",fontWeight:700}}>remonte le stop de TOUTE la position</span>.
            </div>
          </div>

          <div style={{ padding:"8px 10px", background:"#1a0a00", borderRadius:3, border:"1px solid #f9731644" }}>
            <div style={{ fontSize:9, color:"#f97316", fontWeight:700, marginBottom:4 }}>⚠ CONDITIONS OBLIGATOIRES</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              ✓ Marché en <span style={{color:"#f97316"}}>tendance claire</span><br/>
              ✓ Position déjà <span style={{color:"#f97316"}}>en profit</span><br/>
              ✓ Niveaux d'ajout <span style={{color:"#f97316"}}>planifiés AVANT</span> d'entrer<br/>
              ✓ Risque combiné reste <span style={{color:"#f97316"}}>{"<"} 1% du compte</span>
            </div>
          </div>
        </div>

        {/* HOUSE MONEY — STRATÉGIE INSTITUTIONNELLE */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #d946ef" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#d946ef", marginBottom:8 }}>8️⃣ HOUSE MONEY — STRATÉGIE INSTITUTIONNELLE</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Aussi appelée <span style={{color:"#d946ef",fontWeight:700}}>"Profit Compounding"</span>.<br/>
            Tu sépares mentalement ton capital initial de tes profits accumulés.
          </div>

          <div style={{ padding:10, background:"#d946ef11", borderRadius:3, marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#d946ef", fontWeight:700, marginBottom:6 }}>LE CONCEPT</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              <span style={{color:"#d946ef"}}>Capital de départ ($100,000)</span> → protégé strictement à 1% = $1,000/trade<br/>
              <span style={{color:"#d946ef"}}>Profits accumulés</span> → "argent de la maison" — boost possible sur setups A+<br/>
              <br/>
              Utilisé par les fonds spéculatifs pour augmenter l'exposition <span style={{color:"#d946ef"}}>sans toucher au capital noyau</span>.
            </div>
          </div>

          <div style={{ padding:10, background:"#d946ef11", borderRadius:3, marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#d946ef", fontWeight:700, marginBottom:6 }}>EXEMPLE CONCRET (sur $100k de départ)</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              Après 3 mois → compte à <span style={{color:"#4ade80"}}>$110,000</span><br/>
              <br/>
              <span style={{color:"#d946ef"}}>Capital initial :</span> $100,000 — risque 1% = $1,000/trade<br/>
              <span style={{color:"#d946ef"}}>Profits :</span> $10,000 — "house money" disponible<br/>
              <br/>
              Sur un setup <span style={{color:"#00ff88"}}>APEX PARFAIT 3/3</span> :<br/>
              → Tu peux risquer $1,000 (capital) + $500 (50% des profits) = <span style={{color:"#d946ef"}}>$1,500 max</span><br/>
              → Soit ~1.36% du total mais <span style={{color:"#d946ef"}}>uniquement sur ton meilleur edge</span>
            </div>
          </div>

          <div style={{ padding:10, background:"#d946ef11", borderRadius:3, marginBottom:8 }}>
            <div style={{ fontSize:9, color:"#d946ef", fontWeight:700, marginBottom:6 }}>RÈGLES STRICTES</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              ✓ Uniquement sur setups <span style={{color:"#00ff88"}}>confluence maximale</span> (APEX PARFAIT)<br/>
              ✓ Maximum <span style={{color:"#d946ef"}}>50% des profits</span> en boost — jamais plus<br/>
              ✓ Si tu perds le boost → <span style={{color:"#ff6666"}}>retour immédiat à 1% strict</span><br/>
              ✓ Recalcule chaque mois (les profits évoluent)<br/>
              ✓ Si compte revient au capital initial → <span style={{color:"#ff6666"}}>boost désactivé</span>
            </div>
          </div>

          <div style={{ padding:10, background:"#1a0d1a", borderRadius:3, border:"1px solid #d946ef44" }}>
            <div style={{ fontSize:9, color:"#d946ef", fontWeight:700, marginBottom:6 }}>⚠ LE PIÈGE PSYCHOLOGIQUE</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              "L'argent du profit reste TON argent." Les neurosciences le prouvent : <span style={{color:"#ff6666"}}>perdre $5,000 de profits fait aussi mal que perdre $5,000 de capital</span>.<br/>
              <br/>
              <span style={{color:"#ffd700",fontWeight:700}}>Drift dangereux :</span> tu commences à 1.5%, puis 2%, puis "juste cette fois 3%"... tu reviens à la case départ.
            </div>
          </div>

          <div style={{ marginTop:8, padding:"8px 10px", background:"#0a0a14", borderRadius:3, border:"1px dashed #d946ef66" }}>
            <div style={{ fontSize:9, color:"#d946ef", fontWeight:700, marginBottom:4 }}>💡 ALTERNATIVE SIMPLE (recommandée)</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.7 }}>
              Reste à <span style={{color:"#00ff88",fontWeight:700}}>1% strict du capital TOTAL</span>. Le composé fait le travail :<br/>
              <br/>
              $100,000 → 1% = $1,000/trade<br/>
              $130,000 → 1% = $1,300/trade (+30%)<br/>
              $200,000 → 1% = $2,000/trade (+100%)<br/>
              <br/>
              <span style={{color:"#00ff88"}}>Tu gagnes plus en absolu sans changer ta règle.</span> C'est la magie du composé.
            </div>
          </div>
        </div>

        {/* CIRCUIT BREAKER */}
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #ff6666" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#ff6666", marginBottom:8 }}>9️⃣ CIRCUIT BREAKER — PROTÉGER LE COMPTE</div>
          
          <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:8 }}>
            Si le compte perd <span style={{color:"#ff6666",fontWeight:700}}>10-15% depuis le pic</span> → pause totale.<br/>
            Analyse chaque perte. Identifie le problème. Reviens seulement quand tu sais POURQUOI.
          </div>

          <div style={{ padding:10, background:"#1a0000", borderRadius:3, border:"1px solid #ff666644" }}>
            <div style={{ fontSize:9, color:"#ff6666", fontWeight:700, marginBottom:6 }}>📉 LES MATHS DE LA RÉCUPÉRATION</div>
            <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.8, fontFamily:"monospace" }}>
              −10% → besoin de <span style={{color:"#4ade80"}}>+11%</span> ✓ facile<br/>
              −20% → besoin de <span style={{color:"#ffd700"}}>+25%</span> — difficile<br/>
              −30% → besoin de <span style={{color:"#ff9966"}}>+43%</span> — très difficile<br/>
              −50% → besoin de <span style={{color:"#ff6666"}}>+100%</span> — il faut DOUBLER<br/>
              −80% → besoin de <span style={{color:"#ff4444"}}>+400%</span> — game over
            </div>
            <div style={{ fontSize:8, color:TEXT_DIM, marginTop:8, fontStyle:"italic" }}>
              Plus le trou est profond, plus la sortie est exponentiellement difficile.
            </div>
          </div>
        </div>

        {/* CHECKLIST */}
        <div style={{ padding:12, background:BG, borderRadius:3, border:"2px solid #00ff8866", borderLeft:"4px solid #00ff88" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00ff88", marginBottom:10, letterSpacing:1 }}>✅ CHECKLIST AVANT CHAQUE TRADE</div>
          {[
            ["Stop placé sur niveau structurel","Swing low/high, support/résistance — pas un chiffre rond"],
            ["Taille calculée à partir du stop","Lots = Risque ÷ (Stop pips × $/pip)"],
            ["R:R minimum 2:1 vérifié","Target au moins 2× la distance du stop"],
            ["Plan de gestion écrit","Trailing, scale-out, ou pyramiding — décidé AVANT"],
            ["Pas de news haute impact imminente","Calendrier économique vérifié"],
            ["Pas plus de 1% risque total","Toutes positions ouvertes combinées"],
            ["Si trade perd → stop honoré","Pas de revanche, pas de give it room"],
          ].map(([check,detail],i)=>(
            <div key={i} style={{ display:"flex", gap:8, marginBottom:6, padding:"6px 8px", background:"#00ff8808", borderRadius:3 }}>
              <div style={{ fontSize:10, color:"#00ff88" }}>☐</div>
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:TEXT }}>{check}</div>
                <div style={{ fontSize:8, color:"#4a5070", marginTop:1 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>

      </div>    </div>
  );
}

function CalView() {
  const SECTIONS = [
    { title:"CALENDRIER ÉCONOMIQUE", color:ACCENT, links:[
      { label:"Babypips Economic Calendar", url:"https://www.babypips.com/economic-calendar", desc:"Événements HIGH impact" },
      { label:"Forex Factory Calendar", url:"https://www.forexfactory.com/calendar", desc:"Calendrier complet avec consensus" },
      { label:"Trading Economics Calendar", url:"https://tradingeconomics.com/calendar", desc:"Données macro mondiales" },
    ]},
    { title:"ANALYSE FX MACRO", color:"#a855f7", links:[
      { label:"ING Think FX", url:"https://think.ing.com/market/fx/", desc:"Analyse macro FX quotidienne institutionnelle" },
      { label:"Sucden Financial Daily FX", url:"https://www.sucdenfinancial.com/en/market-insights/fx-outlook/daily-fx-analysis/", desc:"Analyse technique et fondamentale" },
      { label:"Daily FX", url:"https://www.dailyfx.com/", desc:"News et analyses FX en continu" },
    ]},
    { title:"FORCE & SENTIMENT", color:"#00ff88", links:[
      { label:"Babypips Market Milk", url:"https://marketmilk.babypips.com/currency-strength", desc:"Force relative des devises" },
      { label:"Myfxbook Outlook", url:"https://www.myfxbook.com/community/outlook", desc:"Sentiment retail — contrarian indicator" },
    ]},
    { title:"COT & POSITIONNEMENT", color:"#ffd700", links:[
      { label:"Tradingster COT", url:"https://www.tradingster.com/cot", desc:"Positionnement institutionnel CFTC" },
      { label:"CFTC COT Reports", url:"https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm", desc:"Rapports officiels CFTC" },
    ]},
  ];
  return (
    <div style={{ padding:16 }}>
      {SECTIONS.map(s => (
        <div key={s.title} style={{ background:BG2, border:`1px solid ${s.color}33`, borderRadius:4, padding:14, marginBottom:10 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:s.color, fontWeight:700, marginBottom:10, borderBottom:`1px solid ${s.color}22`, paddingBottom:8, fontFamily:"'IBM Plex Mono'" }}>{s.title}</div>
          {s.links.map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", marginBottom:5, background:BG, borderRadius:3, border:`1px solid ${s.color}18`, textDecoration:"none" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{l.label} ↗</div>
                <div style={{ fontSize:9, color:TEXT_DIM, marginTop:2 }}>{l.desc}</div>
              </div>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}


// ============================================================
// TRADE APEX — Confluence Macro + COT + Retail
// ============================================================

const VALID_DIVERGENCE = [
  ["GOLDILOCKS","RECESSION"],["RECESSION","GOLDILOCKS"],
  ["GOLDILOCKS","STAGFLATION"],["STAGFLATION","GOLDILOCKS"],
  ["SURCHAUFFE","RECESSION"],["RECESSION","SURCHAUFFE"],
  ["SURCHAUFFE","STAGFLATION"],["STAGFLATION","SURCHAUFFE"],
];

function isValidMacroDivergence(rBase, rQuote) {
  if (!rBase || !rQuote) return false;
  return VALID_DIVERGENCE.some(([a,b]) => a === rBase.label && b === rQuote.label);
}

function getMacroDirection(rBase, rQuote) {
  const strong = ["GOLDILOCKS","SURCHAUFFE"];
  if (strong.includes(rBase.label)) return "LONG";
  return "SHORT";
}

function getMacroPts(rBase, rQuote) {
  const scoreMap = { GOLDILOCKS:100, SURCHAUFFE:80, RECESSION:-80, STAGFLATION:-100 };
  const b = scoreMap[rBase.label] || 0;
  const q = scoreMap[rQuote.label] || 0;
  return Math.abs(b - q);
}

function getApexSignalStrength(macroPts, cotStrength, retailStrength) {
  const strongLevels = ["EXTREME","FORT"];
  const cotStrong = strongLevels.includes(cotStrength);
  const retailStrong = strongLevels.includes(retailStrength);
  const bothExtreme = cotStrength === "EXTREME" && retailStrength === "EXTREME";
  if (bothExtreme && macroPts >= 160)
    return { label:"🔥🔥🔥 APEX PARFAIT", color:"#00ff88", bg:"#001a0d", priority:4 };
  if (bothExtreme)
    return { label:"🔥🔥 APEX FORT", color:"#22c55e", bg:"#052010", priority:3 };
  if (cotStrong && retailStrong)
    return { label:"🔥 APEX CONFIRMÉ", color:"#4ade80", bg:"#0a2e18", priority:2 };
  return { label:"↑↓ APEX BIAIS", color:"#86efac", bg:"#0d1f14", priority:1 };
}

// ============================================================
// TRADE COT — Confluence Macro + COT uniquement (sans retail)
// ============================================================
function TradeCOT({ data, cotData }) {
  const trades = [];

  SENT_PAIRS.forEach(({ name, base, quote }) => {
    const rBase  = getRegime(data, base);
    const rQuote = getRegime(data, quote);
    if (!rBase || !rQuote) return;
    if (!isValidMacroDivergence(rBase, rQuote)) return;

    const direction = getMacroDirection(rBase, rQuote);
    const macroPts  = getMacroPts(rBase, rQuote);

    const CFTC_MAP = {EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
    const bCotRaw  = cotData[CFTC_MAP[base]];
    const qCotRaw  = cotData[CFTC_MAP[quote]];
    if (!bCotRaw || !qCotRaw) return;

    const cotRange_b = bCotRaw.max52 - bCotRaw.min52;
    const cotRange_q = qCotRaw.max52 - qCotRaw.min52;
    const bPct = cotRange_b === 0 ? 50 : Math.round(((bCotRaw.net - bCotRaw.min52) / cotRange_b) * 100);
    const qPct = cotRange_q === 0 ? 50 : Math.round(((qCotRaw.net - qCotRaw.min52) / cotRange_q) * 100);
    const cotSpread = bPct - qPct;
    const cotAbs = Math.abs(cotSpread);
    const cotBias = cotSpread > 0 ? "HAUSSIER" : "BAISSIER";
    const cotStrength = cotAbs >= 60 ? "EXTREME" : cotAbs >= 40 ? "FORT" : cotAbs >= 20 ? "MODERE" : "NUL";

    const cotAligned = (direction === "LONG" && cotBias === "HAUSSIER") ||
                       (direction === "SHORT" && cotBias === "BAISSIER");
    if (!cotAligned) return;

    const sigCot = cotStrength === "EXTREME"
      ? { label:"🔥🔥 COT FORT", color:"#22c55e", bg:"#052010", priority:3 }
      : cotStrength === "FORT"
      ? { label:"🔥 COT CONFIRMÉ", color:"#4ade80", bg:"#0a2e18", priority:2 }
      : { label:"↑↓ COT BIAIS", color:"#86efac", bg:"#0d1f14", priority:1 };

    trades.push({
      name, base, quote,
      direction, macroPts, rBase, rQuote,
      cotBias, cotStrength, bPct, qPct, cotSpread,
      sig: sigCot,
    });
  });

  trades.sort((a, b) => b.sig.priority - a.sig.priority || b.macroPts - a.macroPts);

  return (
    <div style={{padding:12}}>
      <div style={{background:"#050810",border:"1px solid #00aaff44",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#00aaff",fontWeight:700}}>📊 TRADE COT — CONFLUENCE 2/3</div>
          <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Macro divergence + COT institutionnels (sans retail)</div>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:"#00aaff"}}>{trades.length}</div>
      </div>

      {trades.length === 0 && (
        <div style={{padding:16,background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e",textAlign:"center"}}>
          <div style={{fontSize:12,color:"#4a5070",marginBottom:8}}>Aucun signal COT actif</div>
          <div style={{fontSize:9,color:"#4a5070"}}>Macro divergence + alignement COT requis</div>
        </div>
      )}

      {trades.map((t, i) => (
        <div key={i} style={{marginBottom:12,background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e",padding:10}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",letterSpacing:1}}>
              <FlagImg code={t.base} size={16} /> {t.base} / <FlagImg code={t.quote} size={16} /> {t.quote}
            </div>
            <div style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:t.direction==="LONG"?"#052010":"#1a0808",color:t.direction==="LONG"?"#4ade80":"#f87171",border:"1px solid "+(t.direction==="LONG"?"#4ade8055":"#f8717155")}}>
              {t.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
            </div>
          </div>

          {/* 1 - MACRO */}
          <div style={{background:"#0a0a1a",borderRadius:6,padding:"8px 10px",marginBottom:6,borderLeft:"3px solid #00aaff"}}>
            <div style={{fontSize:8,color:"#00aaff",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 1 — MACRO DIVERGENCE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
              <div style={{background:t.rBase.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rBase.border+"55"}}>
                <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}><FlagImg code={t.base} size={14} /> {t.base}</div>
                <div style={{fontSize:10,color:t.rBase.color,fontWeight:700}}>{t.rBase.icon} {t.rBase.label}</div>
              </div>
              <div style={{fontSize:9,color:"#4a5070",textAlign:"center"}}>vs<br/><span style={{color:"#00aaff",fontWeight:700}}>+{t.macroPts}pts</span></div>
              <div style={{background:t.rQuote.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rQuote.border+"55"}}>
                <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}><FlagImg code={t.quote} size={14} /> {t.quote}</div>
                <div style={{fontSize:10,color:t.rQuote.color,fontWeight:700}}>{t.rQuote.icon} {t.rQuote.label}</div>
              </div>
            </div>
          </div>

          {/* 2 - COT */}
          <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid "+(t.cotBias==="HAUSSIER"?"#4ade80":"#f87171")}}>
            <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 2 — COT INSTITUTIONNELS</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:9,color:"#94a3b8"}}>
                <FlagImg code={t.base} size={12} /> P{t.bPct}% &nbsp;vs&nbsp; <FlagImg code={t.quote} size={12} /> P{t.qPct}%
                <span style={{color:"#4a5070",marginLeft:6}}>spread {t.cotSpread>0?"+":""}{t.cotSpread}</span>
              </div>
              <div style={{fontSize:10,fontWeight:700,color:t.cotBias==="HAUSSIER"?"#4ade80":"#f87171"}}>
                {t.cotBias} — {t.cotStrength}
              </div>
            </div>
          </div>

          {/* Conclusion */}
          <div style={{marginTop:8,background:t.sig.bg,border:"1px solid "+t.sig.color+"44",borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:12,color:t.sig.color,fontWeight:700,letterSpacing:1,textAlign:"center",marginBottom:6}}>
              {t.direction === "LONG" ? "🚀" : "📉"} {t.direction} {t.base}/{t.quote}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:6}}>
              <div style={{padding:"4px 6px",background:"#00ff8815",borderRadius:3,textAlign:"center"}}>
                <div style={{fontSize:7,color:"#00ff88",fontWeight:700,marginBottom:2}}>MACRO</div>
                <div style={{fontSize:8,color:"#c8d4f0"}}>{t.rBase.icon}{t.rBase.label.slice(0,4)} vs {t.rQuote.icon}{t.rQuote.label.slice(0,4)}</div>
                <div style={{fontSize:7,color:"#00aaff"}}>+{t.macroPts}pts</div>
              </div>
              <div style={{padding:"4px 6px",background:"#00aaff15",borderRadius:3,textAlign:"center"}}>
                <div style={{fontSize:7,color:"#00aaff",fontWeight:700,marginBottom:2}}>COT INSTITS</div>
                <div style={{fontSize:8,color:t.cotBias==="HAUSSIER"?"#4ade80":"#f87171"}}>{t.cotBias}</div>
                <div style={{fontSize:7,color:"#94a3b8"}}>{t.cotStrength}</div>
              </div>
              <div style={{padding:"4px 6px",background:"#f9731615",borderRadius:3,textAlign:"center"}}>
                <div style={{fontSize:7,color:"#f97316",fontWeight:700,marginBottom:2}}>RETAIL</div>
                <div style={{fontSize:8,color:"#4a5070"}}>Non filtré</div>
                <div style={{fontSize:7,color:"#4a5070"}}>—</div>
              </div>
            </div>
            <div style={{fontSize:8,color:"#4a5070",textAlign:"center"}}>2 confluences sur 3 — surveiller retail pour confirmation complète</div>
          </div>

        </div>
      ))}
    </div>
  );
}

function TradeApex({ data, cotData, retailData }) {
  const trades = [];

  SENT_PAIRS.forEach(({ name, base, quote }) => {
    const rBase  = getRegime(data, base);
    const rQuote = getRegime(data, quote);
    if (!rBase || !rQuote) return;
    if (!isValidMacroDivergence(rBase, rQuote)) return;

    const direction = getMacroDirection(rBase, rQuote);
    const macroPts  = getMacroPts(rBase, rQuote);

    // COT
    const CFTC_MAP = {EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
    const bCotRaw  = cotData[CFTC_MAP[base]];
    const qCotRaw  = cotData[CFTC_MAP[quote]];
    if (!bCotRaw || !qCotRaw) return;

    const cotRange_b = bCotRaw.max52 - bCotRaw.min52;
    const cotRange_q = qCotRaw.max52 - qCotRaw.min52;
    const bPct = cotRange_b === 0 ? 50 : Math.round(((bCotRaw.net - bCotRaw.min52) / cotRange_b) * 100);
    const qPct = cotRange_q === 0 ? 50 : Math.round(((qCotRaw.net - qCotRaw.min52) / cotRange_q) * 100);
    const cotSpread = bPct - qPct;
    const cotAbs = Math.abs(cotSpread);
    const cotBias = cotSpread > 0 ? "HAUSSIER" : "BAISSIER";
    const cotStrength = cotAbs >= 60 ? "EXTREME" : cotAbs >= 40 ? "FORT" : cotAbs >= 20 ? "MODERE" : "NUL";

    // Vérifier alignement COT avec direction
    const cotAligned = (direction === "LONG" && cotBias === "HAUSSIER") ||
                       (direction === "SHORT" && cotBias === "BAISSIER");
    if (!cotAligned) return;

    // Retail
    const rData = retailData[name];
    let retailBias = "N/A", retailStrength = "N/A", lp = 0, sp = 0;
    const hasRetail = !!rData;
    if (hasRetail) {
      lp = rData.longPercentage; sp = rData.shortPercentage;
      if      (lp >= 80) { retailBias = "BAISSIER"; retailStrength = "EXTREME"; }
      else if (sp >= 80) { retailBias = "HAUSSIER"; retailStrength = "EXTREME"; }
      else if (lp >= 70) { retailBias = "BAISSIER"; retailStrength = "FORT"; }
      else if (sp >= 70) { retailBias = "HAUSSIER"; retailStrength = "FORT"; }
      else if (lp >= 55) { retailBias = "BAISSIER"; retailStrength = "MODERE"; }
      else if (sp >= 55) { retailBias = "HAUSSIER"; retailStrength = "MODERE"; }
      else               { retailBias = "NEUTRE";   retailStrength = "NUL"; }
      // Vérifier alignement Retail (contrarian) avec direction
      const retailAligned = (direction === "LONG" && retailBias === "HAUSSIER") ||
                            (direction === "SHORT" && retailBias === "BAISSIER");
      if (!retailAligned || retailStrength === "NUL" || retailStrength === "MODERE") return;
    }

    const sig = getApexSignalStrength(macroPts, cotStrength, retailStrength);

    const baseFlag = CURR.find(c => c.code === base)?.flag || "";
    const quoteFlag = CURR.find(c => c.code === quote)?.flag || "";

    trades.push({
      name, base, quote, baseFlag, quoteFlag,
      direction, macroPts, rBase, rQuote,
      cotBias, cotStrength, bPct, qPct, cotSpread,
      retailBias, retailStrength, lp, sp,
      sig,
    });
  });

  trades.sort((a, b) => b.sig.priority - a.sig.priority || b.macroPts - a.macroPts);

  return (
    <div style={{padding:12}}>
      <div style={{background:"#050810",border:"1px solid #00ff8844",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#00ff88",fontWeight:700}}>⚡ TRADE APEX — CONFLUENCE 3/3</div>
          <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Macro divergence + COT instits + Retail contrarian</div>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:"#00ff88"}}>{trades.length}</div>
      </div>

      {trades.length === 0 && (
        <div style={{padding:16,background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e"}}>
          <div style={{fontSize:12,color:"#4a5070",marginBottom:8,textAlign:"center"}}>Aucun signal APEX actif</div>
          <div style={{fontSize:9,color:"#00aaff",marginBottom:4}}>DEBUG:</div>
          <div style={{fontSize:8,color:"#4a5070",lineHeight:2}}>
            Paires analysées: {SENT_PAIRS.length}<br/>
            COT keys: {Object.keys(cotData).length}<br/>
            Retail keys: {Object.keys(retailData).length}<br/>
            Data devises: {Object.keys(data).filter(k=>hasData(data,k)).join(", ") || "AUCUNE"}<br/>
            {SENT_PAIRS.slice(0,3).map(p=>{
              const rB = getRegime(data,p.base);
              const rQ = getRegime(data,p.quote);
              return p.name+": "+( rB?rB.label:"noReg")+" vs "+(rQ?rQ.label:"noReg");
            }).join(" | ")}
          </div>
        </div>
      )}

      {trades.map(t => (
        <div key={t.name} style={{background:"#08080f",border:"1px solid "+t.sig.color+"55",borderRadius:10,padding:14,marginBottom:12,animation:"fadeIn 0.3s ease"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:16,fontWeight:700,color:"#c8d4f0",letterSpacing:1}}>
              <FlagImg code={t.base} size={18} /><FlagImg code={t.quote} size={18} /> {t.base}/{t.quote}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,fontWeight:700,color:t.sig.color,background:t.sig.bg,padding:"4px 10px",borderRadius:4}}>{t.sig.label}</div>
              <div style={{fontSize:9,color: t.direction==="LONG"?"#00ff88":"#ef4444",marginTop:3,fontWeight:700,letterSpacing:2}}>
                {t.direction} {t.base}/{t.quote}
              </div>
            </div>
          </div>

          {/* 3 confirmations */}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>

            {/* 1 - MACRO */}
            <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid #00aaff"}}>
              <div style={{fontSize:8,color:"#00aaff",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 1 — MACRO DIVERGENCE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
                <div style={{background:t.rBase.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rBase.border+"55"}}>
                  <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}><FlagImg code={t.base} size={14} /> {t.base}</div>
                  <div style={{fontSize:10,color:t.rBase.color,fontWeight:700}}>{t.rBase.icon} {t.rBase.label}</div>
                </div>
                <div style={{fontSize:9,color:"#4a5070",textAlign:"center"}}>vs<br/><span style={{color:"#00aaff",fontWeight:700}}>+{t.macroPts}pts</span></div>
                <div style={{background:t.rQuote.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rQuote.border+"55"}}>
                  <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}><FlagImg code={t.quote} size={14} /> {t.quote}</div>
                  <div style={{fontSize:10,color:t.rQuote.color,fontWeight:700}}>{t.rQuote.icon} {t.rQuote.label}</div>
                </div>
              </div>
            </div>

            {/* 2 - COT */}
            <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid "+(t.cotBias==="HAUSSIER"?"#4ade80":"#f87171")}}>
              <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 2 — COT INSTITUTIONNELS</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:9,color:"#94a3b8"}}>
                  <FlagImg code={t.base} size={12} /> P{t.bPct}% &nbsp;vs&nbsp; <FlagImg code={t.quote} size={12} /> P{t.qPct}%
                  <span style={{color:"#4a5070",marginLeft:6}}>spread {t.cotSpread>0?"+":""}{t.cotSpread}</span>
                </div>
                <div style={{fontSize:10,fontWeight:700,color:t.cotBias==="HAUSSIER"?"#4ade80":"#f87171"}}>
                  {t.cotBias} — {t.cotStrength}
                </div>
              </div>
            </div>

            {/* 3 - RETAIL */}
            <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid "+(t.retailBias==="HAUSSIER"?"#4ade80":"#f87171")}}>
              <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 3 — RETAIL CONTRARIAN</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontSize:8,color:"#4a5070"}}>
                  LONG {t.lp}% &nbsp;·&nbsp; SHORT {t.sp}%
                </div>
                <div style={{fontSize:10,fontWeight:700,color:t.retailBias==="HAUSSIER"?"#4ade80":"#f87171"}}>
                  Contrarian {t.retailBias} — {t.retailStrength}
                </div>
              </div>
              <div style={{height:4,background:"#f87171",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:t.lp+"%",height:"100%",background:"#4ade80"}}/>
              </div>
            </div>

          </div>

          {/* Conclusion */}
          <div style={{marginTop:8,background:t.sig.bg,border:"1px solid "+t.sig.color+"44",borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:12,color:t.sig.color,fontWeight:700,letterSpacing:1,textAlign:"center",marginBottom:8}}>
              {t.direction === "LONG" ? "🚀" : "📉"} {t.direction} {t.base}/{t.quote} — CONFLUENCE TOTALE
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8}}>
              <div style={{padding:"6px 8px",background:"#00ff8815",borderRadius:3,textAlign:"center",border:"1px solid #00ff8833"}}>
                <div style={{fontSize:7,color:"#00ff88",fontWeight:700,marginBottom:3}}>✅ MACRO</div>
                <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}>{t.rBase.icon} vs {t.rQuote.icon}</div>
                <div style={{fontSize:8,color:"#00ff88"}}>{t.rBase.label.slice(0,4)} / {t.rQuote.label.slice(0,4)}</div>
                <div style={{fontSize:7,color:"#00aaff",marginTop:2}}>Divergence +{t.macroPts}pts</div>
              </div>
              <div style={{padding:"6px 8px",background:"#00aaff15",borderRadius:3,textAlign:"center",border:"1px solid #00aaff33"}}>
                <div style={{fontSize:7,color:"#00aaff",fontWeight:700,marginBottom:3}}>✅ COT INSTITS</div>
                <div style={{fontSize:9,color:t.cotBias==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>{t.cotBias}</div>
                <div style={{fontSize:8,color:"#94a3b8"}}>{t.cotStrength}</div>
                <div style={{fontSize:7,color:"#4a5070",marginTop:2}}>P{t.bPct}% vs P{t.qPct}%</div>
              </div>
              <div style={{padding:"6px 8px",background:"#f9731615",borderRadius:3,textAlign:"center",border:"1px solid #f9731633"}}>
                <div style={{fontSize:7,color:"#f97316",fontWeight:700,marginBottom:3}}>✅ RETAIL</div>
                <div style={{fontSize:9,color:t.retailBias==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>{t.retailBias}</div>
                <div style={{fontSize:8,color:"#94a3b8"}}>{t.retailStrength}</div>
                <div style={{fontSize:7,color:"#4a5070",marginTop:2}}>L{t.lp}% / S{t.sp}%</div>
              </div>
            </div>
            <div style={{padding:"6px 10px",background:"#001a0d",borderRadius:4,border:"1px solid #00ff8833",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#00ff88",fontWeight:700}}>3 forces alignées — Setup institutionnel complet</div>
              <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Macro divergente · Institutionnels positionnés · Retail du mauvais côté</div>
            </div>
          </div>

        </div>
      ))}
    </div>
  );
}


// ============================================================
// JOURNAL DE TRADE — PAT & FRANK
// ============================================================
function JournalView() {
  const [trader, setTrader] = useState("PAT");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    date:"", pair:"", direction:"LONG", regime_base:"", regime_quote:"",
    cot_dir:"", cot_strength:"", retail_dir:"", retail_pct:"",
    entry:"", sl:"", tp:"", exit:"",
    result_pips:"", result_usd:"", status:"OUVERT", note:""
  });
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const [filterStatus, setFilterStatus] = useState("TOUS");

  // Firebase sync
  useEffect(() => {
    const journalRef = ref(db, `journal/${trader}`);
    const unsub = onValue(journalRef, (snap) => {
      const val = snap.val();
      if (val) {
        const list = Object.entries(val).map(([k,v]) => ({...v, _key:k}));
        list.sort((a,b) => (b.date||"").localeCompare(a.date||""));
        setTrades(list);
      } else {
        setTrades([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [trader]);

  const submitTrade = () => {
    if (!form.pair || !form.date) return;
    const tradeData = {...form, updatedAt: Date.now()};
    delete tradeData._key;
    if (editKey) {
      set(ref(db, `journal/${trader}/${editKey}`), tradeData);
      setEditKey(null);
    } else {
      const newKey = `trade_${Date.now()}`;
      set(ref(db, `journal/${trader}/${newKey}`), tradeData);
    }
    setForm({date:"",pair:"",direction:"LONG",regime_base:"",regime_quote:"",cot_dir:"",cot_strength:"",retail_dir:"",retail_pct:"",entry:"",sl:"",tp:"",exit:"",result_pips:"",result_usd:"",status:"OUVERT",note:""});
    setShowForm(false);
  };

  const deleteTrade = (key) => {
    if (!confirm("Supprimer ce trade ?")) return;
    set(ref(db, `journal/${trader}/${key}`), null);
  };

  const editTrade = (t) => {
    const {_key, updatedAt, ...rest} = t;
    setForm(rest);
    setEditKey(_key);
    setShowForm(true);
  };

  const filtered = filterStatus === "TOUS" ? trades : trades.filter(t => t.status === filterStatus);

  // STATS
  const closed = trades.filter(t => t.status === "FERMÉ");
  const wins = closed.filter(t => parseFloat(t.result_usd||0) > 0);
  const losses = closed.filter(t => parseFloat(t.result_usd||0) < 0);
  const winRate = closed.length > 0 ? Math.round((wins.length/closed.length)*100) : 0;
  const totalPnL = closed.reduce((acc,t) => acc+parseFloat(t.result_usd||0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((a,t)=>a+parseFloat(t.result_usd||0),0)/wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a,t)=>a+parseFloat(t.result_usd||0),0)/losses.length) : 0;
  const rr = avgLoss > 0 ? (avgWin/avgLoss).toFixed(2) : "—";
  const profitFactor = losses.length > 0 && avgLoss > 0
    ? (wins.reduce((a,t)=>a+parseFloat(t.result_usd||0),0)/Math.abs(losses.reduce((a,t)=>a+parseFloat(t.result_usd||0),0))).toFixed(2)
    : "—";

  const PAIRS = ["EURUSD","GBPUSD","USDJPY","USDCAD","AUDUSD","NZDUSD","USDCHF","GBPJPY","EURJPY","AUDJPY","EURAUD","GBPAUD","EURGBP","AUDNZD","CHFJPY","GBPCAD","EURCAD","AUDCAD","NZDJPY"];
  const REGIMES_LIST = ["—","GOLDILOCKS","SURCHAUFFE","STAGFLATION","RECESSION"];
  const STATUSES = ["OUVERT","FERMÉ","BREAKEVEN","SL TOUCHÉ"];
  const REGIME_COLORS = {GOLDILOCKS:"#00ff88",SURCHAUFFE:"#ffd700",STAGFLATION:"#ff3b3b",RECESSION:"#ff7a00","—":"#4a5070"};

  const inputStyle = {width:"100%",padding:"6px 8px",background:"#0c0c18",border:"1px solid #1a1a2e",borderRadius:3,color:"#c8d4f0",fontSize:10,fontFamily:"'IBM Plex Mono',monospace",outline:"none"};
  const labelStyle = {fontSize:8,color:"#4a5070",letterSpacing:1,marginBottom:3,display:"block"};

  return (
    <div style={{padding:12,fontFamily:"'IBM Plex Mono',monospace"}}>

      {/* SÉLECTEUR PAT / FRANK */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["PAT","FRANK"].map(name => (
          <button key={name} onClick={()=>{setTrader(name);setShowForm(false);setFilterStatus("TOUS");}}
            style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",borderRadius:6,letterSpacing:2,
              border: trader===name?"2px solid #00aaff":"1px solid #1a1a2e",
              background: trader===name?"#00aaff20":"#08080f",
              color: trader===name?"#00aaff":"#4a5070"}}>
            {name === "PAT" ? "👤 PAT" : "👤 FRANK"}
            {trader===name && <span style={{display:"block",fontSize:8,color:"#00aaff66",marginTop:2,letterSpacing:1}}>JOURNAL ACTIF</span>}
          </button>
        ))}
      </div>

      {/* STATS DASHBOARD */}
      <div style={{background:"#08080f",border:"1px solid #00ff8833",borderRadius:8,padding:14,marginBottom:12}}>
        <div style={{fontSize:9,letterSpacing:3,color:"#00ff88",fontWeight:700,marginBottom:12,borderBottom:"1px solid #00ff8822",paddingBottom:8}}>
          📊 STATS — {trader} · {closed.length} trades fermés
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
          {[
            ["WIN RATE", winRate+"%", winRate>=55?"#00ff88":winRate>=45?"#ffd700":"#ff6666"],
            ["TOTAL P&L", (totalPnL>=0?"+":"")+totalPnL.toFixed(0)+"$", totalPnL>=0?"#00ff88":"#ff6666"],
            ["RATIO R:R", rr, parseFloat(rr)>=2?"#00ff88":parseFloat(rr)>=1.5?"#ffd700":"#ff6666"],
            ["OUVERTS", trades.filter(t=>t.status==="OUVERT").length, "#00aaff"],
            ["MOY WIN", wins.length>0?"+"+avgWin.toFixed(0)+"$":"—", "#4ade80"],
            ["PROFIT F.", profitFactor, parseFloat(profitFactor)>=1.5?"#00ff88":"#ff6666"],
          ].map(([label,val,color])=>(
            <div key={label} style={{padding:"10px 8px",background:"#050508",borderRadius:4,textAlign:"center",border:"1px solid #1a1a2e"}}>
              <div style={{fontSize:7,color:"#4a5070",letterSpacing:1,marginBottom:4}}>{label}</div>
              <div style={{fontSize:14,fontWeight:700,color:color}}>{val}</div>
            </div>
          ))}
        </div>

        {/* STATS PAR PAIRE */}
        {closed.length > 0 && (
          <div style={{padding:"8px 10px",background:"#050508",borderRadius:4,border:"1px solid #1a1a2e"}}>
            <div style={{fontSize:8,color:"#4a5070",marginBottom:6,letterSpacing:1}}>PAR PAIRE</div>
            {Object.entries(
              closed.reduce((acc,t)=>{
                if(!acc[t.pair]) acc[t.pair]={wins:0,total:0,pnl:0};
                acc[t.pair].total++;
                if(parseFloat(t.result_usd||0)>0) acc[t.pair].wins++;
                acc[t.pair].pnl+=parseFloat(t.result_usd||0);
                return acc;
              },{})
            ).sort((a,b)=>b[1].pnl-a[1].pnl).map(([pair,st])=>(
              <div key={pair} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid #0a0a14"}}>
                <span style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}>{pair}</span>
                <span style={{fontSize:8,color:"#4a5070"}}>{st.wins}/{st.total}</span>
                <span style={{fontSize:9,fontWeight:700,color:st.pnl>=0?"#00ff88":"#ff6666"}}>{st.pnl>=0?"+":""}{st.pnl.toFixed(0)}$</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOUTON NOUVEAU TRADE */}
      <button onClick={()=>{setShowForm(true);setEditKey(null);setForm({date:"",pair:"",direction:"LONG",regime_base:"",regime_quote:"",cot_dir:"",cot_strength:"",retail_dir:"",retail_pct:"",entry:"",sl:"",tp:"",exit:"",result_pips:"",result_usd:"",status:"OUVERT",note:""}); }}
        style={{width:"100%",padding:"10px",background:"#001a0d",border:"1px solid #00ff8844",borderRadius:6,color:"#00ff88",fontSize:11,fontWeight:700,cursor:"pointer",marginBottom:12,letterSpacing:2}}>
        + ENREGISTRER UN TRADE — {trader}
      </button>

      {/* FORMULAIRE */}
      {showForm && (
        <div style={{background:"#08080f",border:"1px solid #00aaff44",borderRadius:8,padding:14,marginBottom:12,animation:"fadeIn 0.2s ease"}}>
          <div style={{fontSize:10,color:"#00aaff",fontWeight:700,letterSpacing:2,marginBottom:12}}>
            {editKey ? "✏ MODIFIER" : "📝 NOUVEAU TRADE"} — {trader}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><label style={labelStyle}>DATE</label>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inputStyle}/>
            </div>
            <div><label style={labelStyle}>PAIRE</label>
              <select value={form.pair} onChange={e=>setForm(f=>({...f,pair:e.target.value}))} style={inputStyle}>
                <option value="">Choisir...</option>
                {PAIRS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>DIRECTION</label>
              <select value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))} style={inputStyle}>
                <option value="LONG">▲ LONG</option>
                <option value="SHORT">▼ SHORT</option>
              </select>
            </div>
            <div><label style={labelStyle}>STATUT</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inputStyle}>
                {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>RÉGIME BASE</label>
              <select value={form.regime_base} onChange={e=>setForm(f=>({...f,regime_base:e.target.value}))} style={inputStyle}>
                {REGIMES_LIST.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>RÉGIME QUOTE</label>
              <select value={form.regime_quote} onChange={e=>setForm(f=>({...f,regime_quote:e.target.value}))} style={inputStyle}>
                {REGIMES_LIST.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* COT */}
            <div style={{gridColumn:"1 / -1"}}>
              <div style={{background:"#0a0a1a",borderRadius:6,padding:10,borderLeft:"3px solid #00aaff",marginBottom:4}}>
                <div style={{fontSize:8,color:"#00aaff",fontWeight:700,letterSpacing:2,marginBottom:8}}>📈 COT — INSTITUTIONNELS</div>
                <div style={{marginBottom:8}}>
                  <label style={labelStyle}>DIRECTION DES INSTITUTIONNELS SUR LA PAIRE</label>
                  <div style={{display:"flex",gap:6}}>
                    {["HAUSSIER","BAISSIER"].map(d=>(
                      <button key={d} onClick={()=>setForm(f=>({...f,cot_dir:d}))}
                        style={{flex:1,padding:"8px",fontSize:10,cursor:"pointer",borderRadius:3,
                          fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,
                          border:form.cot_dir===d?"1px solid "+(d==="HAUSSIER"?"#4ade8088":"#f8717188"):"1px solid #1a1a2e",
                          background:form.cot_dir===d?(d==="HAUSSIER"?"#4ade8020":"#f8717120"):"#0c0c18",
                          color:form.cot_dir===d?(d==="HAUSSIER"?"#4ade80":"#f87171"):"#4a5070"}}>
                        {d==="HAUSSIER"?"▲ HAUSSIER":"▼ BAISSIER"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:form.cot_dir?8:0}}>
                  <label style={labelStyle}>FORCE DU SIGNAL COT</label>
                  <div style={{display:"flex",gap:4}}>
                    {["—","EXTREME","FORT","MODERE"].map(s=>(
                      <button key={s} onClick={()=>setForm(f=>({...f,cot_strength:s==="—"?"":s}))}
                        style={{flex:1,padding:"6px 4px",fontSize:9,cursor:"pointer",borderRadius:3,
                          fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,
                          border:(form.cot_strength||"—")===s?"1px solid #00aaff88":"1px solid #1a1a2e",
                          background:(form.cot_strength||"—")===s?"#00aaff20":"#0c0c18",
                          color:(form.cot_strength||"—")===s?"#00aaff":"#4a5070"}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {form.cot_dir && (
                  <div style={{padding:"6px 8px",background:"#050508",borderRadius:3,fontSize:9,marginTop:6}}>
                    <span style={{color:"#4a5070"}}>RÉSUMÉ : </span>
                    <span style={{color:form.cot_dir==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>
                      {form.cot_dir==="HAUSSIER"?"▲":"▼"} {form.cot_dir} {form.cot_strength}
                    </span>
                    <span style={{color:"#4a5070"}}> — instits {form.cot_dir==="HAUSSIER"?"LONG":"SHORT"} sur la paire</span>
                  </div>
                )}
              </div>
            </div>

            {/* RETAIL */}
            <div style={{gridColumn:"1 / -1"}}>
              <div style={{background:"#0a0a1a",borderRadius:6,padding:10,borderLeft:"3px solid #f97316"}}>
                <div style={{fontSize:8,color:"#f97316",fontWeight:700,letterSpacing:2,marginBottom:8}}>📊 RETAIL CONTRARIAN — MYFXBOOK</div>
                <div style={{marginBottom:8}}>
                  <label style={labelStyle}>% RETAIL DANS UNE DIRECTION</label>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input type="number" min="1" max="100" value={form.retail_pct||""}
                      onChange={e=>setForm(f=>({...f,retail_pct:e.target.value}))}
                      placeholder="78"
                      style={{width:80,padding:"6px 8px",background:"#0c0c18",border:"1px solid #f9731644",
                        borderRadius:3,color:"#f97316",fontSize:16,fontWeight:700,
                        fontFamily:"'IBM Plex Mono',monospace",textAlign:"center",outline:"none"}}/>
                    <span style={{fontSize:14,color:"#f97316",fontWeight:700}}>%</span>
                  </div>
                </div>
                <div style={{marginBottom:8}}>
                  <label style={labelStyle}>OÙ EST LE RETAIL ? (leur direction)</label>
                  <div style={{display:"flex",gap:6}}>
                    {["LONG","SHORT"].map(d=>(
                      <button key={d} onClick={()=>setForm(f=>({...f,retail_dir:d}))}
                        style={{flex:1,padding:"8px",fontSize:10,cursor:"pointer",borderRadius:3,
                          fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,
                          border:form.retail_dir===d?"1px solid "+(d==="LONG"?"#4ade8088":"#f8717188"):"1px solid #1a1a2e",
                          background:form.retail_dir===d?(d==="LONG"?"#4ade8020":"#f8717120"):"#0c0c18",
                          color:form.retail_dir===d?(d==="LONG"?"#4ade80":"#f87171"):"#4a5070"}}>
                        {d==="LONG"?"▲ LONG":"▼ SHORT"}
                      </button>
                    ))}
                  </div>
                </div>
                {form.retail_pct && form.retail_dir && (()=>{
                  const pct = parseFloat(form.retail_pct||0);
                  const contra = form.retail_dir==="LONG"?"BAISSIER":"HAUSSIER";
                  const contraColor = contra==="HAUSSIER"?"#4ade80":"#f87171";
                  const longPct = form.retail_dir==="LONG"?pct:100-pct;
                  const shortPct = form.retail_dir==="SHORT"?pct:100-pct;
                  return (
                    <div>
                      <div style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:8,marginBottom:3}}>
                          <span style={{color:"#4ade80"}}>LONG {longPct.toFixed(0)}%</span>
                          <span style={{color:"#f87171"}}>SHORT {shortPct.toFixed(0)}%</span>
                        </div>
                        <div style={{height:6,background:"#f87171",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:longPct+"%",height:"100%",background:"#4ade80"}}/>
                        </div>
                      </div>
                      <div style={{padding:"8px 10px",background:"#1a0a00",border:"1px solid #f9731644",borderRadius:4}}>
                        <div style={{fontSize:8,color:"#f97316",fontWeight:700,marginBottom:4}}>⚡ SIGNAL CONTRARIAN</div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{fontSize:9,color:"#4a5070",lineHeight:1.5}}>
                            {pct}% retail {form.retail_dir}<br/>
                            <span style={{color:"#f97316"}}>→ ils vont se faire liquider</span>
                          </div>
                          <div style={{fontSize:20,color:"#333"}}>→</div>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:contraColor}}>
                              {contra==="HAUSSIER"?"▲":"▼"} {contra}
                            </div>
                            <div style={{fontSize:8,color:"#f97316"}}>signal contrarian</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div><label style={labelStyle}>ENTRÉE</label>
              <input type="number" step="0.00001" value={form.entry} onChange={e=>setForm(f=>({...f,entry:e.target.value}))} style={inputStyle} placeholder="1.08500"/>
            </div>
            <div><label style={labelStyle}>STOP LOSS</label>
              <input type="number" step="0.00001" value={form.sl} onChange={e=>setForm(f=>({...f,sl:e.target.value}))} style={inputStyle} placeholder="1.07800"/>
            </div>
            <div><label style={labelStyle}>TARGET</label>
              <input type="number" step="0.00001" value={form.tp} onChange={e=>setForm(f=>({...f,tp:e.target.value}))} style={inputStyle} placeholder="1.10000"/>
            </div>
            <div><label style={labelStyle}>PRIX SORTIE</label>
              <input type="number" step="0.00001" value={form.exit} onChange={e=>setForm(f=>({...f,exit:e.target.value}))} style={inputStyle} placeholder="1.09500"/>
            </div>
            <div><label style={labelStyle}>RÉSULTAT PIPS</label>
              <input type="number" value={form.result_pips} onChange={e=>setForm(f=>({...f,result_pips:e.target.value}))} style={inputStyle} placeholder="+85"/>
            </div>
            <div><label style={labelStyle}>RÉSULTAT $</label>
              <input type="number" value={form.result_usd} onChange={e=>setForm(f=>({...f,result_usd:e.target.value}))} style={inputStyle} placeholder="+850"/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={labelStyle}>NOTE — RAISON DU TRADE</label>
            <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}
              placeholder="Ex: EURUSD — GOLDILOCKS vs RECESSION, COT EXTREME, retail 78% short. Entrée retest support 1.0850."
              style={{...inputStyle,height:80,resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={submitTrade}
              style={{flex:1,padding:"10px",background:"#001a0d",border:"1px solid #00ff8844",borderRadius:4,color:"#00ff88",fontSize:10,fontWeight:700,cursor:"pointer"}}>
              {editKey ? "✓ MODIFIER" : "✓ ENREGISTRER"}
            </button>
            <button onClick={()=>{setShowForm(false);setEditKey(null);}}
              style={{padding:"10px 16px",background:"transparent",border:"1px solid #1a1a2e",borderRadius:4,color:"#4a5070",fontSize:10,cursor:"pointer"}}>
              ANNULER
            </button>
          </div>
        </div>
      )}

      {/* FILTRES */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {["TOUS","OUVERT","FERMÉ","BREAKEVEN","SL TOUCHÉ"].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)}
            style={{padding:"4px 10px",fontSize:9,cursor:"pointer",borderRadius:3,
              border:filterStatus===s?"1px solid #00aaff66":"1px solid #1a1a2e",
              background:filterStatus===s?"#00aaff15":"transparent",
              color:filterStatus===s?"#00aaff":"#4a5070"}}>
            {s} {s==="TOUS"?trades.length:trades.filter(t=>t.status===s).length}
          </button>
        ))}
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{textAlign:"center",padding:24,color:"#4a5070",fontSize:10}}>
          Chargement...
        </div>
      )}

      {/* LISTE */}
      {!loading && filtered.length===0 && (
        <div style={{textAlign:"center",padding:32,color:"#4a5070",fontSize:10}}>
          Aucun trade enregistré pour {trader}.<br/>
          <span style={{fontSize:8}}>Clique sur "+ ENREGISTRER UN TRADE" pour commencer.</span>
        </div>
      )}

      {filtered.map((t) => {
        const pnl = parseFloat(t.result_usd||0);
        const statusColor = t.status==="FERMÉ"?(pnl>0?"#00ff88":"#ff6666"):t.status==="OUVERT"?"#00aaff":t.status==="BREAKEVEN"?"#ffd700":"#ff6666";
        return (
          <div key={t._key} style={{background:"#08080f",border:"1px solid #1a1a2e",borderRadius:8,padding:12,marginBottom:8,borderLeft:"3px solid "+statusColor,animation:"fadeIn 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#c8d4f0",letterSpacing:1}}>{t.pair}</span>
                  <span style={{fontSize:9,fontWeight:700,color:t.direction==="LONG"?"#4ade80":"#f87171",padding:"2px 6px",background:t.direction==="LONG"?"#4ade8015":"#f8717115",borderRadius:3}}>
                    {t.direction==="LONG"?"▲":"▼"} {t.direction}
                  </span>
                  <span style={{fontSize:8,color:statusColor,border:"1px solid "+statusColor+"44",padding:"2px 6px",borderRadius:3}}>{t.status}</span>
                </div>
                <div style={{fontSize:8,color:"#4a5070"}}>{t.date}</div>
              </div>
              <div style={{textAlign:"right"}}>
                {t.result_usd && <div style={{fontSize:14,fontWeight:700,color:pnl>=0?"#00ff88":"#ff6666"}}>{pnl>=0?"+":""}{pnl.toFixed(0)}$</div>}
                {t.result_pips && <div style={{fontSize:9,color:"#4a5070"}}>{parseFloat(t.result_pips)>=0?"+":""}{t.result_pips} pips</div>}
              </div>
            </div>
            {/* CONFLUENCES */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
              {/* MACRO */}
              <div style={{padding:"6px 8px",background:"#00ff8812",borderRadius:4,border:"1px solid #00ff8833",textAlign:"center"}}>
                <div style={{fontSize:7,color:"#00ff88",fontWeight:700,letterSpacing:1,marginBottom:3}}>MACRO</div>
                {t.regime_base && t.regime_base!=="—" && <div style={{fontSize:9,color:REGIME_COLORS[t.regime_base]||"#4a5070",fontWeight:700}}>{t.regime_base.slice(0,4)}</div>}
                {t.regime_quote && t.regime_quote!=="—" && <div style={{fontSize:8,color:REGIME_COLORS[t.regime_quote]||"#4a5070"}}>vs {t.regime_quote.slice(0,4)}</div>}
              </div>
              {/* COT */}
              <div style={{padding:"6px 8px",background:"#00aaff12",borderRadius:4,border:"1px solid #00aaff33",textAlign:"center"}}>
                <div style={{fontSize:7,color:"#00aaff",fontWeight:700,letterSpacing:1,marginBottom:3}}>COT INSTITS</div>
                {t.cot_dir && <div style={{fontSize:10,color:t.cot_dir==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>{t.cot_dir==="HAUSSIER"?"▲":"▼"} {t.cot_dir}</div>}
                {t.cot_strength && <div style={{fontSize:8,color:"#00aaff"}}>{t.cot_strength}</div>}
              </div>
              {/* RETAIL */}
              <div style={{padding:"6px 8px",background:"#f9731612",borderRadius:4,border:"1px solid #f9731633",textAlign:"center"}}>
                <div style={{fontSize:7,color:"#f97316",fontWeight:700,letterSpacing:1,marginBottom:3}}>RETAIL</div>
                {t.retail_pct && t.retail_dir && (()=>{
                  const contra = t.retail_dir==="LONG"?"▼ BAIS":"▲ HAUS";
                  const contraColor = t.retail_dir==="LONG"?"#f87171":"#4ade80";
                  return (
                    <div>
                      <div style={{fontSize:9,color:"#4a5070"}}>{t.retail_pct}% {t.retail_dir}</div>
                      <div style={{fontSize:9,color:contraColor,fontWeight:700}}>→ {contra}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
            {(t.entry||t.sl||t.tp) && (
              <div style={{display:"flex",gap:12,marginBottom:8,fontSize:8,color:"#4a5070"}}>
                {t.entry && <span>E: <span style={{color:"#c8d4f0"}}>{t.entry}</span></span>}
                {t.sl && <span>SL: <span style={{color:"#ff6666"}}>{t.sl}</span></span>}
                {t.tp && <span>TP: <span style={{color:"#00ff88"}}>{t.tp}</span></span>}
                {t.exit && <span>Exit: <span style={{color:"#ffd700"}}>{t.exit}</span></span>}
              </div>
            )}
            {t.note && (
              <div style={{padding:"6px 8px",background:"#050508",borderRadius:3,fontSize:9,color:"#94a3b8",lineHeight:1.5,marginBottom:8,borderLeft:"2px solid #1a1a2e"}}>
                {t.note}
              </div>
            )}
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>editTrade(t)}
                style={{padding:"4px 10px",fontSize:8,cursor:"pointer",borderRadius:3,border:"1px solid #00aaff44",background:"transparent",color:"#00aaff"}}>
                ✏ MODIFIER
              </button>
              <button onClick={()=>deleteTrade(t._key)}
                style={{padding:"4px 10px",fontSize:8,cursor:"pointer",borderRadius:3,border:"1px solid #ff666644",background:"transparent",color:"#ff6666"}}>
                ✕ SUPPRIMER
              </button>
            </div>
          </div>
        );
      })}

      {/* EXPLICATION */}
      <div style={{marginTop:16,padding:14,background:"#08080f",border:"1px solid #1a1a2e",borderRadius:8}}>
        <div style={{fontSize:9,color:"#00aaff",fontWeight:700,letterSpacing:2,marginBottom:10,borderBottom:"1px solid #1a1a2e",paddingBottom:8}}>
          📚 POURQUOI UN JOURNAL ?
        </div>
        <div style={{fontSize:9,color:"#4a5070",lineHeight:1.8}}>
          <span style={{color:"#c8d4f0",fontWeight:700}}>Le journal est ton avantage statistique.</span> Sans données, tu trades sur des émotions. Avec données, tu trades sur des faits.<br/><br/>
          <span style={{color:"#00ff88"}}>Win Rate :</span> Sous 40% = problème de sélection. Dessus mais perdant = problème de gestion.<br/>
          <span style={{color:"#00aaff"}}>Ratio R:R :</span> 2:1 = 34% win rate suffit pour être rentable.<br/>
          <span style={{color:"#ffd700"}}>Profit Factor :</span> Au-dessus de 1.5 = système viable.<br/>
          <span style={{color:"#a855f7"}}>Par paire :</span> Le journal révèle ton vrai edge sur chaque paire.<br/><br/>
          <span style={{color:"#c8d4f0",fontWeight:700}}>Objectif :</span> Après 50 trades, tu as assez de données pour optimiser avec précision mathématique.
        </div>
      </div>
    </div>
  );
}



export default function App() {
  const [data, setData] = useState(mkData());
  const [view, setView] = useState("table");
  const [sentRetail, setSentRetail] = useState({});
  const [sentCot, setSentCot] = useState({});
  const [connected, setConnected] = useState(false);
  const [apexCot, setApexCot]       = useState({});
  const [apexRetail, setApexRetail] = useState({});

  // Fetch COT + Retail pour TradeApex
  useEffect(() => {
    const COT_CODES = ["099741","096742","097741","090741","232741","092741","098662","112741"];
    const loadCOT = async () => {
      const res = await Promise.all(COT_CODES.map(async code => {
        try {
          const url = "https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
          const rows = await (await fetch(url)).json();
          if (!rows?.length) return [code, null];
          const nets = rows.map(r => parseFloat(r.noncomm_positions_long_all||0) - parseFloat(r.noncomm_positions_short_all||0));
          return [code, { net: Math.round(nets[0]), max52: Math.max(...nets.slice(0,26)), min52: Math.min(...nets.slice(0,26)) }];
        } catch { return [code, null]; }
      }));
      const map = {};
      res.forEach(([code, val]) => { if (val) map[code] = val; });
      setApexCot(map);
    };
    loadCOT();
    // Refresh COT chaque vendredi 21h30 EST (publication CFTC) + vérif toutes les heures
    const cotInterval = setInterval(() => {
      const n = new Date();
      const day = n.getUTCDay(); // 5 = vendredi
      const hour = n.getUTCHours();
      const min = n.getUTCMinutes();
      // Vendredi entre 20h30 et 23h UTC (publication CFTC ~20h30 UTC)
      if (day === 5 && hour >= 20 && hour <= 23) loadCOT();
      // Aussi refresh le samedi matin pour être sûr
      if (day === 6 && hour >= 0 && hour <= 2) loadCOT();
    }, 60 * 60 * 1000); // vérif toutes les heures
    const loadMFX = async () => {
      try {
        // Un seul appel — login + outlook côté serveur
        const r = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$")+"&t="+Date.now());
        const d = await r.json();
        if (d.error || !d.symbols) return;
        const map = {};
        d.symbols.forEach(s => { map[s.name] = s; });
        if (Object.keys(map).length > 0) setApexRetail(map);
      } catch(e) {}
    };
    loadMFX();
    const mfxInterval = setInterval(loadMFX, 30 * 60 * 1000);
    return () => { clearInterval(mfxInterval); clearInterval(cotInterval); };
  }, []);

  useEffect(() => {
    const dataRef = ref(db, "apexdata");
    const unsub = onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const base = mkData();
        CURR.forEach(c => {
          if (val[c.code]) {
            INDS.forEach(i => {
              if (val[c.code][i.id]) base[c.code][i.id] = val[c.code][i.id];
            });
          }
        });
        setData(base);
      }
      setConnected(true);
    }, () => setConnected(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadSent() {
      const retail = await fetchRetailApp();
      setSentRetail(retail);
      const codes = [...new Set(Object.values(CFTC_CODES))];
      const cotRes = {};
      await Promise.all(codes.map(async code => { cotRes[code] = await fetchCOTApp(code); }));
      setSentCot(cotRes);
    }
    loadSent();
    const ri = setInterval(loadSent, 60*60*1000);
    return () => clearInterval(ri);
  }, []);

  function setCell(code, id, field, val) {
    setData(p => {
      const n = {...p}; n[code] = {...p[code]}; n[code][id] = {...p[code][id],[field]:val};
      set(ref(db, `apexdata/${code}/${id}`), n[code][id]).catch(console.error);
      return n;
    });
  }

  function resetData() {
    if (confirm("Effacer toutes les données pour TOUS les utilisateurs?")) {
      const d = mkData();
      set(ref(db, "apexdata"), d).catch(console.error);
      setData(d);
    }
  }

  const REGIME_RANK = { "GOLDILOCKS":3, "SURCHAUFFE":2, "RECESSION":-2, "STAGFLATION":-3 };
  const ranked = useMemo(() =>
    CURR.map(c => ({...c, score:calcScore(data,c.code)})).sort((a,b)=>{
      const rA = getRegime(data,a.code);
      const rB = getRegime(data,b.code);
      const rankA = rA ? (REGIME_RANK[rA.label] ?? 0) : 0;
      const rankB = rB ? (REGIME_RANK[rB.label] ?? 0) : 0;
      if (rankB !== rankA) return rankB - rankA;
      return b.score - a.score;
    })
  ,[data]);

  const withData = ranked.filter(c => hasData(data,c.code));

  const allPairs = useMemo(() => {
    const pairs = [];
    for (let i=0;i<withData.length;i++) for (let j=i+1;j<withData.length;j++) {
      const a=withData[i],b=withData[j];
      const strong=a.score>=b.score?a:b, weak=a.score>=b.score?b:a;
      const div=strong.score-weak.score;
      if (div<0.08) continue;
      const regS=getRegime(data,strong.code), regW=getRegime(data,weak.code);
      const perfect=regS&&regW&&["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)&&["RECESSION","STAGFLATION"].includes(regW.label);
      // Filtre strict: seulement bonne économie vs mauvaise économie
      if (!regS || !regW) continue;
      if (!["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)) continue;
      if (!["RECESSION","STAGFLATION"].includes(regW.label)) continue;
      // ── CROISEMENT MACRO + SENTIMENT ──────────────────────────────────
      const sentPair = SENT_PAIRS.find(p =>
        (p.base===strong.code && p.quote===weak.code) ||
        (p.base===weak.code   && p.quote===strong.code)
      );
      let sentSig = null;
      if (sentPair) {
        const rA   = analyzeRetailS(sentRetail[sentPair.name]);
        const bCur = analyzeCurrencyS(sentCot[CFTC_CODES[sentPair.base]]);
        const qCur = analyzeCurrencyS(sentCot[CFTC_CODES[sentPair.quote]]);
        const pCot = analyzePairCOTS(bCur, qCur);
        const raw  = buildSignalS(rA, pCot);
        if (raw.valid) {
          const strongIsBase = sentPair.base === strong.code;
          // Direction sentiment doit correspondre à la direction macro
          const aligned = (raw.bias==="HAUSSIER" && strongIsBase) ||
                          (raw.bias==="BAISSIER" && !strongIsBase);
          if (aligned) sentSig = {...raw, strongIsBase};
        }
      }
      if (!sentSig) continue; // Seulement paires avec DOUBLE confirmation
      pairs.push({strong,weak,div,regS,regW,perfect,sentSig});
    }
    return pairs.sort((a,b)=>(b.div+(b.perfect?0.5:0))-(a.div+(a.perfect?0.5:0)));
  },[data,withData,sentRetail,sentCot]);

  const tabStyle = active => ({
    padding:"5px 10px", fontSize:10, fontFamily:"'IBM Plex Mono',monospace",
    cursor:"pointer", borderRadius:2, letterSpacing:1,
    border: active?`1px solid ${ACCENT}66`:`1px solid ${BORDER}`,
    background: active?`${ACCENT}15`:"transparent",
    color: active?ACCENT:TEXT_DIM,
  });

  const TABS = [
    {id:"table",label:"TABLEAU"},{id:"rank",label:"RANG"},
    {id:"regimes",label:"RÉGIMES"},{id:"tradecot",label:"TRADE COT+MACRO"},{id:"trade",label:"TRADE COT+MACRO+RETAIL"},{id:"journal",label:"JOURNAL"},
    {id:"data",label:"DONNÉES ↗"},{id:"guide",label:"GUIDE"},{id:"heat",label:"HEATMAP"},{id:"sentiment",label:"SENTIMENT"},{id:"cal",label:"RESSOURCES"},
  ];

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'IBM Plex Mono',monospace", color:TEXT, fontSize:12 }}>
      <style>{css}</style>
      <div style={{ background:BG2, borderBottom:`1px solid ${BORDER}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:3, color:ACCENT, fontFamily:"'IBM Plex Mono'" }}>PAT & FRANK MACRO FX</div>
          <div style={{ fontSize:8, color:TEXT_DIM, letterSpacing:3 }}>ANALYSE INSTITUTIONNELLE — BIAIS BANQUE CENTRALE</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:connected?"#00ff88":"#ff3b3b", animation:connected?"pulse 2s infinite":"none" }} />
            <span style={{ fontSize:7, color:connected?"#00ff88":"#ff3b3b", letterSpacing:1 }}>{connected?"SYNC TEMPS RÉEL":"CONNEXION..."}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
          {TABS.map(t=><button key={t.id} style={tabStyle(view===t.id)} onClick={()=>setView(t.id)}>{t.label}</button>)}
        </div>
      </div>
      <div style={{ background:"#06060e", borderBottom:`1px solid ${BORDER}`, padding:"6px 16px", display:"flex", gap:12, overflowX:"auto" }}>
        {ranked.map(c => {
          const st=getStrength(c.score, getRegime(data,c.code)), reg=getRegime(data,c.code);
          return (
            <div key={c.code} style={{ display:"flex", flexDirection:"column", alignItems:"center", minWidth:44, gap:2 }}>
              <span style={{ fontSize:8, color:st.color, fontWeight:700, letterSpacing:1 }}>{c.code}</span>
              <div style={{ width:38, height:2, background:"#0a0a18", borderRadius:1 }}>
                <div style={{ width:Math.min(Math.abs(c.score)*100,100)+"%", height:"100%", background:st.color, borderRadius:1 }} />
              </div>
              <span style={{ fontSize:7, color:TEXT_DIM }}>{c.score>=0?"+":""}{c.score.toFixed(2)}</span>
              {reg&&<span style={{ fontSize:7, color:reg.color }}>{reg.icon}</span>}
            </div>
          );
        })}
      </div>

      {view==="table" && (
        <div style={{ overflowX:"auto", padding:12 }}>
          <div style={{ fontSize:8, color:TEXT_DIM, marginBottom:8, letterSpacing:1 }}>PRIOR → EXP → NOW · Vert=BEAT · Rouge=MISS · Gris=NEUTRE · Tier1: Inflation/Core · Tier2: Unemployment/Services PMI</div>
          <table style={{ borderCollapse:"collapse", minWidth:980 }}>
            <thead>
              <tr>
                <th style={{ background:BG2, padding:"6px 12px", fontSize:9, color:ACCENT, border:`1px solid ${BORDER}`, textAlign:"left", minWidth:110, letterSpacing:2 }}>DEVISE</th>
                {INDS.map(ind=>(
                  <th key={ind.id} colSpan={3} style={{ background:BG2, padding:"6px 8px", fontSize:9, color:ind.tier===1?"#ff9966":ind.tier===2?"#66aaff":TEXT_DIM, border:`1px solid ${BORDER}`, textAlign:"center", letterSpacing:1 }}>
                    {ind.label}<span style={{ display:"block", fontSize:7, color:TEXT_DIM }}>T{ind.tier}</span>
                  </th>
                ))}
                <th style={{ background:BG2, padding:"6px 10px", fontSize:9, color:ACCENT, border:`1px solid ${BORDER}`, textAlign:"center", minWidth:70 }}>SCORE</th>
                <th style={{ background:BG2, padding:"6px 10px", fontSize:9, color:ACCENT, border:`1px solid ${BORDER}`, textAlign:"center", minWidth:90 }}>RÉGIME</th>
              </tr>
              <tr>
                <th style={{ background:BG3, border:`1px solid ${BORDER}` }} />
                {INDS.map(ind=>["Prior","Exp","Now"].map(f=>(
                  <th key={ind.id+f} style={{ background:BG3, padding:"2px 4px", fontSize:7, color:TEXT_DIM, border:`1px solid ${BORDER}`, textAlign:"center" }}>{f}</th>
                )))}
                <th style={{ background:BG3, border:`1px solid ${BORDER}` }} />
                <th style={{ background:BG3, border:`1px solid ${BORDER}` }} />
              </tr>
            </thead>
            <tbody>
              {ranked.map((c,ri)=>{
                const st=getStrength(c.score, getRegime(data,c.code)), reg=getRegime(data,c.code);
                return (
                  <tr key={c.code} style={{ background:ri%2===0?"#07070e":"transparent" }}>
                    <td style={{ padding:"5px 12px", border:`1px solid ${BORDER}`, fontWeight:600, whiteSpace:"nowrap", borderLeft:`3px solid ${reg?reg.color+"88":BORDER}` }}>
                      <FlagImg code={c.code} size={18} />
                      <span style={{ fontSize:12, letterSpacing:2, color:TEXT }}>{c.code}</span>
                      <span style={{ fontSize:8, color:TEXT_DIM, marginLeft:4 }}>#{ri+1}</span>
                    </td>
                    {INDS.map(ind=>["prior","exp","now"].map(field=>(
                      <td key={ind.id+field} style={{ padding:"4px 4px", border:`1px solid ${BORDER}`, textAlign:"center" }}>
                        <Inp code={c.code} id={ind.id} field={field} data={data} setCell={setCell} />
                      </td>
                    )))}
                    <td style={{ padding:"5px 8px", border:`1px solid ${BORDER}`, textAlign:"center" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:st.color, fontFamily:"'IBM Plex Mono'" }}>{c.score>=0?"+":""}{c.score.toFixed(3)}</div>
                      <ScoreBar score={c.score} color={st.color} />
                    </td>
                    <td style={{ padding:"5px 8px", border:`1px solid ${BORDER}`, textAlign:"center" }}>
                      {reg?(
                        <div style={{ background:reg.bg, border:`1px solid ${reg.border}44`, borderRadius:2, padding:"3px 6px", fontSize:9, fontWeight:700, color:reg.color, letterSpacing:1 }}>
                          {reg.icon} {reg.label}
                        </div>
                      ):<span style={{ fontSize:9, color:TEXT_DIM }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view==="rank" && (
        <div style={{ padding:16 }}>
          <div style={{ fontSize:9, color:TEXT_DIM, letterSpacing:2, marginBottom:12 }}>CLASSEMENT MACRO — FORT → FAIBLE</div>
          {ranked.map((c,i)=>{
            const st=getStrength(c.score, getRegime(data,c.code)), reg=getRegime(data,c.code);
            const infS=calcInflationScore(data,c.code), growS=calcGrowthScore(data,c.code);
            return (
              <div key={c.code} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6, padding:"10px 14px", background:BG2, borderRadius:4, border:`1px solid ${reg?reg.border+"33":BORDER}`, borderLeft:`3px solid ${st.color}` }}>
                <span style={{ fontSize:14, fontWeight:700, color:TEXT_DIM, minWidth:24 }}>#{i+1}</span>
                <FlagImg code={c.code} size={20} />
                <div style={{ minWidth:90 }}>
                  <div style={{ fontWeight:700, color:TEXT, letterSpacing:2, fontSize:12 }}>{c.code}</div>
                  {reg&&<div style={{ fontSize:8, color:reg.color }}>{reg.icon} {reg.label}</div>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ height:6, background:"#0a0a14", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:Math.min(Math.abs(c.score)*100,100)+"%", height:"100%", background:st.color, borderRadius:3 }} />
                  </div>
                  <div style={{ display:"flex", gap:12, marginTop:4 }}>
                    {infS!==null&&<span style={{ fontSize:8, color:TEXT_DIM }}>INF: <span style={{ color:infS>0.05?"#00ff88":infS<-0.05?"#ff3b3b":"#888899" }}>{infS>=0?"+":""}{(infS*100).toFixed(0)}%</span></span>}
                    {growS!==null&&<span style={{ fontSize:8, color:TEXT_DIM }}>GROW: <span style={{ color:growS>0.05?"#66ff99":growS<-0.05?"#ff6666":"#888899" }}>{growS>=0?"+":""}{(growS*100).toFixed(0)}%</span></span>}
                  </div>
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:st.color, minWidth:60, textAlign:"right" }}>{c.score>=0?"+":""}{c.score.toFixed(3)}</span>
                <div style={{ background:st.bg, border:`1px solid ${st.color}44`, borderRadius:2, padding:"3px 8px", fontSize:9, fontWeight:700, color:st.color, minWidth:70, textAlign:"center" }}>{st.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {view==="regimes" && (
        <div style={{ padding:12 }}>
          <div style={{ fontSize:8, color:TEXT_DIM, letterSpacing:2, marginBottom:10 }}>CLIQUE POUR VOIR L'ANALYSE COMPLÈTE</div>
          {(()=>{const ORDER={GOLDILOCKS:1,SURCHAUFFE:2,STAGFLATION:3,RECESSION:4};return [...CURR].sort((a,b)=>{const rA=getRegime(data,a.code),rB=getRegime(data,b.code);const oA=rA?ORDER[rA.label]:99,oB=rB?ORDER[rB.label]:99;if(oA!==oB)return oA-oB;return calcScore(data,b.code)-calcScore(data,a.code);}).map(c=><RegimeCard key={c.code} data={data} curr={c} />);})()}
        </div>
      )}

      {view==="tradecot" && (
        <TradeCOT data={data} cotData={apexCot} />
      )}

      {view==="trade" && (
        <TradeApex data={data} cotData={apexCot} retailData={apexRetail} />
      )}

      {view==="data"    && <DataView />}
      {view==="guide"   && <GuideView />}
      {view==="heat" && <HeatmapView data={data} />}
      {view==="sentiment" && <SentimentView />}
      {view==="cal"     && <CalView />}
      {view==="journal" && <JournalView />}
    </div>
  );
}

function HeatmapView({ data }) {
  function getCellColor(ind, cell) {
    const s = getSurprise(ind, cell);
    if (s === null) return { bg: "#0a0a14", color: "#333" };
    const m = getMag(ind, s);
    if (m === 0) return { bg: "#0a0a18", color: "#666" };
    if (m > 0.6) return { bg: "#00ff8833", color: "#00ff88" };
    if (m > 0) return { bg: "#00ff8815", color: "#66ffbb" };
    if (m < -0.6) return { bg: "#ff3b3b33", color: "#ff3b3b" };
    return { bg: "#ff3b3b15", color: "#ff8888" };
  }
  return (
    <div style={{ padding: 16, overflowX: "auto" }}>
      <div style={{ fontSize: 9, color: TEXT_DIM, letterSpacing: 2, marginBottom: 12 }}>HEATMAP MATRICIELLE · 9 DEVISES × 6 INDICATEURS · INTENSITÉ = MAGNITUDE DE SURPRISE</div>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: ACCENT, letterSpacing: 2, minWidth: 110 }}>DEVISE</th>
            {INDS.map(ind => (
              <th key={ind.id} style={{ padding: "10px 8px", fontSize: 9, color: ind.tier === 1 ? "#ff9966" : ind.tier === 2 ? "#66aaff" : TEXT_DIM, letterSpacing: 1, textAlign: "center", minWidth: 100 }}>
                {ind.label}
                <div style={{ fontSize: 7, color: TEXT_DIM, marginTop: 2 }}>T{ind.tier}</div>
              </th>
            ))}
            <th style={{ padding: "10px 14px", fontSize: 10, color: ACCENT, letterSpacing: 2 }}>SCORE</th>
            <th style={{ padding: "10px 14px", fontSize: 10, color: ACCENT, letterSpacing: 2 }}>RÉGIME</th>
          </tr>
        </thead>
        <tbody>
          {CURR.map(c => {
            const score = calcScore(data, c.code);
            const reg = getRegime(data, c.code);
            const st = getStrength(score, reg);
            return (
              <tr key={c.code}>
                <td style={{ padding: "8px 14px", background: BG2, borderLeft: `3px solid ${reg ? reg.color : BORDER}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, fontFamily: "'IBM Plex Mono'" }}><FlagImg code={c.code} size={16} /> {c.code}</div>
                  <div style={{ fontSize: 9, color: TEXT_DIM }}>{c.bc}</div>
                </td>
                {INDS.map(ind => {
                  const cell = data[c.code][ind.id];
                  const s = getSurprise(ind, cell);
                  const cs = getCellColor(ind, cell);
                  const now = toN(cell.now);
                  return (
                    <td key={ind.id} style={{ background: cs.bg, padding: "10px 6px", textAlign: "center", minWidth: 100 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: cs.color, fontFamily: "'IBM Plex Mono'" }}>
                        {s === null ? "—" : (s > 0 ? "+" : "") + s.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 9, color: TEXT_DIM, marginTop: 2 }}>{now !== null ? now + ind.unit : ""}</div>
                    </td>
                  );
                })}
                <td style={{ background: st.bg, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: st.color, fontFamily: "'IBM Plex Mono'" }}>{score >= 0 ? "+" : ""}{score.toFixed(2)}</div>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  {reg ? (
                    <div style={{ background: reg.bg, border: `1px solid ${reg.border}66`, color: reg.color, padding: "4px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 1, borderRadius: 2 }}>
                      {reg.icon} {reg.label}
                    </div>
                  ) : <span style={{ color: TEXT_DIM, fontSize: 10 }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
