import { useState } from "react";

const TEXT = "#cbd5e1", TEXT_DIM = "#94a3b8", TEXT2 = "#e2e8f0";
const GREEN = "#34d399", RED = "#f87171", AMBER = "#fbbf24", BLUE = "#38bdf8", PURPLE = "#c084fc";

function grab(txt, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + "\\s*[\\r\\n]*\\s*(-?[0-9]+(?:\\.[0-9]+)?)\\s*(%|B|M|K)?", "i");
  const m = txt.match(re);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2] === "B") v *= 1000;
  if (m[2] === "K") v /= 1000;
  return v;
}

// Pour les metriques presentes 2x (valeur $ ET croissance %) : prend l'occurrence avec %
function grabGrowth(txt, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + "\\s*[\\r\\n]*\\s*(-?[0-9]+(?:\\.[0-9]+)?)\\s*%", "gi");
  let m, last = null;
  while ((m = re.exec(txt)) !== null) { last = parseFloat(m[1]); }
  return last;
}

function analyse(raw, manualTicker) {
  const t = raw;
  const ticker = (manualTicker && manualTicker.trim()) ? manualTicker.trim().toUpperCase() : ((t.match(/finviz\.com\/stock\?t=([A-Za-z]+)/i) || [])[1] || "?");
  const f = {
    mktcap: grab(t, "Market Cap"), price: grab(t, "Price"), avgvol: grab(t, "Avg Volume"),
    relvol: grab(t, "Rel Volume"), recom: grab(t, "Recom"), epsQQ: grab(t, "EPS Q/Q"),
    epsThisY: grab(t, "EPS this Y"), salesQQ: grab(t, "Sales Q/Q"), instOwn: grab(t, "Inst Own"),
    instTrans: grab(t, "Inst Trans"), insiderTrans: grab(t, "Insider Trans"), perfHalfY: grab(t, "Perf Half Y"),
    perfYear: grab(t, "Perf Year"), sma200: grab(t, "SMA200"), sma50: grab(t, "SMA50"),
    rsi: grab(t, "RSI \\(14\\)"), change: grab(t, "Change"), epsYYTTM: grab(t, "EPS Y/Y TTM"),
    salesYYTTM: grab(t, "Sales Y/Y TTM"), roe: grab(t, "ROE"), debteq: grab(t, "Debt/Eq"),
    epsNextY: grabGrowth(t, "EPS next Y"),
  };
  const surpr = t.match(/EPS\/Sales Surpr\.?\s*[\r\n]*\s*(-?[0-9.]+)%?\s*(-?[0-9.]+)?/i);
  f.epsSurpr = surpr ? parseFloat(surpr[1]) : null;
  f.salesSurpr = surpr && surpr[2] ? parseFloat(surpr[2]) : null;
  return { ticker, f };
}

const C = (label, val, ok, detail) => ({ label, val, ok, detail });

