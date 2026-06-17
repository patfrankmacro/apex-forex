import { useState, useEffect } from "react";

const TEXT="#c8d4f0", TEXT_DIM="#4a5070";
const DT_PAIRS = [["EUR","AUD"],["GBP","AUD"],["EUR","NZD"],["GBP","NZD"],["GBP","JPY"],["EUR","JPY"],["CHF","JPY"]];
const CURS = ["USD","EUR","GBP","JPY","CHF","AUD","NZD","CAD"];

function DtAnalyzer(){
  const [raw, setRaw] = useState("");
  const [res, setRes] = useState(null);
  const [riskMode, setRiskMode] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("apexRisk")||"null"); if (s && s.d === new Date().toDateString()) return s.m; } catch(e){}
    return null;
  });
  const setRisk = (m) => { setRiskMode(m); try { localStorage.setItem("apexRisk", JSON.stringify({m, d:new Date().toDateString()})); } catch(e){} };
  // Filtre 3 : alignement sentiment. Croisements JPY/CHF (quote JPY) : achat=RISK-ON, vente=RISK-OFF. Croisements AUD/NZD : achat=RISK-OFF, vente=RISK-ON.
  const riskAligned = (quote, dir) => {
    if (!riskMode || riskMode === "NEUTRE") return false;
    const quoteRefuge = (quote === "JPY"); // nos 7 paires : quote = JPY ou AUD/NZD
    if (quoteRefuge) return dir === "LONG" ? riskMode === "RISK-ON" : riskMode === "RISK-OFF";
    return dir === "LONG" ? riskMode === "RISK-OFF" : riskMode === "RISK-ON";
  };
  const analyze = () => {
    try {
      const nowET = new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
      const m = nowET.getHours()*60+nowET.getMinutes();
      if (!(m >= 465 && m <= 525)) {
        const hh=String(nowET.getHours()).padStart(2,"0"), mm=String(nowET.getMinutes()).padStart(2,"0");
        setRes({error:`⏰ Il est ${hh}h${mm} à New York. Le Day Trade FX se scanne de 7h45 à 8h45 ET — cassure de 8h (continuation du pôle de Londres). Reviens entre 7h45 et 8h45.`});
        return;
      }
      const lines = raw.split("\n").map(l=>l.trim()).filter(Boolean);
      let start=-1, end=lines.length;
      for (let i=0;i<lines.length;i++){
        if (lines[i].includes("Currency Strength Meter")) start=i;
        else if (start>=0 && (lines[i].includes("Top Gainers")||lines[i].includes("As of"))){ end=i; break; }
      }
      if (start<0){ setRes({error:"Currency Strength Meter introuvable — colle le snapshot MarketMilk complet."}); return; }
      const order=[];
      for (let i=start;i<end;i++){
        const t=lines[i];
        if (CURS.includes(t) && !order.includes(t)) order.push(t);
      }
      if (order.length<8){ setRes({error:"Classement incomplet ("+order.length+"/8 devises lues) — recolle la section Currency Strength en entier."}); return; }
      const rank={}; order.forEach((c,i)=>rank[c]=i+1);
      // Volatility Meter par devise (pour le gold uniquement)
      let vstart=-1, vend=lines.length;
      for (let i=0;i<lines.length;i++){
        if (lines[i].includes("Currency Volatility Meter")) vstart=i;
        else if (vstart>=0 && (lines[i].includes("Most Volatile")||lines[i].includes("As of"))){ vend=i; break; }
      }
      const vorder=[];
      if (vstart>=0) for (let i=vstart;i<vend;i++){ const t=lines[i]; if (CURS.includes(t) && !vorder.includes(t)) vorder.push(t); }
      const vrankUSD = vorder.indexOf("USD")+1; // 0 si absent
      // Least Volatile (veto : pas de carburant)
      let lstart=-1, lend=lines.length;
      for (let i=0;i<lines.length;i++){
        if (lstart<0 && lines[i].includes("Least Volatile")) lstart=i;
        else if (lstart>=0 && (lines[i].includes("As of")||lines[i].includes("MarketMilk"))){ lend=i; break; }
      }
      const leastSet = new Set();
      if (lstart>=0) for (let i=lstart;i<lend;i++){ const mm2=lines[i].match(/^([A-Z]{3})\/([A-Z]{3})$/); if (mm2 && leastSet.size<5) leastSet.add(mm2[1]+"/"+mm2[2]); }
      const out=[];
      DT_PAIRS.forEach(([b,q])=>{
        const gap=Math.abs(rank[b]-rank[q]);
        const dir = rank[b]<rank[q] ? "LONG" : "SHORT";
        const aligned = riskAligned(q, dir);
        const quoteRefuge = (q === "JPY");
        const frozen = leastSet.has(b+"/"+q);
        let pourquoi = "";
        if (gap>=3 && aligned && frozen) {
          pourquoi = "❄️ VETO — ①③ validés MAIS Top 5 Least Volatile : Londres n\u0027a presque pas bougé cette paire depuis 3h. Pôle mou, pas de carburant pour le retracement de 9h30 — le signal est théorique aujourd\u0027hui.";
        } else if (gap>=3 && aligned) {
          const sens = dir==="LONG" ? "ACHAT" : "VENTE";
          const cs = b+" #"+rank[b]+" vs "+q+" #"+rank[q]+" = "+gap+" rangs";
          const courant = quoteRefuge
            ? (dir==="LONG" ? "RISK-ON : le "+q+" refuge est vendu, ta paire monte avec le courant" : "RISK-OFF : la fuite vers le "+q+" refuge porte ta vente")
            : (dir==="LONG" ? "RISK-OFF : le "+q+" risqué est lâché, ta paire monte avec le courant" : "RISK-ON : le "+q+" risqué est acheté, ta paire descend avec le courant");
          pourquoi = sens+" car CONVERGENCE — ② "+cs+" (le capital a tranché) + ③ "+courant+". Currency Strength et sentiment poussent dans le MÊME sens.";
        } else if (gap>=3 && !aligned) {
          pourquoi = riskMode ? (riskMode==="NEUTRE" ? "3+ rangs mais sentiment NEUTRE : pas de courant de fond pour porter le mouvement" : gap+" rangs au Strength mais le "+riskMode+" pousse cette paire dans l'AUTRE sens — divergence sans courant = piège possible") : "choisis le sentiment (③) pour valider";
        }
        out.push({pair:b+"/"+q, base:b, quote:q, rb:rank[b], rq:rank[q], gap, dir, ok:(gap>=3 && aligned && !frozen), frozen, gapOk:gap>=3, aligned, pourquoi});
      });
      out.sort((a,b)=> (b.ok?1:0)-(a.ok?1:0) || b.gap-a.gap);
      // XAU/USD : cas special — l'or se trade contre la position du dollar seul
      const ru = rank["USD"];
      let xau = null;
      let xauConflit = null;
      if (ru <= 2 && riskMode === "RISK-ON") xau = {dir:"SHORT", why:"VENTE car DOUBLE CONVERGENCE — moteur dollar : USD #"+ru+" (Top 2, l'or coté en USD subit sa force) + moteur peur : RISK-ON (le refuge or est délaissé). Les deux moteurs de l'or poussent vers le BAS ensemble."};
      else if (ru >= 7 && riskMode === "RISK-OFF") xau = {dir:"LONG", why:"ACHAT car DOUBLE CONVERGENCE — moteur dollar : USD #"+ru+" (Bottom 2, le dollar coule = l'or mécaniquement porté) + moteur peur : RISK-OFF (fuite vers le refuge). Les deux moteurs poussent vers le HAUT ensemble."};
      else if (ru <= 2 && riskMode === "RISK-OFF") xauConflit = "USD #"+ru+" pousse l'or en BAS mais RISK-OFF le pousse en HAUT — les deux moteurs se battent, jour de mèches, pas de trade or";
      else if (ru >= 7 && riskMode === "RISK-ON") xauConflit = "USD #"+ru+" pousse l'or en HAUT mais RISK-ON le pousse en BAS — conflit, pas de trade or";
      if (false && ru <= 2) xau = {dir:"SHORT", why:"USD #"+ru+" (Top 2 = le dollar est LE moteur du jour) → l'or sous pression"};
      else if (false && ru >= 7) xau = {dir:"LONG", why:"USD #"+ru+" (Bottom 2 = le dollar coule) → l'or respire"};
      let xauNote = xauConflit;
      setRes({order, out, xau, xauNote, ru, heure:String(nowET.getHours()).padStart(2,"0")+"h"+String(nowET.getMinutes()).padStart(2,"0")});
    } catch(e){ setRes({error:"Erreur: "+e.message}); }
  };
  return (
    <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #38bdf855", marginBottom:14}}>
      <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:8}}>🤖 SCAN 7H45-8H45 — COLLE TA PAGE MARKETMILK</div>
      <div style={{marginBottom:8, padding:"8px 10px", background:"#0d1420", borderRadius:6, border:"1px solid #33415555"}}>
        <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:5}}>{"③ SENTIMENT DU JOUR (obligatoire) — lis le Risk Meter puis choisis :"}</div>
        <div style={{display:"flex", gap:6}}>
          {["RISK-ON","NEUTRE","RISK-OFF"].map(m => (
            <button key={m} onClick={()=>setRisk(m)} style={{flex:1, padding:"7px 4px", borderRadius:5, fontSize:8.5, fontWeight:700, cursor:"pointer", border: riskMode===m ? "2px solid "+(m==="RISK-ON"?"#4ade80":m==="RISK-OFF"?"#f87171":"#94a3b8") : "1px solid #334155", background: riskMode===m ? (m==="RISK-ON"?"#052010":m==="RISK-OFF"?"#200505":"#1a2030") : "#0a0f1a", color: riskMode===m ? (m==="RISK-ON"?"#4ade80":m==="RISK-OFF"?"#f87171":"#94a3b8") : "#64748b"}}>{m==="RISK-ON"?"🟢 RISK-ON":m==="RISK-OFF"?"🔴 RISK-OFF":"⚪ NEUTRE"}</button>
          ))}
        </div>
        <a href="https://www.babypips.com/tools/risk-on-risk-off-meter" target="_blank" rel="noopener noreferrer" style={{display:"block", marginTop:6, fontSize:8.5, color:"#7dd3fc", textDecoration:"none"}}>{"🌡️ Ouvrir le Risk-On/Risk-Off Meter (babypips) ↗"}</a>
        {!riskMode && <div style={{fontSize:8, color:"#fbbf24", marginTop:4}}>{"⚠ Choisis le sentiment AVANT de scanner — sans lui, aucune paire ne peut être validée."}</div>}
        {riskMode==="NEUTRE" && <div style={{fontSize:8, color:"#94a3b8", marginTop:4}}>{"NEUTRE = pas de courant de fond : le ③ n'est pas rempli, aucune paire validée aujourd'hui. L'or aussi a besoin d'un sentiment net."}</div>}
        <div style={{fontSize:8, color:"#64748b", marginTop:4}}>{"❄️ VETO carburant : une paire dans le Top 5 Least Volatile est bloquée même à ①②③ validés — Londres ne l'a pas travaillée, le pôle est mou, la cassure de 8h n'a rien à manger."}</div>
      </div>
      <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Colle la page MarketMilk COMPLÈTE (Currency Strength + Least Volatile) — le scanner croise ① ② ③ et vérifie le carburant ❄️..." style={{width:"100%", minHeight:80, background:"#001018", color:TEXT, border:"1px solid #1e3a5f", borderRadius:6, padding:8, fontSize:9, fontFamily:"monospace", resize:"vertical"}}/>
      <button onClick={analyze} style={{marginTop:8, width:"100%", padding:"10px", background:"#38bdf8", color:"#001018", border:"none", borderRadius:6, fontSize:11, fontWeight:700, letterSpacing:1, cursor:"pointer"}}>⚡ SCANNER</button>
      <a href="https://marketmilk.babypips.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", textAlign:"center", marginTop:6, fontSize:8.5, color:"#7dd3fc", textDecoration:"none", fontWeight:700}}>🥛 Ouvrir MarketMilk ↗</a>
      {res && res.error && <div style={{marginTop:10, padding:"10px", background:"#1a0a00", borderRadius:6, fontSize:9, color:"#fbbf24", lineHeight:1.6}}>{res.error}</div>}
      {res && res.out && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:6}}>Scan de {res.heure} · classement : {res.order.join(" > ")}</div>
          {res.out.filter(p=>p.ok).length===0 && <div style={{padding:"10px", background:"#1a1205", borderRadius:6, fontSize:9, color:"#fbbf24", marginBottom:6}}>{"Aucune paire validée — divergences et sentiment ne convergent pas aujourd'hui. Pas de trade FX, c'est la discipline."}</div>}
          {res.out.filter(p=>p.ok).map((p,i)=>(
            <div key={i} style={{padding:"7px 9px", marginBottom:4, background:p.ok?(p.dir==="LONG"?"#052010":"#200505"):"#0f1622", borderRadius:5, borderLeft:"3px solid "+(p.ok?(p.dir==="LONG"?"#4ade80":"#f87171"):"#334155")}}>
              <div style={{fontSize:9.5, fontWeight:700, color:p.ok?(p.dir==="LONG"?"#4ade80":"#f87171"):"#64748b"}}>
                {p.ok?"✅":"·"} {p.pair} {p.ok?(p.dir==="LONG"?"▲ ACHAT possible":"▼ VENTE possible"):(p.gapOk && !p.aligned ? "⛔ "+p.gap+"r mais sentiment contraire" : "")} — {p.base} #{p.rb} vs {p.quote} #{p.rq} = {p.gap} rang{p.gap>1?"s":""} {p.ok?"(≥3 ✓)":(p.gapOk?"(≥3 mais ③ ✗)":"(<3)")}
              </div>
              {p.pourquoi && <div style={{fontSize:8, color:p.ok?"#86efac":"#fbbf24", marginTop:3, lineHeight:1.5, fontStyle:"italic"}}>{p.pourquoi}</div>}
              {p.ok && <div style={{fontSize:8, color:TEXT_DIM, marginTop:3, lineHeight:1.5}}>Maintenant ton graphique M15 : pôle de Londres continu depuis 3h dans ce sens ? Flag dessiné depuis ~7h30 ? Pas de news US à 8h30 ? Alors guette la cassure du flag à 8h sur clôture M15 — c'est ton entrée.</div>}
            </div>
          ))}
          <div style={{fontSize:7.5, color:"#64748b", marginBottom:6}}>{res.out.filter(p=>!p.ok).length+" paire(s) écartée(s) — divergence insuffisante ou sentiment contraire"}</div>
          <div style={{padding:"7px 9px", marginBottom:4, background:res.xau?(res.xau.dir==="LONG"?"#1a1500":"#200505"):"#0f1622", borderRadius:5, borderLeft:"3px solid "+(res.xau?"#fbbf24":"#334155")}}>
            <div style={{fontSize:9.5, fontWeight:700, color:res.xau?"#fbbf24":"#64748b"}}>
              {res.xau?"✅":"·"} XAU/USD (OR) {res.xau?(res.xau.dir==="LONG"?"▲ ACHAT possible":"▼ VENTE possible"):(res.xauNote || "— USD #"+res.ru+" au milieu (3-6), pas de conviction")}
            </div>
            {res.xau && <div style={{fontSize:8, color:TEXT_DIM, marginTop:3, lineHeight:1.5}}>{res.xau.why}. Même structure : pôle de Londres sur M15, flag 3h-8h, cassure NY à 8h (clôture M15 confirmée) — et le COMEX porte la session NY. Stop sous le flag, sortie avant 17h.</div>}
          </div>
          <div style={{fontSize:7.5, color:TEXT_DIM, marginTop:4, fontStyle:"italic"}}>≥3 rangs à 7h45 = le classement a 5h de construction. Le scan donne la DIRECTION — le pôle et le flag se lisent sur TON graphique M15.</div>
        </div>
      )}
    </div>
  );
}

