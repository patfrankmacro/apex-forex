import { useState, useEffect, useCallback } from "react";

const MYFXBOOK_EMAIL = "patrice-bonneau@outlook.com";
const MYFXBOOK_PASS  = "Fucktoi69$";

const PAIRS = [
  { name:"EURUSD", base:"EUR", quote:"USD" },
  { name:"GBPUSD", base:"GBP", quote:"USD" },
  { name:"USDJPY", base:"USD", quote:"JPY" },
  { name:"USDCAD", base:"USD", quote:"CAD" },
  { name:"AUDUSD", base:"AUD", quote:"USD" },
  { name:"NZDUSD", base:"NZD", quote:"USD" },
  { name:"USDCHF", base:"USD", quote:"CHF" },
  { name:"XAUUSD", base:"XAU", quote:"USD" },
  { name:"GBPJPY", base:"GBP", quote:"JPY" },
  { name:"EURJPY", base:"EUR", quote:"JPY" },
  { name:"AUDJPY", base:"AUD", quote:"JPY" },
  { name:"EURAUD", base:"EUR", quote:"AUD" },
  { name:"GBPAUD", base:"GBP", quote:"AUD" },
  { name:"EURGBP", base:"EUR", quote:"GBP" },
  { name:"AUDNZD", base:"AUD", quote:"NZD" },
  { name:"CHFJPY", base:"CHF", quote:"JPY" },
  { name:"GBPCAD", base:"GBP", quote:"CAD" },
  { name:"EURCAD", base:"EUR", quote:"CAD" },
  { name:"AUDCAD", base:"AUD", quote:"CAD" },
  { name:"NZDJPY", base:"NZD", quote:"JPY" },
];

const CFTC = {
  EUR:"099741", GBP:"096742", JPY:"097741",
  CAD:"090741", AUD:"232741", CHF:"092741",
  USD:"098662", NZD:"112741",
};

const FLAG = {
  EUR:"🇪🇺", GBP:"🇬🇧", JPY:"🇯🇵", CAD:"🇨🇦",
  AUD:"🇦🇺", CHF:"🇨🇭", USD:"🇺🇸", NZD:"🇳🇿", XAU:"🥇",
};

function FlagImg({ code, size=18 }) {
  const map = {"EUR":"eu","GBP":"gb","JPY":"jp","CAD":"ca","AUD":"au","CHF":"ch","USD":"us","NZD":"nz","XAU":"un"};
  const cc = map[code] || code.toLowerCase().slice(0,2);
  return <img src={`https://flagcdn.com/w40/${cc}.png`} width={size} height={size*0.75} style={{borderRadius:2,objectFit:"cover",verticalAlign:"middle"}} alt={code} />;
}

function analyzeRetail(s) {
  if (!s) return null;
  const lp = s.longPercentage, sp = s.shortPercentage;
  if (lp >= 75) return { bias:"BAISSIER", strength:"EXTREME",  pct:lp, side:"LONG",  desc:`${lp}% retail LONG (extrême) → contrarian fort: VENDRE` };
  if (sp >= 75) return { bias:"HAUSSIER", strength:"EXTREME",  pct:sp, side:"SHORT", desc:`${sp}% retail SHORT (extrême) → contrarian fort: ACHETER` };
  if (lp >= 65) return { bias:"BAISSIER", strength:"FORT",     pct:lp, side:"LONG",  desc:`${lp}% retail LONG → contrarian: VENDRE` };
  if (sp >= 65) return { bias:"HAUSSIER", strength:"FORT",     pct:sp, side:"SHORT", desc:`${sp}% retail SHORT → contrarian: ACHETER` };
  if (lp >= 55) return { bias:"BAISSIER", strength:"MODERE",   pct:lp, side:"LONG",  desc:`${lp}% retail LONG → léger biais baissier` };
  if (sp >= 55) return { bias:"HAUSSIER", strength:"MODERE",   pct:sp, side:"SHORT", desc:`${sp}% retail SHORT → léger biais haussier` };
  return { bias:"NEUTRE", strength:"NUL", pct:lp, side:"NEUTRE", desc:`Retail neutre ${lp}%L/${sp}%S` };
}

