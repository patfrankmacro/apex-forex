import { useState } from "react";

export default function DayTradeOrView() {
  const [rawCom, setRawCom] = useState("");
  const [rawFx, setRawFx] = useState("");
  const [result, setResult] = useState(null);
  const TEXT="#c8d4f0", TEXT_DIM="#4a5070";

  const analyze = () => {
    try {
      const COMS = ["XAU","XAG","NGAS","Copper","WHEATF","CORNF","SOYF","UKOil","USOil"];
      const CURS = ["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"];

      // --- Page Forex : on lit juste le rang de l'USD ---
      const fxLines = rawFx.split("\n").map(l=>l.trim()).filter(Boolean);
      const usdOrder=[]; let onFx=false;
      for (const l of fxLines){
        if (l.includes("Currency Strength Meter")){ onFx=true; continue; }
        if (onFx){ if (l.startsWith("As of")) break; const x=CURS.find(c=>l===c); if (x&&!usdOrder.includes(x)) usdOrder.push(x); }
      }
      const usdRank = usdOrder.indexOf("USD"); // 0 = plus fort, 7 = plus faible
      const usdTotal = usdOrder.length;

      // --- Page Commodities ---
      const cLines = rawCom.split("\n").map(l=>l.trim()).filter(Boolean);
      const grabStrength = () => {
        const order=[]; let on=false;
        for (const l of cLines){
          if (l.includes("Commodity Strength Meter")){ on=true; continue; }
          if (on){ if (l.startsWith("As of")) break; const x=COMS.find(c=>l===c); if (x&&!order.includes(x)) order.push(x); }
        }
        return order;
      };
      const grabComPairs = (startName, stops) => {
        const out=[]; let on=false, rank=0;
        for (let i=0;i<cLines.length;i++){
          const l=cLines[i];
          if (l.includes(startName)){ on=true; continue; }
          if (on){
            if (l.startsWith("As of")||stops.some(s=>l.includes(s))) break;
            const x=COMS.find(c=>l===c);
            if (x){
              let chg=null;
              for (let j=i+1;j<Math.min(i+4,cLines.length);j++){ const pm=cLines[j].match(/([+-]?\d+\.\d+)%/); if (pm){chg=parseFloat(pm[1]);break;} }
              rank++;
              out.push({com:x, chg, rank});
            }
          }
        }
        return out;
      };

      const strength = grabStrength(); // 0 = plus fort
      const sRank = {}; strength.forEach((c,i)=>sRank[c]=i);
      const gainers  = grabComPairs("Top Gainers", ["Top Losers","Volatility"]);
      const losers   = grabComPairs("Top Losers", ["Volatility","Commodity Volatility"]);
      const mostVol  = grabComPairs("Most Volatile", ["Least Volatile","MarketMilk","Copyright"]);
      const leastVol = grabComPairs("Least Volatile", ["MarketMilk","Copyright","Contact"]).map(p=>p.com);
      const volSet = {}; mostVol.forEach(p=>volSet[p.com]=p.rank);

      if (strength.length===0 || usdRank<0){ setResult({error:"Format non reconnu — colle la page Commodities ET la page Forex (Currency Strength avec USD)."}); return; }

      const TRADE = ["XAU"]; // on trade uniquement l or
      const candidates = [];

      const consider = (com, direction) => {
        if (!TRADE.includes(com)) return;
        const cRank = sRank[com]; if (cRank==null) return;
        // momentum top 2
        const list = direction==="LONG" ? gainers : losers;
        const inTop2 = list.slice(0,2).some(p=>p.com===com);
        if (!inTop2) return;
        // divergence : LONG -> com fort (top3) + USD faible (3 plus faibles) ; SHORT -> inverse
        let divOk=false;
        if (direction==="LONG") divOk = (cRank<=2) && (usdRank>=usdTotal-3);
        else divOk = (cRank>=strength.length-3) && (usdRank<=2);
        if (!divOk) return;
        // pas least volatile
        if (leastVol.includes(com)) return;
        // dans most volatile
        if (!volSet[com]) return;
        const chg = (list.find(p=>p.com===com)||{}).chg;
        candidates.push({com, direction, cRank, usdRank, volRank:volSet[com], chg});
      };

      ["XAU"].forEach(c=>{ consider(c,"LONG"); consider(c,"SHORT"); });

      candidates.sort((a,b)=>Math.abs(b.chg||0)-Math.abs(a.chg||0));
      if (candidates[0]) candidates[0].best=true;

      setResult({ top:candidates, usdRank, usdTotal, usdOrder, strength });
    } catch(e){ setResult({error:"Erreur d'analyse : "+e.message}); }
  };

  return <DayTradeOrUI rawCom={rawCom} setRawCom={setRawCom} rawFx={rawFx} setRawFx={setRawFx} result={result} analyze={analyze} TEXT={TEXT} TEXT_DIM={TEXT_DIM} />;
}