export default function DayTradeFxView(){
  const [openJpy, setOpenJpy] = useState(false);
  const [openScan, setOpenScan] = useState(false);
  const [openSeq, setOpenSeq] = useState(false);
  const [openEntrees, setOpenEntrees] = useState(false);
  const [openMeca, setOpenMeca] = useState(false);
  const [openDesks, setOpenDesks] = useState(false);
  const [openTete, setOpenTete] = useState(false);
  const [openTrades, setOpenTrades] = useState(false);
  const [openVs, setOpenVs] = useState(false);
  const [openJour, setOpenJour] = useState(false);
  const [liveRisk, setLiveRisk] = useState(null);
  useEffect(() => {
    const read = () => { try { setLiveRisk(JSON.parse(localStorage.getItem("apexRisk")||"null")); } catch(e){} };
    read();
    const id = setInterval(read, 600);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{maxWidth:520, margin:"0 auto"}}>
      <div style={{textAlign:"center", marginBottom:12}}>
        <div style={{fontSize:14, fontWeight:800, color:"#38bdf8", letterSpacing:1}}>⚡ DAY TRADE FX</div>
        <div style={{fontSize:9, color:"#7dd3fc", fontWeight:700}}>LE PÔLE DE LONDRES · CASSURE DE 8H</div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:4, lineHeight:1.5}}>Le pôle de Londres se construit de 3h à 7h30 — c'est le programme des desks, le MÊME chaque jour. De 7h30 à 8h ils soufflent : le flag se dessine. À 8h NY ouvre et le flag casse dans le sens du pôle — c'est ton entrée. Une entrée par jour, sortie avant 17h, jamais d'overnight.</div>
      </div>
      <DtAnalyzer />
      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #fbbf2455", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>{"🌡️ LE RISK METER — FILTRE ③ DU DAY TRADE"}</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}>{"Le Risk-On/Risk-Off Meter de babypips mesure l'appétit au risque mondial en temps réel : il agrège actions, obligations, devises refuges et matières premières en un seul cadran. RISK-ON = les investisseurs achètent du rendement (actions, AUD, NZD) et lâchent les refuges (JPY, CHF, or). RISK-OFF = la peur domine, le capital fuit vers les refuges. C'est le COURANT DE FOND sous tes divergences : un JPY fort en Risk-Off est porté par le courant, un JPY fort en Risk-On nage contre lui."}</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}>{"Pourquoi c'est OBLIGATOIRE : tes 7 paires opposent toutes une devise de Londres à une devise risquée (AUD, NZD) ou refuge (JPY). Chaque trade que tu prends EST un pari risk-on ou risk-off, que tu le saches ou non. Le filtre ③ s'assure que ton pari va dans le sens du courant mondial — jamais contre."}</div>
        <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:5}}>{"📊 L'INFLUENCE SUR CE QUE TU TRADES"}</div>
        <div style={{fontSize:8, color:TEXT, lineHeight:1.7, marginBottom:8}}>
          <div style={{padding:"6px 8px", background:"#052010", borderRadius:5, marginBottom:4}}><b style={{color:"#4ade80"}}>{"🟢 RISK-ON (appétit)"}</b>{" — AUD/NZD achetées, JPY/CHF vendus : tes croisements JPY (GBP/JPY, EUR/JPY, CHF/JPY) montent → ACHATS validés · tes croisements AUD/NZD (EUR/AUD, GBP/AUD, EUR/NZD, GBP/NZD) descendent → VENTES validées · XAU/USD : le refuge dort → la VENTE or converge (si USD #1-2)."}</div>
          <div style={{padding:"6px 8px", background:"#200505", borderRadius:5, marginBottom:4}}><b style={{color:"#f87171"}}>{"🔴 RISK-OFF (peur)"}</b>{" — fuite vers JPY/CHF, AUD/NZD lâchées : croisements JPY descendent → VENTES validées · croisements AUD/NZD montent → ACHATS validés · XAU/USD : fuite vers le refuge → l'ACHAT or converge (si USD #7-8)."}</div>
          <div style={{padding:"6px 8px", background:"#1a2030", borderRadius:5}}><b style={{color:"#94a3b8"}}>{"⚪ NEUTRE"}</b>{" — pas de courant de fond : les divergences sont moins fiables, le ③ n'est pas rempli → pas de trade. Les jours neutres sont les jours de range."}</div>
        </div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, padding:"8px 10px", background:"#1a1500", borderRadius:5}}>{"🥇 L'or et ses DEUX moteurs : le dollar (mécanique — l'or est coté en USD) et la peur (refuge). Quand ils convergent (USD fort + Risk-On = vente · USD faible + Risk-Off = achat), le mouvement est propre. Quand ils se BATTENT (USD fort + Risk-Off, typique des paniques où le cash dollar et l'or refuge montent ensemble), l'or fait des mèches dans les deux sens — le scanner te le dira : CONFLIT, pas de trade. C'est la convergence qui fait le trade, jamais un moteur seul."}</div>
        <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginTop:10, marginBottom:5}}>{"📋 PAIRE PAR PAIRE — CE QUE CHAQUE SENTIMENT VALIDE"}</div>
        <div style={{fontSize:7.5, fontFamily:"monospace", lineHeight:1.9}}>
          <div style={{display:"flex", borderBottom:"1px solid #334155", paddingBottom:3, marginBottom:3, fontWeight:700, color:"#94a3b8"}}><span style={{flex:1.2}}>PAIRE</span><span style={{flex:1, color:"#4ade80", background:liveRisk==="RISK-ON"?"#0a2818":"transparent", borderRadius:3, opacity:(liveRisk&&liveRisk!=="RISK-ON")?0.3:1}}>🟢 RISK-ON</span><span style={{flex:1, color:"#f87171", background:liveRisk==="RISK-OFF"?"#2a0a0a":"transparent", borderRadius:3, opacity:(liveRisk&&liveRisk!=="RISK-OFF")?0.3:1}}>🔴 RISK-OFF</span></div>
          {[
            ["GBP/JPY","▲ ACHAT (JPY vendu)","▼ VENTE (fuite vers JPY)","achat","vente"],
            ["EUR/JPY","▲ ACHAT (JPY vendu)","▼ VENTE (fuite vers JPY)","achat","vente"],
            ["CHF/JPY","▲ ACHAT (JPY vendu)","▼ VENTE (fuite vers JPY)","achat","vente"],
            ["EUR/AUD","▼ VENTE (AUD acheté)","▲ ACHAT (AUD lâché)","vente","achat"],
            ["GBP/AUD","▼ VENTE (AUD acheté)","▲ ACHAT (AUD lâché)","vente","achat"],
            ["EUR/NZD","▼ VENTE (NZD acheté)","▲ ACHAT (NZD lâché)","vente","achat"],
            ["GBP/NZD","▼ VENTE (NZD acheté)","▲ ACHAT (NZD lâché)","vente","achat"],
          ].map((r,i)=>(
            <div key={i} style={{display:"flex", borderBottom:"1px solid #1e293b"}}><span style={{flex:1.2, color:"#e2e8f0", fontWeight:700}}>{r[0]}</span><span style={{flex:1, color:r[3]==="achat"?"#4ade80":"#f87171", background:liveRisk==="RISK-ON"?"#0a2818":"transparent", borderRadius:3, opacity:(liveRisk&&liveRisk!=="RISK-ON")?0.3:1}}>{r[1]}</span><span style={{flex:1, color:r[4]==="achat"?"#4ade80":"#f87171", background:liveRisk==="RISK-OFF"?"#2a0a0a":"transparent", borderRadius:3, opacity:(liveRisk&&liveRisk!=="RISK-OFF")?0.3:1}}>{r[2]}</span></div>
          ))}
          <div style={{display:"flex", borderBottom:"1px solid #1e293b", background:"#1a150033"}}><span style={{flex:1.2, color:"#fbbf24", fontWeight:700}}>XAU/USD 🥇</span><span style={{flex:1, color:"#f87171", background:liveRisk==="RISK-ON"?"#0a2818":"transparent", borderRadius:3, opacity:(liveRisk&&liveRisk!=="RISK-ON")?0.3:1}}>{"▼ VENTE si USD #1-2"}</span><span style={{flex:1, color:"#4ade80", background:liveRisk==="RISK-OFF"?"#2a0a0a":"transparent", borderRadius:3, opacity:(liveRisk&&liveRisk!=="RISK-OFF")?0.3:1}}>{"▲ ACHAT si USD #7-8"}</span></div>
        </div>
        <div style={{fontSize:7.5, color:TEXT_DIM, marginTop:5, lineHeight:1.5}}>{"Lecture : la direction affichée est la SEULE validable sous ce sentiment. L'autre direction = ⛔ bloquée même à 3+ rangs. L'or exige en plus sa condition dollar — sentiment seul ne suffit jamais pour XAU. NEUTRE = rien n'est validable, paires comme or."}</div>
        
        <a href="https://www.babypips.com/tools/risk-on-risk-off-meter" target="_blank" rel="noopener noreferrer" style={{display:"block", marginTop:8, fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700}}>{"🌡️ Ouvrir le Risk-On/Risk-Off Meter ↗"}</a>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:12}}>
        <div onClick={()=>setOpenJour(!openJour)} style={{fontSize:11, color:"#34d399", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>📅 LE MEILLEUR JOUR POUR TRADER</span>
          <span style={{fontSize:13}}>{openJour ? "▲" : "▼"}</span>
        </div>
        {openJour && <div style={{marginTop:10}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}>Données BabyPips — fourchette de pips par jour sur tes 2 paires. Plus de pips = plus de mouvement à capter.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}><b style={{color:"#e2e8f0"}}>GBP/JPY :</b> Lun 137 · Mar 132 · Mer 146 · <b style={{color:"#4ade80"}}>Jeu 165</b> · Ven 152</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:8}}><b style={{color:"#e2e8f0"}}>EUR/JPY :</b> Lun 114 · Mar 113 · Mer 114 · <b style={{color:"#4ade80"}}>Jeu 140</b> · Ven 126</div>
          <div style={{fontSize:8, color:"#4ade80", lineHeight:1.6, marginBottom:3, fontWeight:600}}>✅ JEUDI = le meilleur jour (le sommet de la semaine, le plus de pips).</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}>👍 Mardi-mercredi = très bons. Milieu de semaine = activité max.</div>
          <div style={{fontSize:8, color:"#f59e0b", lineHeight:1.6, marginBottom:3}}>⚠️ Vendredi = MATIN seulement. BabyPips : chargé jusqu'à midi ET, puis le marché s'effondre. Sors tôt.</div>
          <div style={{fontSize:8, color:"#f87171", lineHeight:1.6, marginBottom:8}}>🚫 Lundi = le plus mou (le moins de pips). Prudence, souvent du range.</div>
          <div style={{fontSize:8, color:"#4ade80", padding:"7px 9px", background:"#052010", borderRadius:5, lineHeight:1.55, fontWeight:600}}>🔑 Ta stratégie complète : bon JOUR (jeudi) + bonne HEURE (7h45-8h45) + bonne PAIRE (GBP/JPY, EUR/JPY) + bon SETUP (cassure 8h). Les 4 alignés = ta meilleure probabilité.</div>
        </div>}
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #3a2a1f", marginBottom:12}}>
        <div onClick={()=>setOpenJpy(!openJpy)} style={{fontSize:11, color:"#fbbf24", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>🐉 TES PAIRES JPY — LE MOTEUR & QUAND SUIVRE LES DESKS</span>
          <span style={{fontSize:13}}>{openJpy ? "▲" : "▼"}</span>
        </div>
        {openJpy && <div style={{marginTop:10}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#fbbf24"}}>1. Le carry trade — le moteur de fond.</b> GBP/JPY et EUR/JPY sont portées par le carry trade. La BoE et la BCE gardent des taux hauts, la BoJ reste ultra-basse (~0.75% contre 3.50%+ aux US, jusqu'à 300 points d'écart). Les desks empruntent le yen pas cher et achètent du rendement en GBP/EUR — ils VENDENT le yen en permanence. Résultat : un biais LONG structurel sur tes deux paires. C'est pour ça qu'elles tendent si bien : un courant de fond les pousse, tant que l'écart de taux tient.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#fbbf24"}}>2. Le risk-on/off — ton ③ EST le moteur.</b> Sur ces paires, le Risk Meter n'est pas un filtre de plus, c'est LE signal. RISK-ON = le carry roule, les desks chargent du long, tes paires montent. RISK-OFF = panique, ils débouclent le carry, fuite vers le yen refuge, tes paires plongent. Surveille les actions et les rendements US. Sentiment franc = tendance fiable. Sentiment qui hésite = carry incertain = tendance molle = tu passes.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#fbbf24"}}>3. Pourquoi JPY-cross et pas USD/JPY.</b> Tes cross (sans dollar) suivent PROPREMENT le risk-on/off. USD/JPY, lui, est pollué par les rendements US et peut se découpler : pendant qu'EUR/JPY et GBP/JPY continuent de tendre, USD/JPY cale ou s'inverse. C'est pour ça que tant de traders se font piéger sur USD/JPY. Tes paires sont les plus LISIBLES.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#f87171"}}>4. Le danger — la BoJ.</b> Quand le yen est trop faible, la Banque du Japon INTERVIENT (achète du yen) = retournement violent. Et quand le carry se débuncle d'un coup, c'est brutal (le VIX peut spiker comme en 2024). Méfie-toi les jours où le yen est à un niveau extrême + grosse news US ou BoJ. Ton ③ et ta vérif des news du matin doivent capter ce switch.</div>
          <div style={{fontSize:9, color:"#7dd3fc", fontWeight:700, marginTop:10, marginBottom:6}}>⏰ LEUR JOURNÉE — QUAND TU PEUX LES SUIVRE (heure ET)</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}>• Nuit-3h : Tokyo forme le range asiatique. Tu dors.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}>• 3h-7h : Londres CHARGE la tendance (carry). Tu lis le pourquoi, tu prépares.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}>• 7h30-8h : pause — les desks soufflent, le flag se dessine.</div>
          <div style={{fontSize:8, color:"#34d399", lineHeight:1.6, marginBottom:3, fontWeight:600}}>• 8h : NY relance, ils rechargent → ta CASSURE.</div>
          <div style={{fontSize:8, color:"#34d399", lineHeight:1.6, marginBottom:3, fontWeight:600}}>• 9h30 : le NYSE balaye — ton stop tient si le pôle est solide.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3, fontWeight:600}}>• 8h-12h : TA FENÊTRE — Londres ET New York poussent ensemble.</div>
          <div style={{fontSize:8, color:"#fbbf24", lineHeight:1.6, marginBottom:3, fontWeight:600}}>• 11h-12h : London Fix — les desks DÉBOUCLENT. Surveille ta sortie.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:8}}>• 12h-17h : Londres parti, NY seul. Tes cross JPY perdent leur moteur.</div>
          <div style={{fontSize:8, color:"#4ade80", padding:"7px 9px", background:"#052010", borderRadius:5, lineHeight:1.55, fontWeight:600}}>🔑 La règle JPY : les desks de Londres sont présents de 3h à 12h ET. Ton vrai créneau = 8h-12h. Le gros épuisement arrive souvent au fix de midi, PAS à 17h — ne traîne pas l'après-midi sur ces cross.</div>
          <div style={{fontSize:9, color:"#f87171", fontWeight:700, marginTop:10, marginBottom:6}}>⚔️ LA BATAILLE DE 8h — GBP/JPY HEURE PAR HEURE</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}><b style={{color:"#7dd3fc"}}>Avant 8h :</b> Londres a DÉJÀ dessiné la tendance (depuis 3h ET).</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}><b style={{color:"#f59e0b"}}>8h :</b> NY ouvre → la bataille commence : continuation OU retournement.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:3}}><b style={{color:"#f59e0b"}}>8h-9h :</b> les 30-60 min décisives — le scénario se révèle.</div>
          <div style={{fontSize:8, color:"#34d399", lineHeight:1.6, marginBottom:3, fontWeight:600}}>✅ 7h45-8h45 : le flag se dessine — TON scan, TON entrée.</div>
          <div style={{fontSize:8, color:"#34d399", lineHeight:1.6, marginBottom:3, fontWeight:600}}>9h30 : re-test (secondary test) — ton stop tient, le trade continue.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:8}}><b style={{color:"#f87171"}}>Après 12h :</b> GBP/JPY se vide (NY préfère les paires USD) → sors.</div>
          <div style={{fontSize:8, color:"#4ade80", padding:"7px 9px", background:"#052010", borderRadius:5, lineHeight:1.55, fontWeight:600}}>💡 Pourquoi 8h : tu entres AU MOMENT où NY ouvre et double la liquidité — le flag casse dans le sens du pôle. Tu suis les desks pendant qu'ils finissent d'exécuter.</div>
        </div>}
      </div>
      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:12}}>
        <div onClick={()=>setOpenScan(!openScan)} style={{fontSize:11, color:"#fbbf24", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>⏰ POURQUOI SCANNER À 7H45 — LA CASSURE DE 8H</span>
          <span style={{fontSize:13}}>{openScan ? "▲" : "▼"}</span>
        </div>
        {openScan && <div style={{marginTop:10}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#38bdf8"}}>1. Le flag est dessiné.</b> De 3h à 7h30 les desks ont construit le pôle. De 7h30 à 8h ils soufflent — le flag se dessine. À 8h NY ouvre : tu vois si le flag casse. Tu ne devines pas.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#38bdf8"}}>2. Tu scannes AVANT les news US de 8h30.</b> Tu identifies ta paire à 7h45-8h. Les news tombent à 8h30 — APRÈS ton scan. Si elles retournent le sentiment, tu ne prends pas le trade.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#38bdf8"}}>3. Le Currency Strength est exploitable.</b> À 7h45, Londres a poussé 5h. Le scan reflète leur conviction — assez mûr pour lire la direction, assez tôt pour entrer à la cassure.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#38bdf8"}}>4. Tu captes l'ouverture NY à 8h.</b> NY ouvre à 8h et double la liquidité — les desks finissent d'exécuter leur pôle. Ton entrée suit leur dernier mouvement.</div>
          <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.6, marginBottom:8}}>Le flag se lit sur M15 : après le pôle (3h-7h30), le prix consolide en légère contre-tendance (7h30-8h). À 8h, la clôture M15 casse hors du flag dans le sens du pôle — c'est ton signal.</div>
          <div style={{fontSize:8, color:"#4ade80", padding:"7px 9px", background:"#052010", borderRadius:5, lineHeight:1.55, fontWeight:600}}>💡 En une phrase : à 8h tu entres sur du VIVANT — NY vient d'ouvrir, la liquidité est là, le flag casse. Stop sous le flag, target = hauteur du pôle.</div>
        </div>}
      </div>
      <div style={{padding:"12px 14px", background:"#0a1220", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:12}}>
        <div onClick={()=>setOpenEntrees(!openEntrees)} style={{fontSize:11, color:"#f59e0b", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}><span>{"🔭 LA CASSURE 8H — COMMENT MONTER DERRIÈRE LES DESKS"}</span><span style={{fontSize:12}}>{openEntrees ? "▲" : "▼"}</span></div>
        {openEntrees && <>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8}}>{"Londres construit le pôle de 3h à 7h30, puis souffle de 7h30 à 8h — c'est le flag. À 8h NY ouvre et double la liquidité : les desks finissent d'exécuter. Le flag casse. Une seule entrée par jour."}</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8, padding:"8px 10px", background:"#0d1828", borderRadius:6}}><b style={{color:"#34d399"}}>{"\ud83d\udeaa LA CASSURE 8h (scan 7h45-8h45) : tu montes pendant qu'ils chargent."}</b>{" À 8h, les desks de Londres n'ont pas fini : ils ont piégé à 3h, chargé leurs tranches depuis 4h, et ils gardent leur dernière grosse poussée pour l'instant où le forex de New York ouvre et double la liquidité — un gros ordre a besoin de contreparties. Cette dernière poussée, c'est la cassure de leur flag. Tu la vois sur M15 : ils soufflent (le flag, 7h45-8h), puis NY arrive et ils chargent — le flag casse. Tu entres sur la clôture M15 confirmée, derrière leur volume. Tu les suis AU MOMENT où ils finissent d'exécuter — meilleur prix — stop sous le flag pour survivre au balayage de 9h30 qui peut venir après."}</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8, padding:"8px 10px", background:"#0d1828", borderRadius:6}}><b style={{color:"#fbbf24"}}>{"⚠️ Le balayage de 9h30."}</b>{" Après ton entrée, le NYSE peut tirer le prix CONTRE la tendance pour ramasser les stops retail. C'est normal et prévisible. Ton stop sous le flag te protège — si le pôle est solide, le trade reprend dans le sens de Londres."}</div>
        <div style={{fontSize:8, color:"#4ade80", lineHeight:1.5, padding:"7px 9px", background:"#052010", borderRadius:5, fontWeight:600}}>{"La règle des desks : CASSURE 8h = tu entres pendant qu'ils finissent de charger, stop sous le flag. UNE seule entrée par jour. La deuxième tentative est toujours la mauvaise."}</div>
        </>}
      </div>


      <div style={{display:"none"}}><div></div>
      </div>


      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div onClick={()=>setOpenMeca(!openMeca)} style={{fontSize:10, color:"#f59e0b", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}><span>📐 LA MÉCANIQUE — LE PÔLE ET LA CASSURE DE 8H</span><span style={{fontSize:12}}>{openMeca ? "▲" : "▼"}</span></div>
        {openMeca && <>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:10}}>{"La tendance de Londres (3h-7h30) est ta JAMBE. De 7h30 à 8h le flag se dessine. CASSURE 8h : NY ouvre, le flag casse dans le sens du pôle — tu entres sur la clôture M15 confirmée, stop sous le flag. Target = hauteur du pôle, sortie avant 17h. Le schéma ci-dessous illustre la cassure du flag à 8h (sur M15)."}</div>
        <svg width="100%" viewBox="0 0 340 185" height="280" style={{background:"#0a0f1a", borderRadius:6, marginBottom:8, display:"block"}}>
          <text x="8" y="12" fill="#64748b" fontSize="6" fontFamily="monospace">M15 — cassure de flag · Londres 3h-8h ET</text>
          <text x="8" y="175" fill="#38bdf8" fontSize="5.5" fontFamily="monospace">PÔLE LONDRES (3h-7h30)</text>
          <text x="160" y="175" fill="#fbbf24" fontSize="5.5" fontFamily="monospace">FLAG (7h30-8h)</text>
          <text x="220" y="175" fill="#4ade80" fontSize="5.5" fontFamily="monospace">CASSURE 8h NY</text>
          <polyline points="10,155 25,140 38,145 52,128 65,133 80,112 93,117 108,97 120,101 138,80 150,83" fill="none" stroke="#4ade80" strokeWidth="2.5"/>
          <polyline points="150,83 160,87 170,84 180,88 190,85 200,89" fill="none" stroke="#fbbf24" strokeWidth="2"/>
          <line x1="150" y1="79" x2="200" y2="83" stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="3,2"/>
          <line x1="150" y1="91" x2="200" y2="95" stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="3,2"/>
          <line x1="200" y1="20" x2="200" y2="160" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,2"/>
          <polyline points="200,89 215,68 232,50 250,33 268,18" fill="none" stroke="#4ade80" strokeWidth="2.5"/>
          <text x="205" y="60" fill="#4ade80" fontSize="7" fontFamily="monospace" fontWeight="700">CASSURE</text>
          <text x="205" y="70" fill="#86efac" fontSize="6" fontFamily="monospace">clôture M15 ✓</text>
          <line x1="188" y1="98" x2="240" y2="98" stroke="#f87171" strokeWidth="1.2" strokeDasharray="3,2"/>
          <text x="188" y="108" fill="#f87171" fontSize="6" fontFamily="monospace">STOP sous le flag</text>
          <line x1="268" y1="14" x2="320" y2="14" stroke="#4ade80" strokeWidth="1" strokeDasharray="3,2"/>
          <text x="248" y="11" fill="#4ade80" fontSize="5.5" fontFamily="monospace">TARGET = hauteur du pôle</text>
          <text x="30" y="100" fill="#4ade80" fontSize="7" fontFamily="monospace" fontWeight="700">PÔLE</text>
          <text x="30" y="110" fill="#86efac" fontSize="5.5" fontFamily="monospace">Londres 3h→7h30</text>
          <text x="152" y="72" fill="#fbbf24" fontSize="6.5" fontFamily="monospace" fontWeight="700">FLAG</text>
        </svg>
        <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>{"① Pôle : Londres pousse de 3h à 7h30 (jambe haussière M15). ② Flag : consolidation 7h30-8h (légère contre-tendance). ③ Cassure 8h : clôture M15 hors du flag dans le sens du pôle = entrée. Stop sous le flag. Target = hauteur du pôle. Miroir baissier identique, inversé."}</div>
        </>}
      </div>

      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div onClick={()=>setOpenTrades(!openTrades)} style={{fontSize:10, color:"#38bdf8", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}><span>🎯 CE QUE TU TRADES — ET COMMENT LIRE CHACUN</span><span style={{fontSize:12}}>{openTrades ? "▲" : "▼"}</span></div>
        {openTrades && <>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8}}><b style={{color:"#38bdf8"}}>Tes 7 paires</b> — EUR/AUD · GBP/AUD · EUR/NZD · GBP/NZD · GBP/JPY · EUR/JPY · CHF/JPY. Une devise de Londres (EUR, GBP, CHF) contre une devise d'Asie-Pacifique (AUD, NZD, JPY) : le pôle que tu trades est construit par les desks de Londres eux-mêmes. <b>Lecture :</b> écart ≥3 rangs au Currency Strength entre les deux devises, la plus forte au-dessus = la direction. Le scanner calcule, ton M15 confirme le pôle.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8}}><b style={{color:"#fbbf24"}}>XAU/USD (l'or)</b> — un cas spécial : pas deux devises à comparer, UNE seule question — où est le dollar ? L'or est coté en dollars : dollar fort = or sous pression, dollar faible = or qui respire. <b>Lecture :</b> USD #1-2 au Currency Strength = VENTE possible · USD #7-8 = ACHAT possible · USD au milieu (#3-6) = pas de conviction, pas de trade or. Même mécanique que tes paires : à 8h NY et le COMEX ouvrent ensemble — l'or casse son flag de Londres, tu entres sur la clôture M15 confirmée. Seul le signal change — dollar + peur convergents au lieu d'une divergence de rangs.</div>
        <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Pourquoi pas de paires CAD ni de majors dollar ? Le CAD est une devise de session NY (pas de pôle de Londres propre), et les majors USD ont leur vraie vie après ta fenêtre. Tes 7 paires + l'or couvrent exactement le terrain où la tendance de Londres existe.</div>
        </>}
      </div>


      <div style={{display:"none"}}>
      </div>

      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div onClick={()=>setOpenDesks(!openDesks)} style={{fontSize:10, color:"#38bdf8", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}><span>🧠 OÙ SONT LES DESKS — VERSION INTRADAY</span><span style={{fontSize:12}}>{openDesks ? "▲" : "▼"}</span></div>
        {openDesks && <>
        {[
          {h:"3h", t:"Londres ouvre et tend le piège", d:"Fausse cassure du range asiatique, chasse aux stops. Le premier mouvement MENT.", n:"Tu dors ou tu prépares. Jamais de position ici."},
          {h:"4h-7h30", t:"Le pôle se construit", d:"Le piège passé, les desks chargent leur vraie position par tranches. Un flux continu sur ton M15 = leur conviction. Puis 7h30-8h ils soufflent : le flag se dessine, la pause avant NY.", n:"Tu lis le POURQUOI (6h-9h), tu repères la jambe et les bornes du flag."},
          {h:"8h", t:"Forex NY ouvre — CASSURE 8h", d:"La liquidité double. Si les desks ont une conviction, leur flag casse dans le sens du pôle = la continuation fraîche de leur tendance du matin.", n:"Entrée cassure 8h : clôture M15 hors du flag. Stop sous le flag — si 9h30 balaye, ton stop tient."},
          {h:"8h30", t:"⚠️ Les news US", d:"CPI, NFP, claims tombent à 8h30 — APRÈS ton entrée à 8h. Si une grosse news retourne le sentiment, ton stop te sort proprement.", n:"Tu ne touches à rien. Stop et target gèrent."},
          {h:"8h", t:"CASSURE — TON ENTRÉE", d:"NY ouvre, la liquidité double, le flag de Londres casse dans le sens du pôle. Tu entres sur la clôture M15 confirmée.", n:"Stop sous le flag. Target = hauteur du pôle. Sortie avant 17h."},
          {h:"9h30", t:"Balayage NYSE — ton stop tient", d:"Le NYSE peut tirer le prix CONTRE la tendance de Londres pour ramasser les stops retail. Si ton stop est sous le flag, tu survis et le trade continue.", n:"Tu ne touches à rien. Stop et target font le travail."},
          {h:"9h30-17h", t:"NY porte la tendance", d:"Le balayage passé, NY reprend dans le sens de Londres et porte le mouvement l'après-midi. Ton trade vit sa vie : stop et target font le travail.", n:"Tu ne touches à rien. Pas de stop déplacé, pas de target gourmand."},
          {h:"17h", t:"Fin de NY — fin de ton trade", d:"Les desks de NY clôturent. Après 17h, le marché passe à l'Asie : autre logique, autre session — plus TON trade.", n:"Tu sors, gagnant ou perdant. Le Day Trade meurt à 17h, sans exception."},
        ].map((x,i)=>(
          <div key={i} style={{display:"flex", gap:8, padding:"7px 9px", marginBottom:4, background:"#0a1020", borderRadius:5}}>
            <span style={{color:"#7dd3fc", fontWeight:700, fontSize:8.5, minWidth:48}}>{x.h}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:8.5, fontWeight:700, color:TEXT}}>{x.t}</div>
              <div style={{fontSize:7.5, color:TEXT_DIM, lineHeight:1.5, marginTop:1}}>{x.d}</div>
              <div style={{fontSize:7.5, color:"#fbbf24", lineHeight:1.5, marginTop:2}}>🧠 {x.m}</div>
            </div>
          </div>
        ))}
        <div style={{fontSize:8, color:"#4ade80", marginTop:6, padding:"7px 9px", background:"#052010", borderRadius:5, lineHeight:1.5, fontWeight:600}}>La règle d'or intraday : Londres construit la tendance (3h-7h30). Tu montes derrière les desks à la CASSURE du flag à 8h — NY ouvre, la liquidité double, tu entres sur la clôture M15 confirmée. Tu sors avant 17h. Une seule entrée, zéro overnight.</div>
        </>}
      </div>

      <div style={{padding:"12px 14px", background:"#160a2e", borderRadius:8, border:"1px solid #c084fc44", marginBottom:14}}>
        <div onClick={()=>setOpenTete(!openTete)} style={{fontSize:10, color:"#c084fc", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}><span>🧠 DANS LA TÊTE DES DESKS DE LONDRES</span><span style={{fontSize:12}}>{openTete ? "▲" : "▼"}</span></div>
        {openTete && <>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#c084fc"}}>Qui ils sont.</b> Des équipes d'exécution dans les banques (Deutsche, HSBC, BNP, Barclays) avec deux moteurs : les ORDRES CLIENTS (fonds, multinationales qui doivent convertir des milliards aujourd'hui — flux obligatoires) et la CONVICTION macro de la banque (« la BoJ reste accommodante, on vend le JPY »). Ils ne devinent pas le marché : ils SONT le marché — ton edge n'est pas de les battre, c'est de lire leur trace.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#c084fc"}}>Comment ils pensent.</b> Un desk qui doit vendre 2 milliards de JPY ne clique pas « vendre » : il lui faut des ACHETEURS en face. D'où le piège de 3h — pousser le prix contre la tendance prévue pour déclencher les stops et les entrées du retail, qui fournissent la liquidité. Puis il charge sa vraie position par tranches (4h-7h30), en laissant le prix respirer entre chaque tranche pour ne pas révéler sa main. Le pôle propre que tu vois sur M15 = des tranches d'exécution disciplinées, pas un coup de tête.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#fbbf24"}}>Le déjeuner et le déboucle.</b> Vers 7h-8h ET, les desks de Londres déjeunent — la tendance ralentit, c'est ton flag. Mais à leur retour, méfiance : en fin de session, ils BLOQUENT souvent leurs bénéfices. La cassure de 8h peut donc être une vraie continuation OU un déboucle de prise de profits. Si le flag casse proprement à 8h sur clôture M15 = continuation. Si la clôture échoue = déboucle. Tu lis la bougie — c'est elle qui tranche.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#c084fc"}}>Comment les observer.</b> Trois fenêtres : ① le M15 (la trace brute — un flux continu après 4h = conviction, des mèches dans les deux sens = indécision, pas de trade) · ② le Currency Strength (leur allocation agrégée — quelle devise reçoit le capital, laquelle le perd) · ③ les session wraps de 6h-7h30 (le POURQUOI — quel commentaire de banque centrale, quelle news anime leur conviction). Quand les trois racontent la même histoire, tu lis juste.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}}><b style={{color:"#c084fc"}}>Quand les suivre — et quand pas.</b> JAMAIS sur le premier mouvement (3h-4h = le piège, par définition). Tu les suis quand leur travail est VISIBLE et TESTÉ : le pôle construit (4h-7h30), flag dessiné (7h30-8h), puis tu entres à la cassure du flag à 8h. Au moment précis où la liquidité de NY confirme que le train roule. Pas de pôle propre = ils hésitent = toi aussi tu t'abstiens. Et le ❄️ Least Volatile le confirme : une paire dans ce top n'a pas reçu leurs tranches aujourd'hui.</div>
        <div style={{fontSize:8, color:"#fbbf24", lineHeight:1.6, padding:"7px 9px", background:"#1a1500", borderRadius:5}}>⏱️ Le timing en une ligne : ils piègent à 3h, chargent de 4h à 7h30, soufflent de 7h30 à 8h. Toi : tu lis à 6h-9h, tu scannes (7h45-8h45), et tu entres à la cassure du flag de 8h (clôture M15 confirmée). Tu n'es jamais en avance sur eux — tu es juste derrière, là où c'est payé.</div>
        </>}
      </div>

      <div style={{padding:"10px 12px", background:"#160a2e", borderRadius:8, border:"1px solid #c084fc44", marginBottom:14}}>
        <div onClick={()=>setOpenVs(!openVs)} style={{fontSize:9, color:"#c084fc", fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}><span>⚔️ DAY TRADE FX vs SWING FX — ne les mélange jamais</span><span style={{fontSize:11}}>{openVs ? "▲" : "▼"}</span></div>
        {openVs && <>
        <div style={{fontSize:8, color:TEXT, lineHeight:1.65}}>Même ADN (pôle → repli → reprise), deux animaux : le <b style={{color:"#38bdf8"}}>Day Trade</b> se scanne de 7h45 à 8h45 (cassure du flag à 8h), une seule entrée par jour, et meurt à 17h. Le <b style={{color:"#fbbf24"}}>Swing</b> et le <b style={{color:"#34d399"}}>Swing 2.0</b> se scannent à 11h-16h, entrent à la cassure le soir/Tokyo sur H1, et vivent 1-3 jours. Un trade Day Trade se gère en day trade jusqu'au bout — il ne devient JAMAIS un swing parce qu'il perd.</div>
        </>}
      </div>
    </div>
  );
}