function analyzeCurrency(d) {
  if (!d) return null;
  const range = d.max52 - d.min52;
  const pct = range === 0 ? 50 : Math.round(((d.net - d.min52) / range) * 100);
  let bias, strength, extreme = false;
  if (pct >= 90) { bias = "HAUSSIER"; strength = "EXTREME"; extreme = true; }
  else if (pct <= 10) { bias = "BAISSIER"; strength = "EXTREME"; extreme = true; }
  else if (pct >= 65) { bias = "HAUSSIER"; strength = "FORT"; }
  else if (pct <= 35) { bias = "BAISSIER"; strength = "FORT"; }
  else if (pct >= 55) { bias = "HAUSSIER"; strength = "MODERE"; }
  else if (pct <= 45) { bias = "BAISSIER"; strength = "MODERE"; }
  else { bias = "NEUTRE"; strength = "NUL"; }
  return { bias, strength, extreme, pct, net:d.net, longPos:d.longPos, shortPos:d.shortPos, date:d.date };
}

function analyzePairCOT(baseCur, quoteCur) {
  if (!baseCur || !quoteCur) return null;
  const spread = baseCur.pct - quoteCur.pct;
  let bias, strength;
  const abs = Math.abs(spread);
  if (spread > 0) bias = "HAUSSIER";
  else if (spread < 0) bias = "BAISSIER";
  else bias = "NEUTRE";
  if (abs >= 60) strength = "EXTREME";
  else if (abs >= 40) strength = "FORT";
  else if (abs >= 20) strength = "MODERE";
  else strength = "NUL";
  const extreme = baseCur.extreme || quoteCur.extreme;
  return {
    bias, strength, extreme, spread,
    base:baseCur, quote:quoteCur,
    desc:`Base P${baseCur.pct}% vs Quote P${quoteCur.pct}% (spread ${spread>0?"+":""}${spread})`
  };
}

function buildSignal(rA, pCot) {
  if (!rA || !pCot) return { label:"— DONNÉES INCOMPLÈTES", color:"#475569", bg:"#1e3a5f22", action:"En attente des données", valid:false };
  if (rA.bias === "NEUTRE" && pCot.bias === "NEUTRE") return { label:"— NEUTRE", color:"#fbbf24", bg:"#1f2937", action:"Aucun positionnement marqué", valid:false };

  const diverge = rA.bias !== "NEUTRE" && pCot.bias !== "NEUTRE" && rA.bias === pCot.bias;
  // ATTENTION: contrarian retail signifie:
  // Retail LONG -> bias contrarian = BAISSIER
  // Donc rA.bias (déjà inversé) doit MATCHER le COT pour avoir un signal valide

  if (!diverge) {
    if (pCot.extreme && pCot.strength === "EXTREME") {
      return {
        label:"⚠ COT EXTRÊME — surveiller retournement",
        color:"#f59e0b", bg:"#1f2937",
        action:`${pCot.base.pct>=90||pCot.quote.pct<=10?"Base/Quote à l'extrême":""} — pas d'alignement retail`,
        valid:false, warning:true
      };
    }
    return { label:"— PAS D'ALIGNEMENT", color:"#64748b", bg:"#1e3a5f22", action:"Retail et COT pas alignés — invalide", valid:false };
  }

  const direction = rA.bias;
  const retailStrong = rA.strength === "EXTREME" || rA.strength === "FORT";
  const cotStrong = pCot.strength === "EXTREME" || pCot.strength === "FORT";
  const bothExtreme = rA.strength === "EXTREME" && pCot.strength === "EXTREME";

  if (direction === "HAUSSIER") {
    if (bothExtreme)             return { label:"🔥🔥 SETUP PARFAIT HAUSSIER", color:"#22c55e", bg:"#14532d", action:"ACHETER FORT — Retail extrême SHORT + COT extrême HAUSSIER", valid:true };
    if (retailStrong && cotStrong) return { label:"🔥 SIGNAL FORT HAUSSIER",   color:"#4ade80", bg:"#14532d", action:"ACHETER — Retail short + Instits longs", valid:true };
    if (retailStrong || cotStrong) return { label:"↑ SIGNAL HAUSSIER",         color:"#86efac", bg:"#166534", action:"Biais haussier — attendre confirmation technique", valid:true };
    return                              { label:"↑ Biais haussier faible",   color:"#86efac", bg:"#166534", action:"Signal faible — surveiller", valid:true };
  } else {
    if (bothExtreme)             return { label:"🔥🔥 SETUP PARFAIT BAISSIER", color:"#ef4444", bg:"#7f1d1d", action:"VENDRE FORT — Retail extrême LONG + COT extrême BAISSIER", valid:true };
    if (retailStrong && cotStrong) return { label:"🔥 SIGNAL FORT BAISSIER",   color:"#f87171", bg:"#7f1d1d", action:"VENDRE — Retail long + Instits shorts", valid:true };
    if (retailStrong || cotStrong) return { label:"↓ SIGNAL BAISSIER",         color:"#fca5a5", bg:"#991b1b", action:"Biais baissier — attendre confirmation technique", valid:true };
    return                              { label:"↓ Biais baissier faible",   color:"#fca5a5", bg:"#991b1b", action:"Signal faible — surveiller", valid:true };
  }
}