function checks(f) {
  const desc = [
    C("Market Cap > 300M", f.mktcap, f.mktcap!==null && f.mktcap>300, f.mktcap!==null?(f.mktcap>=1000?(f.mktcap/1000).toFixed(2)+"B":f.mktcap.toFixed(0)+"M"):"?"),
    C("Price > $5", f.price, f.price!==null && f.price>5, f.price!==null?"$"+f.price:"?"),
    C("Avg Volume > 200K", f.avgvol, f.avgvol!==null && f.avgvol>0.2, f.avgvol!==null?f.avgvol.toFixed(2)+"M":"?"),
    C("Rel Volume > 1", f.relvol, f.relvol!==null && f.relvol>1, f.relvol!==null?f.relvol.toFixed(2)+"x":"?"),
    C("Strong Buy (Recom < 2)", f.recom, f.recom!==null && f.recom<2, f.recom!==null?f.recom.toFixed(2):"?"),
  ];
  const fond = [
    C("EPS Q/Q > 25%", f.epsQQ, f.epsQQ!==null && f.epsQQ>25, f.epsQQ!==null?"+"+f.epsQQ+"%":"?"),
    C("EPS this Y > 25%", f.epsThisY, f.epsThisY!==null && f.epsThisY>25, f.epsThisY!==null?"+"+f.epsThisY+"%":"?"),
    C("EPS next Y > 25%", f.epsNextY, f.epsNextY!==null && f.epsNextY>25, f.epsNextY!==null?"+"+f.epsNextY+"%":"?"),
    C("Sales Q/Q > 25%", f.salesQQ, f.salesQQ!==null && f.salesQQ>25, f.salesQQ!==null?"+"+f.salesQQ+"%":"?"),
    C("Inst. Own > 10%", f.instOwn, f.instOwn!==null && f.instOwn>10, f.instOwn!==null?f.instOwn+"%":"?"),
    C("Inst. Trans positif", f.instTrans, f.instTrans!==null && f.instTrans>0, f.instTrans!==null?(f.instTrans>0?"+":"")+f.instTrans+"%":"?"),
    C("Both Surprise positif", f.epsSurpr, f.epsSurpr!==null && f.salesSurpr!==null && f.epsSurpr>0 && f.salesSurpr>0, (f.epsSurpr!==null?f.epsSurpr+"%":"?")+" / "+(f.salesSurpr!==null?f.salesSurpr+"%":"?")),
  ];
  const tech = [
    C("Perf 6M > 30%", f.perfHalfY, f.perfHalfY!==null && f.perfHalfY>30, f.perfHalfY!==null?"+"+f.perfHalfY+"%":"?"),
    C("Perf 1Y > 20%", f.perfYear, f.perfYear!==null && f.perfYear>20, f.perfYear!==null?"+"+f.perfYear+"%":"?"),
    C("Prix > SMA200", f.sma200, f.sma200!==null && f.sma200>0, f.sma200!==null?(f.sma200>0?"+":"")+f.sma200+"%":"?"),
    C("Prix > SMA50", f.sma50, f.sma50!==null && f.sma50>0, f.sma50!==null?(f.sma50>0?"+":"")+f.sma50+"%":"?"),
    C("Change up (jour)", f.change, f.change!==null && f.change>0, f.change!==null?(f.change>0?"+":"")+f.change+"%":"?"),
  ];
  return { desc, fond, tech };
}

function vigilance(f) {
  const v = [];
  if (f.insiderTrans!==null && f.insiderTrans<0) v.push("Insider Trans "+f.insiderTrans+"% — les dirigeants vendent (a surveiller, pas eliminatoire).");
  if (f.rsi!==null && f.rsi>70) v.push("RSI "+f.rsi+" — proche/en surachat. Risque de repli court terme : attends un pullback pour entrer.");
  if (f.debteq!==null && f.debteq>1) v.push("Debt/Eq "+f.debteq+" — endettement eleve, verifie la solidite du bilan.");
  return v;
}

function Row({ c }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", borderBottom:"1px solid #1e293b"}}>
      <span style={{fontSize:9, color: c.ok?TEXT2:TEXT_DIM}}>{c.ok?"✅":"❌"} {c.label}</span>
      <span style={{fontSize:8.5, color: c.ok?GREEN:RED, fontWeight:700}}>{c.detail}</span>
    </div>
  );
}

