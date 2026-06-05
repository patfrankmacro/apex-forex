import SentimentView from "./SentimentView";
import DayTradeOrView from "./DayTradeOr";
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
  // USD majeures
  {name:"EURUSD",base:"EUR",quote:"USD"},{name:"GBPUSD",base:"GBP",quote:"USD"},
  {name:"USDJPY",base:"USD",quote:"JPY"},{name:"USDCHF",base:"USD",quote:"CHF"},
  {name:"USDCAD",base:"USD",quote:"CAD"},{name:"AUDUSD",base:"AUD",quote:"USD"},
  {name:"NZDUSD",base:"NZD",quote:"USD"},
  // EUR croisées
  {name:"EURJPY",base:"EUR",quote:"JPY"},{name:"EURGBP",base:"EUR",quote:"GBP"},
  {name:"EURCAD",base:"EUR",quote:"CAD"},{name:"EURAUD",base:"EUR",quote:"AUD"},
  {name:"EURCHF",base:"EUR",quote:"CHF"},{name:"EURNZD",base:"EUR",quote:"NZD"},
  // GBP croisées
  {name:"GBPJPY",base:"GBP",quote:"JPY"},{name:"GBPCHF",base:"GBP",quote:"CHF"},
  {name:"GBPCAD",base:"GBP",quote:"CAD"},{name:"GBPAUD",base:"GBP",quote:"AUD"},
  {name:"GBPNZD",base:"GBP",quote:"NZD"},
  // JPY croisées
  {name:"CHFJPY",base:"CHF",quote:"JPY"},{name:"CADJPY",base:"CAD",quote:"JPY"},
  {name:"AUDJPY",base:"AUD",quote:"JPY"},{name:"NZDJPY",base:"NZD",quote:"JPY"},
  // CHF croisées
  {name:"CADCHF",base:"CAD",quote:"CHF"},{name:"AUDCHF",base:"AUD",quote:"CHF"},
  {name:"NZDCHF",base:"NZD",quote:"CHF"},
  // CAD/AUD/NZD croisées
  {name:"AUDCAD",base:"AUD",quote:"CAD"},{name:"NZDCAD",base:"NZD",quote:"CAD"},
  {name:"AUDNZD",base:"AUD",quote:"NZD"},
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
  const pct=d.signal==="HAUSSIER_FORT"?85:d.signal==="HAUSSIER"?65:d.signal==="BAISSIER"?35:d.signal==="BAISSIER_FORT"?15:50;
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
    const url="https://publicreporting.cftc.gov/resource/gpe5-46if.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
    const rows=await(await fetch(url)).json();
    if(!rows||!rows.length)return null;
    const row=rows[0];
    const prev=rows[1]||{};
    const chgLong=parseInt(row.change_in_lev_money_long||0);
    const chgShort=parseInt(row.change_in_lev_money_short||0);
    const chgNet=chgLong-chgShort;
    const prevChgLong=parseInt(prev.change_in_lev_money_long||0);
    const prevChgShort=parseInt(prev.change_in_lev_money_short||0);
    const prevChgNet=prevChgLong-prevChgShort;
    const levLong=parseInt(row.lev_money_positions_long||0);
    const levShort=parseInt(row.lev_money_positions_short||0);
    const date=row.report_date_as_yyyy_mm_dd?.slice(0,10)||"";
    let signal="NEUTRE";
    if(chgLong>0&&chgShort<0)signal="HAUSSIER_FORT";
    else if(chgLong<0&&chgShort>0)signal="BAISSIER_FORT";
    else if(chgNet>500)signal="HAUSSIER";
    else if(chgNet<-500)signal="BAISSIER";
    let switchType=null;
    const diff=chgNet-prevChgNet;
    if(diff>2000&&prevChgNet<=500&&chgNet>500)switchType="SWITCH_HAUSSIER";
    else if(diff<-2000&&prevChgNet>=-500&&chgNet<-500)switchType="SWITCH_BAISSIER";
    return{chgLong,chgShort,chgNet,prevChgNet,switchType,levLong,levShort,net:levLong-levShort,signal,date,max52:1,min52:-1};
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
  USD: { mfg:"united-states/business-confidence", svc:"united-states/non-manufacturing-pmi", unemp:"united-states/unemployment-rate", rate:"united-states/interest-rate", cpi:"united-states/inflation-cpi", core:"united-states/core-inflation-rate" },
  EUR: { mfg:"euro-area/manufacturing-pmi", svc:"euro-area/services-pmi", unemp:"euro-area/unemployment-rate", rate:"euro-area/interest-rate", cpi:"euro-area/inflation-cpi", core:"euro-area/core-inflation-rate" },
  CAD: { mfg:"canada/manufacturing-pmi", svc:"canada/services-pmi", unemp:"canada/unemployment-rate", rate:"canada/interest-rate", cpi:"canada/inflation-cpi", core:"canada/core-inflation-rate" },
  CHF: { mfg:"switzerland/manufacturing-pmi", svc:"switzerland/services-pmi", unemp:"switzerland/unemployment-rate", rate:"switzerland/interest-rate", cpi:"switzerland/inflation-cpi", core:"switzerland/core-inflation-rate" },
  AUD: { mfg:"australia/manufacturing-pmi", svc:"australia/services-pmi", unemp:"australia/unemployment-rate", rate:"australia/interest-rate", cpi:"australia/inflation-cpi", core:"australia/core-inflation-rate" },
  JPY: { mfg:"japan/manufacturing-pmi", svc:"japan/services-pmi", unemp:"japan/unemployment-rate", rate:"japan/interest-rate", cpi:"japan/inflation-cpi", core:"japan/core-inflation-rate" },
  GBP: { mfg:"united-kingdom/manufacturing-pmi", svc:"united-kingdom/services-pmi", unemp:"united-kingdom/unemployment-rate", rate:"united-kingdom/interest-rate", cpi:"united-kingdom/inflation-cpi", core:"united-kingdom/core-inflation-rate" },
  NZD: { mfg:"new-zealand/manufacturing-pmi", svc:"new-zealand/services-pmi", unemp:"new-zealand/unemployment-rate", rate:"new-zealand/interest-rate", cpi:"new-zealand/inflation-cpi", core:"new-zealand/core-inflation-rate" },
  CNY: { mfg:"china/business-confidence", svc:"china/non-manufacturing-pmi", unemp:"china/unemployment-rate", rate:"china/interest-rate", cpi:"china/inflation-cpi", core:"china/core-inflation-rate" },
};

const REGIMES = {
  GOLDILOCKS:  { label: "GOLDILOCKS",  icon: "◆", color: "#00ff88", bg: "#001a0d", border: "#00ff88",
    bcBias: "NEUTRE — zone de confort idéale",
    tauxDir: "Taux stables — BC surveille sans agir",
    deviseDir: "HAUSSE stable — croissance sans pression inflationniste",
    action: "Marché anticipe : BC en zone de confort → ACHÈTE — croissance forte + inflation sous contrôle = setup institutionnel idéal · Capitaux affluent vers cette économie saine",
    short: "PMI now > exp + Inflation stable/baisse" },
  SURCHAUFFE:  { label: "SURCHAUFFE",  icon: "▲", color: "#ffd700", bg: "#1a1500", border: "#ffd700",
    bcBias: "HAWKISH — hausse des taux imminente ou en cours",
    tauxDir: "Hausse des taux — différentiel attire les capitaux",
    deviseDir: "HAUSSE forte — capitaux attirés par les taux élevés",
    action: "Marché anticipe : BC va monter les taux → ACHÈTE — inflation en hausse + croissance forte = BC forcée d'agir · Traders positionnent AVANT la décision",
    short: "PMI now > exp + Inflation now > exp" },
  STAGFLATION: { label: "STAGFLATION", icon: "■", color: "#ff6600", bg: "#1a0800", border: "#ff6600",
    bcBias: "COINCÉE — monter tue l'économie, baisser alimente l'inflation",
    tauxDir: "Taux bloqués — BC sans marge de manœuvre",
    deviseDir: "BAISSE — pire scénario macro, devise sous pression",
    action: "Marché anticipe : BC piégée, ne peut pas agir → ÉVITE ou VENDS — inflation en hausse MAIS croissance en contraction · Pire configuration pour une devise",
    short: "PMI now < exp + Inflation now > exp" },
  RECESSION:   { label: "RECESSION",   icon: "▼", color: "#cc2200", bg: "#1a0000", border: "#cc2200",
    bcBias: "DOVISH — baisses de taux imminentes",
    tauxDir: "Baisse des taux — différentiel pousse les capitaux ailleurs",
    deviseDir: "BAISSE — capitaux fuient vers économies plus fortes",
    action: "Marché anticipe : BC va baisser les taux → VENDS — inflation en baisse + croissance en contraction = BC forcée de stimuler · Capitaux fuient cette économie",
    short: "PMI now < exp + Inflation stable/baisse" },
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

  const bc      = (CURR.find(cu=>cu.code===code)?.bc) || "BC";
  const rateNow = toN(data[code]["rate"].now);

  const coreNow  = toN(data[code]["core"].now);
  const coreExp  = toN(data[code]["core"].exp);
  const cpiNow   = toN(data[code]["cpi"].now);
  const cpiExp   = toN(data[code]["cpi"].exp);
  const svcNow   = toN(data[code]["svc"].now);
  const svcExp   = toN(data[code]["svc"].exp);
  const svcPrior = toN(data[code]["svc"].prior);
  const unempNow = toN(data[code]["unemp"].now);
  const unempExp = toN(data[code]["unemp"].exp);

  // ── TEXTES INFLATION ─────────────────────────────────────
  const coreHausse = coreNow !== null && coreExp !== null && coreNow > coreExp + 0.05;
  const coreBaisse = coreNow !== null && coreExp !== null && coreNow < coreExp - 0.05;
  const cpiHausse  = cpiNow  !== null && cpiExp  !== null && cpiNow  > cpiExp  + 0.05;
  const cpiBaisse  = cpiNow  !== null && cpiExp  !== null && cpiNow  < cpiExp  - 0.05;

  const infDir = coreHausse ? "EN HAUSSE" : coreBaisse ? "EN BAISSE" : "STABLE";
  const infTxt = coreNow !== null && coreExp !== null
    ? `Core Inflation ${coreNow}% vs exp ${coreExp}% → ${infDir}`
    : "";
  const infImpact = coreHausse
    ? `→ marché anticipe que la ${bc} va MONTER les taux`
    : coreBaisse
    ? `→ marché anticipe que la ${bc} va BAISSER les taux`
    : `→ pas de pression sur la ${bc}`;

  // ── TEXTES PMI ───────────────────────────────────────────
  // Logique Nino: BAT ou MANQUE les attentes (now vs exp)
  const svcBeatT = svcNow !== null && svcExp !== null && svcNow > svcExp + 0.1;
  const svcMissT = svcNow !== null && svcExp !== null && svcNow < svcExp - 0.1;
  const svcSignalT = svcBeatT ? "BAT les attentes → croissance positive" : svcMissT ? "MANQUE les attentes → croissance négative" : "dans les attentes";
  const svcZone50 = svcNow !== null ? (svcNow >= 50 ? "expansion >50" : "contraction <50") : "";
  const svcTxt = (svcNow !== null && svcExp !== null)
    ? `PMI Services ${svcNow} vs exp ${svcExp} → ${svcSignalT} (${svcZone50})`
    : svcNow !== null ? `PMI Services ${svcNow}` : "";

  // ── TEXTES CHÔMAGE ───────────────────────────────────────
  const unempBaisse = unempNow !== null && unempExp !== null && unempNow < unempExp - 0.05;
  const unempHausse = unempNow !== null && unempExp !== null && unempNow > unempExp + 0.05;
  const unempTxt = unempNow !== null && unempExp !== null && Math.abs(unempNow - unempExp) > 0.05
    ? `Chômage ${unempNow}% vs exp ${unempExp}% → ${unempBaisse
        ? "EN BAISSE → plus d'emplois → plus de dépenses → pression inflationniste → signal hawkish"
        : "EN HAUSSE → perte d'emplois → moins de dépenses → inflation sous pression → signal dovish"}`
    : unempNow !== null ? `Chômage ${unempNow}% → stable` : "";

  if (regime.label === "SURCHAUFFE") {
    return `${bc} EN MODE HAWKISH — ${infTxt} ${infImpact}. ${svcTxt}. ${unempTxt}. Taux actuels : ${rateNow}%. → Les traders achètent la devise MAINTENANT en anticipation de la prochaine hausse de taux — les capitaux affluent vers les économies qui offrent un meilleur rendement.`;
  }
  if (regime.label === "GOLDILOCKS") {
    return `${bc} EN ZONE DE CONFORT — ${infTxt} → pas de pression pour agir. ${svcTxt}. ${unempTxt}. Taux : ${rateNow}%. → Croissance solide sans inflation dangereuse = setup institutionnel idéal. Les capitaux se positionnent sur cette devise pour la stabilité et la croissance.`;
  }
  if (regime.label === "STAGFLATION") {
    // Construire texte CPI si différent de Core
    const cpiTxt = cpiNow !== null && cpiExp !== null && Math.abs(cpiNow - cpiExp) > 0.05
      ? ` (CPI ${cpiNow}% vs exp ${cpiExp}% → ${cpiNow > cpiExp ? "EN HAUSSE" : "EN BAISSE"})`
      : "";
    return `${bc} COINCÉE — ${infTxt}${cpiTxt} ${infImpact}, MAIS ${svcTxt}. ${unempTxt}. Taux : ${rateNow}%. → Monter les taux tuerait l'économie déjà en contraction. Baisser les taux alimenterait l'inflation. Les institutionnels fuient cette devise — pire scénario macro possible.`;
  }
  if (regime.label === "RECESSION") {
    return `${bc} VA BAISSER LES TAUX — ${infTxt} ${infImpact}. ${svcTxt}. ${unempTxt}. Taux : ${rateNow}%. → L'économie se contracte ET l'inflation cède → la ${bc} a toute la latitude pour stimuler. Les traders vendent cette devise MAINTENANT en anticipation des baisses de taux.`;
  }
  return "";
}

function getPMIWarning(data, code) {
  const svcNow   = toN(data[code]["svc"].now);
  const svcPrior = toN(data[code]["svc"].prior);
  const svcExp   = toN(data[code]["svc"].exp);
  if (svcNow === null) return null;
  const warnings = [];
  // PRIORITÉ: signal beat/miss vs exp (logique Nino)
  if (svcExp !== null) {
    if (svcNow > svcExp + 0.1 && svcNow < 50) {
      warnings.push(`📈 PMI ${svcNow} BAT les attentes (exp ${svcExp}) — positif même sous 50, croissance meilleure que prévu`);
    }
    if (svcNow < svcExp - 0.1 && svcNow >= 50) {
      warnings.push(`⚠ PMI ${svcNow} MANQUE les attentes (exp ${svcExp}) — négatif même au-dessus de 50, demande plus faible que prévu`);
    }
  }
  // Trajectoire vs prior (contexte secondaire)
  if (svcNow >= 50 && svcNow < 52 && svcPrior !== null && svcPrior > svcNow) {
    const drop = (svcPrior - svcNow).toFixed(1);
    warnings.push(`⚠ PMI en décélération (${svcPrior} → ${svcNow}, −${drop}pts) — surveiller la tendance`);
  }
  if (svcNow >= 52 && svcPrior !== null && svcPrior - svcNow >= 2) {
    warnings.push(`⚠ PMI en fort ralentissement (${svcPrior} → ${svcNow}) — surveiller la tendance`);
  }
  return warnings.length > 0 ? warnings : null;
}