async function myfxLoadAll() {
  const r = await fetch(`/api/myfxbook?email=${encodeURIComponent(MYFXBOOK_EMAIL)}&password=${encodeURIComponent(MYFXBOOK_PASS)}&t=${Date.now()}`);
  const d = await r.json();
  if (d.error || !d.symbols) throw new Error(d.message || "No symbols");
  const map = {};
  d.symbols.forEach(s => { map[s.name] = s; });
  return map;
}

async function fetchCOT(code) {
  try {
    const url = "https://publicreporting.cftc.gov/resource/gpe5-46if.json?cftc_contract_market_code=" + code + "&$order=report_date_as_yyyy_mm_dd DESC&$limit=1";
    const rows = await (await fetch(url)).json();
    if (!rows?.length) return null;
    const row = rows[0];
    const chgLong  = parseInt(row.change_in_lev_money_long||0);
    const chgShort = parseInt(row.change_in_lev_money_short||0);
    const chgNet   = chgLong - chgShort;
    const levLong  = parseInt(row.lev_money_positions_long||0);
    const levShort = parseInt(row.lev_money_positions_short||0);
    // Signal basé sur le changement hebdomadaire
    let signal = "NEUTRE";
    if (chgLong>0 && chgShort<0) signal = "HAUSSIER_FORT";
    else if (chgLong<0 && chgShort>0) signal = "BAISSIER_FORT";
    else if (chgNet > 500) signal = "HAUSSIER";
    else if (chgNet < -500) signal = "BAISSIER";
    // Convertir signal en net/max52/min52 pour compatibilité avec analyzeCurrency
    const pct = signal==="HAUSSIER_FORT"?85:signal==="HAUSSIER"?65:signal==="BAISSIER"?35:signal==="BAISSIER_FORT"?15:50;
    // net fictif entre -100000 et +100000 pour forcer le percentile voulu
    const fakeNet = (pct - 50) * 2000;
    return {
      net: fakeNet,
      longPos: levLong,
      shortPos: levShort,
      chgLong, chgShort, chgNet, signal,
      max52: 100000, min52: -100000,
      date: row.report_date_as_yyyy_mm_dd?.slice(0,10) || "—",
    };
  } catch { return null; }
}