function StockAnalyseView() {
  const [raw, setRaw] = useState("");
  const [ticker, setTicker] = useState("");
  const [res, setRes] = useState(null);
  const [openStrat, setOpenStrat] = useState(false);
  const [openRisk, setOpenRisk] = useState(false);
  const [openVcp, setOpenVcp] = useState(false);
  const [openCascade, setOpenCascade] = useState(false);
  const [openFonds, setOpenFonds] = useState(false);
  const [openHigh, setOpenHigh] = useState(false);
  const [openType, setOpenType] = useState(false);
  const [openRoutine, setOpenRoutine] = useState(false);
  const [openFiltres, setOpenFiltres] = useState(false);

  const run = () => {
    if (!raw.trim()) { setRes({error:"Colle d'abord le tableau de stats Finviz de l'action."}); return; }
    const { ticker: tk, f } = analyse(raw, ticker);
    const ch = checks(f);
    const all = [...ch.desc, ...ch.fond, ...ch.tech];
    const passed = all.filter(c=>c.ok).length;
    const total = all.length;
    setRes({ ticker: tk, f, ch, passed, total, vig: vigilance(f) });
  };

  return (
    <div style={{maxWidth:540, margin:"0 auto", padding:"0 4px"}}>
      <div style={{textAlign:"center", marginBottom:10}}>
        <div style={{fontSize:15, color:PURPLE, fontWeight:900, letterSpacing:1.5, marginBottom:5}}>📊 STOCK ANALYSE</div>
        <div style={{fontSize:9, color:PURPLE+"aa", fontWeight:700, letterSpacing:2}}>METHODE MINERVINI SEPA · SCREENER FINVIZ</div>
      </div>

      <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:10, padding:"8px 10px", background:"#0d0a18", borderRadius:8, border:"1px solid #2a1f3a"}}>
        Va sur <b style={{color:PURPLE}}>finviz.com/stock?t=TICKER</b>, copie le tableau de stats complet (Market Cap, EPS, SMA200, Volume...) et colle-le ci-dessous. L'app verifie les filtres SEPA de Minervini et te donne le verdict.
      </div>

      <input value={ticker} onChange={e=>setTicker(e.target.value)} placeholder="TICKER (ex: RSI) — ecris-le ici"
        style={{width:"100%", background:"#0a0a12", color:"#c084fc", border:"1px solid #2a1f3a", borderRadius:8, padding:"9px 10px", fontSize:12, fontWeight:800, letterSpacing:1, fontFamily:"monospace", boxSizing:"border-box", marginBottom:8, textTransform:"uppercase"}} />
      <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Colle ici le tableau de stats Finviz (P/E, EPS Q/Q, SMA200, Inst Trans...)"
        style={{width:"100%", minHeight:90, background:"#0a0a12", color:TEXT2, border:"1px solid #2a1f3a", borderRadius:8, padding:10, fontSize:9, fontFamily:"monospace", boxSizing:"border-box", marginBottom:8}} />

      <button onClick={run} style={{width:"100%", padding:"11px", background:PURPLE, color:"#1a0a2a", border:"none", borderRadius:8, fontSize:12, fontWeight:900, letterSpacing:1, cursor:"pointer", marginBottom:6}}>⚡ ANALYSER</button>
      <a href="https://finviz.com/screener.ashx" target="_blank" rel="noreferrer" style={{display:"block", textAlign:"center", fontSize:9, color:PURPLE, marginBottom:14}}>🔍 Ouvrir Finviz ↗</a>

      {res?.error && <div style={{fontSize:9, color:AMBER, padding:"10px 12px", background:"#1a1500", borderRadius:8, lineHeight:1.5}}>{res.error}</div>}

      {res?.ticker && (() => {
        const pct = Math.round(res.passed/res.total*100);
        const verdict = pct>=85 ? {t:"✅ CANDIDATE SEPA", c:GREEN, bg:"#052010"} : pct>=65 ? {t:"⚠️ PARTIELLE — analyse fine", c:AMBER, bg:"#1a1500"} : {t:"❌ NE PASSE PAS", c:RED, bg:"#200505"};
        return (
        <div>
          <div style={{padding:"12px 14px", background:verdict.bg, borderRadius:10, border:"1px solid "+verdict.c+"55", marginBottom:12, textAlign:"center"}}>
            <div style={{fontSize:16, color:TEXT2, fontWeight:900, marginBottom:3}}>{res.ticker}</div>
            <div style={{fontSize:13, color:verdict.c, fontWeight:800, marginBottom:4}}>{verdict.t}</div>
            <div style={{fontSize:10, color:TEXT_DIM}}>{res.passed}/{res.total} filtres ({pct}%)</div>
          </div>

          <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10}}>
            <div style={{fontSize:10, color:BLUE, fontWeight:700, marginBottom:6}}>📋 DESCRIPTIFS — le terrain de chasse</div>
            {res.ch.desc.map((c,i)=><Row key={i} c={c} />)}
          </div>
          <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10}}>
            <div style={{fontSize:10, color:GREEN, fontWeight:700, marginBottom:6}}>📈 FONDAMENTAUX — l'acceleration</div>
            {res.ch.fond.map((c,i)=><Row key={i} c={c} />)}
          </div>
          <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10}}>
            <div style={{fontSize:10, color:AMBER, fontWeight:700, marginBottom:6}}>📉 TECHNIQUES — la tendance</div>
            {res.ch.tech.map((c,i)=><Row key={i} c={c} />)}
          </div>

          {res.vig.length>0 && (
            <div style={{padding:"10px 12px", background:"#1a1500", borderRadius:8, marginBottom:10, border:"1px solid #3a2a1f"}}>
              <div style={{fontSize:10, color:AMBER, fontWeight:700, marginBottom:5}}>⚠️ POINTS DE VIGILANCE</div>
              {res.vig.map((v,i)=><div key={i} style={{fontSize:8.5, color:TEXT, lineHeight:1.55, marginBottom:3}}>• {v}</div>)}
            </div>
          )}

          <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
            <div style={{fontSize:10, color:PURPLE, fontWeight:700, marginBottom:5}}>🔍 À VÉRIFIER À L'ŒIL (Finviz ne le donne pas)</div>
            <div style={{fontSize:8.5, color:TEXT, lineHeight:1.55, marginBottom:3}}>• <b>Le VCP</b> : sur le chart, cherche 3-4 contractions de moins en moins profondes, volume qui baisse. C'est LA signature de l'accumulation institutionnelle.</div>
            <div style={{fontSize:8.5, color:TEXT, lineHeight:1.55, marginBottom:3}}>• <b>50-Day New High</b> : le prix casse-t-il son plus haut des 50 derniers jours sur gros volume ? = le breakout.</div>
            <div style={{fontSize:8.5, color:TEXT, lineHeight:1.55}}>• <b>Golden Cross</b> : SMA50 réellement au-dessus de SMA200 sur le chart.</div>
          </div>

          <div style={{padding:"10px 12px", background:"#052010", borderRadius:8, marginBottom:14, border:"1px solid #1a3a2a"}}>
            <div style={{fontSize:10, color:GREEN, fontWeight:700, marginBottom:5}}>🎯 SI TU ENTRES — LES RÈGLES DE RISQUE</div>
            <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6}}>Stop loss <b style={{color:RED}}>-7 à -8%</b> sous l'entrée, sans exception · Ratio R/R <b style={{color:GREEN}}>min 3:1</b> (stop -8% = objectif +24%) · Position <b>max 10-15%</b> du portefeuille · Jamais moyenner à la baisse · Entre <b>au breakout du VCP</b>, jamais avant.</div>
          </div>
        </div>
        );
      })()}

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenStrat(!openStrat)} style={{fontSize:11, color:GREEN, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>🏛️ LA MÉTHODE SEPA — LES 4 PILIERS</span><span style={{fontSize:13}}>{openStrat?"▲":"▼"}</span>
        </div>
        {openStrat && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}>Mark Minervini a gagné le US Investing Championship avec +155% à +334%/an. Sa méthode SEPA trouve les actions explosives AVANT que les gros fonds les découvrent.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:GREEN}}>1. Fondamentaux en accélération</b> — des EPS qui croissent de plus en plus vite, trimestre après trimestre.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:GREEN}}>2. Catalyseur réel</b> — nouveau produit, contrat majeur, entrée dans un indice, changement de direction.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:GREEN}}>3. Technique Stage 2</b> — prix en tendance haussière, au-dessus de toutes les moyennes mobiles.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6}}><b style={{color:GREEN}}>4. Point d'entrée précis</b> — acheter exactement au breakout du VCP, jamais avant.</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenVcp(!openVcp)} style={{fontSize:11, color:AMBER, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>📐 LE VCP — LE SECRET DE MINERVINI</span><span style={{fontSize:13}}>{openVcp?"▲":"▼"}</span>
        </div>
        {openVcp && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}>Le VCP (Volatility Contraction Pattern) est le seul élément que Finviz ne détecte pas — tu le cherches à l'œil sur le chart.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}>Série de contractions de moins en moins profondes (-15%, -10%, -6%, -3%). Le volume diminue à chaque contraction : les vendeurs s'épuisent, les institutionnels accumulent en silence. Puis BREAKOUT avec volume 2-3x la moyenne.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:AMBER}}>Durée</b> : 3 à 8 semaines minimum — plus long = meilleur setup. Le prix reste au-dessus de SMA50 et SMA200 pendant toute la phase.</div>
          <div style={{fontSize:8, color:GREEN, lineHeight:1.55, padding:"6px 8px", background:"#052010", borderRadius:5, fontWeight:600}}>💡 Le VCP EST la signature graphique de l'accumulation institutionnelle : quand un fonds absorbe l'offre sur des semaines, la volatilité se contracte. Quand il a fini, la moindre demande fait exploser le prix.</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenCascade(!openCascade)} style={{fontSize:11, color:GREEN, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>⚡ L'EFFET CASCADE — BOTH POSITIVE SURPRISE</span><span style={{fontSize:13}}>{openCascade?"▲":"▼"}</span>
        </div>
        {openCascade && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}>Le filtre le plus puissant : l'entreprise bat SIMULTANÉMENT ses prévisions d'EPS ET de ventes. Pas juste la croissance — la SURPRISE par rapport aux attentes des analystes.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:RED}}>EPS surprise seul</b> = l'entreprise a coupé ses coûts pour battre les EPS, mais les ventes déçoivent. Signal faible et trompeur.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:RED}}>Revenue surprise seul</b> = les ventes surprennent mais les bénéfices déçoivent. Problème de marges. Signal ambigu.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}><b style={{color:GREEN}}>BOTH POSITIVE</b> = croissance réelle et saine. Le signal le plus puissant du marché.</div>
          <div style={{fontSize:8, color:GREEN, lineHeight:1.6, padding:"7px 9px", background:"#052010", borderRadius:5, fontWeight:600}}>La cascade : 1) Les algos détectent la double surprise → 2) Les analystes relèvent leurs estimations futures → 3) Les fonds augmentent leur allocation → 4) Le prix monte 10-30% rapidement. Le screener capture le DÉBUT de ce cycle.</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenFonds(!openFonds)} style={{fontSize:11, color:BLUE, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>🏦 COMMENT LES FONDS INSTITUTIONNELS ANALYSENT</span><span style={{fontSize:13}}>{openFonds?"▲":"▼"}</span>
        </div>
        {openFonds && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}>Pour suivre les institutionnels, il faut penser comme eux. Leur processus exact — que le screener reproduit :</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:BLUE}}>1. Screening quantitatif</b> sur +8000 actions → EPS QoQ/YoY &gt;25%, Sales &gt;25%, SMA200+. Filtre 99% des actions.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:BLUE}}>2. Vérif double surprise</b> → Both Positive EPS &amp; Revenue. Confirme une croissance réelle, pas artificielle.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:BLUE}}>3. Analyse dynamique institutionnelle</b> → Inst. Trans positif, Inst. Own &gt;10%. Suit l'argent intelligent qui accumule.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:BLUE}}>4. Validation consensus analyste</b> → Strong Buy. Confirmation externe indépendante.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:BLUE}}>5. Vérif liquidité</b> → Avg Vol &gt;200K, Price &gt;$5, Rel Vol &gt;1. Entrée/sortie sans impact prix.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:BLUE}}>6. Timing technique</b> → SMA50&gt;SMA200, Prix&gt;SMA200, 50-Day High. Entrée au meilleur moment.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6}}><b style={{color:BLUE}}>7. Accumulation silencieuse</b> → ils achètent sur 3-8 semaines. C'est là que le VCP se forme sur le chart.</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenHigh(!openHigh)} style={{fontSize:11, color:AMBER, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>🎯 LE 50-DAY NEW HIGH — LE SIGNAL DE BREAKOUT</span><span style={{fontSize:13}}>{openHigh?"▲":"▼"}</span>
        </div>
        {openHigh && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}>Le filtre que la plupart des screeners publics n'incluent pas. Il confirme que le breakout est réel et que le momentum institutionnel est au maximum.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:AMBER}}>Pourquoi 50 jours et pas 20 ?</b> 20 jours = 4 semaines = résistance faible, beaucoup de faux signaux. 50 jours = 10 semaines = résistance MAJEURE brisée, signal fiable, et c'est ce que les algos institutionnels sont programmés pour acheter.</div>
          <div style={{fontSize:8, color:AMBER, lineHeight:1.6, padding:"7px 9px", background:"#1a1500", borderRadius:5, fontWeight:600}}>La séquence parfaite : Phase 1 accumulation silencieuse → Phase 2 contraction VCP (volume baisse) → Phase 3 50-Day New High → Phase 4 BREAKOUT explosif (volume 2-3x). Le point d'entrée Minervini.</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenType(!openType)} style={{fontSize:11, color:PURPLE, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>⚖️ MINERVINI — TRADER OU INVESTISSEUR ?</span><span style={{fontSize:13}}>{openType?"▲":"▼"}</span>
        </div>
        {openType && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}>« Je suis un investisseur de croissance avec une discipline et une précision de trader. » Il sélectionne comme un investisseur (fondamentaux solides) mais exécute et gère le risque comme un trader (stop strict, entrée précise, sortie sans émotion).</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:PURPLE}}>Horizon</b> : 3 semaines à 12 mois (entre le day trader en minutes et le buy &amp; hold en années).</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:PURPLE}}>Stop loss</b> : 7-8% strict (le day trader &lt;1%, le buy &amp; hold aucun).</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:PURPLE}}>Sélection</b> : Fondamentaux + Technique (pas l'un sans l'autre).</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}><b style={{color:PURPLE}}>Entrée</b> : point pivot précis (le breakout du VCP), jamais au hasard.</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6}}><b style={{color:PURPLE}}>Marché baissier</b> : il réduit l'exposition et passe en cash (ne garde pas tout comme le buy &amp; hold).</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:10, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenRoutine(!openRoutine)} style={{fontSize:11, color:GREEN, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>📅 LA ROUTINE QUOTIDIENNE</span><span style={{fontSize:13}}>{openRoutine?"▲":"▼"}</span>
        </div>
        {openRoutine && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:GREEN}}>9h-10h</b> : ouvre le screener avant/pendant l'ouverture du marché US.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:GREEN}}>Interprète le nombre de résultats</b> : 0-3 = marché difficile, prudence · 4-8 = conditions idéales · 9+ = marché fort, sois sélectif.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:6}}><b style={{color:GREEN}}>Vérifie le chart manuellement</b> : cherche le VCP sur chaque candidate, attends le breakout (le volume doit exploser).</div>
          <div style={{fontSize:8.5, color:AMBER, fontWeight:700, marginBottom:4}}>Les 3 questions pour chaque action :</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}>1. Les EPS accélèrent-ils depuis au moins 2 trimestres consécutifs ?</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:3}}>2. Le chart montre-t-il un VCP avec volume décroissant ?</div>
          <div style={{fontSize:8, color:TEXT, lineHeight:1.6, marginBottom:6}}>3. Le rapport risque/rendement est-il d'au moins 3:1 ?</div>
          <div style={{fontSize:8, color:RED, lineHeight:1.6, padding:"7px 9px", background:"#200505", borderRadius:5, fontWeight:600}}>⚠️ Règle absolue : le screener trouve les candidates, ce n'est PAS un signal d'achat automatique. Chaque action doit passer ton analyse manuelle du chart.</div>
        </div>}
      </div>

      <div style={{padding:"10px 12px", background:"#0d0a18", borderRadius:8, marginBottom:20, border:"1px solid #2a1f3a"}}>
        <div onClick={()=>setOpenRisk(!openRisk)} style={{fontSize:11, color:RED, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span>🛡️ GESTION DU RISQUE — LES RÈGLES ABSOLUES</span><span style={{fontSize:13}}>{openRisk?"▲":"▼"}</span>
        </div>
        {openRisk && <div style={{marginTop:8}}>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:RED}}>Stop loss -7 à -8%</b> sous l'entrée. Sans exception. Une perte de 8% se récupère ; une perte de 50% demande +100% pour s'en remettre.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:RED}}>Ratio R/R min 3:1</b>. Stop -8% = objectif min +24%. Sinon, passe à la suivante.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:RED}}>Position max 10-15%</b> du portefeuille sur une seule action. 5 à 10 positions max.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:4}}><b style={{color:RED}}>Ne jamais moyenner à la baisse</b>. Le marché te dit que tu avais tort — écoute-le, coupe.</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6}}><b style={{color:RED}}>Trailing stop</b> : quand l'action monte de 20-30%, remonte ton stop pour protéger les gains.</div>
        </div>}
      </div>
    </div>
  );
}

export default StockAnalyseView;