function DayTradeOrUI({ rawCom, setRawCom, rawFx, setRawFx, result, analyze, TEXT, TEXT_DIM }) {
  const box = {width:"100%", minHeight:70, background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8, color:TEXT, fontSize:10, padding:"8px 10px", fontFamily:"monospace", resize:"vertical", boxSizing:"border-box"};
  return (
    <div style={{maxWidth:760, margin:"0 auto", padding:"4px 2px"}}>
      <div style={{fontSize:13, color:"#fbbf24", fontWeight:700, letterSpacing:2, marginBottom:4}}>⚡ DAY TRADE OR — XAU/USD MOMENTUM</div>
      <div style={{fontSize:9, color:TEXT_DIM, marginBottom:14}}>Système intraday pour l'or (XAU/USD) · basé sur la force de l'or + la faiblesse/force de l'USD · Séparé du Day Trade FX</div>

      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:6}}>🥇 1. COLLE LA PAGE COMMODITIES</div>
      <textarea value={rawCom} onChange={e=>setRawCom(e.target.value)} placeholder="Colle ici la page Commodities de MarketMilk (Commodity Strength, Gainers, Losers, Most/Least Volatile)..." style={box} />
      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, margin:"12px 0 6px"}}>💵 2. COLLE LA PAGE FOREX (pour l'USD)</div>
      <textarea value={rawFx} onChange={e=>setRawFx(e.target.value)} placeholder="Colle ici la page Forex de MarketMilk (Currency Strength Meter avec USD)..." style={box} />
      <button onClick={analyze} style={{marginTop:10, width:"100%", padding:"10px", background:"#fbbf24", color:"#1a1500", border:"none", borderRadius:6, fontSize:11, fontWeight:700, letterSpacing:1, cursor:"pointer"}}>⚡ ANALYSER L'OR</button>

      {result && result.error && (<div style={{marginTop:10, padding:"10px", background:"#1a0a00", borderRadius:6, fontSize:9, color:"#fbbf24", lineHeight:1.6}}>{result.error}</div>)}

      {result && !result.error && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:8, color:TEXT_DIM, marginBottom:8}}>USD : rang {result.usdRank+1}/{result.usdTotal} au Currency Strength {result.usdRank>=result.usdTotal-3?"(faible → favorise l'OR haussier)":result.usdRank<=2?"(fort → favorise l'OR baissier)":"(neutre)"}</div>
          <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🎯 {result.top.length} OPPORTUNITÉ{result.top.length>1?"S":""} OR (les 4 filtres réunis)</div>
          {result.top.length===0 && <div style={{padding:"12px", background:"#0a1628", borderRadius:8, fontSize:9, color:TEXT_DIM, lineHeight:1.6}}>AUCUNE opportunité OR maintenant. Soit l'or n'a pas la divergence avec l'USD, soit pas le momentum top 2, soit pas assez de volatilité. Pas de trade = discipline.</div>}
          {result.top.map((o,i)=>{
            const isLong=o.direction==="LONG"; const name=o.com==="XAU"?"OR (XAU/USD)":"ARGENT (XAG/USD)";
            return (
              <div key={i} style={{marginBottom:10, padding:"12px 14px", borderRadius:8, background:isLong?"linear-gradient(135deg,#04140a,#0a2818)":"linear-gradient(135deg,#1a0608,#2a0a0e)", border:`1px solid ${isLong?"#00ff88":"#ff4d5e"}`, borderLeft:`5px solid ${isLong?"#00ff88":"#ff4d5e"}`, boxShadow:o.best?`0 0 14px ${isLong?"rgba(0,255,136,.4)":"rgba(255,77,94,.4)"}`:"none"}}>
                <div style={{fontSize:12, fontWeight:800, color:isLong?"#00ff88":"#ff4d5e", marginBottom:6}}>{i===0?"🥇":i===1?"🥈":"🥉"} {isLong?"▲ ACHETER":"▼ VENDRE"} {name} {o.best?"⭐ MEILLEURE":""}</div>
                <div style={{fontSize:9, color:TEXT, lineHeight:1.6}}>
                  <div><b style={{color:"#fbbf24"}}>POURQUOI :</b> {isLong?`l'or est FORT (commodité) et l'USD FAIBLE (rang ${o.usdRank+1}/${o.usdTotal}). Quand le dollar baisse, l'or monte → on achète.`:`l'or est FAIBLE (commodité) et l'USD FORT (rang ${o.usdRank+1}/${o.usdTotal}). Quand le dollar monte, l'or baisse → on vend.`}</div>
                  <div><b style={{color:"#fbbf24"}}>LE SIGNAL :</b> {isLong?"top gainer":"top loser"} {o.chg!=null?`(${o.chg>0?"+":""}${o.chg}%)`:""} · dans Most Volatile · divergence or/USD</div>
                  <div><b style={{color:"#fbbf24"}}>EXÉCUTION :</b> attends un repli sur H1/M15 puis entre dans le sens du momentum. Stop serré, target 1.5-2× le risque. Surveille les news US (8h30).</div>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:8, color:TEXT_DIM, marginTop:6, lineHeight:1.5}}>⚠ L'or se trade surtout en session NEW YORK (8h-12h ET) et réagit fort aux news US. Pas de filtre retail sur l'or (moins fiable que sur le forex).</div>
        </div>
      )}

      <div style={{marginTop:18, padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🎯 LA LOGIQUE DE L'OR</div>
        <div style={{fontSize:9, color:TEXT, lineHeight:1.6}}>L'or (XAU) et le dollar (USD) sont des frères ennemis : quand l'USD baisse, l'or monte, et inversement. C'est la relation la plus fiable du métal jaune. On ne devine pas : on attend que l'or bouge DÉJÀ (momentum) dans le sens de la faiblesse/force du dollar.<br/><br/>Contrairement au forex de Londres, l'or se joue surtout en <b style={{color:"#fbbf24"}}>session New York (8h-12h ET)</b> : c'est là que le dollar et les taux US bougent le plus. L'or réagit violemment aux news US (inflation, emploi, Fed) — d'où l'importance de vérifier le calendrier avant d'entrer.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:10}}>📋 LES 4 FILTRES</div>
        <div style={{display:"flex", flexDirection:"column", gap:9}}>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>DIVERGENCE OR/USD</b> : achat = or FORT (top 3 commodités) + USD FAIBLE (3 plus faibles au forex) ; vente = or FAIBLE + USD FORT (top 3)</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>TOP 2 MOMENTUM</b> : l'or est #1 ou #2 des Top Gainers (achat) ou Top Losers (vente) des commodités. Le mouvement est lancé</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>PAS LEAST VOLATILE</b> : on écarte l'or s'il stagne (pas de pips à faire)</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>DANS MOST VOLATILE</b> : l'or doit figurer dans la liste Most Volatile des commodités (il bouge vraiment)</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#4ade80", fontWeight:700, minWidth:16}}>▶</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#4ade80"}}>ENTRÉE</b> : repli sur H1/M15 dans le sens du momentum. Stop serré, target 1.5-2×. Surveille les news US à 8h30</span></div>
        </div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8}}>Pas de filtre retail sur l'or : le retail est presque toujours long sur le métal, donc moins fiable que sur le forex.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:10}}>🕐 MEILLEURES HEURES — OR (heure de New York)</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <div style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#4ade80"}}>⭐ 8h00 – 12h00 ET — TON CRÉNEAU OR.</b> New York ouvre, le dollar et les taux US bougent : c'est là que l'or fait ses plus gros mouvements.</div>
          <div style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>8h30 – 10h00 ET — News US.</b> Inflation, emploi, Fed : l'or réagit violemment. Énorme opportunité MAIS gros risque — vérifie le calendrier.</div>
          <div style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#f87171"}}>⛔ Soir / nuit.</b> Volume faible, spreads larges. L'or bouge peu et de façon erratique. Évite.</div>
        </div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:8}}>🧠 PSYCHOLOGIE OR</div>
        <div style={{fontSize:9, color:TEXT, lineHeight:1.6}}>L'or est PLUS volatil que le forex : il bouge vite et fort. Stop serré obligatoire. Ne chasse jamais un mouvement déjà très avancé. Et rappelle-toi : l'or peut renverser brutalement sur une news US — si tu es en position pendant une annonce, sois prêt.</div>
      </div>

      <div style={{padding:"14px", background:"linear-gradient(135deg, #001a0d 0%, #003319 100%)", borderRadius:8, border:"2px solid #00ff88", borderLeft:"5px solid #00ff88", boxShadow:"0 0 16px rgba(0,255,136,0.4)"}}>
        <div style={{fontSize:11, color:"#00ff88", fontWeight:700, marginBottom:4}}>☀️ TON RITUEL OR — avant la session NY (8h ET)</div>
        <div style={{fontSize:8.5, color:"#a7f3d0", marginBottom:12, lineHeight:1.4}}>Ouvre les 2 pages MarketMilk (Commodities + Forex), puis vérifie les news US avant de prendre position.</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <a href="https://marketmilk.babypips.com/commodities" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #fbbf24"}}>🥇 1. MarketMilk Commodités <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— or, argent, force, volatilité (boîte 1)</span></a>
          <a href="https://marketmilk.babypips.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #00ff88"}}>💵 2. MarketMilk Forex <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— pour la force de l'USD (boîte 2)</span></a>
          <a href="https://www.babypips.com/economic-calendar?week=2026-W23" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #f87171"}}>📅 3. Calendrier économique <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— news US (inflation, emploi, Fed)</span></a>
          <a href="https://investinglive.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #38bdf8"}}>📰 4. InvestingLive <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— actualité en direct</span></a>
          <a href="https://www.financialjuice.com/home" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #c084fc"}}>🧃 5. FinancialJuice <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— flux de news temps réel</span></a>
          <a href="https://www.sucdenfinancial.com/en/market-insights/fx-outlook/daily-fx-analysis/" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #fbbf24"}}>📊 6. Sucden Financial <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— analyse quotidienne pro</span></a>
        </div>
      </div>
    </div>
  );
}