export default function SentimentView() {
  const [retail, setRetail]   = useState({});
  const [cot, setCot]         = useState({});
  const [status, setStatus]   = useState("idle");
  const [lastUp, setLastUp]   = useState(null);
  const [cotDate, setCotDate] = useState(null);

  const loadRetail = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await myfxLoadAll();
      setRetail(data);
      setLastUp(new Date().toLocaleTimeString("fr-CA"));
      setStatus("ok");
    } catch { setStatus("error"); }
  }, []);

  const loadCOT = useCallback(async () => {
    const codes = [...new Set(Object.values(CFTC))];
    const res = {};
    await Promise.all(codes.map(async c => { res[c] = await fetchCOT(c); }));
    setCot(res);
    setCotDate(new Date().toLocaleDateString("fr-CA"));
  }, []);

  useEffect(() => {
    loadRetail();
    loadCOT();
    const ri = setInterval(loadRetail, 60*60*1000);
    const ci = setInterval(() => {
      const n = new Date();
      if (n.getUTCDay()===5 && n.getUTCHours()===20 && n.getUTCMinutes()>=30) loadCOT();
    }, 60000);
    return () => { clearInterval(ri); clearInterval(ci); };
  }, [loadRetail, loadCOT]);

  const pairs = PAIRS.map(p => {
    const s    = retail[p.name];
    const rA   = analyzeRetail(s);
    const bCur = analyzeCurrency(cot[CFTC[p.base]]);
    const qCur = analyzeCurrency(cot[CFTC[p.quote]]);
    const pCot = analyzePairCOT(bCur, qCur);
    const sig  = buildSignal(rA, pCot);
    return { ...p, s, rA, bCur, qCur, pCot, sig };
  });

  const validPairs = pairs.filter(p => p.sig.valid);
  const watchPairs = pairs.filter(p => !p.sig.valid && p.sig.warning);

  return (
    <div style={{padding:12}}>

      <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:10,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#38bdf8",fontWeight:700}}>SENTIMENT — SIGNAUX VALIDES</div>
          <div style={{fontSize:8,color:"#475569",marginTop:2}}>
            Retail Myfxbook {lastUp?"MàJ "+lastUp:status==="loading"?"chargement...":"—"} | COT CFTC {cotDate||"—"}
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={loadRetail} style={{padding:"4px 8px",fontSize:9,fontFamily:"monospace",cursor:"pointer",borderRadius:4,border:"1px solid #1e3a5f",background:"transparent",color:"#64748b"}}>↻ RETAIL</button>
          <button onClick={loadCOT}    style={{padding:"4px 8px",fontSize:9,fontFamily:"monospace",cursor:"pointer",borderRadius:4,border:"1px solid #1e3a5f",background:"transparent",color:"#64748b"}}>↻ COT</button>
        </div>
      </div>

      <div style={{background:"#0a1628",border:"1px solid #f59e0b44",borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:9,color:"#94a3b8",lineHeight:1.8}}>
        <span style={{color:"#f59e0b",fontWeight:700}}>LOGIQUE INSTITUTIONNELLE : </span>
        Retail contrarian + COT compare les <b>2 devises</b> (base vs quote percentiles) +
        <span style={{color:"#4ade80"}}> Signal valide = Retail (inversé) aligné avec spread COT</span>
      </div>

      {status==="error"&&(
        <div style={{padding:8,background:"#7f1d1d33",border:"1px solid #ef4444",borderRadius:6,color:"#f87171",fontSize:9,marginBottom:10}}>
          ⚠ Erreur Myfxbook
        </div>
      )}

      {validPairs.length === 0 && status === "ok" && (
        <div style={{padding:20,textAlign:"center",fontSize:10,color:"#475569",background:"#0a1628",borderRadius:8,marginBottom:10}}>
          Aucun signal valide actuellement<br/>
          <span style={{fontSize:8}}>Toutes les paires analysées — pas d'alignement retail/COT</span>
        </div>
      )}

      <div style={{fontSize:9,color:"#4ade80",letterSpacing:2,marginBottom:8,fontWeight:700}}>
        {validPairs.length} SIGNAL{validPairs.length>1?"AUX":""} VALIDE{validPairs.length>1?"S":""}
      </div>

      {validPairs.map(({name, base, quote, s, rA, bCur, qCur, pCot, sig})=>(
        <div key={name} style={{background:"#0a1628",border:"1px solid "+sig.color+"66",borderRadius:8,padding:12,marginBottom:10}}>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,color:"#c8d8f0"}}><FlagImg code={base} size={16} /><FlagImg code={quote} size={16} /> {base}/{quote}</div>
            <div style={{fontSize:10,padding:"4px 12px",borderRadius:4,background:sig.bg,color:sig.color,fontWeight:700}}>{sig.label}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:6,marginBottom:8}}>

            <div style={{background:"#070b14",borderRadius:6,padding:8,borderLeft:"2px solid "+(rA?.bias==="HAUSSIER"?"#4ade80":rA?.bias==="BAISSIER"?"#f87171":"#475569")}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontSize:8,color:"#475569",letterSpacing:1}}>RETAIL — MYFXBOOK</div>
                <div style={{fontSize:8,color:rA?.bias==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>
                  Contrarian: {rA?.bias} {rA?.strength==="EXTREME"?"⚠":""}
                </div>
              </div>
              {s&&(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:8,marginBottom:3}}>
                    <span style={{color:"#4ade80"}}>LONG {s.longPercentage}%</span>
                    <span style={{color:"#f87171"}}>SHORT {s.shortPercentage}%</span>
                  </div>
                  <div style={{height:5,background:"#f87171",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:s.longPercentage+"%",height:"100%",background:"#4ade80"}}/>
                  </div>
                </>
              )}
              <div style={{fontSize:7,color:"#64748b",marginTop:3}}>{rA?.desc}</div>
            </div>

            <div style={{background:"#070b14",borderRadius:6,padding:8,borderLeft:"2px solid "+(pCot?.bias==="HAUSSIER"?"#4ade80":pCot?.bias==="BAISSIER"?"#f87171":"#475569")}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:8,color:"#475569",letterSpacing:1}}>COT INSTITS — {base} vs {quote}</div>
                <div style={{fontSize:8,color:pCot?.bias==="HAUSSIER"?"#4ade80":"#f87171",fontWeight:700}}>
                  Instits: {pCot?.bias} {pCot?.strength==="EXTREME"?"⚠":""}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:5}}>
                <div>
                  <div style={{fontSize:7,color:"#475569",marginBottom:2}}><FlagImg code={base} size={16} /> {base} — P{bCur?.pct}%</div>
                  <div style={{height:4,background:"#1e3a5f",borderRadius:2,position:"relative"}}>
                    <div style={{position:"absolute",left:0,width:"10%",height:"100%",background:"#4ade8055"}}/>
                    <div style={{position:"absolute",right:0,width:"10%",height:"100%",background:"#f8717155"}}/>
                    <div style={{position:"absolute",left:(bCur?.pct||50)+"%",top:-1,width:2,height:6,background:bCur?.bias==="HAUSSIER"?"#4ade80":"#f87171",transform:"translateX(-50%)"}}/>
                  </div>
                  {bCur&&<div style={{fontSize:7,color:"#475569",marginTop:2}}>Net: {bCur.net>=0?"+":""}{bCur.net.toLocaleString()}</div>}
                </div>
                <div>
                  <div style={{fontSize:7,color:"#475569",marginBottom:2}}><FlagImg code={quote} size={16} /> {quote} — P{qCur?.pct}%</div>
                  <div style={{height:4,background:"#1e3a5f",borderRadius:2,position:"relative"}}>
                    <div style={{position:"absolute",left:0,width:"10%",height:"100%",background:"#4ade8055"}}/>
                    <div style={{position:"absolute",right:0,width:"10%",height:"100%",background:"#f8717155"}}/>
                    <div style={{position:"absolute",left:(qCur?.pct||50)+"%",top:-1,width:2,height:6,background:qCur?.bias==="HAUSSIER"?"#4ade80":"#f87171",transform:"translateX(-50%)"}}/>
                  </div>
                  {qCur&&<div style={{fontSize:7,color:"#475569",marginTop:2}}>Net: {qCur.net>=0?"+":""}{qCur.net.toLocaleString()}</div>}
                </div>
              </div>

              <div style={{fontSize:7,color:"#64748b"}}>{pCot?.desc}</div>
            </div>

          </div>

          <div style={{background:sig.bg,borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:11,color:sig.color,fontWeight:700,marginBottom:3}}>{sig.action}</div>
            <div style={{fontSize:8,color:"#94a3b8"}}>Retail force: {rA?.strength} | COT force: {pCot?.strength}</div>
          </div>

        </div>
      ))}

      {watchPairs.length > 0 && (
        <>
          <div style={{fontSize:9,color:"#f59e0b",letterSpacing:2,marginTop:16,marginBottom:8,fontWeight:700}}>
            ⚠ {watchPairs.length} PAIR{watchPairs.length>1?"ES":"E"} À SURVEILLER (COT EXTRÊME)
          </div>
          {watchPairs.map(({name, base, quote, sig, pCot})=>(
            <div key={name} style={{background:"#0a1628",border:"1px solid #f59e0b44",borderRadius:8,padding:10,marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#c8d8f0"}}><FlagImg code={base} size={16} /><FlagImg code={quote} size={16} /> {base}/{quote}</div>
                <div style={{fontSize:9,color:"#f59e0b"}}>{sig.label}</div>
              </div>
              <div style={{fontSize:8,color:"#64748b",marginTop:4}}>{pCot?.desc}</div>
            </div>
          ))}
        </>
      )}

      <div style={{marginTop:14,padding:10,background:"#0a1628",borderRadius:6,border:"1px solid #1e3a5f22"}}>
        <div style={{fontSize:8,color:"#f59e0b",fontWeight:700,marginBottom:4}}>MÉTHODE INSTITUTIONNELLE</div>
        <div style={{fontSize:8,color:"#64748b",lineHeight:1.9}}>
          1️⃣ Retail Myfxbook → inversion contrarian (foule = mauvaise direction)<br/>
          2️⃣ COT CFTC → changement hebdomadaire Leveraged Funds (hedge funds + CTAs)<br/>
          3️⃣ Signal = Base vs Quote (HAUSSIER FORT / HAUSSIER / BAISSIER / BAISSIER FORT)<br/>
          4️⃣ Signal valide = Retail (inversé) aligné avec spread COT<br/>
          <span style={{color:"#f59e0b"}}>🔥🔥 Setup parfait = retail extrême + Leveraged Funds signal fort opposé</span>
        </div>
      </div>

    </div>
  );
}
