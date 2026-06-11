import { useState } from "react";

const TEXT="#c8d4f0", TEXT_DIM="#4a5070";
const DT_PAIRS = [["EUR","AUD"],["GBP","AUD"],["EUR","NZD"],["GBP","NZD"],["GBP","JPY"],["EUR","JPY"],["CHF","JPY"]];
const CURS = ["USD","EUR","GBP","JPY","CHF","AUD","NZD","CAD"];

function DtAnalyzer(){
  const [raw, setRaw] = useState("");
  const [res, setRes] = useState(null);
  const analyze = () => {
    try {
      const nowET = new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
      const m = nowET.getHours()*60+nowET.getMinutes();
      if (m < 465 || m > 525) {
        const hh=String(nowET.getHours()).padStart(2,"0"), mm=String(nowET.getMinutes()).padStart(2,"0");
        setRes({error:`⏰ Il est ${hh}h${mm} à New York. Le Day Trade FX se scanne entre 7h45 et 8h45 ET — le pôle de Londres est complet, le flag est dessiné, et NY arrive pour le casser. Avant = le flag n'existe pas encore. Après = la cassure est partie sans toi. Reviens demain 7h45.`});
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
      const out=[];
      DT_PAIRS.forEach(([b,q])=>{
        const gap=Math.abs(rank[b]-rank[q]);
        const dir = rank[b]<rank[q] ? "LONG" : "SHORT";
        out.push({pair:b+"/"+q, base:b, quote:q, rb:rank[b], rq:rank[q], gap, dir, ok:gap>=3});
      });
      out.sort((a,b)=>b.gap-a.gap);
      // XAU/USD : cas special — l'or se trade contre la position du dollar seul
      const ru = rank["USD"];
      let xau = null;
      if (ru <= 2) xau = {dir:"SHORT", why:"USD #"+ru+" (Top 2 = le dollar est LE moteur du jour) → l'or sous pression"};
      else if (ru >= 7) xau = {dir:"LONG", why:"USD #"+ru+" (Bottom 2 = le dollar coule) → l'or respire"};
      let xauNote = null;
      setRes({order, out, xau, xauNote, ru, heure:String(nowET.getHours()).padStart(2,"0")+"h"+String(nowET.getMinutes()).padStart(2,"0")});
    } catch(e){ setRes({error:"Erreur: "+e.message}); }
  };
  return (
    <div style={{padding:"12px 14px", background:"#0a1628", borderRadius:8, border:"1px solid #38bdf855", marginBottom:14}}>
      <div style={{fontSize:11, color:"#38bdf8", fontWeight:700, marginBottom:8}}>🤖 SCAN 7H45-8H45 — COLLE TON CURRENCY STRENGTH</div>
      <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Colle le snapshot MarketMilk (le Currency Strength Meter suffit — c'est le SEUL filtre données du Day Trade FX)..." style={{width:"100%", minHeight:80, background:"#001018", color:TEXT, border:"1px solid #1e3a5f", borderRadius:6, padding:8, fontSize:9, fontFamily:"monospace", resize:"vertical"}}/>
      <button onClick={analyze} style={{marginTop:8, width:"100%", padding:"10px", background:"#38bdf8", color:"#001018", border:"none", borderRadius:6, fontSize:11, fontWeight:700, letterSpacing:1, cursor:"pointer"}}>⚡ SCANNER</button>
      <a href="https://marketmilk.babypips.com/" target="_blank" rel="noopener noreferrer" style={{display:"block", textAlign:"center", marginTop:6, fontSize:8.5, color:"#7dd3fc", textDecoration:"none", fontWeight:700}}>🥛 Ouvrir MarketMilk ↗</a>
      {res && res.error && <div style={{marginTop:10, padding:"10px", background:"#1a0a00", borderRadius:6, fontSize:9, color:"#fbbf24", lineHeight:1.6}}>{res.error}</div>}
      {res && res.out && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:8.5, color:TEXT_DIM, marginBottom:6}}>Scan de {res.heure} · classement : {res.order.join(" > ")}</div>
          {res.out.map((p,i)=>(
            <div key={i} style={{padding:"7px 9px", marginBottom:4, background:p.ok?(p.dir==="LONG"?"#052010":"#200505"):"#0f1622", borderRadius:5, borderLeft:"3px solid "+(p.ok?(p.dir==="LONG"?"#4ade80":"#f87171"):"#334155")}}>
              <div style={{fontSize:9.5, fontWeight:700, color:p.ok?(p.dir==="LONG"?"#4ade80":"#f87171"):"#64748b"}}>
                {p.ok?"✅":"·"} {p.pair} {p.ok?(p.dir==="LONG"?"▲ ACHAT possible":"▼ VENTE possible"):""} — {p.base} #{p.rb} vs {p.quote} #{p.rq} = {p.gap} rang{p.gap>1?"s":""} {p.ok?"(≥3 ✓)":"(<3)"}
              </div>
              {p.ok && <div style={{fontSize:8, color:TEXT_DIM, marginTop:3, lineHeight:1.5}}>Maintenant ton graphique M15 : pôle de Londres continu depuis 3h dans ce sens ? Flag dessiné depuis ~7h30 ? Pas de news US à 8h30 ? Alors attends la cassure du flag — c'est ton entrée.</div>}
            </div>
          ))}
          <div style={{padding:"7px 9px", marginBottom:4, background:res.xau?(res.xau.dir==="LONG"?"#1a1500":"#200505"):"#0f1622", borderRadius:5, borderLeft:"3px solid "+(res.xau?"#fbbf24":"#334155")}}>
            <div style={{fontSize:9.5, fontWeight:700, color:res.xau?"#fbbf24":"#64748b"}}>
              {res.xau?"✅":"·"} XAU/USD (OR) {res.xau?(res.xau.dir==="LONG"?"▲ ACHAT possible":"▼ VENTE possible"):(res.xauNote || "— USD #"+res.ru+" au milieu (3-6), pas de conviction")}
            </div>
            {res.xau && <div style={{fontSize:8, color:TEXT_DIM, marginTop:3, lineHeight:1.5}}>{res.xau.why}. Même structure : pôle de Londres sur M15, flag 7h30-8h, cassure 8h-8h45 — et le COMEX ouvre à 8h20, le carburant de l'or. Stop sur le flag, sortie avant 17h.</div>}
          </div>
          <div style={{fontSize:7.5, color:TEXT_DIM, marginTop:4, fontStyle:"italic"}}>≥3 rangs à 8h = l'équivalent jeune du ≥4 rangs de 10h30 : le classement n'a que 5h de construction. Le scan donne la DIRECTION — le pôle, le flag et la cassure se lisent sur TON M15.</div>
        </div>
      )}
    </div>
  );
}

export default function DayTradeFxView(){
  return (
    <div style={{maxWidth:520, margin:"0 auto"}}>
      <div style={{textAlign:"center", marginBottom:12}}>
        <div style={{fontSize:14, fontWeight:800, color:"#38bdf8", letterSpacing:1}}>⚡ DAY TRADE FX</div>
        <div style={{fontSize:9, color:"#7dd3fc", fontWeight:700}}>LE FLAG DE LONDRES · M15</div>
        <div style={{fontSize:8, color:TEXT_DIM, marginTop:4, lineHeight:1.5}}>Même structure que ton Swing — pôle, flag, cassure — mais compressée : le pôle de Londres (3h→7h30), le flag (7h30-8h), et la cassure quand NY ouvre. Le test de liquidité de 8h n'est plus un événement que tu observes : c'est TON ENTRÉE. Sortie avant 17h, jamais d'overnight.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:10, color:"#7dd3fc", fontWeight:700, marginBottom:8}}>📋 TA SÉQUENCE DU JOUR</div>
        {[
          {n:"1", icon:"📰", color:"#38bdf8", t:"6H-7H30 — QU'ONT FAIT L'ASIE ET LONDRES ?", sub:"News à fort impact + commentaires des banques centrales (session wraps Investing). Le POURQUOI derrière le mouvement de Londres."},
          {n:"2", icon:"👁️", color:"#38bdf8", t:"7H30-7H45 — LE PÔLE ET LE FLAG (M15)", sub:"Londres pousse dans UN sens depuis 3h (après le piège du matin) ? Le prix consolide en drift léger depuis ~7h30 ? Pôle + flag = la structure est là."},
          {n:"3", icon:"🥛", color:"#fbbf24", t:"7H45-8H45 — SCANNE LE CURRENCY STRENGTH", sub:"Colle MarketMilk. Ta paire doit avoir ≥3 rangs d'écart dans le sens du pôle. C'est le SEUL filtre données — à 8h, le reste du snapshot n'est pas mûr."},
          {n:"4", icon:"📅", color:"#f59e0b", t:"VÉRIFIE 8H30 (calendrier Investing)", sub:"News US majeure à 8h30 (CPI, NFP, FOMC) ? Tu n'entres PAS avant — tu attends 9h que le spike soit digéré. Pas de news = voie libre."},
          {n:"5", icon:"🚀", color:"#34d399", t:"8H-8H45 — ENTRE À LA CASSURE", sub:"NY ouvre, la liquidité double. Si elle pousse dans le sens de Londres, le flag casse : entre à la cassure confirmée (bougie M15 qui clôture hors du flag). Stop sur le flag · Target = hauteur du pôle."},
          {n:"6", icon:"🏁", color:"#f87171", t:"AVANT 17H — SORS. TOUJOURS.", sub:"Day trade = la journée seulement. Target atteint, stop touché, ou 17h : tu sors. Un day trade qui devient un swing involontaire = une discipline cassée."},
        ].map((s,i)=>(
          <div key={i} style={{display:"flex", gap:10, padding:"8px 0", borderBottom:i<5?"1px solid #1e293b":"none"}}>
            <div style={{minWidth:22, height:22, borderRadius:11, background:s.color+"22", border:"1px solid "+s.color, color:s.color, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center"}}>{s.n}</div>
            <div><div style={{fontSize:9.5, fontWeight:700, color:s.color}}>{s.icon} {s.t}</div>
            <div style={{fontSize:8, color:TEXT, lineHeight:1.55, marginTop:2}}>{s.sub}</div></div>
          </div>
        ))}
        <div style={{fontSize:8, color:"#fbbf24", marginTop:8, padding:"7px 9px", background:"#1a1500", borderRadius:5, lineHeight:1.5}}>Pas de pôle propre, pas de ≥3 rangs, ou news à 8h30 ? = Pas de trade aujourd'hui. Une entrée par jour MAXIMUM — la deuxième tentative est toujours la mauvaise.</div>
      </div>

      <DtAnalyzer />

      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:10, color:"#c084fc", fontWeight:700, marginBottom:6}}>📐 LA MÉCANIQUE — LE FLAG DE LONDRES</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:10}}>Au Swing, le test de NY est un événement que tu OBSERVES : le pôle survit ou pas, et tu entres le soir. Au Day Trade, ce même test devient ton DÉCLENCHEUR : la liquidité doublée de 8h est exactement le carburant qui casse ton flag. Même événement, deux usages — ne les confonds jamais : le Swing se décide à 10h30, le Day Trade se joue à 8h.</div>
        <svg viewBox="0 0 320 180" style={{width:"100%", maxWidth:340, display:"block", margin:"0 auto 8px"}}>
          <rect x="20" y="155" width="120" height="8" fill="#1e3a5f"/>
          <text x="55" y="175" fill="#7dd3fc" fontSize="6.5" fontFamily="monospace">LONDRES 3h-7h30</text>
          <rect x="140" y="155" width="160" height="8" fill="#14532d"/>
          <text x="185" y="175" fill="#4ade80" fontSize="6.5" fontFamily="monospace">NY ouvre 8h = TON ENTRÉE</text>
          <polyline points="25,140 45,120 65,128 85,95 105,102 125,70" fill="none" stroke="#4ade80" strokeWidth="2.5"/>
          <text x="30" y="100" fill="#4ade80" fontSize="7" fontFamily="monospace" fontWeight="700">PÔLE</text>
          <text x="30" y="110" fill="#86efac" fontSize="5.5" fontFamily="monospace">Londres 3h→7h30</text>
          <polyline points="125,70 135,78 145,74 155,82 165,78" fill="none" stroke="#fbbf24" strokeWidth="2"/>
          <text x="128" y="60" fill="#fbbf24" fontSize="7" fontFamily="monospace" fontWeight="700">FLAG 7h30-8h</text>
          <polyline points="165,78 180,55 200,40 220,28" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeDasharray="0"/>
          <text x="195" y="22" fill="#4ade80" fontSize="7" fontFamily="monospace" fontWeight="700">CASSURE 8h-8h45</text>
          <line x1="125" y1="90" x2="170" y2="90" stroke="#f87171" strokeWidth="1.2" strokeDasharray="3,2"/>
          <text x="172" y="93" fill="#f87171" fontSize="6" fontFamily="monospace">STOP</text>
          <line x1="220" y1="8" x2="300" y2="8" stroke="#4ade80" strokeWidth="1.2" strokeDasharray="3,2"/>
          <text x="225" y="6" fill="#4ade80" fontSize="6" fontFamily="monospace">TARGET = hauteur du pôle</text>
        </svg>
        <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>① Pôle : Londres pousse de 3h à ~7h30 (M15, après le piège du matin) → ② Flag : 7h30-8h, drift léger contre-tendance, profondeur ≤50% au Fib (sous le Golden Pocket = setup mort, comme au Swing) → ③ Cassure : 8h-8h45, NY pousse dans le sens de Londres = ENTRÉE. Stop sur le flag, target = hauteur du pôle projetée, sortie avant 17h. Le miroir baissier est identique, inversé.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:10, color:"#7dd3fc", fontWeight:700, marginBottom:8}}>🧠 OÙ SONT LES DESKS — VERSION INTRADAY</div>
        {[
          {h:"3h", t:"Londres ouvre et tend le piège", d:"Fausse cassure du range asiatique, chasse aux stops. Le premier mouvement MENT.", m:"Tu dors ou tu prépares. Jamais de position ici."},
          {h:"4h-7h30", t:"Le pôle se construit", d:"Le piège passé, les desks révèlent leur vraie direction et chargent. Un flux continu sur ton M15 = leur conviction.", m:"Tu lis. La narrative de 6h-7h30 t'explique POURQUOI ils poussent."},
          {h:"7h30-8h", t:"La pause avant NY — ton flag", d:"Les desks de Londres ralentissent avant l'arrivée de NY : prises de profit légères, le prix drifte. C'est le flag qui se dessine.", m:"Tu traces le flag sur M15, tu poses ton alerte sur la borne. Tu n'entres PAS dans le flag."},
          {h:"8h-8h45", t:"NY arrive — le carburant", d:"La liquidité mondiale double. Si NY pousse dans le sens de Londres, le flag casse avec du volume : c'est le mouvement le plus propre de ta journée.", m:"Entrée à la cassure CONFIRMÉE (clôture M15 hors du flag). Cassure du mauvais côté = setup mort, tu laisses."},
          {h:"8h30", t:"⚠️ Le champ de mines US", d:"CPI, NFP, claims — les news US tombent à 8h30, en plein dans ta fenêtre d'entrée. Un spike de news peut casser ton flag dans les DEUX sens en 30 secondes.", m:"Calendrier vérifié AVANT. News majeure = tu attends 9h, ou tu passes ton tour."},
          {h:"9h30-16h", t:"NY déroule", d:"Le NYSE ouvre (9h30, volume), puis NY porte le mouvement. Ton trade vit sa vie : stop et target font le travail.", m:"Tu ne touches à rien. Pas de stop déplacé, pas de target gourmand."},
          {h:"17h", t:"Fin de NY — fin de ton trade", d:"Les desks de NY clôturent. Après 17h, le marché passe à l'Asie : autre logique, autre session — plus TON trade.", m:"Tu sors, gagnant ou perdant. Le Day Trade meurt à 17h, sans exception."},
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
        <div style={{fontSize:8, color:"#4ade80", marginTop:6, padding:"7px 9px", background:"#052010", borderRadius:5, lineHeight:1.5, fontWeight:600}}>La règle d'or intraday : Londres construit (3h-7h30), le flag respire (7h30-8h), NY casse (8h-8h45), tu sors avant 17h. Une seule fenêtre d'entrée, une seule entrée, zéro overnight.</div>
      </div>

      <div style={{padding:"12px 14px", background:"#0d1420", borderRadius:8, border:"1px solid #1e3a5f", marginBottom:14}}>
        <div style={{fontSize:10, color:"#7dd3fc", fontWeight:700, marginBottom:8}}>🎯 CE QUE TU TRADES — ET COMMENT LIRE CHACUN</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8}}><b style={{color:"#38bdf8"}}>Tes 7 paires</b> — EUR/AUD · GBP/AUD · EUR/NZD · GBP/NZD · GBP/JPY · EUR/JPY · CHF/JPY. Une devise de Londres (EUR, GBP, CHF) contre une devise d'Asie-Pacifique (AUD, NZD, JPY) : le pôle que tu trades est construit par les desks de Londres eux-mêmes. <b>Lecture :</b> écart ≥3 rangs au Currency Strength entre les deux devises, la plus forte au-dessus = la direction. Le scanner calcule, ton M15 confirme le pôle.</div>
        <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8}}><b style={{color:"#fbbf24"}}>XAU/USD (l'or)</b> — un cas spécial : pas deux devises à comparer, UNE seule question — où est le dollar ? L'or est coté en dollars : dollar fort = or sous pression, dollar faible = or qui respire. <b>Lecture :</b> USD #1-2 au Currency Strength = VENTE possible · USD #7-8 = ACHAT possible · USD au milieu (#3-6) = pas de conviction, pas de trade or. Bonus de session : le COMEX ouvre à 8h20 — l'or reçoit son carburant en plein dans ta fenêtre d'entrée.</div>
        <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.5}}>Pourquoi pas de paires CAD ni de majors dollar ? Le CAD est une devise de session NY (pas de pôle de Londres propre), et les majors USD ont leur vraie vie après ta fenêtre. Tes 7 paires + l'or couvrent exactement le terrain où le flag de Londres existe.</div>
      </div>

      <div style={{padding:"10px 12px", background:"#160a2e", borderRadius:8, border:"1px solid #c084fc44", marginBottom:14}}>
        <div style={{fontSize:9, color:"#c084fc", fontWeight:700, marginBottom:4}}>⚔️ DAY TRADE FX vs SWING FX — ne les mélange jamais</div>
        <div style={{fontSize:8, color:TEXT, lineHeight:1.65}}>Même ADN (pôle → flag → cassure), deux animaux : le <b style={{color:"#38bdf8"}}>Day Trade</b> se scanne à 7h45-8h45 (Currency Strength seul, ≥3r), entre à 8h-8h45 sur M15, et meurt à 17h. Le <b style={{color:"#fbbf24"}}>Swing</b> s'analyse à 10h30-10h55 (5 filtres complets), entre le soir sur H1, et vit 1-3 jours. Un trade pris à 8h se gère en day trade jusqu'au bout — il ne devient JAMAIS un swing parce qu'il perd. Et un signal swing de 10h30 n'autorise aucune entrée anticipée du matin.</div>
      </div>
    </div>
  );
}