function interpretIndicator(id, now, code, exp=null) {
  if (now === null || now === undefined) return "";
  const target = BC_TARGETS[code] || 2.0;
  if (id === "cpi" || id === "core") {
    if (exp === null) return `→ ${now}% (target ${target}%)`;
    const diff = now - exp;
    const arr = diff > 0.05 ? " ↑" : diff < -0.05 ? " ↓" : " →";
    if (diff > 0.05)  return `→ EN HAUSSE (exp ${exp}, now ${now}${arr}) — pression hawkish sur la BC`;
    if (diff < -0.05) return `→ EN BAISSE (exp ${exp}, now ${now}${arr}) — pression dovish sur la BC`;
    return `→ STABLE (exp ${exp}, now ${now}${arr}) — pas de signal`;
  }
  if (id === "svc" || id === "mfg") {
    if (exp === null) return `→ ${now >= 50 ? "expansion" : "contraction"} (${now})`;
    const diff = now - exp;
    const arr = diff > 0.1 ? " ↑" : diff < -0.1 ? " ↓" : " →";
    // Logique Nino: BAT ou MANQUE les attentes (now vs exp), pas seuil 50
    const beat = diff > 0.1;
    const miss = diff < -0.1;
    const signal = beat ? "BAT attentes ✅" : miss ? "MANQUE attentes ⚠" : "dans attentes →";
    const zone50 = now >= 50 ? "(>50 expansion)" : "(<50 contraction)";
    return `→ ${signal} ${zone50} (exp ${exp}, now ${now}${arr})`;
  }
  if (id === "unemp") {
    if (exp === null) return `→ ${now}%`;
    const diff = now - exp;
    if (diff > 0.05)  return `→ EN HAUSSE ⚠ (exp ${exp}, now ${now} ↑) — moins d'emplois → moins de dépenses → dovish`;
    if (diff < -0.05) return `→ EN BAISSE ✓ (exp ${exp}, now ${now} ↓) — plus d'emplois → plus de dépenses → hawkish`;
    return `→ STABLE (exp ${exp}, now ${now})`;
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

  // ══════════════════════════════════════════════════════════
  // LOGIQUE D'ANTICIPATION INSTITUTIONNELLE — 3 PILIERS
  // On anticipe ce que la BC va faire ENSUITE
  // Chaque donnée comparée à son expectation (EXP)
  // ══════════════════════════════════════════════════════════

  // ── 1. INFLATION vs EXPECTATION ──────────────────────────
  // Core = signal structurel principal (BC regarde en priorité)
  // CPI = confirmation si Core neutre
  const coreNow  = toN(data[code]["core"].now);
  const coreExp  = toN(data[code]["core"].exp);
  const cpiNow   = toN(data[code]["cpi"].now);
  const cpiExp   = toN(data[code]["cpi"].exp);

  const coreHausse = coreNow !== null && coreExp !== null && coreNow > coreExp + 0.05;
  const coreBaisse = coreNow !== null && coreExp !== null && coreNow < coreExp - 0.05;
  const coreStable = !coreHausse && !coreBaisse;
  const cpiHausse  = cpiNow !== null && cpiExp !== null && cpiNow > cpiExp + 0.05;
  const cpiBaisse  = cpiNow !== null && cpiExp !== null && cpiNow < cpiExp - 0.05;

  // Core prime sur CPI
  // CPI seul sans Core = signal plus faible
  // Hausse CPI doit être significative (> 0.15%) pour déclencher infHausse sans Core
  const cpiHausseSig = cpiNow !== null && cpiExp !== null && cpiNow > cpiExp + 0.15;
  const infHausse = coreHausse || (coreStable && cpiHausseSig);
  const infBaisse = coreBaisse || (coreStable && cpiBaisse);

  // ── 2. PMI SERVICES — NOW vs EXP (surprise vs attente) ───
  // Services = 70-80% de l économie → PRIME sur manufacturing
  // Ce qui compte : est-ce que ça bat les attentes ou déçoit ?
  // NZD PMI 48.9 > exp 45 = POSITIF même si sous 50
  // USD PMI 50.9 < exp 51.1 = NÉGATIF même si au-dessus de 50
  const svcNow   = toN(data[code]["svc"].now);
  const svcExp   = toN(data[code]["svc"].exp);
  const svcPrior = toN(data[code]["svc"].prior);

  // Surprise vs expectation = signal principal
  // EN HAUSSE = emplois - → dépenses - → inflation - → BC dovish → devise FAIBLE
  const unempNow = toN(data[code]["unemp"].now);
  const unempExp = toN(data[code]["unemp"].exp);

  const unempHawkish = unempNow !== null && unempExp !== null && unempNow < unempExp - 0.05;
  const unempDovish  = unempNow !== null && unempExp !== null && unempNow > unempExp + 0.05;

  const svcBeat = svcNow !== null && svcExp !== null && svcNow > svcExp + 0.1;
  const svcMiss = svcNow !== null && svcExp !== null && svcNow < svcExp - 0.1;
  // Seuil 50 = info contextuelle (expansion/contraction)
  const svcAbove50 = svcNow !== null && svcNow > 50;
  // Positif = beat les attentes (peu importe si > ou < 50)
  // Négatif = miss les attentes
  // Neutre = dans les attentes → trajectoire décide
  // Beat attentes = positif SAUF si PMI sous 50 + chômage dovish (contraction réelle)
  const svcPositif = svcBeat && (svcAbove50 || !unempDovish) || (!svcMiss && svcAbove50 && svcNow >= svcPrior);
  const svcNegatif = svcMiss || (!svcBeat && !svcAbove50);
  const svcRalentit = svcNow !== null && svcPrior !== null && svcNow < svcPrior;

  // ── 3. CHÔMAGE vs EXPECTATION — CO-PILOTE BC ─────────────
  // EN BAISSE = emplois + → dépenses + → inflation + → BC hawkish → devise FORTE
  // ── 4. CROISSANCE = PMI Services + Chômage co-pilote ─────
  let growthPos = false;
  let growthNeg = false;

  if (svcNegatif) {
    // PMI miss attentes = croissance décevante
    // Chômage aggrave ou améliore
    growthNeg = true;
    // Exception: si chômage hawkish ET PMI miss faible → neutre
    if (unempHawkish && !svcMiss) growthNeg = false;
  } else if (svcPositif) {
    // PMI beat attentes = croissance forte
    // Chômage confirme ou infirme
    if (unempDovish && svcRalentit) {
      // Chômage monte ET PMI ralentit = retournement précoce
      growthNeg = true;
    } else {
      growthPos = true;
    }
  } else {
    // PMI neutre → chômage décide
    if (unempHawkish) growthPos = true;
    else if (unempDovish) growthNeg = true;
    else { growthNeg = svcRalentit; growthPos = !growthNeg; }
  }

  // ── 5. MATRICE 4 RÉGIMES — ANTICIPATION BC ───────────────
  if (infHausse && growthPos)  return REGIMES.SURCHAUFFE;
  if (!infHausse && growthPos) return REGIMES.GOLDILOCKS;
  if (infHausse && growthNeg)  return REGIMES.STAGFLATION;
  if (!infHausse && growthNeg) return REGIMES.RECESSION;

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
                <div style={{ fontSize:8, color:"#475569", letterSpacing:1 }}>LEVERAGED FUNDS — {strong.code} vs {weak.code}</div>
                <div style={{ fontSize:9, fontWeight:700, color:pCot.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                  Instits: {pCot.bias} {pCot.strength==="EXTREME"?"⚠":""}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:6 }}>
                {[{curr:strong,cot:strongCOT},{curr:weak,cot:weakCOT}].map(({curr,cot})=>(
                  <div key={curr.code}>
                    <div style={{ fontSize:8, color:"#475569", marginBottom:3 }}>
                      <FlagImg code={curr.code} size={18} /> {curr.code} — {cot?.bias} {cot?.strength}
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
                    <div style={{ fontSize:7, color:"#475569", marginTop:1 }}>Chg: {cot?.chgNet>=0?"+":""}{cot?.chgNet?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:8, color:"#64748b" }}>
                {strongCOT?.bias} {strongCOT?.strength} vs {weakCOT?.bias} {weakCOT?.strength} · spread {pCot.spread>0?"+":""}{pCot.spread}pts
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
        {[["Previous","#ffd700","Le chiffre du mois dernier → colonne PREVIOUS"],["Consensus",ACCENT,"Ce que les économistes prévoient → colonne CONSENSUS"],["Actual","#00ff88","Le chiffre publié → colonne ACTUAL"]].map(([k,col,v])=>(
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
    { title:"CORE INFLATION", sub:"Core Inflation Rate — Trading Economics",
      desc:"Le plus important — indicateur pur de l'inflation structurelle. La BC regarde ça en premier pour décider des taux.",
      good:"EN HAUSSE vs Consensus → BC va monter les taux → capitaux entrent → devise monte",
      bad:"EN BAISSE vs Consensus → BC va baisser les taux → capitaux sortent → devise baisse",
      pct:"Tier 1 · 27.5%", color:"#ff6666" },
    { title:"INFLATION (CPI)", sub:"Inflation Rate — Trading Economics",
      desc:"Confirme le Core. Si les 2 sont en hausse vs Consensus = signal hawkish très puissant. Si les 2 baissent = signal dovish fort.",
      good:"EN HAUSSE vs Consensus + Core EN HAUSSE → double confirmation hawkish",
      bad:"EN BAISSE vs Consensus + Core EN BAISSE → double confirmation dovish",
      pct:"Tier 1 · 22.5%", color:"#ff9966" },
    { title:"UNEMPLOYMENT RATE", sub:"Unemployment Rate — Trading Economics",
      desc:"LOGIQUE INVERSE — chômage EN BAISSE = bon pour l'économie. Plus d'emplois → plus de revenus → plus de dépenses → inflation monte → BC hawkish. Chômage EN HAUSSE = perte d'emplois → moins de dépenses → inflation baisse → BC dovish.",
      good:"EN BAISSE vs Consensus → plus d'emplois → plus de dépenses → inflation monte → hawkish",
      bad:"EN HAUSSE vs Consensus → perte d'emplois → moins de dépenses → inflation baisse → dovish",
      pct:"Tier 2 · 20%", color:"#66aaff" },
    { title:"SERVICES PMI", sub:"Services PMI — Trading Economics",
      desc:"70% de l'économie. CE QUI COMPTE : ACTUAL vs CONSENSUS (la surprise vs attente). NZD PMI 48.9 > Consensus 45 = POSITIF même sous 50. USD PMI 50.9 < Consensus 51.1 = NÉGATIF même au-dessus de 50. Seuil 50 = contexte additionnel, pas règle absolue.",
      good:"ACTUAL > CONSENSUS → croissance meilleure que prévu → signal positif (même si PMI < 50)",
      bad:"SOUS 50 OU EN BAISSE vers 50 → contraction ou ralentissement → croissance faible",
      pct:"Tier 2 · 17.5%", color:"#66ccff" },
    { title:"MANUFACTURING PMI", sub:"Manufacturing PMI — Trading Economics",
      desc:"Indicateur avancé de l'activité industrielle. Signal précoce d'un retournement économique.",
      good:"AU-DESSUS 50 ET EN HAUSSE → production qui accélère → signal d'expansion",
      bad:"SOUS 50 OU EN BAISSE → ralentissement industriel → signal négatif",
      pct:"Tier 3 · 7.5%", color:"#aaaacc" },
    { title:"FUNDS RATE", sub:"Interest Rate — Trading Economics",
      desc:"Le taux directeur de la BC. Compare ACTUAL vs PREVIOUS. Le différentiel de taux entre 2 pays détermine où les capitaux vont.",
      good:"EN HAUSSE vs Previous → différentiel augmente → capitaux entrent → devise monte",
      bad:"EN BAISSE vs Previous → différentiel diminue → capitaux sortent → devise baisse",
      pct:"Tier 3 · 5%", color:"#888899" },
  ];
  return (
    <div style={{ padding:16, fontFamily:"'IBM Plex Mono',monospace" }}>

      {/* SECTION ÉDUCATIVE — LEVERAGED FUNDS */}
      <div style={{ background:BG2, border:"1px solid #1e3a5f", borderRadius:8, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:12, color:"#f59e0b", fontWeight:700, letterSpacing:1, marginBottom:10 }}>💼 LEVERAGED FUNDS — QUI SONT-ILS ?</div>
        <div style={{ fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:12 }}>
          Hedge funds, CTAs, fonds spéculatifs à effet de levier. Ils tradent avec un horizon <b>swing/court terme</b> — le même que nous. Contrairement aux banques centrales (hedgers) ou aux Asset Managers (long terme), leurs mouvements reflètent la <b>spéculation pure</b> sur les données macro de la semaine.
        </div>
        <div style={{ fontSize:11, color:"#4ade80", fontWeight:700, marginBottom:6 }}>🎯 POURQUOI LES SUIVRE ?</div>
        <div style={{ fontSize:10, color:TEXT_DIM, lineHeight:1.7, marginBottom:12 }}>
          • <b>Même horizon</b> que swing trader (1-4 semaines)<br/>
          • Ajustent positions <b>chaque semaine</b> selon CPI, PMI, taux directeurs<br/>
          • <b>Action concrète</b> (pas paroles) — ils risquent leur argent réel<br/>
          • Signal <b>frais hebdomadaire</b> — rapport CFTC publié chaque vendredi
        </div>
        <div style={{ fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:6 }}>📊 COMMENT ILS TRADENT ?</div>
        <div style={{ fontSize:10, color:TEXT_DIM, lineHeight:1.7, marginBottom:12 }}>
          • Analysent CPI, Core Inflation, PMI Services, Unemployment<br/>
          • Anticipent décisions banques centrales (hausse/baisse taux)<br/>
          • Ajustent positions Long/Short chaque mardi (snapshot CFTC)<br/>
          • Bougent les prix par leurs flux massifs sur futures
        </div>
        <div style={{ fontSize:11, color:"#a78bfa", fontWeight:700, marginBottom:6 }}>⚡ NOTRE STRATÉGIE</div>
        <div style={{ fontSize:10, color:TEXT_DIM, lineHeight:1.7 }}>
          <b>1.</b> On lit le changement hebdomadaire (chgLong / chgShort) — pas le total<br/>
          <b>2.</b> On compare la <b>force relative</b> entre 2 devises (Nino)<br/>
          <b>3.</b> Si une devise a un <span style={{ background:"#14532d", color:"#4ade80", padding:"1px 6px", borderRadius:3, fontSize:9 }}>🔥 SWITCH</span> = les Leveraged Funds ont <b>renversé leur direction</b> cette semaine (ex: étaient short, deviennent long fort). C'est le signal le plus puissant selon Nino — un retournement institutionnel majeur<br/>
          <b>4.</b> Retail contrarian 70%+ aligné = validation finale
        </div>
      </div>

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
      {/* LOGIQUE D'ANTICIPATION */}
      <div style={{ background:BG2, border:"1px solid #a855f733", borderRadius:4, padding:14, marginBottom:10 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"#a855f7", fontWeight:700, marginBottom:14, borderBottom:"1px solid #a855f722", paddingBottom:8 }}>
          🧠 LOGIQUE D'ANTICIPATION INSTITUTIONNELLE
        </div>
        <div style={{ marginBottom:12, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #a855f7" }}>
          <div style={{ fontSize:10, color:"#a855f7", fontWeight:700, marginBottom:8 }}>PRINCIPE FONDAMENTAL</div>
          <div style={{ fontSize:9, color:TEXT, lineHeight:1.8 }}>
            On ne trade pas ce qui s'est passé.<br/>
            <span style={{color:"#a855f7",fontWeight:700}}>On anticipe ce que la banque centrale va faire ENSUITE.</span><br/><br/>
            Chaque donnée économique est comparée à son <span style={{color:"#ffd700"}}>expectation (EXP)</span>.<br/>
            La surprise vs Consensus = signal d'anticipation pour les institutionnels.
          </div>
        </div>

        {/* INFLATION */}
        <div style={{ marginBottom:10, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #ff6666" }}>
          <div style={{ fontSize:10, color:"#ff6666", fontWeight:700, marginBottom:8 }}>📊 INFLATION vs EXPECTATION</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div style={{ padding:8, background:"#001a0d", borderRadius:3, border:"1px solid #00ff8833" }}>
              <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:4 }}>EN HAUSSE (Actual {">"} Consensus)</div>
              <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.7 }}>
                → BC va MONTER les taux<br/>
                → Capitaux entrent<br/>
                → <span style={{color:"#00ff88"}}>Devise MONTE</span>
              </div>
            </div>
            <div style={{ padding:8, background:"#1a0000", borderRadius:3, border:"1px solid #ff666633" }}>
              <div style={{ fontSize:9, color:"#ff6666", fontWeight:700, marginBottom:4 }}>EN BAISSE (Actual {"<"} Consensus)</div>
              <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.7 }}>
                → BC va BAISSER les taux<br/>
                → Capitaux sortent<br/>
                → <span style={{color:"#ff6666"}}>Devise BAISSE</span>
              </div>
            </div>
          </div>
        </div>

        {/* PMI SERVICES */}
        <div style={{ marginBottom:10, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #66ccff" }}>
          <div style={{ fontSize:10, color:"#66ccff", fontWeight:700, marginBottom:8 }}>📈 PMI SERVICES — 2 DIMENSIONS</div>
          <div style={{ marginBottom:8, padding:8, background:"#001020", borderRadius:3, border:"1px solid #66ccff33" }}>
            <div style={{ fontSize:9, color:"#66ccff", fontWeight:700, marginBottom:4 }}>DIMENSION 1 — ACTUAL vs CONSENSUS (priorité)</div>
            <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.7 }}>
              <span style={{color:"#00ff88"}}>ACTUAL {">"} CONSENSUS = BAT</span> — croissance meilleure que prévu → positif (même sous 50)<br/>
              <span style={{color:"#ff6666"}}>ACTUAL {"<"} CONSENSUS = MANQUE</span> — croissance décevante → négatif (même au-dessus de 50)<br/>
              <span style={{color:"#ffd700",fontWeight:700}}>Ex: NZD 48.9 {">"} Consensus 45 = positif · USD 50.9 {"<"} Consensus 51.1 = négatif</span>
            </div>
          </div>
          <div style={{ padding:8, background:"#001020", borderRadius:3, border:"1px solid #66ccff33" }}>
            <div style={{ fontSize:9, color:"#66ccff", fontWeight:700, marginBottom:4 }}>DIMENSION 2 — SEUIL 50 (contexte)</div>
            <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.7 }}>
              PMI 50 → 55 = <span style={{color:"#00ff88"}}>accélération forte → très positif</span><br/>
              PMI 55 → 51 = <span style={{color:"#ffd700"}}>ralentissement → surveiller</span><br/>
              PMI 48 → 49 = <span style={{color:"#ffd700"}}>contraction qui s'améliore → signal précoce</span><br/>
              PMI 50 → 46 = <span style={{color:"#ff6666"}}>détérioration rapide → très négatif</span>
            </div>
          </div>
        </div>

        {/* CHÔMAGE */}
        <div style={{ marginBottom:10, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #66aaff" }}>
          <div style={{ fontSize:10, color:"#66aaff", fontWeight:700, marginBottom:8 }}>👥 CHÔMAGE — LOGIQUE ÉCONOMIQUE COMPLÈTE</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div style={{ padding:8, background:"#001a0d", borderRadius:3, border:"1px solid #00ff8833" }}>
              <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:4 }}>EN BAISSE (Actual {"<"} Consensus) ✓</div>
              <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.7 }}>
                Plus d'emplois<br/>
                → Plus de revenus<br/>
                → Plus de dépenses<br/>
                → Demande monte<br/>
                → Inflation monte<br/>
                → BC anticipe hausse taux<br/>
                → <span style={{color:"#00ff88"}}>Devise FORTE — hawkish</span>
              </div>
            </div>
            <div style={{ padding:8, background:"#1a0000", borderRadius:3, border:"1px solid #ff666633" }}>
              <div style={{ fontSize:9, color:"#ff6666", fontWeight:700, marginBottom:4 }}>EN HAUSSE (Actual {">"} Consensus) ⚠</div>
              <div style={{ fontSize:8, color:TEXT_DIM, lineHeight:1.7 }}>
                Perte d'emplois<br/>
                → Moins de revenus<br/>
                → Moins de dépenses<br/>
                → Demande chute<br/>
                → Inflation baisse<br/>
                → BC va baisser les taux<br/>
                → <span style={{color:"#ff6666"}}>Devise FAIBLE — dovish</span>
              </div>
            </div>
          </div>
        </div>

        {/* LES 4 RÉGIMES */}
        <div style={{ marginBottom:4, padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #a855f7" }}>
          <div style={{ fontSize:10, color:"#a855f7", fontWeight:700, marginBottom:10 }}>🎯 LES 4 RÉGIMES — ANTICIPATION</div>
          {[
            { label:"SURCHAUFFE", icon:"▲", color:"#ffd700", bg:"#1a1500",
              inflation:"↑ PLUS HAUTE que prévu", inflColor:"#ffd700",
              pmi:"↑ MEILLEUR que prévu", pmiColor:"#ffd700",
              chomage:"↓ EN BAISSE", chColor:"#ffd700",
              logic:"Tout accélère en même temps. L'économie chauffe, l'inflation grimpe. La banque centrale DOIT monter les taux.",
              action:"ACHÈTE la devise — les capitaux affluent vers les hauts rendements.",
              devise:"FORTE ↑↑↑" },
            { label:"GOLDILOCKS", icon:"◆", color:"#00ff88", bg:"#001a0d",
              inflation:"→ STABLE ou plus basse", inflColor:"#66ffaa",
              pmi:"↑ MEILLEUR que prévu", pmiColor:"#00ff88",
              chomage:"→ STABLE ou en baisse", chColor:"#66ffaa",
              logic:"Scénario parfait : l'économie croît SANS faire grimper l'inflation. La BC est détendue, aucune pression.",
              action:"Capitaux affluent pour la stabilité. Meilleur environnement long terme.",
              devise:"FORTE STABLE ↑↑" },
            { label:"STAGFLATION", icon:"■", color:"#ff3b3b", bg:"#1a0000",
              inflation:"↑ PLUS HAUTE que prévu", inflColor:"#ff6666",
              pmi:"↓ PIRE que prévu", pmiColor:"#ff3b3b",
              chomage:"↑ EN HAUSSE", chColor:"#ff3b3b",
              logic:"Piège mortel : l'inflation monte MAIS l'économie ralentit. La BC est COINCÉE — monter tue l'économie, baisser nourrit l'inflation. Aucune issue.",
              action:"FUIS la devise — pire scénario possible.",
              devise:"FAIBLE ↓↓" },
            { label:"RECESSION", icon:"▼", color:"#ff7a00", bg:"#1a0800",
              inflation:"→ STABLE ou plus basse", inflColor:"#ffaa66",
              pmi:"↓ PIRE que prévu", pmiColor:"#ff7a00",
              chomage:"↑ EN HAUSSE", chColor:"#ff7a00",
              logic:"L'économie se contracte ET l'inflation cède. La BC a de la marge : elle PEUT baisser les taux pour relancer.",
              action:"VENDS la devise — capitaux fuient les bas rendements.",
              devise:"FAIBLE ↓↓↓" },
          ].map(R=>(
            <div key={R.label} style={{ marginBottom:8, padding:12, background:R.bg, borderRadius:4, border:`1px solid ${R.color}44`, borderLeft:`4px solid ${R.color}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, borderBottom:`1px solid ${R.color}33`, paddingBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:R.color }}>{R.icon} {R.label}</span>
                <span style={{ fontSize:10, fontWeight:700, color:R.color }}>DEVISE {R.devise}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"3px 10px", fontSize:9, marginBottom:8 }}>
                <span style={{ color:TEXT_DIM }}>Inflation :</span>
                <span style={{ color:R.inflColor, fontWeight:700 }}>{R.inflation}</span>
                <span style={{ color:TEXT_DIM }}>PMI :</span>
                <span style={{ color:R.pmiColor, fontWeight:700 }}>{R.pmi}</span>
                <span style={{ color:TEXT_DIM }}>Chômage :</span>
                <span style={{ color:R.chColor, fontWeight:700 }}>{R.chomage}</span>
              </div>
              <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.6, marginBottom:6, paddingTop:6, borderTop:`1px solid ${R.color}22` }}>
                <span style={{ color:"#fbbf24" }}>💡 </span>{R.logic}
              </div>
              <div style={{ fontSize:10, color:R.color, fontWeight:700, lineHeight:1.5 }}>
                🎯 {R.action}
              </div>
            </div>
          ))}
        </div>
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
            ["2️⃣ COT — LEVERAGED FUNDS","Hedge funds + CTAs ajustent leurs positions chaque semaine","Force relative entre 2 devises (logique Nino) — TFF Report CFTC · mis à jour chaque vendredi","#00aaff"],
            ["3️⃣ RETAIL CONTRARIAN","Les traders particuliers ont statistiquement tort aux extrêmes","70%+ retail dans un sens → les institutionnels feront l'inverse","#f97316"],
          ].map(([title,desc,detail,color])=>(
            <div key={title} style={{ marginBottom:8, padding:"8px 10px", background:BG2, borderRadius:3, borderLeft:"2px solid "+color+"66" }}>
              <div style={{ fontSize:10, fontWeight:700, color:color, marginBottom:3 }}>{title}</div>
              <div style={{ fontSize:9, color:TEXT, marginBottom:2 }}>{desc}</div>
              <div style={{ fontSize:8, color:TEXT_DIM, fontStyle:"italic" }}>{detail}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:12, background:BG, borderRadius:3, borderLeft:"3px solid #00ff88" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00ff88", marginBottom:10 }}>🎯 L'ONGLET ANALYSE — 3 ÉTAPES</div>
          <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.8, marginBottom:10 }}>
            L'onglet ANALYSE combine tout en une seule vue, en cascade :
          </div>
          <div style={{ marginBottom:8, padding:"8px 10px", background:BG2, borderRadius:3, borderLeft:"2px solid #a78bfa66" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#a78bfa", marginBottom:3 }}>ÉTAPE 1 — Biais Leveraged Funds</div>
            <div style={{ fontSize:8, color:TEXT_DIM }}>Quelles devises les institutionnels achètent / vendent cette semaine (avec 🔥 SWITCH)</div>
          </div>
          <div style={{ marginBottom:8, padding:"8px 10px", background:BG2, borderRadius:3, borderLeft:"2px solid #4ade8066" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#4ade80", marginBottom:3 }}>ÉTAPE 2 — Biais Macro</div>
            <div style={{ fontSize:8, color:TEXT_DIM }}>Quelles devises sont fortes / faibles selon leur régime économique (score)</div>
          </div>
          <div style={{ marginBottom:10, padding:"8px 10px", background:BG2, borderRadius:3, borderLeft:"2px solid #fbbf2466" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#fbbf24", marginBottom:3 }}>ÉTAPE 3 — Opportunités APEX (3/3)</div>
            <div style={{ fontSize:8, color:TEXT_DIM }}>Seulement les setups où les 3 forces s'alignent : Macro divergente + COT FORT + Retail 70%+ contrarian</div>
          </div>
          <div style={{ padding:"8px 10px", background:"#001a0d", borderRadius:3, border:"1px solid #00ff8844" }}>
            <div style={{ fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:2 }}>Un signal APEX = les 3 forces convergent.</div>
            <div style={{ fontSize:8, color:TEXT_DIM }}>Si 0 signal cette semaine → ne pas forcer un trade, attendre l'alignement.</div>
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
// TRADE MACRO — Divergence de régimes uniquement
// ============================================================
function TradeMacro({ data }) {
  const trades = [];

  SENT_PAIRS.forEach(({ name, base, quote }) => {
    const rBase  = getRegime(data, base);
    const rQuote = getRegime(data, quote);
    if (!rBase || !rQuote) return;
    if (!isValidMacroDivergence(rBase, rQuote)) return;

    const direction = getMacroDirection(rBase, rQuote);
    const macroPts  = getMacroPts(rBase, rQuote);

    const scoreBase  = calcScore(data, base);
    const scoreQuote = calcScore(data, quote);

    // Signal strength basé sur divergence
    const sig = macroPts >= 180
      ? { label:"🔥🔥 DIVERGENCE EXTRÊME", color:"#00ff88", bg:"#001a0d", priority:3 }
      : macroPts >= 160
      ? { label:"🔥 DIVERGENCE FORTE", color:"#22c55e", bg:"#052010", priority:2 }
      : { label:"↑↓ DIVERGENCE MODÉRÉE", color:"#86efac", bg:"#0d1f14", priority:1 };

    trades.push({
      name, base, quote,
      direction, macroPts, rBase, rQuote,
      scoreBase, scoreQuote, sig,
    });
  });

  trades.sort((a, b) => b.sig.priority - a.sig.priority || b.macroPts - a.macroPts);

  return (
    <div style={{padding:12}}>
      <div style={{background:"#050810",border:"1px solid #a855f744",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#a855f7",fontWeight:700}}>📊 TRADE MACRO — DIVERGENCE PURE</div>
          <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Régimes opposés uniquement — 1 confluence sur 3</div>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:"#a855f7"}}>{trades.length}</div>
      </div>

      {/* EXPLICATION */}
      <div style={{background:"#0a0a14",border:"1px solid #a855f733",borderRadius:6,padding:10,marginBottom:12}}>
        <div style={{fontSize:8,color:"#a855f7",fontWeight:700,letterSpacing:2,marginBottom:6}}>LOGIQUE</div>
        <div style={{fontSize:9,color:"#4a5070",lineHeight:1.7}}>
          Ce tab montre toutes les paires avec une <span style={{color:"#a855f7"}}>divergence macro</span> — 2 économies dans des régimes opposés.<br/>
          <span style={{color:"#ffd700"}}>⚠ Signal de direction seulement</span> — utilise TRADE COT+MACRO pour confirmer avec les institutionnels.
        </div>
      </div>

      {trades.length === 0 && (
        <div style={{padding:16,background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e",textAlign:"center"}}>
          <div style={{fontSize:12,color:"#4a5070",marginBottom:8}}>Aucune divergence macro active</div>
          <div style={{fontSize:9,color:"#4a5070"}}>Entrez les données économiques dans le tableau</div>
        </div>
      )}

      {trades.map((t, i) => (
        <div key={i} style={{marginBottom:12,background:"#08080f",borderRadius:8,border:"1px solid "+t.sig.color+"44",padding:10}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",letterSpacing:1}}>
              <FlagImg code={t.base} size={16}/> {t.base} / <FlagImg code={t.quote} size={16}/> {t.quote}
            </div>
            <div style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,
              background:t.direction==="LONG"?"#052010":"#1a0808",
              color:t.direction==="LONG"?"#4ade80":"#f87171",
              border:"1px solid "+(t.direction==="LONG"?"#4ade8055":"#f8717155")}}>
              {t.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
            </div>
          </div>

          {/* MACRO DIVERGENCE */}
          <div style={{background:"#0a0a1a",borderRadius:6,padding:"8px 10px",marginBottom:8,borderLeft:"3px solid #a855f7"}}>
            <div style={{fontSize:8,color:"#a855f7",letterSpacing:2,marginBottom:6,fontWeight:700}}>✅ DIVERGENCE MACRO</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
              <div style={{background:t.rBase.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rBase.border+"55"}}>
                <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}><FlagImg code={t.base} size={14}/> {t.base}</div>
                <div style={{fontSize:11,color:t.rBase.color,fontWeight:700}}>{t.rBase.icon} {t.rBase.label}</div>
                <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Score: {t.scoreBase>=0?"+":""}{t.scoreBase.toFixed(3)}</div>
              </div>
              <div style={{fontSize:9,color:"#4a5070",textAlign:"center"}}>
                vs<br/>
                <span style={{color:"#a855f7",fontWeight:700}}>+{t.macroPts}pts</span>
              </div>
              <div style={{background:t.rQuote.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rQuote.border+"55"}}>
                <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}><FlagImg code={t.quote} size={14}/> {t.quote}</div>
                <div style={{fontSize:11,color:t.rQuote.color,fontWeight:700}}>{t.rQuote.icon} {t.rQuote.label}</div>
                <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Score: {t.scoreQuote>=0?"+":""}{t.scoreQuote.toFixed(3)}</div>
              </div>
            </div>
          </div>

          {/* Conclusion */}
          <div style={{background:t.sig.bg,border:"1px solid "+t.sig.color+"44",borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:12,color:t.sig.color,fontWeight:700,letterSpacing:1,textAlign:"center",marginBottom:4}}>
              {t.direction === "LONG" ? "🚀" : "📉"} {t.direction} {t.base}/{t.quote}
            </div>
            <div style={{fontSize:9,color:t.sig.color,textAlign:"center",marginBottom:6}}>{t.sig.label}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
              <div style={{padding:"4px 6px",background:"#a855f715",borderRadius:3,textAlign:"center",border:"1px solid #a855f733"}}>
                <div style={{fontSize:7,color:"#a855f7",fontWeight:700,marginBottom:2}}>MACRO</div>
                <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}>{t.rBase.icon} vs {t.rQuote.icon}</div>
                <div style={{fontSize:7,color:"#4a5070"}}>+{t.macroPts}pts</div>
              </div>
              <div style={{padding:"4px 6px",background:"#1a1a2e",borderRadius:3,textAlign:"center",border:"1px solid #333"}}>
                <div style={{fontSize:7,color:"#4a5070",fontWeight:700,marginBottom:2}}>COT</div>
                <div style={{fontSize:9,color:"#4a5070"}}>Non vérifié</div>
                <div style={{fontSize:7,color:"#4a5070"}}>—</div>
              </div>
              <div style={{padding:"4px 6px",background:"#1a1a2e",borderRadius:3,textAlign:"center",border:"1px solid #333"}}>
                <div style={{fontSize:7,color:"#4a5070",fontWeight:700,marginBottom:2}}>RETAIL</div>
                <div style={{fontSize:9,color:"#4a5070"}}>Non vérifié</div>
                <div style={{fontSize:7,color:"#4a5070"}}>—</div>
              </div>
            </div>
            <div style={{marginTop:8,padding:"6px 8px",background:"#0a0a14",borderRadius:3,textAlign:"center"}}>
              <div style={{fontSize:8,color:"#ffd700"}}>⚠ Confirme avec TRADE COT+MACRO avant d'entrer</div>
            </div>
          </div>

        </div>
      ))}
    </div>
  );
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

    const bPct = bCotRaw.signal==="HAUSSIER_FORT"?85:bCotRaw.signal==="HAUSSIER"?65:bCotRaw.signal==="BAISSIER"?35:bCotRaw.signal==="BAISSIER_FORT"?15:50;
    const qPct = qCotRaw.signal==="HAUSSIER_FORT"?85:qCotRaw.signal==="HAUSSIER"?65:qCotRaw.signal==="BAISSIER"?35:qCotRaw.signal==="BAISSIER_FORT"?15:50;
    const cotSpread = bPct - qPct;
    const cotAbs = Math.abs(cotSpread);
    let cotBias = cotSpread > 0 ? "HAUSSIER" : "BAISSIER";
    let cotStrength = cotAbs >= 60 ? "EXTREME" : cotAbs >= 40 ? "FORT" : cotAbs >= 20 ? "MODERE" : "NUL";

    // LOGIQUE NINO — les 2 devises doivent être HAUSSIER FORT ou BAISSIER FORT
    // ET |chgNet| >= 3000 (mouvement significatif dans les 2 colonnes comme GBP/NZD)
    const bIsFort = bCotRaw.signal === "HAUSSIER_FORT" || bCotRaw.signal === "BAISSIER_FORT";
    const qIsFort = qCotRaw.signal === "HAUSSIER_FORT" || qCotRaw.signal === "BAISSIER_FORT";
    if (!bIsFort || !qIsFort) return;
    if (Math.abs(bCotRaw.chgNet||0) < 3000 || Math.abs(qCotRaw.chgNet||0) < 3000) return;
    const bChg = bCotRaw.chgNet || 0;
    const qChg = qCotRaw.chgNet || 0;
    const forceDiff = bChg - qChg;
    const cotDirNino = forceDiff > 0 ? "HAUSSIER" : "BAISSIER";
    const cotAligned = (direction === "LONG" && cotDirNino === "HAUSSIER") ||
                       (direction === "SHORT" && cotDirNino === "BAISSIER");
    if (!cotAligned) return;
    cotBias = cotDirNino;
    const absForce = Math.abs(forceDiff);
    cotStrength = absForce >= 8000 ? "EXTREME" : absForce >= 5000 ? "FORT" : "MODERE";

    const sigCot = cotStrength === "EXTREME"
      ? { label:"🔥🔥 COT FORT", color:"#22c55e", bg:"#052010", priority:3 }
      : cotStrength === "FORT"
      ? { label:"🔥 COT CONFIRMÉ", color:"#4ade80", bg:"#0a2e18", priority:2 }
      : { label:"↑↓ COT BIAIS", color:"#86efac", bg:"#0d1f14", priority:1 };

    trades.push({
      name, base, quote,
      direction, macroPts, rBase, rQuote,
      cotBias, cotStrength, bPct, qPct, cotSpread, bCotRaw, qCotRaw,
      sig: sigCot,
    });
  });

  trades.sort((a, b) => b.sig.priority - a.sig.priority || b.macroPts - a.macroPts);

  return (
    <div style={{padding:12}}>
      <div style={{background:"#050810",border:"1px solid #00aaff44",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#00aaff",fontWeight:700}}>📊 TRADE COT — CONFLUENCE 2/3</div>
          <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Régimes opposés + Leveraged Funds force relative alignée — 2 confluences sur 3</div>
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
            <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 2 — COT LEVERAGED FUNDS</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:9,color:"#94a3b8"}}>
                <FlagImg code={t.base} size={12} /> <span style={{color:t.bCotRaw?.signal?.includes("HAUSSIER")?"#4ade80":"#f87171",marginLeft:3}}>
                  {(t.bCotRaw?.signal||"—").replace("_"," ")}
                </span>
                <span style={{color:"#4a5070",marginLeft:4}}>({t.bCotRaw?.chgNet>=0?"+":""}{(t.bCotRaw?.chgNet||0).toLocaleString()})</span>{t.bCotRaw?.switchType && " "}{t.bCotRaw?.switchType && <span style={{marginLeft:4,padding:"1px 4px",borderRadius:3,background:t.bCotRaw.switchType==="SWITCH_HAUSSIER"?"#14532d":"#7f1d1d",color:t.bCotRaw.switchType==="SWITCH_HAUSSIER"?"#4ade80":"#f87171",fontSize:8,fontWeight:700}}>🔥 SWITCH</span>}{t.bCotRaw?.switchType && <span style={{fontSize:7,color:"#64748b",marginLeft:4}}>(sem.préc: {t.bCotRaw.prevChgNet>=0?"+":""}{(t.bCotRaw.prevChgNet||0).toLocaleString()})</span>}
                &nbsp;vs&nbsp;
                <FlagImg code={t.quote} size={12} /> <span style={{color:t.qCotRaw?.signal?.includes("HAUSSIER")?"#4ade80":"#f87171",marginLeft:3}}>
                  {(t.qCotRaw?.signal||"—").replace("_"," ")}
                </span>
                <span style={{color:"#4a5070",marginLeft:4}}>({t.qCotRaw?.chgNet>=0?"+":""}{(t.qCotRaw?.chgNet||0).toLocaleString()})</span>{t.qCotRaw?.switchType && " "}{t.qCotRaw?.switchType && <span style={{marginLeft:4,padding:"1px 4px",borderRadius:3,background:t.qCotRaw.switchType==="SWITCH_HAUSSIER"?"#14532d":"#7f1d1d",color:t.qCotRaw.switchType==="SWITCH_HAUSSIER"?"#4ade80":"#f87171",fontSize:8,fontWeight:700}}>🔥 SWITCH</span>}{t.qCotRaw?.switchType && <span style={{fontSize:7,color:"#64748b",marginLeft:4}}>(sem.préc: {t.qCotRaw.prevChgNet>=0?"+":""}{(t.qCotRaw.prevChgNet||0).toLocaleString()})</span>}
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
                <div style={{fontSize:7,color:"#00aaff",fontWeight:700,marginBottom:2}}>LEVERAGED FUNDS</div>
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

    const bPct = bCotRaw.signal==="HAUSSIER_FORT"?85:bCotRaw.signal==="HAUSSIER"?65:bCotRaw.signal==="BAISSIER"?35:bCotRaw.signal==="BAISSIER_FORT"?15:50;
    const qPct = qCotRaw.signal==="HAUSSIER_FORT"?85:qCotRaw.signal==="HAUSSIER"?65:qCotRaw.signal==="BAISSIER"?35:qCotRaw.signal==="BAISSIER_FORT"?15:50;
    const cotSpread = bPct - qPct;
    const cotAbs = Math.abs(cotSpread);
    let cotBias = cotSpread > 0 ? "HAUSSIER" : "BAISSIER";
    let cotStrength = cotAbs >= 60 ? "EXTREME" : cotAbs >= 40 ? "FORT" : cotAbs >= 20 ? "MODERE" : "NUL";

    // Vérifier alignement COT avec direction
    // LOGIQUE NINO — les 2 devises doivent être HAUSSIER FORT ou BAISSIER FORT
    // ET |chgNet| >= 3000 (mouvement significatif dans les 2 colonnes comme GBP/NZD)
    const bIsFort = bCotRaw.signal === "HAUSSIER_FORT" || bCotRaw.signal === "BAISSIER_FORT";
    const qIsFort = qCotRaw.signal === "HAUSSIER_FORT" || qCotRaw.signal === "BAISSIER_FORT";
    if (!bIsFort || !qIsFort) return;
    if (Math.abs(bCotRaw.chgNet||0) < 3000 || Math.abs(qCotRaw.chgNet||0) < 3000) return;
    const bChg = bCotRaw.chgNet || 0;
    const qChg = qCotRaw.chgNet || 0;
    const forceDiff = bChg - qChg;
    const cotDirNino = forceDiff > 0 ? "HAUSSIER" : "BAISSIER";
    const cotAligned = (direction === "LONG" && cotDirNino === "HAUSSIER") ||
                       (direction === "SHORT" && cotDirNino === "BAISSIER");
    if (!cotAligned) return;
    cotBias = cotDirNino;
    const absForce = Math.abs(forceDiff);
    cotStrength = absForce >= 8000 ? "EXTREME" : absForce >= 5000 ? "FORT" : "MODERE";

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
      cotBias, cotStrength, bPct, qPct, cotSpread, bCotRaw, qCotRaw,
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
          <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Régimes opposés + COT alignés + Retail contrarian — 3 confluences sur 3</div>
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
              <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 2 — COT LEVERAGED FUNDS</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:9,color:"#94a3b8"}}>
                  <FlagImg code={t.base} size={12} /> <span style={{color:t.bCotRaw&&t.bCotRaw.signal&&t.bCotRaw.signal.includes("HAUSSIER")?"#4ade80":"#f87171"}}>{(t.bCotRaw&&t.bCotRaw.signal||"—").replace("_"," ")}</span> <span style={{color:"#4a5070"}}>({t.bCotRaw&&t.bCotRaw.chgNet>=0?"+":""}{(t.bCotRaw&&t.bCotRaw.chgNet||0).toLocaleString()})</span>{t.bCotRaw&&t.bCotRaw.switchType && <span style={{marginLeft:4,padding:"1px 4px",borderRadius:3,background:t.bCotRaw.switchType==="SWITCH_HAUSSIER"?"#14532d":"#7f1d1d",color:t.bCotRaw.switchType==="SWITCH_HAUSSIER"?"#4ade80":"#f87171",fontSize:8,fontWeight:700}}>🔥 SWITCH</span>}{t.bCotRaw&&t.bCotRaw.switchType && <span style={{fontSize:7,color:"#64748b",marginLeft:4}}>(sem.préc: {t.bCotRaw.prevChgNet>=0?"+":""}{(t.bCotRaw.prevChgNet||0).toLocaleString()})</span>} &nbsp;vs&nbsp; <FlagImg code={t.quote} size={12} /> <span style={{color:t.qCotRaw&&t.qCotRaw.signal&&t.qCotRaw.signal.includes("HAUSSIER")?"#4ade80":"#f87171"}}>{(t.qCotRaw&&t.qCotRaw.signal||"—").replace("_"," ")}</span> <span style={{color:"#4a5070"}}>({t.qCotRaw&&t.qCotRaw.chgNet>=0?"+":""}{(t.qCotRaw&&t.qCotRaw.chgNet||0).toLocaleString()})</span>{t.qCotRaw&&t.qCotRaw.switchType && <span style={{marginLeft:4,padding:"1px 4px",borderRadius:3,background:t.qCotRaw.switchType==="SWITCH_HAUSSIER"?"#14532d":"#7f1d1d",color:t.qCotRaw.switchType==="SWITCH_HAUSSIER"?"#4ade80":"#f87171",fontSize:8,fontWeight:700}}>🔥 SWITCH</span>}{t.qCotRaw&&t.qCotRaw.switchType && <span style={{fontSize:7,color:"#64748b",marginLeft:4}}>(sem.préc: {t.qCotRaw.prevChgNet>=0?"+":""}{(t.qCotRaw.prevChgNet||0).toLocaleString()})</span>}
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
                <div style={{fontSize:7,color:"#00aaff",fontWeight:700,marginBottom:3}}>✅ LEVERAGED FUNDS</div>
                <div style={{fontSize:9,color:t.cotBias==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>{t.cotBias}</div>
                <div style={{fontSize:8,color:"#94a3b8"}}>{t.cotStrength}</div>
                <div style={{fontSize:7,color:"#4a5070",marginTop:2}}>{(t.bCotRaw?.signal||"—").replace("_"," ")} / {(t.qCotRaw?.signal||"—").replace("_"," ")}</div>
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
                <div style={{fontSize:7,color:"#00aaff",fontWeight:700,letterSpacing:1,marginBottom:3}}>LEVERAGED FUNDS</div>
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





function DayTradeAnalyzer() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState(null);
  const TEXT="#c8d4f0", TEXT_DIM="#4a5070";

  const analyze = () => {
    try {
      const lines = raw.split("\n").map(l=>l.trim()).filter(Boolean);
      const CURS = ["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"];

      const grabCurrencies = (startName) => {
        const order=[]; let on=false;
        for (const l of lines){
          if (l.includes(startName)){ on=true; continue; }
          if (on){ if (l.startsWith("As of")) break; const x=CURS.find(c=>l===c); if (x&&!order.includes(x)) order.push(x); }
        }
        return order;
      };
      const strength = grabCurrencies("Currency Strength Meter");   // 0 = plus fort
      const volMeter = grabCurrencies("Currency Volatility Meter"); // 0 = plus volatile
      const strongest = strength[0], weakest = strength[strength.length-1];
      const sRank = {}; strength.forEach((c,i)=>sRank[c]=i);
      const vRank = {}; volMeter.forEach((c,i)=>vRank[c]=i);

      const grabPairs = (startName, stops) => {
        const out=[]; let on=false, rank=0;
        for (let i=0;i<lines.length;i++){
          const l=lines[i];
          if (l.includes(startName)){ on=true; continue; }
          if (on){
            if (l.startsWith("As of")||stops.some(s=>l.includes(s))) break;
            const m=l.match(/^([A-Z]{3})\/([A-Z]{3})$/);
            if (m){
              let chg=null;
              for (let j=i+1;j<Math.min(i+4,lines.length);j++){ const pm=lines[j].match(/([+-]?\d+\.\d+)%/); if (pm){chg=parseFloat(pm[1]);break;} }
              rank++;
              out.push({pair:m[1]+m[2], base:m[1], quote:m[2], chg, rank});
            }
          }
        }
        return out;
      };
      const gainers  = grabPairs("Top Gainers", ["Top Losers","Volatility","Most Volatile"]);
      const losers   = grabPairs("Top Losers", ["Volatility","Most Volatile","Currency Volatility"]);
      const mostVol  = grabPairs("Most Volatile", ["Least Volatile","MarketMilk","Copyright"]);
      const volRankPair = {}; mostVol.forEach((p)=>volRankPair[p.pair]={rank:p.rank, chg:p.chg});

      if (!strongest || !weakest){ setResult({error:"Format non reconnu — colle le bloc MarketMilk complet (Currency Strength inclus)."}); return; }

      const leastVol = grabPairs("Least Volatile", ["MarketMilk","Copyright","Manage"]).map(p=>p.pair);
      const TOP_RANK = 2; // on ne garde que le top 2 des gainers et losers
      const candidates = [];
      const SESSION_CURS = ["EUR","GBP","USD","CHF","CAD"]; // actives 6h-11h ET
      const nStr = strength.length;
      const LONDON_CURS = ["EUR","GBP","CHF"];   // actives a ton entree 6h30
      const WHITELIST = ["EURAUD","GBPAUD","EURNZD","GBPNZD","GBPJPY","EURJPY","CHFJPY"]; // les 7 paires autorisees (Londres EUR/GBP/CHF contre Asie-Pacifique AUD/NZD/JPY) - format sans slash
      const NY_CURS = ["USD","CAD"];             // amplifient quand NY ouvre a 8h
      const GAP_MIN = 4;                          // divergence min (sur 8 devises)
      const consider = (p, direction) => {
        // CRITERE 1 - DIVERGENCE SUFFISANTE (ecart >= 4 rangs)
        const rb=sRank[p.base], rq=sRank[p.quote];
        if (rb===undefined||rq===undefined) return;
        const strongCur = direction==="LONG"?p.base:p.quote;
        const weakCur   = direction==="LONG"?p.quote:p.base;
        const forceGap = Math.abs(rb-rq);
        if (forceGap < GAP_MIN) return;            // pas assez de divergence -> rejete
        // la forte doit etre en moitie haute, la faible en moitie basse
        if (!(sRank[strongCur] < sRank[weakCur])) return;
        // CRITERE 2 - MOMENTUM: top 2 gainers/losers
        if (p.rank > TOP_RANK) return;
        if (p.chg===null) return;
        // CRITERE 3 - LISTE BLANCHE: uniquement les 7 paires autorisees
        const hasLondon = LONDON_CURS.includes(p.base) || LONDON_CURS.includes(p.quote);
        if (!WHITELIST.includes(p.pair)) return;
        // CRITERE 4 - pas Least Volatile
        if (leastVol.includes(p.pair)) return;
        // CRITERE 4b - DOIT etre dans Most Volatile (top 5 affiche)
        if (!volRankPair[p.pair]) return; // pas dans les 5 plus volatiles -> rejete
        // CRITERE 5 - RETAIL CONTRARIEN >= 70% (obligatoire si dispo)
        const rt = (window.__apexRetail||{})[p.pair] || (window.__apexRetail||{})[p.base+p.quote];
        let retailOk=false, retailPct=null, retailSide=null, retailMissing=false;
        if (rt && rt.longPercentage!=null && rt.shortPercentage!=null){
          const lp=Math.round(rt.longPercentage), sp=Math.round(rt.shortPercentage);
          if (direction==="LONG"){ retailPct=sp; retailSide="SHORT"; retailOk = sp>=70; }
          else { retailPct=lp; retailSide="LONG"; retailOk = lp>=70; }
          if (!retailOk) return; // retail pas assez a contre-sens -> alerte non validee
        } else {
          retailMissing=true; // Myfxbook deconnecte -> on affiche avec mention
        }
        // BONUS (classement + surbrillance)
        const v = volRankPair[p.pair];
        const isVolatile = !!v;
        const volRank = v?v.rank:null, volChg = v?v.chg:null;
        const inMostVol2 = isVolatile && volRank <= 1;
        const hasNY = NY_CURS.includes(p.base) || NY_CURS.includes(p.quote); // continuation NY
        const isMaxDiv = (p.base===strongest&&p.quote===weakest)||(p.base===weakest&&p.quote===strongest);
        const score = forceGap*10 + (10-p.rank*3) + (inMostVol2?8:0) + (hasNY?4:0) + (isMaxDiv?5:0) + Math.abs(p.chg);
        const driverVol = false;
        candidates.push({...p, direction, forceGap, isMaxDiv, isVolatile, volRank, volChg, score, inMostVol2, hasNY, driverVol, retailOk, retailPct, retailSide, retailMissing, weakCur, strongCur,
          strongRank: sRank[strongCur], weakRank: sRank[weakCur], strengthLen: nStr});
      };
      gainers.forEach(p=>consider(p,"LONG"));
      losers.forEach(p=>consider(p,"SHORT"));

      candidates.sort((a,b)=>b.score-a.score);
      const top = candidates.slice(0,3);
      if (top.length>0) top[0].surbrillance = true; // la meilleure = surbrillance

      if (top.length===0){ setResult({error:"AUCUNE opportunité APEX pour ta session (London-NY 6h-11h ET) — aucune paire active ne converge. Pas de trade = bonne décision.", strongest, weakest}); return; }
      setResult({ strongest, weakest, top });
    } catch(e){ setResult({error:"Erreur: "+e.message}); }
  };

  return (
    <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #fbbf2455", marginBottom:14}}>
      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🤖 ANALYSE AUTO — COLLE TES DONNÉES MARKETMILK</div>
      <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Colle ici tout le contenu copié depuis marketmilk.babypips.com (Currency Strength, Volatility Meter, Gainers, Losers, Most Volatile)..." style={{width:"100%", minHeight:90, background:"#001018", color:TEXT, border:"1px solid #1e3a5f", borderRadius:6, padding:8, fontSize:9, fontFamily:"monospace", resize:"vertical"}}/>
      <button onClick={analyze} style={{marginTop:8, width:"100%", padding:"10px", background:"#fbbf24", color:"#1a1500", border:"none", borderRadius:6, fontSize:11, fontWeight:700, letterSpacing:1, cursor:"pointer"}}>⚡ ANALYSER</button>

      {result && result.error && (<div style={{marginTop:10, padding:"10px", background:"#1a0a00", borderRadius:6, fontSize:9, color:"#fbbf24", lineHeight:1.6}}>{result.error}{result.strongest?<div style={{color:TEXT_DIM, marginTop:6, fontSize:8}}>Force du jour : {result.strongest} fort → {result.weakest} faible</div>:""}</div>)}

      {result && !result.error && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:8, color:TEXT_DIM, marginBottom:8}}>FORCE DU JOUR : <b style={{color:"#4ade80"}}>{result.strongest} (la plus forte)</b> → <b style={{color:"#f87171"}}>{result.weakest} (la plus faible)</b></div>
          <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🎯 {result.top.length} OPPORTUNITÉ{result.top.length>1?"S":""} APEX (les 6 filtres réunis)</div>
          {result.top.map((o,i)=>{
            const isLong = o.direction==="LONG";
            const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;
            const cardStyle = o.surbrillance ? {
              background: isLong ? "linear-gradient(135deg, #001a0d 0%, #003319 100%)" : "linear-gradient(135deg, #1a0000 0%, #330000 100%)",
              border: isLong ? "2px solid #00ff88" : "2px solid #ff3b3b",
              borderLeft: isLong ? "5px solid #00ff88" : "5px solid #ff3b3b",
              boxShadow: isLong ? "0 0 16px rgba(0,255,136,0.4)" : "0 0 16px rgba(255,59,59,0.4)"
            } : {
              background: "#0a1628",
              border: `1px solid ${isLong?"#4ade8033":"#f8717133"}`,
              borderLeft: `4px solid ${isLong?"#4ade80":"#f87171"}`
            };
            return (
            <div key={i} style={{...cardStyle, borderRadius:6, padding:"10px 12px", marginBottom:8}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                <span style={{fontSize:13, fontWeight:700, color:isLong?"#00ff88":"#ff3b3b"}}>{medal} {isLong?"▲ ACHETER":"▼ VENDRE"} {o.base}/{o.quote}</span>
                <span style={{display:"flex", gap:4, alignItems:"center"}}>
                  {o.surbrillance && <span style={{fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:3, background:"#fbbf24", color:"#1a1500"}}>⭐ MEILLEURE</span>}
                  {o.isMaxDiv && <span style={{fontSize:7, color:"#fbbf24", background:"#0a0a00", padding:"2px 6px", borderRadius:3}}>DIVERGENCE MAX</span>}
                </span>
              </div>
              <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6}}>
                <b style={{color:o.direction==="LONG"?"#4ade80":"#f87171"}}>POURQUOI {o.direction==="LONG"?"ACHETER":"VENDRE"} :</b> {o.strongCur} est {o.strongRank===0?"la devise la plus FORTE":"forte ("+(o.strongRank+1)+"e)"} et {o.weakCur} {o.weakRank===o.strengthLen-1?"la plus FAIBLE":"faible ("+(o.weakRank+1)+"e)"}. La {o.direction==="LONG"?"forte monte contre la faible → on achète":"faible chute contre la forte → on vend"}.<br/>
                <b style={{color:"#38bdf8"}}>POURQUOI CETTE PAIRE :</b> {o.isMaxDiv?"divergence MAXIMALE (les 2 extrêmes absolus du classement). ":`divergence de ${o.forceGap} rangs au Currency Strength. `}Contient une devise de Londres = active à ton entrée 6h30.{o.hasNY?" Et une devise NY = le mouvement s'amplifiera quand New York ouvre à 8h (tu gardes jusqu'à 11h).":""}<br/>
                <b style={{color:"#fbbf24"}}>LE SIGNAL :</b> {o.direction==="LONG"?"top gainer":"top loser"} #{o.rank} ({o.chg>0?"+":""}{o.chg}%, mouvement de Londres lancé) · divergence {o.forceGap} rangs{o.isVolatile?` · Most Volatile #${o.volRank+1} (${o.volChg}%)`:""}<br/>
                <b style={{color:"#34d399"}}>RETAIL CONTRARIEN :</b> {o.retailMissing?"⚠ Myfxbook non connecté — retail non vérifié":`${o.retailPct}% du retail est ${o.retailSide} = à contre-sens de toi. Ils se font piéger, leurs stops alimentent ton mouvement ✓`}<br/>
                <b style={{color:"#c084fc"}}>EXÉCUTION :</b> attends un repli {o.direction==="LONG"?"baissier puis achète quand ça repart vers le haut":"haussier puis vends quand ça repart vers le bas"} (H1/M15). Stop serré {o.direction==="LONG"?"sous le dernier creux":"au-dessus du dernier sommet"} · target 1.5-2× le risque.
              </div>
            </div>
          );})}
          <div style={{marginTop:6, padding:"6px 8px", background:"#1a1500", borderRadius:4, fontSize:8, color:"#fbbf24", lineHeight:1.5}}>
            ⚠ Chaque paire coche les 6 critères (divergence ≥4 rangs + top 2 momentum + une de tes paires + pas least volatile + dans Most Volatile + retail contrarien ≥70%). Classées par divergence et continuation NY. Entre au repli, garde jusqu'à ~11h pendant que NY amplifie.
          </div>
        </div>
      )}
    </div>
  );
}

