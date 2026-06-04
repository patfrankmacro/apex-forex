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
      const comVolMeter=[]; let onCV=false;
      for (const l of cLines){
        if (l.includes("Commodity Volatility Meter")){ onCV=true; continue; }
        if (onCV){ if (l.startsWith("As of")) break; const x=COMS.find(c=>l===c); if (x&&!comVolMeter.includes(x)) comVolMeter.push(x); }
      }
      const cvRank={}; comVolMeter.forEach((c,i)=>cvRank[c]=i); // 0=plus volatile
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
        const list = direction==="LONG" ? gainers : losers;
        const found = list.find(p=>p.com===com);
        const chg = found ? found.chg : null;
        // FILTRE 1 - DIVERGENCE : or top3 Commodity Strength + USD 3 plus faibles (LONG) ; inverse SHORT
        let divOk=false;
        if (direction==="LONG") divOk = (cRank<=2) && (usdRank>=usdTotal-3);
        else divOk = (cRank>=strength.length-3) && (usdRank<=2);
        if (!divOk) return;
        // FILTRE 2 - TOP 3 MOMENTUM gainers ou losers
        const inTop3 = list.slice(0,3).some(p=>p.com===com);
        if (!inTop3) return;
        // FILTRE 3 - VOLATILITE : dans Most Volatile + dans top4 Volatility Meter + pas Least Volatile
        if (!volSet[com]) return; // pas dans Most Volatile (top5 affiche)
        if (cvRank[com]==null || cvRank[com]>3) return; // pas dans top4 Volatility Meter
        if (leastVol.includes(com)) return; // dans Least Volatile
        candidates.push({com, direction, cRank, usdRank, usdTotal, chg, inMostVol:!!volSet[com]});
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
          <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🎯 {result.top.length} OPPORTUNITÉ{result.top.length>1?"S":""} OR (les 3 filtres réunis)</div>
          {result.top.length===0 && <div style={{padding:"12px", background:"#0a1628", borderRadius:8, fontSize:9, color:TEXT_DIM, lineHeight:1.6}}>AUCUNE opportunité OR maintenant. Soit l'or n'a pas la divergence avec l'USD, soit il n'est pas dans le top 3 des gainers/losers, soit il ne bouge pas assez (pas dans Most Volatile). Pas de trade = discipline — quand l'or sort, c'est un vrai mouvement.</div>}
          {result.top.map((o,i)=>{
            const isLong=o.direction==="LONG"; const name=o.com==="XAU"?"OR (XAU/USD)":"ARGENT (XAG/USD)";
            return (
              <div key={i} style={{marginBottom:10, padding:"12px 14px", borderRadius:8, background:isLong?"linear-gradient(135deg,#04140a,#0a2818)":"linear-gradient(135deg,#1a0608,#2a0a0e)", border:`1px solid ${isLong?"#00ff88":"#ff4d5e"}`, borderLeft:`5px solid ${isLong?"#00ff88":"#ff4d5e"}`, boxShadow:o.best?`0 0 14px ${isLong?"rgba(0,255,136,.4)":"rgba(255,77,94,.4)"}`:"none"}}>
                <div style={{fontSize:12, fontWeight:800, color:isLong?"#00ff88":"#ff4d5e", marginBottom:6}}>{i===0?"🥇":i===1?"🥈":"🥉"} {isLong?"▲ ACHETER":"▼ VENDRE"} {name} {o.best?"⭐ MEILLEURE":""}</div>
                <div style={{fontSize:9, color:TEXT, lineHeight:1.6}}>
                  <div><b style={{color:"#fbbf24"}}>POURQUOI :</b> {isLong?`l'or est FORT (commodité) et l'USD FAIBLE (rang ${o.usdRank+1}/${o.usdTotal}). Quand le dollar baisse, l'or monte → on achète.`:`l'or est FAIBLE (commodité) et l'USD FORT (rang ${o.usdRank+1}/${o.usdTotal}). Quand le dollar monte, l'or baisse → on vend.`}</div>
                  <div><b style={{color:"#fbbf24"}}>LE SIGNAL :</b> {isLong?"top gainer":"top loser"} {o.chg!=null?`(${o.chg>0?"+":""}${o.chg}%)`:""} · divergence or/USD confirmée</div>
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
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:10}}>📋 LES 3 FILTRES</div>
        <div style={{display:"flex", flexDirection:"column", gap:9}}>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>DIVERGENCE OR/USD</b> : achat = or dans le TOP 3 des commodités + USD dans les 3 PLUS FAIBLES du forex ; vente = or dans les 3 plus faibles + USD dans le top 3. C est LE moteur de l or</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>TOP 3 MOMENTUM</b> : l'or est dans le top 3 des Top Gainers (achat) ou Top Losers (vente) des commodités. Le mouvement est lancé</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>VOLATILITÉ RÉELLE</b> : l'or doit être dans le <b>Most Volatile</b> (top 5 affiché) + dans le <b>top 4 du Commodity Volatility Meter</b> + pas dans Least Volatile. Quand l'or passe ce filtre, c'est un vrai mouvement — rare mais solide</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#4ade80", fontWeight:700, minWidth:16}}>▶</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#4ade80"}}>ENTRÉE</b> : repli sur H1/M15 dans le sens du momentum. Stop serré, target 1.5-2×. Surveille les news US à 8h30</span></div>
        </div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8}}>Pas de filtre retail sur l'or : le retail est presque toujours long sur le métal, donc moins fiable que sur le forex.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:6}}>📐 EXEMPLE RÉEL — XAU/USD ACHAT · 4 juin 2026</div>
        <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:10, lineHeight:1.4}}>Commodity Strength : XAU #3 · USD #8/8 au forex · XAU top gainer #3 (+1.06%). Voici pourquoi XAU/USD ACHAT cochait les 3 filtres.</div>
        <div style={{display:"flex", flexDirection:"column", gap:7}}>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>Divergence ✓</b> — XAU #3 au Commodity Strength (top 3) + USD #8/8 au forex (3 plus faibles). L'or FORT + dollar FAIBLE = les deux tirent dans le même sens. C'est le moteur du trade.</span></div>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>Momentum ✓</b> — XAU top gainer #3 (+1.06%) des commodités. Le mouvement haussier est déjà lancé. L'or grimpe pendant que le dollar s'effondre.</span></div>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>③</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>Volatilité ✓</b> — XAU dans Most Volatile + top 4 Commodity Volatility Meter. L'or bouge vraiment ce jour-là — pas une montée molle. Un vrai mouvement tradable.</span></div>
        </div>
        <div style={{fontSize:9, color:"#4ade80", marginTop:10, padding:"8px 10px", background:"#0a2010", borderRadius:5, lineHeight:1.5, fontWeight:600}}>✅ Les 3 filtres réunis = ALERTE ACHAT. XAU/USD a monté de +1.06% pendant la session NY. Le dollar s'effondrait (USD #8/8), l'or était fort ET volatile. Tu ne devines pas — tu suis un flux institutionnel déjà lancé et confirmé par les 3 filtres.</div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8, lineHeight:1.4}}>💡 Pourquoi ce trade était gagnant : quand le dollar est la devise la plus faible ET que l'or est dans Most Volatile, les institutionnels achètent l'or massivement comme valeur refuge. Tes 3 filtres captent exactement ce moment.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #fbbf2444", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:4}}>🗺️ GPS — L'AGENDA DES INSTITUTIONNELS SUR L'OR</div>
        <div style={{fontSize:8, color:TEXT_DIM, marginBottom:12}}>Suis leur calendrier. Entre derrière eux après confirmation. Sniper precision.</div>
        <div style={{display:"flex", flexDirection:"column", gap:0}}>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e3a5f", border:"2px solid #38bdf8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#38bdf8", fontWeight:700}}>2h</div>
              <div style={{width:2, height:32, background:"#1e3a5f"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#38bdf8", fontWeight:700}}>2h00-5h00 ET — LONDON KILL ZONE</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Banques bullion de Londres (Goldman, HSBC, UBS) placent leurs premières positions. Londres est le plus grand marché OTC d'or au monde.</div>
              <div style={{fontSize:8, color:"#4a5070", marginTop:2}}>→ Dors. Les gros joueurs construisent.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e3a5f", border:"2px solid #c084fc", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#c084fc", fontWeight:700}}>5h30</div>
              <div style={{width:2, height:32, background:"#c084fc44"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#c084fc", fontWeight:700}}>5h30 ET — LONDON AM GOLD FIX ⚡</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Les grandes banques bullion fixent le premier prix de référence officiel de l'or. Pic de volume institutionnel. La direction du jour se confirme.</div>
              <div style={{fontSize:8, color:"#c084fc", marginTop:2}}>→ Dors. Observe le biais directionnel.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#052010", border:"2px solid #00ff88", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#00ff88", fontWeight:700}}>6h</div>
              <div style={{width:2, height:32, background:"#00ff8844"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#00ff88", fontWeight:700}}>6h00 ET — PRÉPARE-TOI</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Ouvre MarketMilk Commodities + Forex. Vérifie la force de l'or et la faiblesse de l'USD. Vérifie le calendrier éco US.</div>
              <div style={{fontSize:8, color:"#00ff88", marginTop:2}}>→ Rituel OR. Check tes 2 pages.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#fbbf24,#f59e0b)", border:"3px solid #fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#1a1500", fontWeight:900, boxShadow:"0 0 12px rgba(251,191,36,0.6)"}}>6h30</div>
              <div style={{width:2, height:40, background:"#fbbf2466"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8, padding:"8px 10px", background:"#1a1500", borderRadius:6, border:"1px solid #fbbf2466", marginBottom:4}}>
              <div style={{fontSize:10, color:"#fbbf24", fontWeight:900}}>⚡ 6h30 ET — VÉRIFIE TES 3 FILTRES</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5, marginTop:2}}>Londres a déjà bougé l'or depuis 2h. Si tes 3 filtres passent → le mouvement institutionnel est confirmé. Entre au repli.</div>
              <div style={{fontSize:8.5, color:"#fbbf24", fontWeight:700, marginTop:4}}>→ Alerte = entre au repli sur H1/M15</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a2a00", border:"2px solid #4ade80", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#4ade80", fontWeight:700}}>8h</div>
              <div style={{width:2, height:32, background:"#4ade8044"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#4ade80", fontWeight:700}}>8h00 ET — GOLDEN OVERLAP ⭐</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>NY ouvre. COMEX s'active. 70% des highs/lows journaliers de l'or se forment ici. Le mouvement de Londres s'amplifie massivement.</div>
              <div style={{fontSize:8, color:"#4ade80", marginTop:2}}>→ Tiens ta position. Remonte ton stop.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a1500", border:"2px solid #fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#fbbf24", fontWeight:700}}>8h30</div>
              <div style={{width:2, height:32, background:"#fbbf2422"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#fbbf24", fontWeight:700}}>8h30 ET — NEWS US ⚠️</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>CPI, NFP, FOMC. L'or réagit violemment. Mercredi/Jeudi = jours les plus actifs (FOMC, données emploi).</div>
              <div style={{fontSize:8, color:"#fbbf24", marginTop:2}}>→ Stop au break-even si en profit.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e1a2e", border:"2px solid #c084fc", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#c084fc", fontWeight:700}}>10h</div>
              <div style={{width:2, height:32, background:"#c084fc33"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#c084fc", fontWeight:700}}>10h00 ET — LONDON PM GOLD FIX ⚡</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Deuxième prix de référence officiel fixé par les banques bullion. Deuxième pic de volume. Souvent une accélération ou confirmation du mouvement.</div>
              <div style={{fontSize:8, color:"#c084fc", marginTop:2}}>→ Surveille. Possible accélération finale.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#052010", border:"2px solid #4ade80", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#4ade80", fontWeight:700}}>11h</div>
              <div style={{width:2, height:32, background:"#f8717133"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#4ade80", fontWeight:700}}>11h-12h ET — SÉCURISE ET SORS</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Londres ferme ses positions sur l'or. Les desks européens prennent leurs profits. Risque de renversement.</div>
              <div style={{fontSize:8, color:"#4ade80", marginTop:2}}>→ Sors avant 12h. Trade terminé.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a0000", border:"2px solid #f87171", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#f87171", fontWeight:700}}>12h+</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9, color:"#f87171", fontWeight:700}}>⛔ APRÈS 12h — ÉVITE</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Volume baisse, spreads s'élargissent. Les institutionnels sont sortis. Faux signaux.</div>
              <div style={{fontSize:8, color:"#f87171", marginTop:2}}>→ Ne trade pas.</div>
            </div>
          </div>

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
