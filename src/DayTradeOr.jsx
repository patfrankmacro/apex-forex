import { useState } from "react";

export default function DayTradeOrView() {
  const [rawCom, setRawCom] = useState("");
  const [rawFx, setRawFx] = useState("");
  const [result, setResult] = useState(null);
  const TEXT="#c8d4f0", TEXT_DIM="#4a5070";

  const analyze = () => {
    try {
      // Blocage horaire : OR seulement de 9h a 12h ET (Golden Overlap, COMEX ouvert + news 8h30 passee)
      const nowET = new Date(new Date().toLocaleString("en-US", {timeZone:"America/New_York"}));
      const minsET = nowET.getHours()*60 + nowET.getMinutes();
      if (minsET < 540 || minsET > 720) {
        const hh = String(nowET.getHours()).padStart(2,"0"), mm = String(nowET.getMinutes()).padStart(2,"0");
        setResult({error:`⏰ Il est ${hh}h${mm} à New York. Le Day Trade OR s'analyse entre 9h et 12h ET (Golden Overlap). Avant 9h, le COMEX vient d'ouvrir et la news de 8h30 n'est pas digérée — la direction des desks NY n'est pas lisible. Après 12h, le volume retombe. Reviens dans la fenêtre.`});
        return;
      }
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
        const cRank = sRank[com];
        // NOUVELLE LOGIQUE : l'or se compare au DOLLAR, pas aux autres commodites.
        // On regarde 2 choses : (1) le dollar est-il en tete/queue du Currency Strength,
        // (2) l'or confirme-t-il (present dans gainers pour LONG, losers pour SHORT).
        const list = direction==="LONG" ? gainers : losers;
        const found = list.find(p=>p.com===com);
        if (!found) return; // l'or n'est pas du bon cote (ou trop plat pour etre liste) -> pas de trade
        const chg = found.chg;
        // FILTRE DOLLAR : USD doit etre dans le TOP 2 fort (SHORT or) ou TOP 2 faible (LONG or)
        let usdOk=false;
        if (direction==="LONG") usdOk = (usdRank >= usdTotal-2);   // USD #7 ou #8 sur 8 = tres faible -> or monte
        else usdOk = (usdRank <= 1);                               // USD #1 ou #2 = tres fort -> or baisse
        if (!usdOk) return;
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
      <div style={{fontSize:9, color:TEXT_DIM, marginBottom:14}}>Système intraday pour l'or (XAU/USD) · session New York / COMEX · entrée 9h ET · basé sur la force de l'or + la faiblesse/force de l'USD · Séparé du Day Trade FX</div>

      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:6}}>🥇 1. COLLE LA PAGE COMMODITIES</div>
      <textarea value={rawCom} onChange={e=>setRawCom(e.target.value)} placeholder="Colle ici la page Commodities de MarketMilk (Commodity Strength, Gainers, Losers, Most/Least Volatile)..." style={box} />
      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, margin:"12px 0 6px"}}>💵 2. COLLE LA PAGE FOREX (pour l'USD)</div>
      <textarea value={rawFx} onChange={e=>setRawFx(e.target.value)} placeholder="Colle ici la page Forex de MarketMilk (Currency Strength Meter avec USD)..." style={box} />
      <button onClick={analyze} style={{marginTop:10, width:"100%", padding:"10px", background:"#fbbf24", color:"#1a1500", border:"none", borderRadius:6, fontSize:11, fontWeight:700, letterSpacing:1, cursor:"pointer"}}>⚡ ANALYSER L'OR</button>

      {result && result.error && (<div style={{marginTop:10, padding:"10px", background:"#1a0a00", borderRadius:6, fontSize:9, color:"#fbbf24", lineHeight:1.6}}>{result.error}</div>)}

      {result && !result.error && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:8, color:TEXT_DIM, marginBottom:8}}>USD : rang {result.usdRank+1}/{result.usdTotal} au Currency Strength {result.usdRank>=result.usdTotal-3?"(faible → favorise l'OR haussier)":result.usdRank<=2?"(fort → favorise l'OR baissier)":"(neutre)"}</div>
          <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🎯 {result.top.length} OPPORTUNITÉ{result.top.length>1?"S":""} OR (les 2 filtres réunis)</div>
          {result.top.length===0 && <div style={{padding:"12px", background:"#0a1628", borderRadius:8, fontSize:9, color:TEXT_DIM, lineHeight:1.6}}>AUCUNE opportunité OR maintenant. Soit l'or n'a pas la divergence avec l'USD (or fort + dollar faible, ou l'inverse), soit il n'est pas dans le top 3 des gainers/losers. Pas de trade = discipline — quand l'or sort, la direction est nette.</div>}
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
        <div style={{fontSize:9, color:TEXT, lineHeight:1.7}}>L'or (XAU) et le dollar (USD) sont des frères ennemis : quand l'USD baisse, l'or monte, et inversement. C'est la relation la plus fiable du métal jaune. L'or est investi principalement depuis les États-Unis — c'est un actif <b style={{color:"#fbbf24"}}>américain</b>, pas un actif de Londres ou d'Asie comme tes paires FX.<br/><br/>
        <b style={{color:"#38bdf8"}}>⏰ Ton entrée — 9h ET, une fois la direction NY lisible :</b> contrairement au FX (entrée 6h30 sur la trace de Londres), l'or se joue sur le <b>COMEX de New York</b>. Le COMEX ouvre à 8h20, les news US tombent à 8h30 (l'or réagit violemment), puis la poussière retombe. À <b>9h</b>, les desks institutionnels de NY ont révélé leur direction et la news est digérée. C'est TON moment : tu lis leur trace sur MarketMilk et tu entres derrière eux.<br/><br/>
        <b style={{color:"#f87171"}}>📅 L'or n'est PAS un swing comme le FX :</b> la session asiatique du soir TUE le volume de l'or au lieu de le relayer. L'or se trade dans la fenêtre <b>9h-12h ET</b> (Golden Overlap), puis tu sors avant midi. C'est un trade de journée, propre et net — pas une position gardée plusieurs jours. Mercredi (FOMC) et jeudi sont les jours les plus forts.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:8}}>📊 LES NEWS US QUI BOUGENT L'OR</div>
        <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:10, lineHeight:1.5}}>L'or bouge à l'inverse du dollar. Ce qui compte = le chiffre RÉEL vs les ATTENTES (consensus), pas juste bon ou mauvais.</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <div style={{padding:"7px 9px", background:"#001018", borderRadius:5}}><div style={{fontSize:9, color:"#f87171", fontWeight:700, marginBottom:2}}>🔴 CPI / Inflation</div><div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Plus HAUT que prévu → Fed agressive (taux hauts) → <b style={{color:"#4ade80"}}>USD ↑</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#f87171"}}>OR ↓</b><br/>Plus BAS que prévu → Fed assouplit → <b style={{color:"#f87171"}}>USD ↓</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#4ade80"}}>OR ↑</b></div></div>
          <div style={{padding:"7px 9px", background:"#001018", borderRadius:5}}><div style={{fontSize:9, color:"#38bdf8", fontWeight:700, marginBottom:2}}>🔵 Non-Farm Payrolls (NFP) / Emploi</div><div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Plus HAUT que prévu (économie forte) → <b style={{color:"#4ade80"}}>USD ↑</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#f87171"}}>OR ↓</b><br/>Plus BAS que prévu (économie molle) → <b style={{color:"#f87171"}}>USD ↓</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#4ade80"}}>OR ↑</b></div></div>
          <div style={{padding:"7px 9px", background:"#001018", borderRadius:5}}><div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:2}}>🟡 Taux de chômage — LOGIQUE INVERSÉE</div><div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Plus BAS que prévu (moins de chômeurs = économie forte) → <b style={{color:"#4ade80"}}>USD ↑</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#f87171"}}>OR ↓</b><br/>Plus HAUT que prévu (économie molle) → <b style={{color:"#f87171"}}>USD ↓</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#4ade80"}}>OR ↑</b></div></div>
          <div style={{padding:"7px 9px", background:"#001018", borderRadius:5}}><div style={{fontSize:9, color:"#4ade80", fontWeight:700, marginBottom:2}}>🟢 PMI (manufacturier / services)</div><div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Au-dessus de 50 et mieux que prévu (expansion) → <b style={{color:"#4ade80"}}>USD ↑</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#f87171"}}>OR ↓</b><br/>Sous 50 ou pire que prévu (contraction) → <b style={{color:"#f87171"}}>USD ↓</b><span style={{color:TEXT_DIM}}> / </span><b style={{color:"#4ade80"}}>OR ↑</b></div></div>
        </div>
        <div style={{fontSize:8, color:"#fbbf24", marginTop:8, padding:"7px 9px", background:"#1a1500", borderRadius:5, lineHeight:1.5}}>💡 Règle simple : économie US forte = dollar fort = or faible. Économie US molle = dollar faible = or fort. L'or réagit à la SURPRISE (réel vs consensus) — si tout sort comme prévu, l'or bouge peu. ⚠️ N'entre JAMAIS juste avant une news : attends qu'elle passe (8h30) puis entre à 9h.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:10}}>📋 LES 2 FILTRES</div>
        <div style={{display:"flex", flexDirection:"column", gap:9}}>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>DOLLAR TOP 2</b> : achat = USD dans les 2 PLUS FAIBLES du forex (#7 ou #8) ; vente = USD dans les 2 PLUS FORTS (#1 ou #2). L'or est l'inverse du dollar — quand le dollar est clairement fort ou faible, l'or suit mécaniquement. C'est LE moteur.</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>L'OR CONFIRME</b> : l'or doit être présent dans les Top Gainers (achat) ou Top Losers (vente) de la page Commodities. S'il est trop plat pour y figurer = pas de trade. Ce filtre confirme que l'or bouge vraiment dans le même sens que la divergence dollar.</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#4ade80", fontWeight:700, minWidth:16}}>▶</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#4ade80"}}>ENTRÉE</b> : repli sur H1/M15 dans le sens du momentum. Stop serré, target 1.5-2×. Surveille les news US à 8h30</span></div>
        </div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8}}>Pas de filtre retail sur l'or : le retail est presque toujours long sur le métal, donc moins fiable que sur le forex.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:6}}>📐 EXEMPLE RÉEL — XAU/USD ACHAT · 4 juin 2026</div>
        <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:10, lineHeight:1.4}}>Commodity Strength : XAU #3 · USD #8/8 au forex · XAU top gainer #3 (+0.90%). Voici pourquoi XAU/USD ACHAT cochait les 2 filtres.</div>
        <div style={{display:"flex", flexDirection:"column", gap:7}}>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>①</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>Dollar top 2 faible ✓</b> — USD #8/8 au forex = le dollar est dans les 2 plus faibles. Dollar au plancher → l'or monte mécaniquement. C'est le moteur du trade.</span></div>
          <div style={{display:"flex", gap:8, padding:"7px 9px", background:"#001018", borderRadius:5}}><span style={{color:"#fbbf24", fontWeight:700, minWidth:16}}>②</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#fbbf24"}}>L'or confirme ✓</b> — XAU présent dans les Top Gainers (+0.90%). L'or monte pendant que le dollar s'effondre — il confirme la divergence. Le mouvement est lancé.</span></div>
        </div>
        <div style={{fontSize:9, color:"#4ade80", marginTop:10, padding:"8px 10px", background:"#0a2010", borderRadius:5, lineHeight:1.5, fontWeight:600}}>✅ Les 2 filtres réunis = ALERTE ACHAT. Le dollar s'effondrait (USD #8/8) et l'or était fort (top 3) et déjà en mouvement (top gainer #3). Tu ne devines pas — tu suis un flux institutionnel déjà lancé et confirmé par les 2 filtres.</div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:8, lineHeight:1.4}}>💡 Pourquoi ce trade était gagnant : quand le dollar est la devise la plus faible ET que l'or grimpe déjà (top gainer), les institutionnels achètent l'or comme valeur refuge. Tes 2 filtres captent exactement ce moment — la direction, pas le bruit.</div>
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
              <div style={{fontSize:9, color:"#38bdf8", fontWeight:700}}>Nuit — Londres prépare (PAS ton heure)</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Londres bouge l'or pendant la nuit, mais le vrai marché de l'or (le COMEX de New York) n'est pas encore ouvert. La direction n'est pas fiable. Ce n'est pas ton moment.</div>
              <div style={{fontSize:8, color:"#4a5070", marginTop:2}}>→ Dors. Tu n'entres pas la nuit.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e3a5f", border:"2px solid #c084fc", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#c084fc", fontWeight:700}}>8h20</div>
              <div style={{width:2, height:32, background:"#c084fc44"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#c084fc", fontWeight:700}}>8h20 ET — LE COMEX OUVRE ⚡</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Le marché à terme de l'or de New York ouvre. Les desks institutionnels (banques, hedge funds) commencent à se positionner. Le vrai volume de l'or arrive.</div>
              <div style={{fontSize:8, color:"#c084fc", marginTop:2}}>→ Observe. Ne touche à rien encore.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a1500", border:"2px solid #fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#fbbf24", fontWeight:700}}>8h30</div>
              <div style={{width:2, height:32, background:"#fbbf2444"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#fbbf24", fontWeight:700}}>8h30 ET — NEWS US ⚠️</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>CPI, NFP, chômage, PMI, FOMC tombent. L'or réagit violemment. Mercredi (FOMC) et jeudi = jours les plus actifs. NE PAS entrer maintenant — laisse la news passer.</div>
              <div style={{fontSize:8, color:"#fbbf24", marginTop:2}}>→ Attends. Lis la réaction (voir guide news US).</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#fbbf24,#f59e0b)", border:"3px solid #fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#1a1500", fontWeight:900, boxShadow:"0 0 12px rgba(251,191,36,0.6)"}}>9h</div>
              <div style={{width:2, height:40, background:"#fbbf2466"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8, padding:"8px 10px", background:"#1a1500", borderRadius:6, border:"1px solid #fbbf2466", marginBottom:4}}>
              <div style={{fontSize:10, color:"#fbbf24", fontWeight:900}}>⚡ 9h00 ET — TON ENTRÉE</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5, marginTop:2}}>Le COMEX roule depuis 8h20, la news de 8h30 est passée. Les desks NY ont révélé leur direction. Tu colles MarketMilk, tu lances l'analyse. Si tes 2 filtres passent → tu entres au repli derrière eux.</div>
              <div style={{fontSize:8.5, color:"#fbbf24", fontWeight:700, marginTop:4}}>→ Colle + analyse + entre au repli sur H1/M15</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1a2a00", border:"2px solid #4ade80", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"#4ade80", fontWeight:700}}>9-12h</div>
              <div style={{width:2, height:32, background:"#4ade8044"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#4ade80", fontWeight:700}}>9h-12h ET — GOLDEN OVERLAP ⭐</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Londres + New York actifs en même temps, COMEX à plein régime. 70% des highs/lows journaliers de l'or se forment dans cette fenêtre. C'est là que ton trade travaille.</div>
              <div style={{fontSize:8, color:"#4ade80", marginTop:2}}>→ Tiens ta position. Remonte ton stop.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#1e1a2e", border:"2px solid #c084fc", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#c084fc", fontWeight:700}}>11h</div>
              <div style={{width:2, height:32, background:"#c084fc33"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#c084fc", fontWeight:700}}>11h ET — Pic de volume final</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Dernière poussée du Golden Overlap avant la fermeture de Londres. Souvent une accélération ou confirmation du mouvement. Sécurise tes gains.</div>
              <div style={{fontSize:8, color:"#c084fc", marginTop:2}}>→ Surveille. Remonte ton stop.</div>
            </div>
          </div>

          <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", minWidth:32}}>
              <div style={{width:28, height:28, borderRadius:"50%", background:"#052010", border:"2px solid #4ade80", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#4ade80", fontWeight:700}}>12h</div>
              <div style={{width:2, height:32, background:"#f8717133"}}/>
            </div>
            <div style={{flex:1, paddingBottom:8}}>
              <div style={{fontSize:9, color:"#4ade80", fontWeight:700}}>12h ET — SÉCURISE ET SORS</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>Le Golden Overlap se termine, Londres ferme. Le volume de l'or retombe. Les institutionnels prennent leurs profits. Risque de renversement.</div>
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

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #fbbf2444", marginBottom:14}}>
        <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🏦 COMMENT SUIVRE LES INSTITUTIONNELS SUR L'OR</div>
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #38bdf8"}}>
            <div style={{fontSize:9, color:"#38bdf8", fontWeight:700, marginBottom:3}}>8h20 ET — Le COMEX ouvre, les desks NY entrent</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>L'or se trade vraiment sur le COMEX de New York. À 8h20, Goldman NY, JPMorgan, les hedge funds et fonds souverains commencent à se positionner. Si l'USD est faible, ils achètent l'or ; s'il est fort, ils le vendent.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#052010", borderRadius:6, borderLeft:"3px solid #00ff88"}}>
            <div style={{fontSize:9, color:"#00ff88", fontWeight:700, marginBottom:3}}>9h ET — Tu lis leur trace et tu les suis</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Le COMEX roule depuis 8h20, la news US de 8h30 est passée. Or fort + USD faible = les desks NY ont acheté ; or faible + USD fort = ils ont vendu. Tes 2 filtres confirment. Tu entres derrière eux au repli sur H1/M15.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #fbbf24"}}>
            <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:3}}>9h-12h ET — Le Golden Overlap travaille</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Londres + New York actifs en même temps, COMEX à plein régime. 70% des highs/lows journaliers de l'or se forment dans cette fenêtre. Ton trade travaille pendant que le volume institutionnel pousse le mouvement.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #4ade80"}}>
            <div style={{fontSize:9, color:"#4ade80", fontWeight:700, marginBottom:3}}>12h ET — Tu sors AVANT la fin du Golden Overlap</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>À midi, le Golden Overlap se termine et Londres ferme. Le volume de l'or retombe, les spreads s'élargissent, le mouvement peut se renverser. Sors avant 12h — ton profit est fait. L'or n'est pas un swing : on ne le garde pas le soir.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#001018", borderRadius:6, borderLeft:"3px solid #c084fc"}}>
            <div style={{fontSize:9, color:"#c084fc", fontWeight:700, marginBottom:3}}>🔗 Pourquoi tu suis le dollar pour trader l'or</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Tu ne devines pas la direction de l'or — tu la lis dans le dollar. Quand une news US sort à 8h30 (inflation, emploi), les desks NY achètent ou vendent le dollar selon le résultat. L'or fait l'inverse, automatiquement. À 9h, MarketMilk te montre déjà cette direction (or fort/faible + USD fort/faible). Tu confirmes avec tes 2 filtres et tu suis.</div>
          </div>
          <div style={{padding:"8px 10px", background:"#1a1500", borderRadius:6, border:"1px solid #fbbf2444"}}>
            <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:3}}>💡 La règle d'or de l'or</div>
            <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Quand l'USD s'effondre, les banques centrales (Chine, Russie, Inde) et les fonds institutionnels achètent l'or massivement comme valeur refuge. Tes 2 filtres captent exactement ce moment. Tu ne devines pas — tu suis un flux déjà lancé et confirmé.</div>
          </div>
        </div>
      </div>

      <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:8}}>🧠 PSYCHOLOGIE OR</div>
        <div style={{fontSize:9, color:TEXT, lineHeight:1.6}}>L'or est un actif CALME et propre : il trend sans le bruit du gaz ou de l'argent. C'est sa force — des mouvements lisibles, pas erratiques. Mais il peut renverser brutalement sur une news US : ne sois jamais en position juste avant une annonce, et ne chasse pas un mouvement déjà très avancé. Stop serré, target réaliste (l'or fait ~1%/jour, pas 3%).</div>
      </div>

      <div style={{padding:"14px", background:"linear-gradient(135deg, #001a0d 0%, #003319 100%)", borderRadius:8, border:"2px solid #00ff88", borderLeft:"5px solid #00ff88", boxShadow:"0 0 16px rgba(0,255,136,0.4)"}}>
        <div style={{fontSize:11, color:"#00ff88", fontWeight:700, marginBottom:4}}>☀️ TON RITUEL OR — avant ton entrée (9h ET)</div>
        <div style={{fontSize:8.5, color:"#a7f3d0", marginBottom:12, lineHeight:1.4}}>Ouvre les 2 pages MarketMilk (Commodities + Forex), puis vérifie les news US avant de prendre position.</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <a href="https://marketmilk.babypips.com/commodities" target="_blank" rel="noopener noreferrer" style={{display:"block", padding:"10px 12px", background:"#001a10", color:TEXT, borderRadius:6, fontSize:10, fontWeight:600, textDecoration:"none", borderLeft:"3px solid #fbbf24"}}>🥇 1. MarketMilk Commodités <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— or + force/momentum (boîte 1)</span></a>
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