function DayTradeView() {
  const ACCENT="#38bdf8", TEXT="#c8d4f0", TEXT_DIM="#4a5070", BORDER="#1a1a2e";
  return (
    <div style={{padding:16, maxWidth:760, margin:"0 auto"}}>
      <div style={{fontSize:13, color:"#fbbf24", fontWeight:700, letterSpacing:2, marginBottom:4}}>⚡ DAY TRADE FX — CURRENCY STRENGTH MOMENTUM</div>
      <div style={{fontSize:9, color:TEXT_DIM, marginBottom:16}}>Système court terme (intraday / 1-3 jours) basé sur la force et la volatilité du jour · Séparé de la méthode COT swing</div>

      <DayTradeAnalyzer />


      {/* LOGIQUE */}
      <div style={{padding:"12px 14px", background:"#1a1500", borderRadius:8, border:"1px solid #fbbf2444", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🎯 LA LOGIQUE</div>
        <div style={{fontSize:9, color:TEXT, lineHeight:1.8}}>
          Les <b style={{color:"#fbbf24"}}>gros joueurs</b> (banques, fonds) déplacent des milliards chaque jour. Quand ils achètent une devise elle devient <b style={{color:"#4ade80"}}>FORTE</b>, quand ils la vendent elle devient <b style={{color:"#f87171"}}>FAIBLE</b>. Ces positions ne se débouclent pas en une heure — les institutions sont puissantes mais lentes. Un mouvement qu'elles lancent peut durer <b>plusieurs jours</b>. On ne devine pas, <b>on SUIT ce flux</b>.<br/><br/>
          Le principe : acheter la devise la plus <b style={{color:"#4ade80"}}>FORTE</b> contre la plus <b style={{color:"#f87171"}}>FAIBLE</b> (divergence), quand le mouvement est déjà lancé (momentum) et que la paire bouge assez (volatilité).<br/><br/>
          <b style={{color:"#38bdf8"}}>⏰ Ton entrée — 6h30 ET, en pleine session de Londres :</b> Londres est ouvert depuis 3h, les news européennes du matin sont tombées, les banques ont déjà pris position. À 6h30 tu lis leur trace sur MarketMilk et tu entres derrière eux, dans une tendance déjà confirmée.<br/><br/>
          <b style={{color:"#a78bfa"}}>🔁 Pourquoi tes positions durent 1 à 3 jours :</b> tes 7 paires opposent une devise de Londres (<b>EUR/GBP/CHF</b>) à une devise du bloc asiatique-Pacifique (<b>AUD/NZD/JPY</b>). Aucune n'est une paire du dollar. Le mouvement passe de main en main sans s'éteindre : <b>Londres</b> le lance le matin, tu gardes ta position pendant <b>New York</b> (8h), puis la <b>session asiatique</b> (Tokyo + Sydney) prend le relais le soir sur AUD/NZD/JPY — mêmes raisons fondamentales, même direction. Le lendemain Londres reprend.<br/><br/><b style={{color:"#34d399"}}>🎭 Le retail contrarien (≥70%) :</b> dernière confirmation. Si tu achètes une paire et que 70%+ du retail est SHORT (à contre-sens), parfait : les gros joueurs te suivent, le retail se fait piéger, leurs stops qui sautent alimentent ton mouvement. Le retail du mauvais côté = ton carburant.
        </div>
      </div>

      {/* POURQUOI CES 7 PAIRES */}
      <div style={{padding:"12px 14px", background:"#04140a", borderRadius:8, border:"1px solid #4ade8055", marginBottom:14}}>
        <div style={{fontSize:11, color:"#4ade80", fontWeight:700, marginBottom:8}}>🎯 POURQUOI CES 7 PAIRES À 6h30</div>
        <div style={{fontSize:9, color:TEXT, lineHeight:1.6, marginBottom:10}}>
          On trade UNIQUEMENT : <b style={{color:"#4ade80"}}>EUR/AUD · GBP/AUD · EUR/NZD · GBP/NZD · GBP/JPY · EUR/JPY · CHF/JPY</b>. Chacune oppose une devise de Londres (EUR, GBP, CHF) à une devise du bloc Asie-Pacifique (AUD, NZD, JPY). Pas de paires CAD : le CAD est une devise de session New York, pas de notre relais Londres↔Asie.
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:7}}>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700}}>1.</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Les news sont déjà sorties.</b> À 6h30 ET il est 11h30 à Londres : les chiffres éco européens du matin (inflation, emploi, PIB UK/EU) sont tombés entre 2h et 5h. Les institutions les ont digérés et ont déjà pris position. Tu entres dans une tendance confirmée, pas dans l'incertitude.</span></div>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700}}>2.</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>La conviction des big boys est à son max.</b> Londres est ouvert depuis 3h, le volume institutionnel est massif. Les gros joueurs ont bâti leurs positions sur EUR/GBP/CHF selon les news. À 6h30 la direction est nette, pas hésitante.</span></div>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700}}>3.</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Le mouvement va durer plusieurs sessions.</b> Tu entres pendant Londres, tu gardes ta position pendant New York (8h), puis la session asiatique (Tokyo + Sydney) prend le relais le soir sur AUD/NZD/JPY. Tu te places au début d'un flux qui passe de main en main, pas dans un coup d'une heure.</span></div>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700}}>4.</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Le sentiment retail est déjà formé.</b> Le retail a réagi aux news du matin, souvent à contre-sens. À 6h30 leur positionnement est mûr et lisible — ton filtre retail contrarien ≥70% capte ce déséquilibre exact.</span></div>
        </div>
        <div style={{fontSize:9, color:"#4ade80", marginTop:10, padding:"8px 10px", background:"#0a2010", borderRadius:5, lineHeight:1.5, fontWeight:600}}>💡 6h30 ET = le point de convergence : news digérées + tendance de Londres confirmée + retail piégé. Tu ne devines rien, tu te places dans un flux déjà validé que les sessions suivantes vont relayer pendant 1 à 3 jours.</div>
      </div>

      {/* SEQUENCE */}
      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:10}}>📋 LA SÉQUENCE — ÉTAPE PAR ÉTAPE</div>
        <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:10}}>L'app vérifie ces 6 filtres pour toi quand tu colles tes données. Une alerte n'apparaît que si les 6 sont cochés.</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>DIVERGENCE ≥ 4 rangs</b> au Currency Strength : la devise forte et la faible séparées d'au moins 4 places (vraie divergence, pas 2 voisines)</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>TOP 2 momentum</b> : la paire est #1 ou #2 des Top Gainers (→ achat) ou Top Losers (→ vente). Le mouvement est déjà lancé</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>UNE DE TES 7 PAIRES</b> : EUR/AUD, GBP/AUD, EUR/NZD, GBP/NZD, GBP/JPY, EUR/JPY ou CHF/JPY. Toute autre paire est écartée</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>PAS Least Volatile</b> : on écarte ce qui stagne (pas de pips à faire)</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>⑤</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>DANS MOST VOLATILE</b> : la paire doit figurer dans la liste Most Volatile (elle bouge vraiment, il y a des pips à faire)</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>⑥</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#34d399"}}>RETAIL CONTRARIEN ≥ 70%</b> : si tu achètes, le retail doit être short 70%+ ; si tu vends, long 70%+. Ils se font piéger, leurs stops alimentent ton mouvement</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#c084fc", fontWeight:700, minWidth:16}}>▶</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#c084fc"}}>ENTRÉE</b> : sur H1/M15, attends un repli (pullback) puis entre. Stop serré, target 1.5-2× le risque. Tu gardes en swing 1 à 3 jours — réévalue chaque matin à 6h30</span></div>
        </div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8}}>⭐ BONUS (surbrillance) : la paire est aussi dans Most Volatile + divergence maximale du jour.</div>
      </div>

      {/* EXEMPLE REEL - GBP/NZD */}
      <div style={{padding:"12px 14px", background:"#04140a", borderRadius:8, border:"1px solid #4ade8055", marginBottom:14}}>
        <div style={{fontSize:11, color:"#4ade80", fontWeight:700, marginBottom:4}}>📐 EXEMPLE RÉEL — CHF/JPY ACHAT à 6h30</div>
        <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:10}}>Currency Strength à 6h30 : CHF #1 (le plus fort, refuge Europe), JPY #6 (faible). Pourquoi CHF/JPY ACHAT cochait les 6 filtres — et pourquoi la position a tenu plusieurs jours.</div>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700, minWidth:14}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Divergence ✓</b> — CHF #1 vs JPY #6 = écart de 5 rangs. Les banques de Londres ont acheté le CHF (refuge européen) depuis 3h.</span></div>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700, minWidth:14}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Momentum ✓</b> — top gainer #1. Le mouvement de Londres était déjà lancé à ton entrée.</span></div>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700, minWidth:14}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Une de tes 7 paires ✓</b> — CHF/JPY oppose une devise de Londres (CHF) à une devise d'Asie (JPY). Pile ton type de paire.</span></div>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700, minWidth:14}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Pas Least Volatile ✓</b> — CHF/JPY bougeait activement, pas dans les stagnantes.</span></div>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700, minWidth:14}}>⑤</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Most Volatile ✓</b> — CHF/JPY figurait dans la liste Most Volatile. Des pips à faire.</span></div>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#4ade80", fontWeight:700, minWidth:14}}>⑥</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Retail contrarien ✓</b> — le retail était SHORT à 70%+ pendant que toi tu achetais. Ils se faisaient piéger.</span></div>
        </div>
        <div style={{fontSize:9, color:"#4ade80", marginTop:10, padding:"8px 10px", background:"#0a2010", borderRadius:5, lineHeight:1.5, fontWeight:600}}>✅ Les 6 filtres réunis = ALERTE ACHAT à 6h30. Tu entres au repli. Londres porte le mouvement le matin, tu gardes pendant NY, puis Tokyo reprend le JPY le soir et continue de le vendre. La position a tenu plusieurs jours tant que CHF restait fort et JPY faible. C'est exactement le type de swing que le système cherche.</div>
      </div>

      {/* TABLEAU RECAP - PLAN DE TRADE */}
      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #fbbf2444", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:10}}>📋 TON PLAN DE TRADE — RÉSUMÉ</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {[
            {t:"6h30 ET", a:"Colle MarketMilk + lance l'analyse", p:"Londres bouge, la tendance est déjà lancée", col:"#4ade80"},
            {t:"Si alerte", a:"Entre au repli (pullback) sur H1/M15", p:"Meilleur prix — jamais sur l'extension", col:"#4ade80"},
            {t:"8h ET", a:"Tiens ta position pendant NY", p:"New York ouvre — tu gardes, tu n'ajoutes pas", col:"#38bdf8"},
            {t:"Le soir", a:"Tu gardes — Asie prend le relais", p:"Tokyo + Sydney continuent sur AUD/NZD/JPY", col:"#a78bfa"},
            {t:"Chaque matin 6h30", a:"Réévalue ta position", p:"Devise forte toujours forte ? Tu gardes. Sinon tu sors. Stop remonté.", col:"#fbbf24"}
          ].map((r,i)=>(
            <div key={i} style={{display:"flex", gap:10, alignItems:"flex-start", padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:`3px solid ${r.col}`}}>
              <span style={{fontSize:9, fontWeight:700, color:r.col, minWidth:54, paddingTop:1}}>{r.t}</span>
              <span style={{flex:1}}>
                <span style={{fontSize:10, color:TEXT, fontWeight:600, display:"block", lineHeight:1.4}}>{r.a}</span>
                <span style={{fontSize:8.5, color:TEXT_DIM, display:"block", marginTop:2, lineHeight:1.4}}>{r.p}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8, lineHeight:1.5}}>Si aucune alerte ne sort à 6h30 = pas de trade ce jour. La discipline d'attendre le bon setup fait partie de la stratégie.</div>
      </div>

      {/* PSYCHOLOGIE */}
      <div style={{padding:"12px 14px", background:"#1a0a2e", borderRadius:8, border:"1px solid #a855f744", marginBottom:14}}>
        <div style={{fontSize:11, color:"#c084fc", fontWeight:700, marginBottom:8}}>🧠 LA PSYCHOLOGIE</div>
        <div style={{fontSize:9, color:TEXT, lineHeight:1.8}}>
          <b style={{color:"#c084fc"}}>Reste du côté du flux.</b> Tu ne prédis pas — tu suis ce qui bouge déjà. La devise forte attire les acheteurs, la faible attire les vendeurs : tu te places dans ce courant et tu y restes tant qu'il tient.<br/><br/>
          <b style={{color:"#c084fc"}}>Ne chasse pas un mouvement trop avancé.</b> Si une paire a déjà fait +1.5% aujourd'hui, le gros du mouvement est peut-être passé. Entre sur un <b>repli</b>, pas sur l'extension. Le bon moment = quand le momentum reprend après une petite pause.<br/><br/>
          <b style={{color:"#c084fc"}}>La volatilité est ton amie ET ton ennemie.</b> Elle crée les pips, mais aussi les faux mouvements. Stop serré et discipline absolue.<br/><br/>
          <b style={{color:"#fbbf24"}}>Une décision, une exécution.</b> Pas de sur-analyse, pas de revenge trade. Une fois dans le swing, laisse le flux travailler — ne touche pas à ta position par impatience.
        </div>
      </div>

      {/* TIMELINE GPS FX */}
      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #4ade8044", marginBottom:14}}>
        <div style={{fontSize:11, color:"#4ade80", fontWeight:700, marginBottom:4}}>🗺️ GPS — L'AGENDA DES GROS JOUEURS FX</div>
        <div style={{fontSize:8, color:TEXT_DIM, marginBottom:12}}>Suis leur agenda. Entre derrière eux. Comme un sniper.</div>
        <div style={{display:"flex", flexDirection:"column", gap:0}}>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e3a5f", border:"2px solid #38bdf8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#38bdf8", fontWeight:700}}>3h</div>
              <div style={{width:2, height:32, background:"#1e3a5f"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#38bdf8", fontWeight:700}}>3h00 ET — OUVERTURE LONDRES</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Banques européennes entrent sur EUR/GBP/CHF. La tendance du jour se forme en silence.</div>
              <div style={{fontSize:8, color:"#4a5070", marginTop:2}}>→ Dors. Laisse-les travailler.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e3a5f", border:"2px solid #38bdf8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#38bdf8", fontWeight:700}}>5h</div>
              <div style={{width:2, height:32, background:"#1e3a5f"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#38bdf8", fontWeight:700}}>3h-6h ET — NEWS EUROPÉENNES</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Inflation, emploi, PIB de la zone euro tombent. Les institutionnels digèrent et confirment leur direction.</div>
              <div style={{fontSize:8, color:"#4a5070", marginTop:2}}>→ Dors. La tendance s'établit.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#052010", border:"2px solid #00ff88", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#00ff88", fontWeight:700}}>6h</div>
              <div style={{width:2, height:32, background:"#00ff8844"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#00ff88", fontWeight:700}}>6h00 ET — PRÉPARE-TOI</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Ouvre ton rituel. MarketMilk + calendrier éco + news. Lis la tendance de Londres.</div>
              <div style={{fontSize:8, color:"#00ff88", marginTop:2}}>→ Rituel du matin. Check tes ressources.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#00ff88,#4ade80)", border:"3px solid #00ff88", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#001a0d", fontWeight:900, boxShadow:"0 0 12px rgba(0,255,136,0.6)"}}>6h30</div>
              <div style={{width:2, height:40, background:"#00ff8866"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8, padding:"8px 10px", background:"#052010", borderRadius:6, border:"1px solid #00ff8866", marginBottom:4}}>
              <div style={{fontSize:10, color:"#00ff88", fontWeight:900}}>⚡ 6h30 ET — TON ENTRÉE</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5, marginTop:2}}>Londres roule depuis 3h30. Tendance confirmée. Retail piégé à contre-sens. Tes 6 filtres te disent si les gros joueurs sont dans le trade.</div>
              <div style={{fontSize:8.5, color:"#00ff88", fontWeight:700, marginTop:4}}>→ Analyse + entre au repli sur H1/M15</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a2a00", border:"2px solid #fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#fbbf24", fontWeight:700}}>8h</div>
              <div style={{width:2, height:32, background:"#fbbf2444"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#fbbf24", fontWeight:700}}>8h00 ET — NEW YORK OUVRE</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>New York entre. Tes paires n'ont pas de dollar, donc NY ne les trade pas directement — mais tu gardes ta position, le mouvement de Londres tient.</div>
              <div style={{fontSize:8, color:"#fbbf24", marginTop:2}}>→ Tu gardes. Remonte ton stop.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a1500", border:"2px solid #fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#fbbf24", fontWeight:700}}>8h30</div>
              <div style={{width:2, height:32, background:"#fbbf2422"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#fbbf24", fontWeight:700}}>8h30 ET — NEWS US ⚠️</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>NFP, CPI, FOMC. Peut accélérer OU renverser brutalement. Ne pas entrer après une news.</div>
              <div style={{fontSize:8, color:"#fbbf24", marginTop:2}}>→ Stop au break-even si en profit.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#160a2e", border:"2px solid #a78bfa", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#a78bfa", fontWeight:700}}>Soir</div>
              <div style={{width:2, height:32, background:"#f8717133"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#a78bfa", fontWeight:700}}>LE SOIR — SESSION ASIATIQUE PREND LE RELAIS</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Tokyo + Sydney ouvrent. Les desks asiatiques voient le même fondamental sur AUD/NZD/JPY et continuent dans le même sens. Ton mouvement ne meurt pas — il change de mains.</div>
              <div style={{fontSize:8, color:"#a78bfa", marginTop:2}}>→ Tu gardes. Le relais est passé.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#052010", border:"2px solid #4ade80", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#4ade80", fontWeight:700}}>J+1</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9, color:"#4ade80", fontWeight:700}}>LENDEMAIN 6h30 — LONDRES REPREND</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Londres rouvre et reprend le mouvement. Tu rouvres MarketMilk : ta devise forte toujours en haut, la faible toujours en bas ? Le swing continue. L'écart se referme ? Tu sors.</div>
              <div style={{fontSize:8, color:"#4ade80", marginTop:2}}>→ Réévalue chaque matin. Tu gardes 1 à 3 jours.</div>
            </div>
          </div>

        </div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #fbbf2444", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🏦 COMPRENDRE L'AGENDA INSTITUTIONNEL — COMMENT LES SUIVRE</div>
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #38bdf8"}}>
            <div style={{fontSize:9, color:"#38bdf8", fontWeight:700, marginBottom:3}}>3h ET — Londres entre en premier</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Deutsche Bank, HSBC, BNP, Barclays ouvrent leurs desks. Ils achètent EUR, GBP ou CHF selon les données économiques européennes du matin. Ce sont eux qui créent la divergence que tu vas lire à 6h30 sur MarketMilk. Tu ne les vois pas entrer — mais tu vois leur résultat : EUR #1, JPY #8 = ils ont acheté EUR depuis 3h.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#052010", borderRadius:6, borderLeft:"3px solid #00ff88"}}>
            <div style={{fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:3}}>6h30 ET — Tu lis leur trace et tu les suis</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>MarketMilk te montre ce que les gros joueurs ont DÉJÀ fait. Tes 6 filtres confirment que le mouvement est réel. Tu entres derrière eux sur ta meilleure paire (EUR/JPY, GBP/JPY, EUR/AUD...). Tu ne devines pas — tu confirmes et tu suis. Comme un sniper qui attend le bon moment.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #fbbf24"}}>
            <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:3}}>8h ET — New York ouvre, tu gardes</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Tes paires n'ont pas de dollar, donc NY ne les trade pas directement. Mais le dollar bouge l'EUR et le GBP de façon indirecte, et surtout : rien n'a changé au fondamental de Londres. Tu ne prends pas de nouvelle position à 8h — tu tiens celle de 6h30. Le mouvement continue.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #4ade80"}}>
            <div style={{fontSize:9, color:"#a78bfa", fontWeight:700, marginBottom:3}}>Le soir — La session asiatique reprend le flambeau</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Londres ferme, mais Tokyo et Sydney ouvrent. Les desks asiatiques voient le même fondamental sur AUD/NZD/JPY et continuent dans le même sens. Ton mouvement ne s'arrête pas à la fermeture de Londres — il passe simplement à un autre groupe de banques. C'est pour ça que tes positions durent plusieurs jours.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #c084fc"}}>
            <div style={{fontSize:9, color:"#c084fc", fontWeight:700, marginBottom:3}}>🔗 Comment les banques se passent le relais — sans se parler</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Aucune banque n'appelle l'autre. Elles voient toutes le même chart : EUR/JPY monte depuis Londres, divergence confirmée, tendance haussière. Londres lance le matin → New York garde l'après-midi → Tokyo + Sydney reprennent le soir sur le JPY/AUD/NZD → Londres reprend le lendemain. Les raisons fondamentales (données européennes vs faiblesse asiatique) ne changent pas en une nuit. Chaque session passe le flambeau à la suivante, dans le même sens. C'est pour ça qu'un bon trade tient 1 à 3 jours — automatique, prévisible, répétable.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #f87171"}}>
            <div style={{fontSize:9, color:"#f87171", fontWeight:700, marginBottom:3}}>🎭 Le retail — la preuve que les institutionnels sont dans le trade</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Quand 80% du retail est SHORT sur EUR/JPY pendant que Londres monte, c'est la preuve que les institutionnels sont LONG. Le retail a pris la mauvaise direction — leurs stops qui sautent alimentent le mouvement haussier. C'est exactement ce que ton filtre retail ≥70% capte.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#1a1500", borderRadius:6, border:"1px solid #fbbf2444"}}>
            <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:3}}>💡 La règle d'or</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Tu ne sais jamais exactement ce que les banques font. Mais MarketMilk te montre CE QU'ELLES ONT DÉJÀ FAIT. Tes 6 filtres confirment que le mouvement est réel. Tu ne devines pas — tu confirmes et tu suis. Tu n'es pas la liquidité. Tu suis la liquidité.</div>
          </div>
        </div>
      </div>

      {/* RITUEL DU MATIN - 4 LIENS */}
      <div style={{padding:"14px", background:"linear-gradient(135deg, #001a0d 0%, #003319 100%)", borderRadius:8, border:"2px solid #00ff88", borderLeft:"5px solid #00ff88", boxShadow:"0 0 16px rgba(0,255,136,0.4)"}}>
        <div style={{fontSize:11, color:"#00ff88", fontWeight:700, marginBottom:4}}>☀️ TON RITUEL DU MATIN — 6h ET</div>
        <div style={{fontSize:8.5, color:"#a7f3d0", marginBottom:12, lineHeight:1.4}}>Ouvre MarketMilk pour l'analyse, puis vérifie les news avant de prendre position.</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <a href="https://marketmilk.babypips.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #00ff88"}}>
            🥛 1. MarketMilk <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— force, volatilité, momentum (colle ici pour l'analyse)</span>
          </a>
          <a href="https://www.babypips.com/economic-calendar?week=2026-W23" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #f87171"}}>
            📅 2. Calendrier économique <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— les news du jour (NFP, CPI, taux)</span>
          </a>
          <a href="https://investinglive.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #38bdf8"}}>
            📰 3. InvestingLive <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— l'actualité en direct</span>
          </a>
          <a href="https://www.financialjuice.com/home" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #c084fc"}}>
            🧃 4. FinancialJuice <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— flux de news temps réel</span>
          </a>
          <a href="https://www.sucdenfinancial.com/en/market-insights/fx-outlook/daily-fx-analysis/" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #fbbf24"}}>
            📊 5. Sucden Financial <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— analyse FX quotidienne pro</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function PositionCalc() {
  const [capital, setCapital] = useState("");
  const [risque, setRisque] = useState("1");
  const [paire, setPaire] = useState("GBPNZD");
  const [entree, setEntree] = useState("");
  const [stop, setStop] = useState("");

  const PAIRES = ["EURNZD","EURCHF","NZDJPY","CHFJPY","GBPNZD","AUDNZD","EURUSD","GBPUSD","USDCAD","USDJPY","AUDUSD","NZDUSD","EURJPY","GBPJPY","AUDJPY","CADJPY","EURCAD","GBPCAD","EURGBP","EURAUD","GBPAUD","NZDCAD","AUDCAD","AUDNZD","USDCHF","NZDCHF","CADCHF","AUDCHF","GBPCHF"];

  const cap = parseFloat(capital)||0;
  const rsk = parseFloat(risque)||0;
  const ent = parseFloat(entree)||0;
  const stp = parseFloat(stop)||0;

  // Calcul
  const isJPY = paire.endsWith("JPY");
  const pipSize = isJPY ? 0.01 : 0.0001;
  const stopPips = ent && stp ? Math.abs(ent - stp) / pipSize : 0;
  const riskAmount = cap * rsk / 100;

  // Valeur du pip pour 1 lot standard (100k) en devise QUOTE
  // Puis conversion en USD selon la paire
  const quote = paire.slice(3,6);
  // Valeur pip par lot standard en devise quote = pipSize * 100000
  const pipValueQuote = pipSize * 100000; // ex: 0.0001*100000 = 10 (quote units)

  // Conversion quote -> USD (approximation avec prix d'entrée quand quote n'est pas USD)
  // Pour paires XXXUSD: pip vaut deja ~10 USD
  // Pour USDXXX: diviser par prix
  // Pour cross: approximation
  let pipValueUSD = 10; // defaut
  if (quote === "USD") {
    pipValueUSD = pipValueQuote; // ~10 USD
  } else if (paire.startsWith("USD")) {
    pipValueUSD = ent ? pipValueQuote / ent : 10;
  } else {
    // cross: pip en quote, convertir quote->USD
    // approximation: si quote=JPY ~0.0067, CAD ~0.73, CHF ~1.1, NZD ~0.6, AUD ~0.65, GBP ~1.27, EUR ~1.08
    const quoteToUSD = {JPY:0.0067, CAD:0.73, CHF:1.12, NZD:0.60, AUD:0.65, GBP:1.27, EUR:1.08, USD:1};
    pipValueUSD = pipValueQuote * (quoteToUSD[quote]||1);
  }

  const lots = stopPips > 0 && pipValueUSD > 0 ? riskAmount / (stopPips * pipValueUSD) : 0;
  const direction = ent && stp ? (stp < ent ? "LONG" : "SHORT") : "";

  const inputStyle = {width:"100%", padding:"10px 12px", fontSize:14, background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:6, color:"#c8d4f0", marginTop:4, boxSizing:"border-box", fontFamily:"monospace"};
  const labelStyle = {fontSize:11, color:"#94a3b8", fontWeight:600, letterSpacing:0.5};

  return (
    <div style={{maxWidth:520, margin:"0 auto", padding:"4px 0"}}>
      <div style={{fontSize:13, color:"#38bdf8", fontWeight:700, letterSpacing:2, marginBottom:4}}>🧮 CALCULATRICE DE POSITION</div>
      <div style={{fontSize:10, color:"#475569", marginBottom:16}}>Compte USD · Calcule le nombre de lots pour risquer un % fixe de ton capital</div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
        <div>
          <div style={labelStyle}>CAPITAL ($ USD)</div>
          <input style={inputStyle} type="number" inputMode="decimal" placeholder="10000" value={capital} onChange={e=>setCapital(e.target.value)}/>
        </div>
        <div>
          <div style={labelStyle}>RISQUE (%)</div>
          <input style={inputStyle} type="number" inputMode="decimal" placeholder="1" value={risque} onChange={e=>setRisque(e.target.value)}/>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <div style={labelStyle}>PAIRE</div>
        <select style={inputStyle} value={paire} onChange={e=>setPaire(e.target.value)}>
          {PAIRES.filter((p,i,a)=>a.indexOf(p)===i).map(p=><option key={p} value={p}>{p.slice(0,3)}/{p.slice(3,6)}</option>)}
        </select>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16}}>
        <div>
          <div style={labelStyle}>PRIX D'ENTRÉE</div>
          <input style={inputStyle} type="number" inputMode="decimal" placeholder="2.2800" value={entree} onChange={e=>setEntree(e.target.value)}/>
        </div>
        <div>
          <div style={labelStyle}>PRIX DU STOP</div>
          <input style={inputStyle} type="number" inputMode="decimal" placeholder="2.2900" value={stop} onChange={e=>setStop(e.target.value)}/>
        </div>
      </div>

      {lots > 0 ? (
        <div style={{padding:"16px", background:"#001a0d", border:"1px solid #14532d", borderRadius:8}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10}}>
            <span style={{fontSize:11, color:"#94a3b8"}}>POSITION À PRENDRE {direction && <span style={{color:direction==="LONG"?"#4ade80":"#f87171", fontWeight:700}}>· {direction}</span>}</span>
          </div>
          <div style={{fontSize:32, color:"#4ade80", fontWeight:700, fontFamily:"monospace", lineHeight:1}}>{lots.toFixed(2)} <span style={{fontSize:14, color:"#94a3b8"}}>lots</span></div>
          <div style={{marginTop:14, paddingTop:14, borderTop:"1px solid #14532d", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontSize:11, color:"#c8d4f0", fontFamily:"monospace"}}>
            <div>Risque $ : <b style={{color:"#fbbf24"}}>{riskAmount.toFixed(2)} $</b></div>
            <div>Stop : <b>{stopPips.toFixed(1)} pips</b></div>
            <div>Valeur pip : <b>{pipValueUSD.toFixed(2)} $/lot</b></div>
            <div>Unités : <b>{(lots*100000).toLocaleString()}</b></div>
          </div>
        </div>
      ) : (
        <div style={{padding:"16px", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8, textAlign:"center", fontSize:11, color:"#475569"}}>
          Remplis capital, risque, entrée et stop pour voir le nombre de lots
        </div>
      )}

      <div style={{marginTop:14, fontSize:8, color:"#475569", lineHeight:1.6}}>
        ⚠ Les valeurs de pip pour les cross et paires JPY sont approximatives (basées sur des taux de conversion moyens). Vérifie toujours avec ton broker avant d'exécuter. La calculatrice suppose 1 lot standard = 100 000 unités.
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
          const url = "https://publicreporting.cftc.gov/resource/gpe5-46if.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
          const rows = await (await fetch(url, {cache:"no-store"})).json();
          if (!rows?.length) return [code, null];
          const row=rows[0];
          const prev=rows[1]||{};
          const chgLong=parseInt(row.change_in_lev_money_long||0);
          const chgShort=parseInt(row.change_in_lev_money_short||0);
          const chgNet=chgLong-chgShort;
          const prevChgLong=parseInt(prev.change_in_lev_money_long||0);
          const prevChgShort=parseInt(prev.change_in_lev_money_short||0);
          const prevChgNet=prevChgLong-prevChgShort;
          const levLong=parseInt(row.lev_money_positions_long||0);
          const levShort=parseInt(row.lev_money_positions_short||0);
          const date=row.report_date_as_yyyy_mm_dd?.slice(0,10)||"";
          let signal="NEUTRE";
          if(chgLong>0&&chgShort<0)signal="HAUSSIER_FORT";
          else if(chgLong<0&&chgShort>0)signal="BAISSIER_FORT";
          else if(chgNet>500)signal="HAUSSIER";
          else if(chgNet<-500)signal="BAISSIER";
          let switchType=null;
          const diff=chgNet-prevChgNet;
          if(diff>2000&&prevChgNet<=500&&chgNet>500)switchType="SWITCH_HAUSSIER";
          else if(diff<-2000&&prevChgNet>=-500&&chgNet<-500)switchType="SWITCH_BAISSIER";
          return [code,{chgLong,chgShort,chgNet,prevChgNet,switchType,levLong,levShort,net:levLong-levShort,signal,date,max52:1,min52:-1}];
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
    const loadMFX = async (attempt = 1) => {
      try {
        // Un seul appel — login + outlook côté serveur
        const r = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$")+"&t="+Date.now(), {cache:"no-store"});
        const d = await r.json();
        // Si échec (rate limit Myfxbook ou deconnexion) → reessayer
        if (d.error || !d.symbols) {
          window.__mfxConnected = false;
          if (attempt < 3) {
            setTimeout(() => loadMFX(attempt + 1), attempt * 5000); // 5s, puis 10s
          } else {
            // Apres 3 echecs rapproches: reessayer toutes les 5 min jusqu'a reconnexion
            setTimeout(() => loadMFX(1), 5 * 60 * 1000);
          }
          // Ne PAS vider apexRetail — on garde les dernières données valides
          return;
        }
        window.__mfxConnected = true;
        const map = {};
        d.symbols.forEach(s => {
          map[s.name] = s;
          // Normaliser sans slash: "GBP/NZD" → "GBPNZD"
          map[s.name.replace("/","")] = s;
        });
        if (Object.keys(map).length > 0) {
          setApexRetail(map);
          window.__apexRetail = map; // expose pour le DayTradeAnalyzer
          // Snapshot historique du sentiment retail (1 max par 4h) pour voir la tendance
          try {
            const now = Date.now();
            const lastSnap = window.__lastRetailSnap || 0;
            if (now - lastSnap > 4 * 60 * 60 * 1000) {
              window.__lastRetailSnap = now;
              const snap = {};
              d.symbols.forEach(s => {
                const key = s.name.replace("/","");
                snap[key] = { l: Math.round(s.longPercentage), s: Math.round(s.shortPercentage) };
              });
              const bucket = Math.floor(now / (4 * 60 * 60 * 1000)); // tranche de 4h
              set(ref(db, `retailHistory/${bucket}`), { t: now, data: snap });
            }
          } catch(err) {}
        }
      } catch(e) {
        // Erreur réseau → réessayer aussi
        if (attempt < 3) setTimeout(() => loadMFX(attempt + 1), attempt * 5000);
      }
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
      const retailRaw = await fetchRetailApp();
      // Normaliser les clés: ajouter version sans slash
      const retail = {...retailRaw};
      Object.keys(retailRaw).forEach(k => {
        const noSlash = k.replace("/","");
        if (noSlash !== k) retail[noSlash] = retailRaw[k];
      });
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

  const ranked = useMemo(() =>
    CURR.map(cu => ({...cu, score:calcScore(data,cu.code)})).sort((a,b) => b.score - a.score)
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
    {id:"regimes",label:"RÉGIMES"},{id:"analyse",label:"ANALYSE"},{id:"journal",label:"JOURNAL"},
    {id:"calc",label:"CALCUL"},
    {id:"data",label:"DONNÉES ↗"},{id:"guide",label:"GUIDE"},{id:"heat",label:"HEATMAP"},{id:"cal",label:"RESSOURCES"},
  ];

  return (
    <div style={{ minHeight:"100vh", background:BG, fontFamily:"'IBM Plex Mono',monospace", color:TEXT, fontSize:12 }}>
      <style>{css}</style>
      <div style={{ background:BG2, borderBottom:`1px solid ${BORDER}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:3, color:ACCENT, fontFamily:"'IBM Plex Mono'" }}>PAT & FRANK MACRO FX</div>
          <div style={{ fontSize:8, color:TEXT_DIM, letterSpacing:3 }}>LEVERAGED FUNDS + MACRO + RETAIL — STRATÉGIE NINO</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:connected?"#00ff88":"#ff3b3b", animation:connected?"pulse 2s infinite":"none" }} />
            <span style={{ fontSize:7, color:connected?"#00ff88":"#ff3b3b", letterSpacing:1 }}>{connected?"SYNC TEMPS RÉEL":"CONNEXION..."}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={()=>setView("daytrade")} style={{ padding:"6px 12px", borderRadius:6, fontSize:10, fontWeight:800, letterSpacing:1, cursor:"pointer", border: view==="daytrade"?"2px solid #fbbf24":"2px solid #fbbf2466", background: view==="daytrade"?"#fbbf24":"#1a1500", color: view==="daytrade"?"#1a1500":"#fbbf24", fontFamily:"'IBM Plex Mono'", boxShadow:"0 0 8px rgba(251,191,36,0.3)" }}>⚡ DAY TRADE FX</button>
          <button onClick={()=>setView("daytradeor")} style={{ padding:"6px 12px", borderRadius:6, fontSize:10, fontWeight:800, letterSpacing:1, cursor:"pointer", border: view==="daytradeor"?"2px solid #fbbf24":"2px solid #fbbf2466", background: view==="daytradeor"?"#fbbf24":"#1a1500", color: view==="daytradeor"?"#1a1500":"#fbbf24", fontFamily:"'IBM Plex Mono'", boxShadow:"0 0 8px rgba(251,191,36,0.3)" }}>⚡ DAY TRADE OR</button>
          <div style={{ width:1, height:20, background:BORDER, margin:"0 2px" }} />
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
      {/* LÉGENDE bandeau */}
      <div style={{ background:"#06060e", borderBottom:`1px solid ${BORDER}`, padding:"4px 16px", fontSize:7, color:"#475569", letterSpacing:0.5, display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
        <span>Score macro: <span style={{color:"#4ade80"}}>+fort</span> / <span style={{color:"#f87171"}}>-faible</span></span>
        <span style={{color:"#ffd700"}}>▲ SURCHAUFFE</span>
        <span style={{color:"#00ff88"}}>◆ GOLDILOCKS</span>
        <span style={{color:"#ff6600"}}>■ STAGFLATION</span>
        <span style={{color:"#cc2200"}}>▼ RECESSION</span>
      </div>

      {view==="table" && (
        <div style={{ overflowX:"auto", padding:12 }}>
          <div style={{ fontSize:8, color:TEXT_DIM, marginBottom:8, letterSpacing:1 }}>PREVIOUS → CONSENSUS → ACTUAL · Vert=EN HAUSSE · Rouge=EN BAISSE · Gris=STABLE · Tier1: Inflation/Core · Tier2: Unemployment/Services PMI</div>
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
                {INDS.map(ind=>["Previous","Consensus","Actual"].map(f=>(
                  <th key={ind.id+f} style={{ background:BG3, padding:"2px 4px", fontSize:7, color:TEXT_DIM, border:`1px solid ${BORDER}`, textAlign:"center" }}>{f}</th>
                )))}
                <th style={{ background:BG3, border:`1px solid ${BORDER}` }} />
                <th style={{ background:BG3, border:`1px solid ${BORDER}` }} />
              </tr>
            </thead>
            <tbody>
              {ranked.map((c,ri)=>{
                const reg=getRegime(data,c.code);
            const scoreColor = c.score >= 0.3?"#00ff88":c.score >= 0.1?"#66ffaa":c.score >= 0?"#aaffcc":c.score >= -0.1?"#ffaaaa":c.score >= -0.3?"#ff6666":"#cc2200";
            const st = {
              color: scoreColor,
              label: c.score >= 0.1 ? "FORT ↑" : c.score <= -0.1 ? "FAIBLE ↓" : "NEUTRE →",
              labelColor: c.score >= 0.1 ? "#00ff88" : c.score <= -0.1 ? "#cc2200" : "#888899"
            };
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

          {/* INDICATEUR DE CHARGEMENT (tant que CFTC pas chargé) */}
          {Object.keys(apexCot).length === 0 && (
            <div style={{marginTop:16, padding:"24px", textAlign:"center", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8}}>
              <div style={{fontSize:13, color:"#38bdf8", marginBottom:6}}>⏳ Chargement des données live…</div>
              <div style={{fontSize:9, color:"#475569"}}>CFTC (Leveraged Funds) + Myfxbook (Retail) en cours</div>
            </div>
          )}

          {/* MEILLEURES OPPORTUNITÉS — MACRO + LEVERAGED FUNDS COMBINÉS */}
          {(() => {
            const CFTC_MAP = {EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
            const FORTS_MACRO = ["SURCHAUFFE","GOLDILOCKS"];
            const FAIBLES_MACRO = ["RECESSION","STAGFLATION"];
            const codes = ["EUR","GBP","JPY","CAD","AUD","CHF","USD","NZD"];
            // Devises FORTES: macro forte + COT achete (chgNet > 0)
            const fortes = [];
            const faibles = [];
            codes.forEach(code => {
              const reg = getRegime(data, code);
              const cot = apexCot[CFTC_MAP[code]];
              if (!reg || !cot) return;
              if (FORTS_MACRO.includes(reg.label) && cot.chgNet > 0) {
                fortes.push({ code, reg, cot, score: ranked.find(r=>r.code===code)?.score||0 });
              }
              if (FAIBLES_MACRO.includes(reg.label) && cot.chgNet < 0) {
                faibles.push({ code, reg, cot, score: ranked.find(r=>r.code===code)?.score||0 });
              }
            });
            // Generer toutes les paires FORTE x FAIBLE
            const opps = [];
            const PAIR_ORDER_LIST = ["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY"];
            fortes.forEach(f => {
              faibles.forEach(w => {
                // Ordre forex standard
                const iF = PAIR_ORDER_LIST.indexOf(f.code);
                const iW = PAIR_ORDER_LIST.indexOf(w.code);
                const base = iF < iW ? f.code : w.code;
                const quote = iF < iW ? w.code : f.code;
                const direction = base === f.code ? "LONG" : "SHORT";
                const scoreCombined = Math.abs(f.cot.chgNet) + Math.abs(w.cot.chgNet);
                // NINO PUR: colonnes opposees + |chgNet| >= 3000 sur LES DEUX devises
                const fIsFort = (f.cot.chgLong > 0 && f.cot.chgShort < 0) || (f.cot.chgLong < 0 && f.cot.chgShort > 0);
                const wIsFort = (w.cot.chgLong > 0 && w.cot.chgShort < 0) || (w.cot.chgLong < 0 && w.cot.chgShort > 0);
                const ninoPur = fIsFort && wIsFort && Math.abs(f.cot.chgNet) >= 3000 && Math.abs(w.cot.chgNet) >= 3000;
                // Vérifier RETAIL: clé avec ou sans slash
                const pairKey = base + quote;
                const pairKeySlash = base + "/" + quote;
                const retailData = apexRetail[pairKey] || apexRetail[pairKeySlash];
                let retailOk = false, retailPct = null, retailBias = null;
                if (retailData) {
                  const lp = retailData.longPercentage, sp = retailData.shortPercentage;
                  // direction=LONG → retail doit être 70%+ SHORT (contrarian) → on achète
                  // direction=SHORT → retail doit être 70%+ LONG (contrarian) → on vend
                  if (direction === "LONG" && sp >= 70) { retailOk = true; retailPct = sp; retailBias = "SHORT"; }
                  if (direction === "SHORT" && lp >= 70) { retailOk = true; retailPct = lp; retailBias = "LONG"; }
                  if (!retailOk) {
                    retailPct = lp >= sp ? lp : sp;
                    retailBias = lp >= sp ? "LONG" : "SHORT";
                  }
                }
                opps.push({ base, quote, direction, forte:f, faible:w, scoreCombined, retailOk, retailPct, retailBias, retailData, ninoPur });
              });
            });
            opps.sort((a,b) => b.scoreCombined - a.scoreCombined);
            // APEX 3/3 strict: ne garder que les setups ou le retail est contrarian confirme (70%+ du cote oppose)
const retailLoaded = opps.some(o => o.retailData);
            const top = retailLoaded ? opps.filter(o => o.retailOk).slice(0,10) : opps.slice(0,10);
            const retailMissing = !retailLoaded;
            if (top.length === 0) return null;
            return (
              <div style={{marginTop:16, padding:"12px 0"}}>
                <div style={{fontSize:9, color:"#38bdf8", letterSpacing:2, marginBottom:4, fontWeight:700}}>🎯 MEILLEURES OPPORTUNITÉS</div>
                <div style={{fontSize:8, color:"#475569", marginBottom:10}}>Macro divergente + Leveraged Funds alignés · Score = |chgNet| combiné</div>
                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:8}}>
                  {top.map((o,i) => {
                    const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;
                    const isLong = o.direction === "LONG";
                    const apexStyle = o.ninoPur ? {
                      background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%)",
                      border: "2px solid #a855f7",
                      borderLeft: "5px solid #c084fc",
                      boxShadow: "0 0 18px rgba(168,85,247,0.5), 0 0 30px rgba(168,85,247,0.25)"
                    } : o.retailOk ? {
                      background: isLong ? "linear-gradient(135deg, #001a0d 0%, #003319 100%)" : "linear-gradient(135deg, #1a0000 0%, #330000 100%)",
                      border: isLong ? "2px solid #00ff88" : "2px solid #ff3b3b",
                      borderLeft: isLong ? "5px solid #00ff88" : "5px solid #ff3b3b",
                      boxShadow: isLong ? "0 0 12px rgba(0,255,136,0.3)" : "0 0 12px rgba(255,59,59,0.3)"
                    } : {
                      background: BG2,
                      border: `1px solid ${o.direction==="LONG"?"#4ade8033":"#f8717133"}`,
                      borderLeft: `3px solid ${o.direction==="LONG"?"#4ade80":"#f87171"}`
                    };
                    return (
                      <div key={o.base+o.quote} style={{...apexStyle, borderRadius:6, padding:"10px 12px"}}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
                          <span style={{fontSize:12, fontWeight:700, color:TEXT}}>
                            <span style={{marginRight:6, fontSize:11}}>{medal}</span>
                            <FlagImg code={o.base} size={14} /> {o.base}/{o.quote} <FlagImg code={o.quote} size={14} />
                          </span>
                          <span style={{display:"flex", gap:6, alignItems:"center"}}>
                            {o.ninoPur && (
                              <span style={{fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:3, background:"#a855f7", color:"#fff", letterSpacing:0.5, boxShadow:"0 0 8px rgba(168,85,247,0.6)"}}>
                                👑 NINO PUR
                              </span>
                            )}
                            {o.retailOk && (
                              <span style={{fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:3, background:o.direction==="LONG"?"#00ff88":"#ff3b3b", color:o.direction==="LONG"?"#001a0d":"#1a0000", letterSpacing:0.5}}>
                                🎯 APEX 3/3
                              </span>
                            )}
                            <span style={{fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:3, background:o.direction==="LONG"?"#14532d":"#7f1d1d", color:o.direction==="LONG"?"#4ade80":"#f87171"}}>
                              {o.direction==="LONG"?"▲ LONG":"▼ SHORT"}
                            </span>
                          </span>
                        </div>
                        <div style={{fontSize:8, color:TEXT_DIM, marginBottom:3}}>
                          <span style={{color:"#a78bfa"}}>MACRO:</span>{" "}
                          {(() => {
                            // Afficher dans l'ordre de la paire : base d'abord, quote ensuite
                            const baseSide = o.forte.code === o.base ? o.forte : o.faible;
                            const quoteSide = o.forte.code === o.quote ? o.forte : o.faible;
                            return (<>
                              <span style={{color:baseSide.reg.color}}>{baseSide.reg.icon} {baseSide.reg.label} ({baseSide.score>=0?"+":""}{baseSide.score.toFixed(2)})</span>
                              <span style={{color:"#475569"}}> vs </span>
                              <span style={{color:quoteSide.reg.color}}>{quoteSide.reg.icon} {quoteSide.reg.label} ({quoteSide.score>=0?"+":""}{quoteSide.score.toFixed(2)})</span>
                            </>);
                          })()}
                        </div>
                        <div style={{fontSize:8, color:TEXT_DIM, marginBottom:4}}>
                          <span style={{color:"#4ade80"}}>Leveraged Funds:</span>{" "}
                          {(() => {
                            const baseSide = o.forte.code === o.base ? o.forte : o.faible;
                            const quoteSide = o.forte.code === o.quote ? o.forte : o.faible;
                            const dot = s => s.cot.chgNet > 0 ? "🟢" : "🔴";
                            const col = s => s.cot.chgNet > 0 ? "#4ade80" : "#f87171";
                            const sign = s => s.cot.chgNet >= 0 ? "+" : "";
                            return (<>
                              <span style={{color:col(baseSide), fontWeight:700}}>{dot(baseSide)} {baseSide.code} {sign(baseSide)}{baseSide.cot.chgNet.toLocaleString()}{baseSide.cot.switchType?"🔥":""}</span>
                              <span style={{color:"#475569"}}> vs </span>
                              <span style={{color:col(quoteSide), fontWeight:700}}>{dot(quoteSide)} {quoteSide.code} {sign(quoteSide)}{quoteSide.cot.chgNet.toLocaleString()}{quoteSide.cot.switchType?"🔥":""}</span>
                            </>);
                          })()}
                        </div>
                        {o.retailData && (
                          <div style={{fontSize:8, marginBottom:4}}>
                            {o.retailOk ? (
                              <span style={{color:"#00ff88"}}>✅ RETAIL: {o.retailPct}% {o.retailBias} → contrarian {o.direction} aligné</span>
                            ) : (
                              <span style={{color:"#fbbf24"}}>⚠ RETAIL: {o.retailPct}% {o.retailBias} → sous 70%, pas confirmé</span>
                            )}
                          </div>
                        )}
                        <div style={{fontSize:8, color:"#64748b", borderTop:"1px solid #1e3a5f", paddingTop:4, marginTop:4}}>
                          Score combiné: <span style={{color:"#38bdf8", fontWeight:700}}>{o.scoreCombined.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* EXPLICATION DE LA LOGIQUE */}
                <div style={{marginTop:12, padding:"10px 12px", background:"#0a1628", border:"1px solid #1e3a5f44", borderRadius:6}}>
                  <div style={{fontSize:9, color:"#38bdf8", fontWeight:700, letterSpacing:1, marginBottom:8}}>💡 COMMENT LIRE CE TABLEAU</div>
                  <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.7}}>
                    Ce tableau combine <b style={{color:"#a78bfa"}}>3 forces</b> pour identifier les meilleurs setups :<br/>
                    <b style={{color:"#4ade80"}}>1. MACRO divergente</b> — une devise <b>forte</b> (SURCHAUFFE/GOLDILOCKS) contre une <b>faible</b> (RECESSION/STAGFLATION). Les BCs vont dans des directions opposées.<br/>
                    <b style={{color:"#4ade80"}}>2. LEVERAGED FUNDS alignés</b> — les institutionnels <b>achètent</b> la forte (chgNet positif) et <b>vendent</b> la faible (chgNet négatif). 🔥 = switch cette semaine.<br/>
                    <b style={{color:"#f97316"}}>3. RETAIL contrarian</b> — 70%+ des traders particuliers sont du mauvais côté. On prend la position OPPOSÉE.<br/>
                    <b style={{color:"#fbbf24"}}>Score combiné</b> = |chgNet forte| + |chgNet faible|. Plus le score est élevé, plus le mouvement institutionnel est massif → meilleure probabilité.
                  </div>
                  <div style={{marginTop:8, padding:"8px 10px", background:"#001a2e", borderRadius:4, fontSize:8, color:TEXT, border:"1px solid #38bdf844", lineHeight:1.7}}>
                    <b style={{color:"#38bdf8"}}>🔄 EXEMPLE — POURQUOI LE RETAIL OPPOSÉ EST UN BON SIGNAL</b><br/>
                    <span style={{color:TEXT_DIM}}>Cas d'un SHORT où le retail est 75% LONG (opposé à toi) :</span><br/><br/>
                    Les fonds veulent <b style={{color:"#f87171"}}>vendre</b> la paire (des milliards)<br/>
                    <span style={{color:"#475569"}}>↓</span><br/>
                    Il leur faut des <b>acheteurs en face</b> pour absorber leurs ventes<br/>
                    <span style={{color:"#475569"}}>↓</span><br/>
                    Le <b style={{color:"#fbbf24"}}>retail 75% long</b> = ces acheteurs (ils achètent la paire)<br/>
                    <span style={{color:"#475569"}}>↓</span><br/>
                    Les fonds <b>vendent DANS cette demande retail</b><br/>
                    <span style={{color:"#475569"}}>↓</span><br/>
                    Une fois tous les retail acheteurs entrés → <b>plus personne pour pousser le prix en haut</b><br/>
                    <span style={{color:"#475569"}}>↓</span><br/>
                    La paire <b style={{color:"#f87171"}}>chute</b> → les retail longs se font piéger → leur panique (ils coupent leurs longs = vendent) <b>alimente encore la baisse</b><br/><br/>
                    <b style={{color:"#fbbf24"}}>👉 Le retail opposé n'est pas un contre-argument — c'est le CARBURANT du trade.</b> Tu veux toujours la foule du côté opposé au tien.
                  </div>
                  <div style={{marginTop:8, padding:"6px 8px", background:"#001a0d", borderRadius:3, fontSize:8, color:"#4ade80"}}>
                    🎯 <b>APEX 3/3</b> = les paires en surbrillance passent les 3 filtres. <span style={{color:"#00ff88"}}>Vert = LONG</span> · <span style={{color:"#ff3b3b"}}>Rouge = SHORT</span>. Setups haute probabilité.
                  </div>
                  <div style={{marginTop:6, padding:"6px 8px", background:"#1a0a2e", borderRadius:3, fontSize:8, color:"#c084fc", border:"1px solid #a855f744"}}>
                    👑 <b>NINO PUR</b> (violet royal) = signature de la méthode Nino. Les Leveraged Funds <b>réduisent leurs longs ET ajoutent des shorts</b> en même temps (ou inverse). Les 2 colonnes du rapport CFTC vont en <b>directions opposées</b> = vrai signal directionnel propre, pas un repositionnement ambigu. Signal le plus puissant.
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========== BIAIS MACRO (devises fortes/faibles) — copié de ANALYSE ========== */}
          {(()=>{
            const fortes=ranked.filter(r=>r.score>=0.2);
            const faibles=ranked.filter(r=>r.score<=-0.2);
            return(
              <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 14px",marginTop:16,marginBottom:12}}>
                <div style={{fontSize:11,color:"#a78bfa",fontWeight:700,marginBottom:8,letterSpacing:1}}>🌍 BIAIS MACRO</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:8,color:"#4ade80",fontWeight:700,marginBottom:6}}>🟢 DEVISES FORTES</div>
                    {fortes.map(r=>{const reg=getRegime(data,r.code);return<div key={r.code} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,padding:"4px 8px",background:"#052010",borderRadius:4,border:"1px solid #4ade8022"}}><span style={{fontSize:10,color:"#c8d4f0",fontWeight:700}}><FlagImg code={r.code} size={14}/> {r.code}</span><span style={{fontSize:9}}><span style={{color:reg?reg.color:"#888"}}>{reg?reg.icon+" "+reg.label:""}</span> <span style={{color:"#4ade80"}}>{r.score>=0?"+":""}{r.score.toFixed(2)}</span></span></div>;})}
                  </div>
                  <div>
                    <div style={{fontSize:8,color:"#f87171",fontWeight:700,marginBottom:6}}>🔴 DEVISES FAIBLES</div>
                    {faibles.map(r=>{const reg=getRegime(data,r.code);return<div key={r.code} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,padding:"4px 8px",background:"#1a0505",borderRadius:4,border:"1px solid #f8717122"}}><span style={{fontSize:10,color:"#c8d4f0",fontWeight:700}}><FlagImg code={r.code} size={14}/> {r.code}</span><span style={{fontSize:9}}><span style={{color:reg?reg.color:"#888"}}>{reg?reg.icon+" "+reg.label:""}</span> <span style={{color:"#f87171"}}>{r.score>=0?"+":""}{r.score.toFixed(2)}</span></span></div>;})}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========== BIAIS LEVERAGED FUNDS (panneau live) ========== */}
          {(() => {
            const CFTC_MAP = {EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
            const buys = [], sells = [];
            Object.entries(CFTC_MAP).forEach(([code, id]) => {
              const cot = apexCot[id];
              if (!cot || cot.chgNet === undefined) return;
              if (cot.chgNet > 0) buys.push({ code, chgNet: cot.chgNet, sw: cot.switchType });
              else if (cot.chgNet < 0) sells.push({ code, chgNet: cot.chgNet, sw: cot.switchType });
            });
            buys.sort((a,b) => b.chgNet - a.chgNet);
            sells.sort((a,b) => a.chgNet - b.chgNet);
            if (buys.length === 0 && sells.length === 0) return null;
            // Date du dernier rapport CFTC + fraîcheur
            const cftcDate = Object.values(apexCot).find(x=>x?.date)?.date;
            let freshLabel = null, freshColor = "#475569";
            if (cftcDate) {
              const days = Math.floor((new Date() - new Date(cftcDate)) / (1000*60*60*24));
              freshColor = days <= 7 ? "#4ade80" : days <= 10 ? "#fbbf24" : "#f87171";
              freshLabel = `${cftcDate} (${days}j — ${days<=7?"frais ✓":days<=10?"à surveiller":"périmé ⚠"})`;
            }
            return (
              <div style={{ marginTop:24, padding:14, background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                  <span style={{ fontSize:11, color:"#4ade80", fontWeight:700, letterSpacing:2 }}>📊 BIAIS LEVERAGED FUNDS</span>
                  {freshLabel && <span style={{ fontSize:8, color:freshColor }}>📅 CFTC: {freshLabel}</span>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <div style={{ fontSize:10, color:"#4ade80", fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>🟢 ACHÈTENT</div>
                    {buys.map(b => (
                      <div key={b.code} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", marginBottom:4, background:"#001a0d", border:"1px solid #4ade8033", borderRadius:4 }}>
                        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:TEXT }}><FlagImg code={b.code} size={16} /> {b.code}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:"#4ade80" }}>+{b.chgNet.toLocaleString()} {b.sw?"🔥":""}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:"#f87171", fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>🔴 VENDENT</div>
                    {sells.map(s => (
                      <div key={s.code} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", marginBottom:4, background:"#1a0000", border:"1px solid #f8717133", borderRadius:4 }}>
                        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:TEXT }}><FlagImg code={s.code} size={16} /> {s.code}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:"#f87171" }}>{s.chgNet.toLocaleString()} {s.sw?"🔥":""}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize:8, color:"#475569", marginTop:10, fontStyle:"italic" }}>🔥 = switch cette semaine (renversement institutionnel majeur)</div>
              </div>
            );
          })()}

          {/* ========== LEVERAGED FUNDS — QUI SONT-ILS ? ========== */}
          <div style={{marginTop:24, padding:"14px", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8}}>
            <div style={{fontSize:12, color:"#f59e0b", fontWeight:700, letterSpacing:1, marginBottom:10}}>💼 LEVERAGED FUNDS — QUI SONT-ILS ?</div>
            <div style={{fontSize:10, color:TEXT, lineHeight:1.7, marginBottom:12}}>
              Hedge funds, CTAs, fonds spéculatifs à effet de levier. Ils tradent avec un horizon <b>swing/court terme</b> — le même que nous. Contrairement aux banques centrales (hedgers) ou aux Asset Managers (long terme), leurs mouvements reflètent la <b>spéculation pure</b> sur les données macro de la semaine.
            </div>
            <div style={{fontSize:11, color:"#4ade80", fontWeight:700, marginBottom:6}}>🎯 POURQUOI LES SUIVRE ?</div>
            <div style={{fontSize:10, color:TEXT_DIM, lineHeight:1.7, marginBottom:12}}>
              • <b>Même horizon</b> que swing trader (1-4 semaines)<br/>
              • Ajustent positions <b>chaque semaine</b> selon CPI, PMI, taux directeurs<br/>
              • <b>Action concrète</b> (pas paroles) — ils risquent leur argent réel<br/>
              • Signal <b>frais hebdomadaire</b> — rapport CFTC publié chaque vendredi
            </div>
            <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:6}}>📊 COMMENT ILS TRADENT ?</div>
            <div style={{fontSize:10, color:TEXT_DIM, lineHeight:1.7, marginBottom:12}}>
              • Analysent CPI, Core Inflation, PMI Services, Unemployment<br/>
              • Anticipent décisions banques centrales (hausse/baisse taux)<br/>
              • Ajustent positions Long/Short chaque mardi (snapshot CFTC)<br/>
              • Bougent les prix par leurs flux massifs sur futures
            </div>
            <div style={{fontSize:11, color:"#a78bfa", fontWeight:700, marginBottom:6}}>⚡ NOTRE STRATÉGIE</div>
            <div style={{fontSize:10, color:TEXT_DIM, lineHeight:1.7}}>
              <b>1.</b> On lit le changement hebdomadaire (chgLong / chgShort) — pas le total<br/>
              <b>2.</b> On compare la <b>force relative</b> entre 2 devises (Nino)<br/>
              <b>3.</b> Si une devise a un <span style={{ background:"#14532d", color:"#4ade80", padding:"1px 6px", borderRadius:3, fontSize:9 }}>🔥 SWITCH</span> = les Leveraged Funds ont <b>renversé leur direction</b> cette semaine (ex: étaient short, deviennent long fort). C'est le signal le plus puissant selon Nino — un retournement institutionnel majeur<br/>
              <b>4.</b> Retail contrarian 70%+ aligné = validation finale
            </div>
            <div style={{fontSize:11, color:"#f97316", fontWeight:700, marginTop:14, marginBottom:6}}>👥 POURQUOI LES LEVERAGED FUNDS PRENNENT LE CONTRAIRE DU RETAIL ?</div>
            <div style={{fontSize:10, color:TEXT_DIM, lineHeight:1.7}}>
              Ce n'est pas par principe — c'est une <b>nécessité mécanique</b> :<br/>
              • Pour <b>vendre des milliards</b>, il faut des acheteurs en face. Le retail qui achète au sommet (FOMO) fournit cette <b>liquidité</b><br/>
              • Pour <b>acheter des milliards</b>, il faut des vendeurs. Le retail qui panique au creux la fournit<br/>
              • Les Leveraged Funds ne peuvent entrer gros QUE là où la foule prend l'autre côté<br/><br/>
              <span style={{color:"#fbbf24"}}>Quand 70%+ du retail est LONG, la plupart ont déjà acheté → plus personne pour pousser le prix plus haut → les Leveraged Funds vendent dans cette liquidité et le prix chute.</span><br/><br/>
              <span style={{color:"#4ade80"}}>🎯 Retail massivement LONG → Leveraged Funds VENDENT → on VEND avec eux</span><br/>
              <span style={{color:"#4ade80"}}>🎯 Retail massivement SHORT → Leveraged Funds ACHÈTENT → on ACHÈTE avec eux</span>
            </div>
          </div>

          {/* ========== LES 4 RÉGIMES (aide-mémoire) ========== */}
          <div style={{marginTop:24, padding:"14px", background:"#0a1628", border:"1px solid #a855f744", borderRadius:8}}>
            <div style={{fontSize:11, color:"#a855f7", fontWeight:700, letterSpacing:2, marginBottom:4}}>🎯 LES 4 RÉGIMES — AIDE-MÉMOIRE</div>
            <div style={{fontSize:8, color:"#475569", marginBottom:12}}>Comment lire le tableau et identifier un régime soi-même</div>
            {[
              { label:"SURCHAUFFE", icon:"▲", color:"#ffd700", bg:"#1a1500",
                inflation:"↑ PLUS HAUTE que prévu", inflColor:"#ffd700",
                pmi:"↑ MEILLEUR que prévu", pmiColor:"#ffd700",
                chomage:"↓ EN BAISSE", chColor:"#ffd700",
                logic:"Tout accélère en même temps. L'économie chauffe, l'inflation grimpe. La banque centrale DOIT monter les taux.",
                action:"ACHÈTE la devise — les capitaux affluent vers les hauts rendements.",
                devise:"FORTE ↑↑↑" },
              { label:"GOLDILOCKS", icon:"◆", color:"#00ff88", bg:"#001a0d",
                inflation:"→ STABLE ou plus basse", inflColor:"#66ffaa",
                pmi:"↑ MEILLEUR que prévu", pmiColor:"#00ff88",
                chomage:"→ STABLE ou en baisse", chColor:"#66ffaa",
                logic:"Scénario parfait : l'économie croît SANS faire grimper l'inflation. La BC est détendue, aucune pression.",
                action:"Capitaux affluent pour la stabilité. Meilleur environnement long terme.",
                devise:"FORTE STABLE ↑↑" },
              { label:"STAGFLATION", icon:"■", color:"#ff3b3b", bg:"#1a0000",
                inflation:"↑ PLUS HAUTE que prévu", inflColor:"#ff6666",
                pmi:"↓ PIRE que prévu", pmiColor:"#ff3b3b",
                chomage:"↑ EN HAUSSE", chColor:"#ff3b3b",
                logic:"Piège mortel : l'inflation monte MAIS l'économie ralentit. La BC est COINCÉE — monter tue l'économie, baisser nourrit l'inflation. Aucune issue.",
                action:"FUIS la devise — pire scénario possible.",
                devise:"FAIBLE ↓↓" },
              { label:"RECESSION", icon:"▼", color:"#ff7a00", bg:"#1a0800",
                inflation:"→ STABLE ou plus basse", inflColor:"#ffaa66",
                pmi:"↓ PIRE que prévu", pmiColor:"#ff7a00",
                chomage:"↑ EN HAUSSE", chColor:"#ff7a00",
                logic:"L'économie se contracte ET l'inflation cède. La BC a de la marge : elle PEUT baisser les taux pour relancer.",
                action:"VENDS la devise — capitaux fuient les bas rendements.",
                devise:"FAIBLE ↓↓↓" },
            ].map(R=>(
              <div key={R.label} style={{ marginBottom:8, padding:12, background:R.bg, borderRadius:4, border:`1px solid ${R.color}44`, borderLeft:`4px solid ${R.color}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, borderBottom:`1px solid ${R.color}33`, paddingBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:R.color }}>{R.icon} {R.label}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:R.color }}>DEVISE {R.devise}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"3px 10px", fontSize:9, marginBottom:8 }}>
                  <span style={{ color:TEXT_DIM }}>Inflation :</span>
                  <span style={{ color:R.inflColor, fontWeight:700 }}>{R.inflation}</span>
                  <span style={{ color:TEXT_DIM }}>PMI :</span>
                  <span style={{ color:R.pmiColor, fontWeight:700 }}>{R.pmi}</span>
                  <span style={{ color:TEXT_DIM }}>Chômage :</span>
                  <span style={{ color:R.chColor, fontWeight:700 }}>{R.chomage}</span>
                </div>
                <div style={{ fontSize:9, color:TEXT_DIM, lineHeight:1.6, marginBottom:6, paddingTop:6, borderTop:`1px solid ${R.color}22` }}>
                  <span style={{ color:"#fbbf24" }}>💡 </span>{R.logic}
                </div>
                <div style={{ fontSize:10, color:R.color, fontWeight:700, lineHeight:1.5 }}>
                  🎯 {R.action}
                </div>
              </div>
            ))}
          </div>

          {/* ========== STRATEGIE TECHNIQUE — GOLDEN POCKET ========== */}
          <div style={{marginTop:24, padding:"14px 14px 16px", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8}}>
            <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, letterSpacing:2, marginBottom:4}}>📈 STRATÉGIE TECHNIQUE — ENTRER AVEC LES LEVERAGED FUNDS</div>
            <div style={{fontSize:9, color:"#475569", marginBottom:14}}>Le tableau donne la DIRECTION · le Golden Pocket Fibonacci donne le PRIX D'ENTRÉE · Timeframe H4</div>

            <div style={{fontSize:9, color:TEXT, lineHeight:1.8, marginBottom:14, padding:"12px 14px", background:"#001a2e", borderRadius:4, borderLeft:"3px solid #38bdf8"}}>
              <b style={{color:"#38bdf8"}}>🎯 PENSE COMME UN LEVERAGED FUND</b><br/><br/>
              Imagine que tu gères <b>2 milliards de dollars</b> et que tu veux acheter une devise. Tu ne peux pas tout acheter d'un coup — le marché monterait contre toi. Et surtout : <b>tu ne veux pas payer le prix fort.</b><br/><br/>
              Comme un grossiste, tu attends que le prix <b>redescende en solde</b> avant de charger. Ce niveau d'escompte, sur un graphique, c'est le <b style={{color:"#c084fc"}}>Golden Pocket : la zone 61.8%–65%</b> du dernier mouvement (retracement de Fibonacci).<br/><br/>
              Quand le prix recule jusque-là, les fonds <b>accumulent</b> : ils achètent par paquets à chaque retour dans la zone. Tu vois leur empreinte par <b>les rejets répétés + le volume qui monte</b>. Tu entres AU MÊME PRIX qu'eux, dans la zone d'escompte, AVEC eux.
            </div>
            <div style={{marginBottom:14, padding:"12px 14px", background:"#0a2540", borderRadius:6, border:"1px solid #38bdf855"}}>
              <div style={{fontSize:10, color:"#38bdf8", fontWeight:700, marginBottom:8}}>🔗 LE LIEN COT ↔ GOLDEN POCKET</div>
              <div style={{fontSize:9, color:TEXT, lineHeight:1.7}}>
                Le tableau (COT) te dit que les Leveraged Funds <b>achètent ou vendent</b> une devise cette semaine — mais <b>pas à quel prix.</b><br/><br/>
                Le Golden Pocket te donne ce prix manquant. Quand un fonds accumule des milliards, il le fait sur un <b>repli</b> (l'escompte), jamais au sommet. Statistiquement, ce repli s'arrête dans la zone <b style={{color:"#c084fc"}}>61.8%–65%</b> — c'est là que l'accumulation institutionnelle se concentre.<br/><br/>
                👉 <b style={{color:"#38bdf8"}}>Le COT prouve QU'ILS achètent · le Golden Pocket te montre OÙ ils achètent.</b> Les deux ensemble = tu sais quelle paire trader ET à quel prix entrer avec eux.
              </div>
            </div>

            <div style={{marginBottom:14, padding:"12px", background:"#001a0d", borderRadius:6, border:"1px solid #4ade8044"}}>
              <div style={{fontSize:10, color:"#4ade80", fontWeight:700, marginBottom:10}}>▲ ACHAT — ACCUMULATION AU GOLDEN POCKET</div>
              <svg viewBox="0 0 320 180" style={{width:"100%", maxWidth:340, display:"block", margin:"0 auto 12px"}}>
                {/* Niveaux Fibonacci */}
                <line x1="40" y1="25" x2="300" y2="25" stroke="#555" strokeWidth="0.8" strokeDasharray="3,3"/>
                <text x="2" y="28" fill="#888" fontSize="8" fontFamily="monospace">100%</text>
                <line x1="40" y1="70" x2="300" y2="70" stroke="#888" strokeWidth="0.8" strokeDasharray="3,3"/>
                <text x="6" y="73" fill="#aaa" fontSize="8" fontFamily="monospace">50%</text>
                {/* GOLDEN POCKET */}
                <rect x="40" y="95" width="260" height="20" fill="#a855f733" stroke="#a855f7" strokeWidth="1.2"/>
                <text x="44" y="91" fill="#c084fc" fontSize="8" fontFamily="monospace" fontWeight="700">GOLDEN POCKET 61.8-65%</text>
                <line x1="40" y1="140" x2="300" y2="140" stroke="#ff6666" strokeWidth="0.8" strokeDasharray="3,3"/>
                <text x="2" y="143" fill="#ff6666" fontSize="8" fontFamily="monospace">78.6%</text>
                {/* Courbe de prix: impulsion montante puis repli vers le pocket avec rejets */}
                <polyline points="45,140 70,95 90,55 110,30 130,55 145,100 155,108 165,98 178,107 188,100 205,60 230,35 260,20" fill="none" stroke="#4ade80" strokeWidth="2"/>
                {/* Fleches de rejet dans le pocket */}
                <text x="138" y="128" fill="#4ade80" fontSize="9">↑</text>
                <text x="171" y="128" fill="#4ade80" fontSize="9">↑</text>
                <text x="120" y="170" fill="#4ade80" fontSize="7" fontFamily="monospace">2-3 rejets = accumulation</text>
                {/* Point entree */}
                <circle cx="188" cy="100" r="4" fill="#00ff88"/>
                <text x="196" y="103" fill="#00ff88" fontSize="8" fontFamily="monospace" fontWeight="700">ENTRÉE</text>
              </svg>
              <div style={{display:"flex", flexDirection:"column", gap:7}}>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#4ade80", fontWeight:700, fontSize:11, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Le tableau dit <b style={{color:"#4ade80"}}>Leveraged Funds ACHÈTENT</b> (chgNet positif) → biais <b>LONG</b></span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#4ade80", fontWeight:700, fontSize:11, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Sur H4, trouve la dernière <b>impulsion haussière</b> (gros mouvement vert) et trace le <b>Fibonacci du bas vers le haut</b></span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#4ade80", fontWeight:700, fontSize:11, minWidth:16}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Attends que le prix <b>recule dans le</b> <b style={{color:"#c084fc"}}>GOLDEN POCKET (61.8%–65%)</b> = la zone d'escompte où les fonds rachètent</span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#4ade80", fontWeight:700, fontSize:11, minWidth:16}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Guette <b>2-3 touches</b> de la zone avec <b>mèches basses de rejet</b> + <b style={{color:"#fbbf24"}}>volume qui monte</b> à chaque touche = ils accumulent</span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#4ade80", fontWeight:700, fontSize:11, minWidth:16}}>⑤</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#00ff88"}}>ENTRÉE LONG</b> quand les rejets tiennent · <b>stop sous le 78.6%</b> · target = extension <b>1.618</b></span></div>
              </div>
            </div>

            <div style={{marginBottom:14, padding:"12px", background:"#1a0000", borderRadius:6, border:"1px solid #f8717144"}}>
              <div style={{fontSize:10, color:"#f87171", fontWeight:700, marginBottom:10}}>▼ VENTE — DISTRIBUTION AU GOLDEN POCKET</div>
              <svg viewBox="0 0 320 180" style={{width:"100%", maxWidth:340, display:"block", margin:"0 auto 12px"}}>
                {/* Niveaux Fibonacci (inverses) */}
                <line x1="40" y1="40" x2="300" y2="40" stroke="#ff6666" strokeWidth="0.8" strokeDasharray="3,3"/>
                <text x="2" y="43" fill="#ff6666" fontSize="8" fontFamily="monospace">78.6%</text>
                {/* GOLDEN POCKET en haut */}
                <rect x="40" y="60" width="260" height="20" fill="#a855f733" stroke="#a855f7" strokeWidth="1.2"/>
                <text x="44" y="56" fill="#c084fc" fontSize="8" fontFamily="monospace" fontWeight="700">GOLDEN POCKET 61.8-65%</text>
                <line x1="40" y1="105" x2="300" y2="105" stroke="#888" strokeWidth="0.8" strokeDasharray="3,3"/>
                <text x="6" y="108" fill="#aaa" fontSize="8" fontFamily="monospace">50%</text>
                <line x1="40" y1="150" x2="300" y2="150" stroke="#555" strokeWidth="0.8" strokeDasharray="3,3"/>
                <text x="2" y="153" fill="#888" fontSize="8" fontFamily="monospace">100%</text>
                {/* Courbe: impulsion descendante puis remontee vers le pocket avec rejets */}
                <polyline points="45,35 70,80 90,120 110,145 130,120 145,72 155,64 165,74 178,65 188,72 205,115 230,140 260,160" fill="none" stroke="#f87171" strokeWidth="2"/>
                {/* Fleches de rejet dans le pocket */}
                <text x="138" y="52" fill="#f87171" fontSize="9">↓</text>
                <text x="171" y="52" fill="#f87171" fontSize="9">↓</text>
                <text x="120" y="20" fill="#f87171" fontSize="7" fontFamily="monospace">2-3 rejets = accumulation short</text>
                {/* Point entree */}
                <circle cx="188" cy="72" r="4" fill="#ff3b3b"/>
                <text x="196" y="75" fill="#ff3b3b" fontSize="8" fontFamily="monospace" fontWeight="700">ENTRÉE</text>
              </svg>
              <div style={{display:"flex", flexDirection:"column", gap:7}}>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#f87171", fontWeight:700, fontSize:11, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Le tableau dit <b style={{color:"#f87171"}}>Leveraged Funds VENDENT</b> (chgNet négatif) → biais <b>SHORT</b></span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#f87171", fontWeight:700, fontSize:11, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Sur H4, trouve la dernière <b>impulsion baissière</b> (gros mouvement rouge) et trace le <b>Fibonacci du haut vers le bas</b></span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#f87171", fontWeight:700, fontSize:11, minWidth:16}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Attends que le prix <b>remonte dans le</b> <b style={{color:"#c084fc"}}>GOLDEN POCKET (61.8%–65%)</b> = la zone chère où les fonds revendent</span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#f87171", fontWeight:700, fontSize:11, minWidth:16}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}>Guette <b>2-3 touches</b> de la zone avec <b>mèches hautes de rejet</b> + <b style={{color:"#fbbf24"}}>volume qui monte</b> à chaque touche = ils accumulent leur short</span></div>
                <div style={{display:"flex", gap:8, alignItems:"flex-start"}}><span style={{color:"#f87171", fontWeight:700, fontSize:11, minWidth:16}}>⑤</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#ff3b3b"}}>ENTRÉE SHORT</b> quand les rejets tiennent · <b>stop au-dessus du 78.6%</b> · target = extension <b>1.618</b></span></div>
              </div>
            </div>

            <div style={{marginBottom:14, padding:"12px 14px", background:"#1a1500", borderRadius:6, border:"1px solid #fbbf2444"}}>
              <div style={{fontSize:10, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🔍 COMMENT VOIR L'ACCUMULATION (leur empreinte)</div>
              <div style={{fontSize:9, color:TEXT, lineHeight:1.7}}>
                Un seul passage dans le Golden Pocket = peut-être du hasard. Ce qui prouve que les fonds sont là :<br/>
                • <b style={{color:"#fbbf24"}}>Touches répétées</b> : le prix revient 2-3 fois sur la zone sans la casser<br/>
                • <b style={{color:"#fbbf24"}}>Mèches de rejet</b> à chaque touche (le prix entre puis repart vite)<br/>
                • <b style={{color:"#fbbf24"}}>Volume croissant</b> à chaque retour (Volume Profile) = les institutions qui chargent, pas du bruit retail<br/>
                <span style={{color:TEXT_DIM}}>Plus il y a de rejets qui tiennent avec du volume, plus l'accumulation est réelle.</span>
              </div>
            </div>

            <div style={{padding:"10px 12px", background:"#1a0a2e", borderRadius:4, border:"1px solid #a855f744", fontSize:9, color:"#c084fc", lineHeight:1.7}}>
              <b style={{color:"#a855f7"}}>💡 POURQUOI ÇA MARCHE</b><br/>
              <span style={{color:TEXT_DIM}}>Les Leveraged Funds ne chassent jamais le prix — ils attendent un <b style={{color:"#c084fc"}}>escompte</b>. Le Golden Pocket (61.8%–65%) est ce niveau d'escompte où ils accumulent par paquets. Le retail panique et vend ses positions exactement là, fournissant la liquidité. Tu te places <b style={{color:"#fbbf24"}}>dans la zone d'escompte, avec les fonds, contre la foule.</b></span>
            </div>
            <div style={{marginBottom:14, padding:"12px 14px", background:"#1a0a2e", borderRadius:6, border:"1px solid #a855f755"}}>
              <div style={{fontSize:10, color:"#c084fc", fontWeight:700, marginBottom:8}}>🧠 LA PSYCHOLOGIE — POURQUOI LE PRIX REVIENT & CHASSE LES STOPS</div>
              <div style={{fontSize:9, color:TEXT, lineHeight:1.7}}>
                <b style={{color:"#c084fc"}}>Le problème des fonds :</b> pour acheter des milliards, il leur faut des vendeurs en face. S'ils achètent d'un coup, le prix monte contre eux. Ils ont besoin d'une <b>réserve de liquidité</b> — et cette réserve, ce sont les ordres du retail.<br/><br/>
                <b style={{color:"#c084fc"}}>Où est la liquidité ?</b> Le retail place ses stops à des endroits ultra-prévisibles : sous les derniers creux, au-dessus des derniers sommets, aux niveaux ronds. Les fonds savent exactement où ces stops sont entassés.<br/><br/>
                <b style={{color:"#c084fc"}}>Pourquoi le prix revient dans la zone :</b> le prix ne bouge pas au hasard — il <b>se dirige vers la liquidité</b>. Il retourne vers le Golden Pocket / les creux parce que c'est là que dorment les ordres dont les fonds ont besoin pour remplir leur position.<br/><br/>
                <b style={{color:"#c084fc"}}>La chasse aux stops (liquidity grab) :</b> souvent le prix <b>perce légèrement</b> sous un creux (ou au-dessus d'un sommet) pour déclencher les stops du retail. Ces stops déclenchés = des ordres forcés = exactement la liquidité que les fonds prennent. Puis le prix <b>repart violemment</b> dans l'autre sens.<br/><br/>
                <b style={{color:"#fbbf24"}}>Ce que ça change pour toi :</b> ce que le retail appelle "fausse cassure" ou "malchance" est en fait le moment où les fonds chargent. Au lieu de te faire piéger, tu <b>attends ce balayage</b> : le pic + mèche de rejet + retour dans la zone = leur empreinte. Tu entres APRÈS le grab, avec eux, pas avant.
              </div>
            </div>

            <div style={{marginBottom:14, padding:"12px 14px", background:"#001a2e", borderRadius:6, border:"1px solid #38bdf855"}}>
              <div style={{fontSize:10, color:"#38bdf8", fontWeight:700, marginBottom:8}}>🎭 PENSER COMME EUX — LES 3 PHASES</div>
              <div style={{fontSize:9, color:TEXT, lineHeight:1.7}}>
                Le marché passe le plus clair de son temps en range, pas en tendance. Ces ranges suivent 3 phases :<br/><br/>
                <b style={{color:"#4ade80"}}>① ACCUMULATION</b> — le prix stagne. Le retail trouve le marché "faible" et vend. Les fonds utilisent cette vente pour bâtir leurs positions, tranquillement.<br/><br/>
                <b style={{color:"#fbbf24"}}>② MANIPULATION</b> — le prix casse le range et déclenche les stops (panique retail). Les fonds achètent dans cette liquidité. C'est le "stop hunt".<br/><br/>
                <b style={{color:"#38bdf8"}}>③ EXPANSION</b> — le prix repart franchement dans la vraie direction. Le retail piégé du mauvais côté alimente encore le mouvement.<br/><br/>
                <b style={{color:"#fbbf24"}}>La discipline clé :</b> ne jamais entrer en même temps que la foule (sur la cassure). Attendre le balayage, la confirmation, puis entrer dans le sens des fonds. Patience = tu n'es plus la liquidité, tu es avec ceux qui la prennent.
              </div>
            </div>

            <div style={{marginTop:8, padding:"8px 10px", background:"#001a0d", borderRadius:4, fontSize:8, color:"#4ade80", lineHeight:1.7}}>
              <b>⚠ RÈGLES & CONFIRMATION</b><br/>
              ✓ <b>H4</b> = timeframe des Leveraged Funds (jamais sous H1)<br/>
              ✓ Le prix doit d'abord dépasser le <b>50%</b> (filtre) avant d'entrer dans le Golden Pocket<br/>
              ✓ <b>NE PAS entrer au 1er contact</b> — attendre 2-3 rejets qui tiennent + volume croissant<br/>
              ✓ <b>Stop</b> juste au-delà du <b>78.6%</b> · target = extension <b>1.618</b> (R:R 2:1 min)<br/>
              ✗ <span style={{color:"#f87171"}}>Si le prix <b>CLÔTURE au-delà du 78.6%</b> = les fonds ont lâché → PAS de trade (invalidé)</span><br/>
              ✓ Confirmer avec <b>APEX 3/3</b> ou <b>NINO PUR</b> du tableau ci-dessus
            </div>
          </div>

        </div>
      )}

      {view==="rank" && (
        <div style={{ padding:16 }}>
          <div style={{ fontSize:9, color:TEXT_DIM, letterSpacing:2, marginBottom:6 }}>CLASSEMENT MACRO — FORT → FAIBLE</div>
          <div style={{ fontSize:8, color:"#475569", marginBottom:12, lineHeight:1.6 }}>
            <b>SCORE</b> = force macro globale (+1 très fort / -1 très faible) · <b>INF</b> = pression inflation vs attentes · <b>GROW</b> = croissance (PMI + emploi) vs attentes · Plus c'est élevé, plus la BC va monter les taux → devise forte
          </div>
          {ranked.map((c,i)=>{
            const reg=getRegime(data,c.code);
            const scoreColor = c.score >= 0.3?"#00ff88":c.score >= 0.1?"#66ffaa":c.score >= 0?"#aaffcc":c.score >= -0.1?"#ffaaaa":c.score >= -0.3?"#ff6666":"#cc2200";
            const st = {
              color: scoreColor,
              label: c.score >= 0.1 ? "FORT ↑" : c.score <= -0.1 ? "FAIBLE ↓" : "NEUTRE →",
              labelColor: c.score >= 0.1 ? "#00ff88" : c.score <= -0.1 ? "#cc2200" : "#888899"
            };
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

      {view==="analyse" && (
        <div style={{padding:12}}>
          {/* HEADER */}
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <div>
              <div style={{fontSize:11,letterSpacing:3,color:"#38bdf8",fontWeight:700}}>⚡ ANALYSE — OPPORTUNITÉS DE TRADING</div>
              <div style={{fontSize:8,color:"#475569",marginTop:2}}>Macro + Leveraged Funds + Retail · {Object.values(apexCot).find(d=>d?.date)?.date||"—"}</div>
            </div>
            {(()=>{const d=Object.values(apexCot).find(x=>x?.date)?.date;if(!d)return null;const days=Math.floor((new Date()-new Date(d))/(1000*60*60*24));const col=days<=7?"#4ade80":days<=10?"#fbbf24":"#f87171";return <div style={{fontSize:8,color:col}}>📅 CFTC: {d} ({days}j — {days<=7?"frais":days<=10?"à surveiller":"périmé"})</div>;})()}
          </div>

          {/* ÉTAPE 1 — BIAIS LEVERAGED FUNDS */}
          {(()=>{
            const CFTC_MAP={EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
            const biais=Object.entries(CFTC_MAP).map(([dev,code])=>{const d=apexCot[code];if(!d)return null;return{dev,chgNet:d.chgNet||0,switchType:d.switchType};}).filter(Boolean);
            const achetent=biais.filter(b=>b.chgNet>0).sort((a,b)=>b.chgNet-a.chgNet);
            const vendent=biais.filter(b=>b.chgNet<=0).sort((a,b)=>a.chgNet-b.chgNet);
            return(
              <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:10,color:"#4ade80",fontWeight:700,marginBottom:8,letterSpacing:1}}>📊 ÉTAPE 1 — BIAIS LEVERAGED FUNDS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:8,color:"#4ade80",fontWeight:700,marginBottom:6}}>🟢 ACHÈTENT</div>
                    {achetent.map(b=><div key={b.dev} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,padding:"4px 8px",background:"#052010",borderRadius:4,border:"1px solid #4ade8022"}}><span style={{fontSize:10,color:"#c8d4f0",fontWeight:700}}><FlagImg code={b.dev} size={14}/> {b.dev}</span><span style={{fontSize:9,color:"#4ade80"}}>+{b.chgNet.toLocaleString()}{b.switchType==="SWITCH_HAUSSIER"?" 🔥":""}</span></div>)}
                  </div>
                  <div>
                    <div style={{fontSize:8,color:"#f87171",fontWeight:700,marginBottom:6}}>🔴 VENDENT</div>
                    {vendent.map(b=><div key={b.dev} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,padding:"4px 8px",background:"#1a0505",borderRadius:4,border:"1px solid #f8717122"}}><span style={{fontSize:10,color:"#c8d4f0",fontWeight:700}}><FlagImg code={b.dev} size={14}/> {b.dev}</span><span style={{fontSize:9,color:"#f87171"}}>{b.chgNet.toLocaleString()}{b.switchType==="SWITCH_BAISSIER"?" 🔥":""}</span></div>)}
                  </div>
                </div>
                <div style={{fontSize:7,color:"#475569",marginTop:8,paddingTop:6,borderTop:"1px solid #1e3a5f"}}>🔥 = switch cette semaine (renversement institutionnel majeur)</div>
              </div>
            );
          })()}

          {/* ÉTAPE 2 — BIAIS MACRO */}
          {(()=>{
            const fortes=ranked.filter(r=>r.score>=0.2);
            const faibles=ranked.filter(r=>r.score<=-0.2);
            return(
              <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:10,color:"#a78bfa",fontWeight:700,marginBottom:8,letterSpacing:1}}>🌍 ÉTAPE 2 — BIAIS MACRO</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:8,color:"#4ade80",fontWeight:700,marginBottom:6}}>🟢 DEVISES FORTES</div>
                    {fortes.map(r=>{const reg=getRegime(data,r.code);return<div key={r.code} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,padding:"4px 8px",background:"#052010",borderRadius:4,border:"1px solid #4ade8022"}}><span style={{fontSize:10,color:"#c8d4f0",fontWeight:700}}><FlagImg code={r.code} size={14}/> {r.code}</span><span style={{fontSize:9}}><span style={{color:reg?reg.color:"#888"}}>{reg?reg.icon+" "+reg.label:""}</span> <span style={{color:"#4ade80"}}>{r.score>=0?"+":""}{r.score.toFixed(2)}</span></span></div>;})}
                  </div>
                  <div>
                    <div style={{fontSize:8,color:"#f87171",fontWeight:700,marginBottom:6}}>🔴 DEVISES FAIBLES</div>
                    {faibles.map(r=>{const reg=getRegime(data,r.code);return<div key={r.code} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,padding:"4px 8px",background:"#1a0505",borderRadius:4,border:"1px solid #f8717122"}}><span style={{fontSize:10,color:"#c8d4f0",fontWeight:700}}><FlagImg code={r.code} size={14}/> {r.code}</span><span style={{fontSize:9}}><span style={{color:reg?reg.color:"#888"}}>{reg?reg.icon+" "+reg.label:""}</span> <span style={{color:"#f87171"}}>{r.score>=0?"+":""}{r.score.toFixed(2)}</span></span></div>;})}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ÉTAPE 3 — OPPORTUNITÉS */}
          {(()=>{
            const CFTC_MAP={EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
            const PAIRS=["EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","EURJPY","EURGBP","EURCAD","EURAUD","EURCHF","EURNZD","GBPJPY","GBPCHF","GBPCAD","GBPAUD","GBPNZD","CHFJPY","CADJPY","AUDJPY","NZDJPY","CADCHF","AUDCHF","NZDCHF","AUDCAD","NZDCAD","AUDNZD"];
            const opps=[];
            PAIRS.forEach(pair=>{
              const base=pair.slice(0,3),quote=pair.slice(3,6);
              const rBase=getRegime(data,base),rQuote=getRegime(data,quote);
              const bCot=apexCot[CFTC_MAP[base]],qCot=apexCot[CFTC_MAP[quote]];
              if(!rBase||!rQuote||!bCot||!qCot)return;
              const sBase=ranked.find(r=>r.code===base)?.score||0;
              const sQuote=ranked.find(r=>r.code===quote)?.score||0;
              const macroDiff=sBase-sQuote;
              if(Math.abs(macroDiff)<0.5)return;
              const direction=macroDiff>0?"LONG":"SHORT";
              const cotAligned=direction==="LONG"?bCot.chgNet>qCot.chgNet:bCot.chgNet<qCot.chgNet;
              if(!cotAligned)return;
              const bIsFort=bCot.signal==="HAUSSIER_FORT"||bCot.signal==="BAISSIER_FORT";
              const qIsFort=qCot.signal==="HAUSSIER_FORT"||qCot.signal==="BAISSIER_FORT";
              const bDir=bCot.chgNet>0?"H":"B";
              const qDir=qCot.chgNet>0?"H":"B";
              const cotOk=bIsFort&&qIsFort&&Math.abs(bCot.chgNet)>=3000&&Math.abs(qCot.chgNet)>=3000&&bDir!==qDir;
              const retailS=sentRetail[pair]||sentRetail[pair.slice(0,3)+"/"+pair.slice(3,6)];
              const rA=retailS?analyzeRetailS(retailS):null;
              const retailBiasOk = rA&&((direction==="SHORT"&&rA.bias==="BAISSIER")||(direction==="LONG"&&rA.bias==="HAUSSIER"));
              const retailOk=rA&&(rA.strength==="EXTREME"||rA.strength==="FORT")&&retailBiasOk;
              const score3=(cotOk?1:0)+(retailOk?1:0)+1;
              opps.push({pair,base,quote,direction,rBase,rQuote,macroDiff,sBase,sQuote,bCot,qCot,cotOk,retailOk,rA,score3});
            });
            opps.sort((a,b)=>b.score3-a.score3||Math.abs(b.macroDiff)-Math.abs(a.macroDiff));
            const apex=opps.filter(o=>o.score3===3);
            const partial=opps.filter(o=>o.score3===2).slice(0,5);
            return(
              <div>
                <div style={{fontSize:10,color:"#fbbf24",fontWeight:700,marginBottom:8,letterSpacing:1}}>🎯 ÉTAPE 3 — OPPORTUNITÉS CONFIRMÉES</div>
                {apex.length===0&&(
                  <div style={{padding:20,textAlign:"center",background:"#0a1628",borderRadius:8,marginBottom:12}}>
                    <div style={{fontSize:12,color:"#475569",marginBottom:6}}>⏳ Aucun signal APEX cette semaine</div>
                    <div style={{fontSize:9,color:"#374151"}}>Attendre que les 3 forces s'alignent — ne pas forcer un trade</div>
                  </div>
                )}
                {apex.map(o=>(
                  <div key={o.pair} style={{background:"#0a1628",border:`2px solid ${o.direction==="LONG"?"#4ade80":"#f87171"}`,borderRadius:8,padding:"10px 14px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#fff"}}><FlagImg code={o.base} size={16}/> {o.base}/{o.quote} <FlagImg code={o.quote} size={16}/></span>
                      <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:4,background:o.direction==="LONG"?"#14532d":"#7f1d1d",color:o.direction==="LONG"?"#4ade80":"#f87171"}}>🔥🔥🔥 {o.direction==="LONG"?"▲ LONG":"▼ SHORT"} — APEX</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                      <div style={{background:"#0c1a2e",borderRadius:4,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontSize:7,color:"#a78bfa",marginBottom:2,fontWeight:700}}>✅ 1 — MACRO</div>
                        <div style={{fontSize:8,color:o.rBase.color}}>{o.rBase.icon} {o.rBase.label}</div>
                        <div style={{fontSize:7,color:"#475569"}}>vs</div>
                        <div style={{fontSize:8,color:o.rQuote.color}}>{o.rQuote.icon} {o.rQuote.label}</div>
                        <div style={{fontSize:8,color:"#38bdf8",marginTop:2}}>écart {Math.abs(o.macroDiff).toFixed(2)}</div>
                      </div>
                      <div style={{background:"#0c1a2e",borderRadius:4,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontSize:7,color:"#4ade80",marginBottom:2,fontWeight:700}}>✅ 2 — COT LF</div>
                        <div style={{fontSize:8,color:o.bCot.chgNet>0?"#4ade80":"#f87171"}}>{o.base} {o.bCot.chgNet>=0?"+":""}{o.bCot.chgNet.toLocaleString()}{o.bCot.switchType?" 🔥":""}</div>
                        <div style={{fontSize:7,color:"#475569"}}>vs</div>
                        <div style={{fontSize:8,color:o.qCot.chgNet>0?"#4ade80":"#f87171"}}>{o.quote} {o.qCot.chgNet>=0?"+":""}{o.qCot.chgNet.toLocaleString()}{o.qCot.switchType?" 🔥":""}</div>
                      </div>
                      <div style={{background:"#0c1a2e",borderRadius:4,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontSize:7,color:"#fbbf24",marginBottom:2,fontWeight:700}}>✅ 3 — RETAIL</div>
                        <div style={{fontSize:9,color:"#f87171",fontWeight:700}}>{o.rA?.lp}% LONG</div>
                        <div style={{fontSize:9,color:"#4ade80",fontWeight:700}}>{o.rA?.sp}% SHORT</div>
                        <div style={{fontSize:7,color:o.direction==="LONG"?"#4ade80":"#f87171",marginTop:2}}>→ contrarian {o.direction==="LONG"?"ACHETER":"VENDRE"}</div>
                      </div>
                    </div>
                    <div style={{background:"#050d1a",borderRadius:4,padding:"8px 10px",fontSize:8,color:"#94a3b8",lineHeight:1.7}}>
                      <span style={{color:"#fbbf24",fontWeight:700}}>💡 POURQUOI CE TRADE ? </span>
                      <span style={{color:o.rBase.color}}>{o.rBase.icon} {o.base} {o.rBase.label}</span>{" vs "}<span style={{color:o.rQuote.color}}>{o.rQuote.icon} {o.quote} {o.rQuote.label}</span>{" — les BCs divergent. "}
                      {"Les Leveraged Funds "}<span style={{color:o.bCot.chgNet>0?"#4ade80":"#f87171"}}>{o.bCot.chgNet>0?"achètent":"vendent"} {o.base}</span>{" et "}<span style={{color:o.qCot.chgNet>0?"#4ade80":"#f87171"}}>{o.qCot.chgNet>0?"achètent":"vendent"} {o.quote}</span>{(o.bCot.switchType||o.qCot.switchType)?" (switch institutionnel cette semaine).":". "}
                      {o.rA&&<span>{"Le retail est à "}<span style={{color:"#f87171",fontWeight:700}}>{Math.max(o.rA.lp,o.rA.sp)}% du mauvais côté</span>{" → signal contrarian fort. "}</span>}
                      <span style={{color:"#4ade80",fontWeight:700}}>3 forces alignées = probabilité maximale.</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {view==="data"    && <DataView />}
      {view==="guide"   && <GuideView />}
      {view==="heat" && <HeatmapView data={data} />}
      {view==="sentiment" && <SentimentView />}
      {view==="cal"     && <CalView />}
      {view==="journal" && <JournalView />}
      {view==="calc"    && <PositionCalc />}
      {view==="daytrade" && <DayTradeView />}
      {view==="daytradeor" && <DayTradeOrView />}
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
