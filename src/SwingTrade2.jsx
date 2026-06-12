import { useState } from "react";

const TEXT = "#c8d4f0", TEXT_DIM = "#4a5070";
const ST_PAIRS = [["EUR","AUD"],["GBP","AUD"],["EUR","NZD"],["GBP","NZD"],["GBP","JPY"],["EUR","JPY"],["CHF","JPY"]];
const CURS = ["USD","EUR","GBP","JPY","CHF","AUD","NZD","CAD"];

export default function SwingTrade2View() {
  const [raw, setRaw] = useState("");
  const [res, setRes] = useState(null);
  const [riskMode, setRiskMode] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("apexRisk")||"null"); if (s && s.d === new Date().toDateString()) return s.m; } catch(e){}
    return null;
  });
  const setRisk = (m) => { setRiskMode(m); try { localStorage.setItem("apexRisk", JSON.stringify({m, d:new Date().toDateString()})); } catch(e){} };
  const riskAligned = (quote, dir) => {
    if (!riskMode || riskMode === "NEUTRE") return false;
    const quoteRefuge = (quote === "JPY");
    if (quoteRefuge) return dir === "LONG" ? riskMode === "RISK-ON" : riskMode === "RISK-OFF";
    return dir === "LONG" ? riskMode === "RISK-OFF" : riskMode === "RISK-ON";
  };

  const analyze = () => {
    try {
      const nowET = new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
      const m = nowET.getHours()*60 + nowET.getMinutes();
      if (m < 660 || m > 960) {
        const hh=String(nowET.getHours()).padStart(2,"0"), mm=String(nowET.getMinutes()).padStart(2,"0");
        setRes({error:`⏰ Il est ${hh}h${mm} à New York. Le Swing 2.0 se scanne entre 11h et 16h ET — le Fix de 11h a clos le travail de Londres, et NY le teste en direct. Avant 11h = Londres pas finie. Après 16h = NY en sortie. Reviens dans la fenêtre.`});
        return;
      }
      const lines = raw.split("\n").map(s=>s.trim()).filter(Boolean);
      let csStart=-1, csEnd=lines.length;
      for (let i=0;i<lines.length;i++){
        if (csStart<0 && lines[i].includes("Currency Strength Meter")) csStart=i;
        else if (csStart>=0 && (lines[i].includes("As of")||lines[i].includes("Top Gainers"))){ csEnd=i; break; }
      }
      const order=[];
      if (csStart>=0) for (let i=csStart;i<csEnd;i++){ const t=lines[i]; if (CURS.includes(t) && !order.includes(t)) order.push(t); }
      if (order.length < 8) { setRes({error:"Classement incomplet ("+order.length+"/8 devises). Colle la page MarketMilk complète : Currency Strength + Top Gainers + Top Losers."}); return; }
      const rank={}; order.forEach((c,i)=>rank[c]=i+1);
      const grabSection = (start, stops) => {
        let si=-1, se=lines.length;
        for (let i=0;i<lines.length;i++){
          if (si<0 && lines[i].includes(start)) si=i;
          else if (si>=0 && stops.some(s=>lines[i].includes(s))){ se=i; break; }
        }
        const out=[];
        if (si>=0) for (let i=si;i<se;i++){ const mm2=lines[i].match(/^([A-Z]{3})\/([A-Z]{3})$/); if (mm2 && !out.includes(mm2[1]+"/"+mm2[2])) out.push(mm2[1]+"/"+mm2[2]); }
        return out.slice(0,5);
      };
      const gainers = grabSection("Top Gainers", ["Top Losers"]);
      const losers  = grabSection("Top Losers",  ["Currency Volatility","Most Volatile"]);
      // Top 5 absent = bonus simplement indisponible, pas bloquant
      const out=[];
      ST_PAIRS.forEach(([b,q])=>{
        const gap = Math.abs(rank[b]-rank[q]);
        const dir = rank[b]<rank[q] ? "LONG" : "SHORT";
        const pairStr = b+"/"+q;
        const inTop = dir==="LONG" ? gainers.includes(pairStr) : losers.includes(pairStr);
        const aligned = riskAligned(q, dir);
        const ok = gap>=3 && aligned;
        let pourquoi = "";
        if (ok) {
          const sens = dir==="LONG" ? "ACHAT" : "VENTE";
          const courant = (q==="JPY")
            ? (dir==="LONG" ? "RISK-ON : le JPY refuge est vendu, le courant porte ta paire vers le haut" : "RISK-OFF : la fuite vers le JPY refuge porte ta vente")
            : (dir==="LONG" ? "RISK-OFF : le "+q+" risqué est lâché, ta paire monte avec le courant" : "RISK-ON : le "+q+" risqué est acheté, ta paire descend avec le courant");
          pourquoi = sens+" car CONVERGENCE — ① "+b+" #"+rank[b]+" vs "+q+" #"+rank[q]+" = "+gap+" rangs (le capital a tranché sur les deux sessions) + ③ "+courant+"."+(inTop?" 🔥 BONUS ② : "+pairStr+" est dans le Top 5 "+(dir==="LONG"?"Gainers":"Losers")+" — le mouvement est DÉJÀ en cours, signal renforcé.":" (② Top 5 éteint : le mouvement n'a pas encore éclaté sur cette paire — la divergence est là, sois plus exigeant sur ton pôle H1.)");
        } else {
          const manque = [];
          if (gap<3) manque.push("divergence "+gap+"r (<3)");
          if (gap>=3 && !aligned) manque.push(riskMode ? (riskMode==="NEUTRE"?"sentiment NEUTRE":"③ "+riskMode+" pousse dans l'autre sens") : "sentiment non choisi");
          pourquoi = manque.join(" · ");
        }
        out.push({pair:pairStr, base:b, quote:q, rb:rank[b], rq:rank[q], gap, dir, inTop, aligned, ok, pourquoi});
      });
      out.sort((a,b2)=>(b2.ok?1:0)-(a.ok?1:0) || (b2.inTop?1:0)-(a.inTop?1:0) || b2.gap-a.gap);
      const ru = rank["USD"];
      let xau=null, xauConflit=null;
      if (ru <= 2 && riskMode === "RISK-ON") xau = {dir:"SHORT", why:"VENTE car DOUBLE CONVERGENCE — moteur dollar : USD #"+ru+" (l'or coté en USD subit sa force) + moteur peur : RISK-ON (le refuge est délaissé). Les deux moteurs poussent vers le BAS. Ton H1 confirme le pôle Londres+NY, le flag se dessine à Tokyo."};
      else if (ru >= 7 && riskMode === "RISK-OFF") xau = {dir:"LONG", why:"ACHAT car DOUBLE CONVERGENCE — moteur dollar : USD #"+ru+" (le dollar coule, l'or respire) + moteur peur : RISK-OFF (fuite vers le refuge). Les deux moteurs poussent vers le HAUT."};
      else if (ru <= 2 && riskMode === "RISK-OFF") xauConflit = "USD #"+ru+" pousse l'or en BAS mais le RISK-OFF le pousse en HAUT — les deux moteurs se battent, jour de mèches, pas de trade or.";
      else if (ru >= 7 && riskMode === "RISK-ON") xauConflit = "USD #"+ru+" pousse l'or en HAUT mais le RISK-ON le pousse en BAS — conflit, pas de trade or.";
      setRes({order, out, xau, xauConflit, ru, heure:String(nowET.getHours()).padStart(2,"0")+"h"+String(nowET.getMinutes()).padStart(2,"0")});
    } catch(e){ setRes({error:"Erreur: "+e.message}); }
  };

  const S = {sec:{padding:"12px 14px", background:"#06140d", borderRadius:8, border:"1px solid #34d39955", marginBottom:14}, h:{fontSize:11, color:"#34d399", fontWeight:700, marginBottom:8}, sh:{fontSize:9, color:"#34d399", fontWeight:700, marginBottom:5}, p:{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8}};

  return (
    <div>
      <div style={{fontSize:15, color:"#34d399", fontWeight:900, letterSpacing:1.5, marginBottom:5}}>⚡ SWING TRADE 2.0</div>
      <div style={{fontSize:9, color:"#34d399aa", fontWeight:700, letterSpacing:2, marginBottom:4}}>LONDRES + NEW YORK · ENTRÉE TOKYO · ① + ③ CONVERGENTS · ② BONUS</div>
      <div style={{fontSize:8.5, color:TEXT_DIM, lineHeight:1.6, marginBottom:14}}>Tu lis la journée COMPLÈTE des deux desks majeurs (scan 11h-16h), le flag se dessine à Tokyo, et tu entres à sa cassure. LE SIGNAL : ① divergence ≥3r + ③ sentiment aligné — les deux convergent ou pas de trade. BONUS ② : Top 5 Gainers/Losers = le mouvement a déjà éclaté, signal renforcé. Position 1-3 jours.</div>

      <div style={S.sec}>
        <div style={S.h}>📋 TA SÉQUENCE DU JOUR</div>
        {[
          ["1","📰","6H-8H — LE POURQUOI","News de la nuit (Asie) et du matin (Londres) + banques centrales (session wraps). L'histoire qui anime les desks aujourd'hui."],
          ["2","🌡️","11H — LE SENTIMENT (③)","Un regard sur le Risk Meter, un clic sur le bouton — mémorisé pour la journée, partagé avec ton Day Trade. Le courant de fond est posé."],
          ["3","🥛","11H-16H — SCANNE (① + ③)","Colle la page MarketMilk complète. Le Fix de 11h a signé la fin du travail de Londres, NY le teste en direct : tu lis les DEUX sessions. Le scanner croise divergence ≥3r + ton sentiment, et signale le bonus ② (Top 5) quand le mouvement a déjà éclaté."],
          ["4","👁️","VÉRIFIE LE PÔLE (H1)","Sur la paire signalée : un flux continu depuis 3h, porté par Londres PUIS par NY, sans inversion majeure. Le pôle des deux sessions = la matière première de ton flag."],
          ["5","⏳","17H-2H — TOKYO DESSINE LE FLAG","NY ferme, l'Asie respire : drift léger contre-tendance, SANS effondrement. Mesure au Fibonacci sur le pôle Londres+NY : 38.2% sain · 50% limite · Golden Pocket = dernière défense."],
          ["6","🚀","ENTRE À LA CASSURE DU FLAG","Tokyo casse dans le sens du pôle = entrée pendant la nuit · sinon Londres rouvre à 3h et casse = entrée à la reprise. C'est la cassure qui décide du moment, pas l'horloge. Stop derrière le flag · Target = hauteur du pôle · 1-3 jours."],
          ["7","🔁","CHAQUE JOUR 11H-16H — RÉÉVALUE","Devise forte toujours forte ? Sentiment inchangé ? Tu gardes. Un juge qui tourne = tu serres le stop. Deux = tu sors."],
        ].map((e,i)=>(
          <div key={i} style={{display:"flex", gap:8, padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4, alignItems:"flex-start"}}>
            <span style={{color:"#34d399", fontWeight:900, fontSize:11, minWidth:14}}>{e[0]}</span>
            <div><div style={{fontSize:9, fontWeight:700, color:"#e2e8f0"}}>{e[1]+" "+e[2]}</div><div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5, marginTop:2}}>{e[3]}</div></div>
          </div>
        ))}
        <div style={{fontSize:8, color:"#fbbf24", marginTop:6, lineHeight:1.5}}>Pas de convergence ① + ③ ? = Pas de trade, c'est la discipline. Le ② éteint ne bloque pas — il te dit juste d'être plus exigeant sur le pôle H1.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🤖 SCAN 11H-16H — COLLE TA PAGE MARKETMILK COMPLÈTE</div>
        <div style={{marginBottom:8, padding:"8px 10px", background:"#02100a", borderRadius:6, border:"1px solid #33415555"}}>
          <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:5}}>③ SENTIMENT DU JOUR (obligatoire) — lis le Risk Meter puis choisis :</div>
          <div style={{display:"flex", gap:6}}>
            {["RISK-ON","NEUTRE","RISK-OFF"].map(mm=>(
              <button key={mm} onClick={()=>setRisk(mm)} style={{flex:1, padding:"7px 4px", borderRadius:5, fontSize:8.5, fontWeight:700, cursor:"pointer", border: riskMode===mm ? "2px solid "+(mm==="RISK-ON"?"#4ade80":mm==="RISK-OFF"?"#f87171":"#94a3b8") : "1px solid #334155", background: riskMode===mm ? (mm==="RISK-ON"?"#052010":mm==="RISK-OFF"?"#200505":"#1a2030") : "#0a0f1a", color: riskMode===mm ? (mm==="RISK-ON"?"#4ade80":mm==="RISK-OFF"?"#f87171":"#94a3b8") : "#64748b"}}>{mm==="RISK-ON"?"🟢 RISK-ON":mm==="RISK-OFF"?"🔴 RISK-OFF":"⚪ NEUTRE"}</button>
            ))}
          </div>
          <a href="https://www.babypips.com/tools/risk-on-risk-off-meter" target="_blank" rel="noopener noreferrer" style={{display:"block", marginTop:6, fontSize:8.5, color:"#7dd3fc", textDecoration:"none"}}>🌡️ Ouvrir le Risk-On/Risk-Off Meter (babypips) ↗</a>
          {!riskMode && <div style={{fontSize:8, color:"#fbbf24", marginTop:4}}>⚠ Choisis le sentiment AVANT de scanner — sans lui, rien ne peut converger.</div>}
          {riskMode==="NEUTRE" && <div style={{fontSize:8, color:"#94a3b8", marginTop:4}}>NEUTRE = pas de courant : le ③ n'est pas rempli, aucune paire ni or validables aujourd'hui.</div>}
        </div>
        <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Colle la page MarketMilk COMPLÈTE (Currency Strength + Top Gainers + Top Losers) — le scanner croise ① ② ③..." style={{width:"100%", minHeight:90, background:"#02100a", color:TEXT, border:"1px solid #1e3a2f", borderRadius:6, padding:8, fontSize:9, fontFamily:"monospace", resize:"vertical"}}/>
        <button onClick={analyze} style={{marginTop:8, width:"100%", padding:"10px", background:"#34d399", color:"#02100a", border:"none", borderRadius:6, fontSize:11, fontWeight:900, cursor:"pointer", letterSpacing:1}}>⚡ SCANNER</button>
        <a href="https://marketmilk.babypips.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", marginTop:6, fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700}}>🥛 Ouvrir MarketMilk ↗</a>
        {res && res.error && <div style={{marginTop:10, padding:"10px", background:"#1a0a00", borderRadius:6, fontSize:9, color:"#fbbf24", lineHeight:1.6}}>{res.error}</div>}
        {res && res.out && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:6}}>Scan de {res.heure} · classement : {res.order.join(" > ")}</div>
            {res.out.filter(p=>p.ok).length===0 && <div style={{padding:"10px", background:"#1a1205", borderRadius:6, fontSize:9, color:"#fbbf24", marginBottom:6}}>Aucune triple convergence aujourd'hui — pas de trade FX, c'est la discipline. Les juges ne sont pas d'accord.</div>}
            {res.out.filter(p=>p.ok).map((p,i)=>(
              <div key={i} style={{padding:"8px 10px", marginBottom:5, background:p.dir==="LONG"?"#052010":"#200505", borderRadius:6, border:"1px solid "+(p.dir==="LONG"?"#4ade8044":"#f8717144")}}>
                <div style={{fontSize:10, fontWeight:700, color:p.dir==="LONG"?"#4ade80":"#f87171"}}>✅ {p.pair} {p.dir==="LONG"?"▲ ACHAT possible":"▼ VENTE possible"} — {p.base} #{p.rb} vs {p.quote} #{p.rq} = {p.gap} rangs</div>
                <div style={{fontSize:8.5, color:p.dir==="LONG"?"#86efac":"#fca5a5", marginTop:4, lineHeight:1.6, fontStyle:"italic"}}>{p.pourquoi}</div>
                <div style={{fontSize:8, color:TEXT_DIM, marginTop:4, lineHeight:1.5}}>Maintenant ton H1 : pôle Londres+NY continu depuis 3h dans ce sens ? Alors Tokyo dessinera le flag ce soir (Fib ≤50%) — entre à sa cassure, à Tokyo ou à la reprise de Londres.</div>
              </div>
            ))}
            <div style={{fontSize:7.5, color:"#64748b", marginBottom:6}}>{res.out.filter(p=>!p.ok).length+" paire(s) écartée(s) : "+res.out.filter(p=>!p.ok).map(p=>p.pair+" ("+p.pourquoi+")").join(" · ")}</div>
            {res.xau && (
              <div style={{padding:"8px 10px", marginBottom:4, background:res.xau.dir==="LONG"?"#1a1500":"#140d00", borderRadius:6, border:"1px solid #fbbf2444"}}>
                <div style={{fontSize:10, fontWeight:700, color:"#fbbf24"}}>✅ XAU/USD (OR) {res.xau.dir==="LONG"?"▲ ACHAT possible":"▼ VENTE possible"}</div>
                <div style={{fontSize:8.5, color:"#fde68a", marginTop:4, lineHeight:1.6, fontStyle:"italic"}}>{res.xau.why}</div>
              </div>
            )}
            {res.xauConflit && <div style={{padding:"8px 10px", background:"#140d00", borderRadius:6, fontSize:8.5, color:"#fbbf24", lineHeight:1.6}}>⚠ OR EN CONFLIT — {res.xauConflit}</div>}
            {!res.xau && !res.xauConflit && <div style={{fontSize:7.5, color:"#64748b"}}>Or : USD #{res.ru} {riskMode?("+ "+riskMode):""} — pas de double convergence, pas de trade or.</div>}
          </div>
        )}
      </div>

      <div style={S.sec}>
        <div style={S.h}>🎬 TA JOURNÉE, MINUTE PAR MINUTE — COMMENT TOUT S'EMBOÎTE</div>
        <div style={S.p}>Pendant que tu prépares ton café, les desks de Londres ouvrent à 3h, tendent leur piège, puis chargent leur vraie position par tranches jusqu'au Fix de 11h. À 8h, New York arrive avec la liquidité mondiale doublée : elle teste Londres, puis HÉRITE de sa direction et la porte jusqu'à 17h. Ta mission : lire l'œuvre des DEUX, puis monter dans le train quand l'Asie a fini de respirer.</div>
        <div style={S.p}><b style={{color:"#34d399"}}>6h-8h — Tu lis le POURQUOI.</b> Session wraps, banques centrales, news de la nuit. Quelle histoire anime les desks ? Sans le pourquoi, le classement n'est qu'un tableau de chiffres.</div>
        <div style={S.p}><b style={{color:"#34d399"}}>11h — Le Fix signe, tu choisis le sentiment.</b> Le travail de Londres est officiellement clos. Un regard sur le Risk Meter, un clic : le ③ est posé pour la journée.</div>
        <div style={S.p}><b style={{color:"#34d399"}}>11h-16h — Tu scannes les DEUX sessions.</b> Le Currency Strength agrège ce que Londres a FAIT et ce que NY en FAIT : une divergence ≥3r qui tient à travers les deux sessions = un vrai programme institutionnel, pas un coup du matin. Le sentiment confirme que le courant mondial la porte. ① + ③ = signal — et si la paire est en plus dans le Top 5 (②), le mouvement a déjà éclaté : bonus.</div>
        <div style={S.p}><b style={{color:"#34d399"}}>17h-2h — Tokyo dessine ton flag.</b> NY ferme, les desks asiatiques gèrent sans conviction directionnelle : le prix drifte contre la tendance, doucement. C'est la respiration que tu mesures au Fibonacci sur le pôle Londres+NY.</div>
        <div style={S.p}><b style={{color:"#34d399"}}>La cassure — Tokyo ou Londres décide.</b> Si l'Asie casse le flag dans le sens du pôle pendant la nuit : entrée. Si elle respire sagement jusqu'au matin : Londres rouvre à 3h et c'est SA reprise qui casse — entrée à la reprise. Tu ne choisis pas l'heure, tu obéis à la cassure confirmée (clôture H1 hors du flag).</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, padding:"8px 10px", background:"#02100a", borderRadius:5}}>⚡ En une phrase : Londres construit (3h-11h), NY valide et porte (8h-17h), Tokyo respire (17h-2h), et la cassure du flag — asiatique ou londonienne — te fait entrer dans un mouvement que DEUX sessions majeures ont déjà signé. Si la divergence ou le sentiment manque au scan, la chaîne est cassée et tu passes ton tour. Le Top 5 (②) est le thermomètre : allumé = déjà parti, éteint = vérifie ton pôle de près.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>📐 LA MÉCANIQUE — LE FLAG DE TOKYO</div>
        <div style={S.p}>Au Day Trade, le flag se forme en 30 minutes avant NY. Ici, il se forme en plusieurs HEURES pendant la session asiatique — même structure, échelle supérieure : le PÔLE = toute la poussée Londres+NY du jour (3h-17h, sur ton H1). Le FLAG = la dérive de Tokyo (17h-2h), un drift léger contre-tendance qui ne s'effondre jamais. La CASSURE = le retour du volume, asiatique ou londonien, dans le sens du pôle.</div>
        <div style={{padding:"10px", background:"#020a06", borderRadius:6, marginBottom:8, fontFamily:"monospace", fontSize:8, lineHeight:1.6, color:TEXT, whiteSpace:"pre", overflowX:"auto"}}>{"VENTE (miroir haussier identique, inversé) :\n│\\\n│ \\   LE PÔLE = Londres (3h-11h)\n│  \\   + NY qui hérite (8h-17h)\n│   \\\n│    \\      ___38.2% sain___\n│     \\    /  TOKYO drifte   \\   ← LE FLAG (17h-2h)\n│      \\__/____50% limite_____\\\n│        (61.8-65% Golden Pocket = dernière défense)\n│         \\\n│          \\ ← CASSURE : Tokyo la nuit OU Londres à 3h\n│           ↓  stop derrière le flag · target = hauteur du pôle\n└─────────────────────────── 1 à 3 jours"}</div>
        <div style={S.p}>Profondeur au Fibonacci tiré sur le pôle : <b style={{color:"#4ade80"}}>38.2%</b> = respiration saine · <b style={{color:"#fbbf24"}}>50%</b> = limite acceptable · <b style={{color:"#f87171"}}>Golden Pocket (61.8-65%)</b> = dernière défense — plus profond, le setup est MORT : les desks ne défendent plus leur position, n'entre pas. Stop derrière le flag, target = hauteur du pôle projetée, 1-3 jours, réévalue chaque jour dans ta fenêtre.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🧠 OÙ SONT LES DESKS — HEURE PAR HEURE, VERSION SWING</div>
        {[
          ["3h","Londres ouvre et piège","Fausse cassure du range asiatique, chasse aux stops. Le premier mouvement MENT.","Tu dors. La journée des desks commence sans toi — tant mieux."],
          ["4h-11h","Londres construit le pôle","Le piège passé, les tranches s'enchaînent dans la vraie direction jusqu'au Fix de 11h — la signature finale de Londres.","Tu lis les news à 6h-8h. Le POURQUOI se révèle pendant qu'ils travaillent."],
          ["8h","NY arrive — le test","La liquidité mondiale double. NY juge le travail de Londres : elle le valide et l'amplifie, ou elle le tue.","Tu observes. Si NY inverse Londres, il n'y aura pas de signal propre aujourd'hui."],
          ["11h","LE FIX — Londres a fini","Exécution administrative géante puis passage de relais : la direction de Londres est DÉFINITIVE, NY la porte seule.","🌡️ Ton sentiment + 🥛 ton scan : ta fenêtre s'ouvre. Tu lis l'œuvre complète."],
          ["11h-16h","NY déroule","Les desks américains portent le mouvement hérité : c'est la confirmation en direct que le programme tient.","Tu scannes UNE fois, tu vérifies le pôle H1, tu prépares tes niveaux de flag."],
          ["17h","NY ferme — Tokyo prend","Les desks américains clôturent. L'Asie gère sans conviction : le drift commence.","Tu traces le flag qui se dessine, tu poses ton alerte sur la borne. Tu n'entres PAS dans le flag."],
          ["17h-2h","Tokyo respire","Prises de profit légères, le prix dérive contre la tendance. Le flag mûrit, le Fibonacci se mesure.","Si Tokyo casse dans le sens du pôle : ENTRÉE de nuit. Sinon tu attends Londres."],
          ["3h","Londres revient","Les desks reprennent leur programme : si la divergence d'hier tient, la reprise casse le flag avec du volume.","ENTRÉE à la reprise confirmée (clôture H1 hors du flag). Le cycle recommence — ta position est portée par la nouvelle vague."],
        ].map((e,i)=>(
          <div key={i} style={{display:"flex", gap:8, padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4, alignItems:"flex-start"}}>
            <span style={{color:"#34d399", fontWeight:900, fontSize:9, minWidth:48}}>{e[0]}</span>
            <div>
              <div style={{fontSize:9, fontWeight:700, color:"#e2e8f0"}}>{e[1]}</div>
              <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5, marginTop:1}}>{e[2]}</div>
              <div style={{fontSize:8, color:"#34d399", lineHeight:1.5, marginTop:2}}>🧠 {e[3]}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={S.sec}>
        <div style={S.h}>🧠 LA PSYCHOLOGIE DES DESKS LONDRES + NY — ET COMMENT LES SUIVRE EN TANT QUE RETAIL</div>
        <div style={S.p}><b style={{color:"#e2e8f0"}}>Pourquoi regarder les DEUX ensemble.</b> Londres seule, c'est une opinion — la plus grosse du marché (40% du volume mondial), mais une opinion d'une session. Quand New York, le deuxième desk de la planète, REPREND la direction de Londres au lieu de la combattre, l'opinion devient un consensus mondial : les deux plus grosses forces du forex poussent dans le même sens. C'est ce consensus que ton scan de 11h-16h photographie — une divergence qui survit au Fix ET à des heures de NY n'est plus un coup du matin, c'est un programme.</div>
        <div style={S.p}><b style={{color:"#e2e8f0"}}>Ce qu'ils font vraiment.</b> Deutsche, HSBC, BNP, Barclays côté Londres ; JPMorgan, Citi, Goldman côté NY. Deux moteurs : les ORDRES CLIENTS (flux obligatoires de milliards) et la CONVICTION macro. Un desk qui doit vendre 2 milliards de JPY étale ses tranches sur des heures — c'est mathématique, pas psychologique. Cette obligation d'étalement crée le pôle régulier sur ton H1 : tu ne regardes pas du bruit, tu regardes un programme d'exécution.</div>
        <div style={S.p}><b style={{color:"#e2e8f0"}}>Comment les suivre en tant que retail.</b> Tu ne peux pas voir leurs ordres — mais tu vois leurs TRACES, et elles ne mentent pas : ① le Currency Strength (leur allocation agrégée sur les deux sessions) · ② le Top 5 Gainers/Losers (où leur volume s'est déversé aujourd'hui) · ③ le Risk Meter (le courant mondial dans lequel ils nagent) · ④ ton H1 (le pôle, leur exécution dessinée). Ton edge n'est pas l'information — c'est la PATIENCE : eux doivent exécuter toute la journée, toi tu peux attendre que tout converge et entrer une seule fois, au meilleur moment, sur le flag que leur pause asiatique te dessine.</div>
        <div style={S.p}><b style={{color:"#e2e8f0"}}>Quand NE PAS les suivre.</b> Si NY inverse Londres (pôle cassé dans l'après-midi) : les deux desks ne sont pas d'accord, pas de consensus, pas de trade. Si la divergence existe sans le Top 5 (② éteint) : le programme est en place mais le volume n'a pas encore éclaté sur ta paire — signal valide, ton pôle H1 devient le juge décisif. Si le sentiment contredit : leur direction nage contre le courant mondial — même les desks perdent ces batailles-là. Trois juges, trois OUI, ou rien.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🌡️ LE SENTIMENT — FILTRE ③</div>
        <div style={S.p}>Chaque trade que tu prends EST un pari risk-on ou risk-off, que tu le saches ou non. Le ③ s'assure que ton pari va dans le sens du courant mondial — jamais contre. Choisi une fois le matin, partagé avec ton Day Trade.</div>
        <div style={S.sh}>📊 L'INFLUENCE SUR CE QUE TU TRADES</div>
        <div style={{fontSize:8, color:TEXT, lineHeight:1.7, marginBottom:8}}>
          <div style={{padding:"6px 8px", background:"#052010", borderRadius:5, marginBottom:4}}><b style={{color:"#4ade80"}}>🟢 RISK-ON (appétit)</b> — AUD/NZD achetées, JPY/CHF vendus : tes croisements JPY (GBP/JPY, EUR/JPY, CHF/JPY) montent → ACHATS validés · tes croisements AUD/NZD (EUR/AUD, GBP/AUD, EUR/NZD, GBP/NZD) descendent → VENTES validées · XAU/USD : le refuge dort → la VENTE or converge (si USD #1-2).</div>
          <div style={{padding:"6px 8px", background:"#200505", borderRadius:5, marginBottom:4}}><b style={{color:"#f87171"}}>🔴 RISK-OFF (peur)</b> — fuite vers JPY/CHF, AUD/NZD lâchées : croisements JPY descendent → VENTES validées · croisements AUD/NZD montent → ACHATS validés · XAU/USD : fuite vers le refuge → l'ACHAT or converge (si USD #7-8).</div>
          <div style={{padding:"6px 8px", background:"#1a2030", borderRadius:5}}><b style={{color:"#94a3b8"}}>⚪ NEUTRE</b> — pas de courant de fond : le ③ n'est pas rempli → pas de trade. Les jours neutres sont les jours de range.</div>
        </div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, marginBottom:8, padding:"8px 10px", background:"#140d00", borderRadius:5}}>🥇 L'or et ses DEUX moteurs : le dollar (mécanique — coté en USD) et la peur (refuge). Quand ils convergent (USD fort + Risk-On = vente · USD faible + Risk-Off = achat), le mouvement est propre. Quand ils se BATTENT (USD fort + Risk-Off, typique des paniques), l'or fait des mèches dans les deux sens — le scanner te dira CONFLIT, pas de trade. La convergence fait le trade, jamais un moteur seul.</div>
        <div style={S.sh}>📋 PAIRE PAR PAIRE — CE QUE CHAQUE SENTIMENT VALIDE</div>
        <div style={{fontSize:7.5, fontFamily:"monospace", lineHeight:1.9, marginBottom:6}}>
          <div style={{display:"flex", borderBottom:"1px solid #334155", paddingBottom:3, marginBottom:3, fontWeight:700, color:"#94a3b8"}}><span style={{flex:1.2}}>PAIRE</span><span style={{flex:1, color:"#4ade80"}}>🟢 RISK-ON</span><span style={{flex:1, color:"#f87171"}}>🔴 RISK-OFF</span></div>
          {[["GBP/JPY","▲ ACHAT (JPY vendu)","▼ VENTE (fuite vers JPY)","a","v"],["EUR/JPY","▲ ACHAT (JPY vendu)","▼ VENTE (fuite vers JPY)","a","v"],["CHF/JPY","▲ ACHAT (JPY vendu)","▼ VENTE (fuite vers JPY)","a","v"],["EUR/AUD","▼ VENTE (AUD acheté)","▲ ACHAT (AUD lâché)","v","a"],["GBP/AUD","▼ VENTE (AUD acheté)","▲ ACHAT (AUD lâché)","v","a"],["EUR/NZD","▼ VENTE (NZD acheté)","▲ ACHAT (NZD lâché)","v","a"],["GBP/NZD","▼ VENTE (NZD acheté)","▲ ACHAT (NZD lâché)","v","a"]].map((r,i)=>(
            <div key={i} style={{display:"flex", borderBottom:"1px solid #1e293b"}}><span style={{flex:1.2, color:"#e2e8f0", fontWeight:700}}>{r[0]}</span><span style={{flex:1, color:r[3]==="a"?"#4ade80":"#f87171"}}>{r[1]}</span><span style={{flex:1, color:r[4]==="a"?"#4ade80":"#f87171"}}>{r[2]}</span></div>
          ))}
          <div style={{display:"flex", borderBottom:"1px solid #1e293b", background:"#1a150033"}}><span style={{flex:1.2, color:"#fbbf24", fontWeight:700}}>XAU/USD 🥇</span><span style={{flex:1, color:"#f87171"}}>▼ VENTE si USD #1-2</span><span style={{flex:1, color:"#4ade80"}}>▲ ACHAT si USD #7-8</span></div>
        </div>
        <div style={{fontSize:7.5, color:TEXT_DIM, lineHeight:1.5}}>Lecture : la direction affichée est la SEULE validable sous ce sentiment. L'autre = ⛔ bloquée même à 3+ rangs. L'or exige en plus sa condition dollar. NEUTRE = rien n'est validable.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🗓️ COMPRENDRE L'AGENDA INSTITUTIONNEL</div>
        <div style={S.sh}>3h ET — Londres entre en premier</div>
        <div style={S.p}>Deutsche Bank, HSBC, BNP, Barclays ouvrent leurs desks. Avant de prendre position, ils ont analysé deux choses : (1) ce qui s'est passé pendant la session asiatique (comment JPY/AUD/NZD ont bougé la nuit, le sentiment risk-on/risk-off — le même courant que ton ③), et (2) les news économiques européennes du matin (inflation, emploi, PIB UK/EU). La combinaison dicte leur direction sur EUR/GBP/CHF contre AUD/NZD/JPY. Tu ne les vois pas entrer — mais tu vois leur résultat dans ta fenêtre 11h-16h : EUR fort, JPY faible = ils ont acheté EUR après avoir lu la session asiatique ET les news EU.</div>
        <div style={S.sh}>8h ET — New York ouvre et hérite</div>
        <div style={S.p}>Tes paires n'ont pas de dollar, donc NY ne les trade pas directement — mais le volume de New York teste puis PORTE la direction de Londres. C'est l'étage qui transforme une opinion d'une session en consensus mondial. Tu n'analyses pas encore : ton scan se fait entre 11h et 16h, quand le travail de Londres est signé (le Fix) et que NY le confirme en direct. Avant ça, tu observes seulement.</div>
        <div style={S.sh}>11h-16h ET — Tu lis leur trace</div>
        <div style={S.p}>MarketMilk te montre ce que les gros joueurs ont DÉJÀ fait sur les deux sessions. Ton signal (① divergence ≥3r + ③ sentiment aligné) confirme que le programme est réel et porté ; le ② Top 5 te dit s'il a déjà éclaté (bonus) ou s'il couve encore (ton pôle H1 devient le juge décisif). Tu ne devines pas — tu confirmes, tu attends le flag de Tokyo, et tu suis. Comme un sniper.</div>
        <div style={S.sh}>Le soir — Tokyo reprend le flambeau (et te dessine ton flag)</div>
        <div style={S.p}>Londres + NY = ~60% du volume mondial. Quand les deux ont créé une tendance forte, les sessions suivantes (Tokyo, Sydney) tendent à la respecter quand les fondamentaux ne changent pas — mais elles consolident d'abord : c'est exactement la respiration qui dessine TON flag de 17h à 2h. Pas une loi mécanique, une tendance probable. Ton edge vient de te placer du bon côté à la cassure, pas de supposer que le mouvement continuera coûte que coûte.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.7, marginBottom:8}}>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4}}><b style={{color:"#e2e8f0"}}>🇯🇵 JPY (GBP/JPY · EUR/JPY · CHF/JPY)</b> — LA devise de Tokyo. Les desks japonais sont disciplinés et suiveurs de tendance. Si Londres+NY ont vendu le JPY (BoJ accommodante, taux défavorables), Tokyo a tendance à rester dans le même sens tant que ces raisons tiennent : son drift de la nuit reste léger — ton flag est sain. Souvent Tokyo prolonge même le mouvement (cassure de nuit = ton entrée). Rien n'est automatique.</div>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4}}><b style={{color:"#e2e8f0"}}>🇦🇺 AUD (EUR/AUD · GBP/AUD)</b> — la devise de Sydney. Les desks australiens tradent l'AUD selon les données chinoises (la Chine = partenaire #1 de l'Australie) et la RBA. Si Londres+NY ont acheté l'AUD, Sydney ouvre avec les mêmes données : le flag respire sans s'effondrer, et la reprise de Londres recharge demain.</div>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5}}><b style={{color:"#e2e8f0"}}>🇳🇿 NZD (EUR/NZD · GBP/NZD)</b> — suit l'AUD de près : deux devises d'Océanie liées aux matières premières et à la Chine. Si l'AUD est fort, le NZD l'est souvent aussi. Sydney trade les deux et prolonge le consensus Londres+NY.</div>
        </div>
        <div style={S.p}>Quand la tendance est forte, le mouvement ne s'arrête pas à la fermeture de NY — les desks suivants voient les mêmes fondamentaux et peuvent le prolonger. C'est pourquoi ta position peut tenir 1 à 3 jours quand les fondamentaux restent en place. Mais ça dépend du marché : certaines tiennent, d'autres se referment vite. Tu réévalues chaque jour dans ta fenêtre, tu ne présumes rien.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🎯 POURQUOI CES 7 PAIRES</div>
        <div style={S.p}>On trade UNIQUEMENT : EUR/AUD · GBP/AUD · EUR/NZD · GBP/NZD · GBP/JPY · EUR/JPY · CHF/JPY. Chacune oppose une devise de Londres (EUR, GBP, CHF) à une devise du bloc Asie-Pacifique (AUD, NZD, JPY). Pas de paires CAD : le CAD est une devise de session New York, pas de notre relais Londres↔Asie↔Londres.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.7, marginBottom:8}}>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4}}><b style={{color:"#34d399"}}>1. Les deux sessions ont signé.</b> Entre 11h et 16h ET, Londres a TERMINÉ (Fix passé) et révélé sa direction définitive, et New York la teste en direct. Tu lis un pôle mûr des DEUX desks majeurs — puis Tokyo te dessine le flag et la cassure te fait entrer.</div>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4}}><b style={{color:"#34d399"}}>2. La conviction est testée par le marché entier.</b> Dans ta fenêtre, le mouvement a traversé l'ouverture de NY (8h) et des heures de session sans s'inverser — la liquidité maximale du monde n'a trouvé personne pour s'y opposer. La direction est nette, validée par les deux plus gros marchés de la planète.</div>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5, marginBottom:4}}><b style={{color:"#34d399"}}>3. Le relais des sessions travaille POUR toi.</b> Chaque paire oppose une devise de Londres à une devise d'Asie — jamais deux de la même session. Une fois entré à la cassure du flag, ta position passe de main en main : Tokyo prolonge ou respire, Londres recharge à 3h, NY reporte. Un flux qui peut durer 1-3 jours — mais tu réévalues chaque jour, rien n'est acquis.</div>
          <div style={{padding:"7px 9px", background:"#02100a", borderRadius:5}}><b style={{color:"#34d399"}}>4. Le flag de Tokyo est structurel.</b> Tes paires dorment quand l'Asie gère : les devises de Londres n'ont plus leurs desks (fermés), les devises d'Asie n'ont pas de contrepartie agressive. Résultat : le drift léger, régulier, qui dessine ton flag chaque nuit. C'est l'architecture des sessions elle-même qui fabrique ton setup.</div>
        </div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.65, padding:"8px 10px", background:"#02100a", borderRadius:5}}>💡 11h-16h ET = le point de convergence : Londres a fini (Fix passé) + NY teste en direct + ton ① et ton ③ convergent (le ② te dit si le mouvement a déjà éclaté). Tu ne devines rien — tu te places dans un flux institutionnel validé que les sessions suivantes peuvent prolonger, souvent 1 à 3 jours quand la divergence persiste, sans que ce soit jamais garanti.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🥇 XAU/USD — LA STRATÉGIE OR DU SWING 2.0</div>
        <div style={S.p}>L'or n'oppose pas deux devises — il s'oppose au dollar seul. Coté en USD : dollar fort = or sous pression, dollar faible = or qui respire. Sa lecture remplace le signal classique par une DOUBLE CONVERGENCE :</div>
        <div style={S.p}><b style={{color:"#fbbf24"}}>① pour l'or = la position du dollar</b> au Currency Strength de ta fenêtre : USD #1-2 (le dollar est LE moteur) = VENTE possible · USD #7-8 (le dollar coule) = ACHAT possible · USD au milieu (#3-6) = pas de conviction, pas de trade or.</div>
        <div style={S.p}><b style={{color:"#fbbf24"}}>③ pour l'or = la peur.</b> Le refuge a deux maîtres : VENTE propre exige USD fort + RISK-ON (le refuge dort) · ACHAT propre exige USD faible + RISK-OFF (fuite vers le refuge). Moteurs OPPOSÉS (USD fort + Risk-Off, typique des paniques) = CONFLIT affiché par le scanner, jour de mèches, pas de trade.</div>
        <div style={S.p}><b style={{color:"#fbbf24"}}>② pour l'or = TON H1.</b> Pas de Top 5 MarketMilk pour XAU — c'est le pôle qui prouve le mouvement réel : flux continu de 3h jusqu'à ta fenêtre, porté par Londres puis le COMEX (ouvert 8h20), sans inversion.</div>
        <div style={S.p}>Puis même séquence que tes paires : Tokyo dessine le flag la nuit (Fib sur le pôle), cassure à Tokyo ou à la reprise de Londres, stop derrière le flag, target = hauteur du pôle, 1-3 jours. Le verdict or s'affiche sous ton scan à chaque analyse.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🎯 LA LOGIQUE</div>
        <div style={S.p}>Londres traite ~40% du volume mondial du forex, New York ~19%. Ensemble : près de 60% de tout le change de la planète. Quand les DEUX poussent dans le même sens toute une journée, ce n'est plus une opinion — c'est le consensus des plus grosses forces du marché, et il ne se déboucle pas en une nuit. C'est exactement pour ça qu'une position peut tenir 1 à 3 jours : Tokyo respire, Londres recharge, NY reporte, et ton flag de la nuit n'est qu'une pause dans leur programme.</div>
        <div style={S.p}>Le principe : acheter la plus FORTE contre la plus FAIBLE (① divergence ≥3 rangs après deux sessions), quand il est PORTÉ par le courant mondial (③ sentiment aligné). Deux juges indépendants — l'allocation du capital et l'appétit au risque planétaire — qui convergent. Le ② (Top 5) est le bonus : allumé, le mouvement a déjà éclaté et ton signal est renforcé. Un seul qui manque, et tu passes : le marché te redonnera une convergence demain ou après-demain. La discipline du non-trade EST le système.</div>
      </div>

      <div style={S.sec}>
        <div style={S.h}>🌅 TON RITUEL DU MATIN</div>
        <div style={S.p}>Ouvre MarketMilk pour l'analyse, puis vérifie les news avant de prendre position.</div>
        <a href="https://marketmilk.babypips.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700, marginBottom:5}}>🥛 1. MarketMilk — Currency Strength + Top 5 (colle pour le scan) ↗</a>
        <a href="https://www.babypips.com/tools/risk-on-risk-off-meter" target="_blank" rel="noopener noreferrer" style={{display:"block", fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700, marginBottom:5}}>🌡️ 2. Risk-On/Risk-Off Meter — ton ③ du jour ↗</a>
        <a href="https://tradingeconomics.com/stream" target="_blank" rel="noopener noreferrer" style={{display:"block", fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700, marginBottom:5}}>📡 3. Trading Economics Stream — flux macro mondial en direct ↗</a>
        <a href="https://www.babypips.com/economic-calendar" target="_blank" rel="noopener noreferrer" style={{display:"block", fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700, marginBottom:5}}>📅 4. Calendrier économique — les news du jour (NFP, CPI, taux) ↗</a>
        <a href="https://investinglive.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700, marginBottom:5}}>📰 5. InvestingLive — l'actualité en direct ↗</a>
        <a href="https://www.financialjuice.com/home" target="_blank" rel="noopener noreferrer" style={{display:"block", fontSize:9, color:"#7dd3fc", textDecoration:"none", fontWeight:700}}>🧃 6. FinancialJuice — flux de news ↗</a>
      </div>
    </div>
  );
}
