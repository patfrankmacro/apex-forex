with open('src/App.jsx','r') as f: c=f.read()
reps = []
def rep(old,new,label): reps.append((old,new,label))

# 1. Etat riskMode du composant Swing (apres raw)
rep('''  const [raw, setRaw] = useState("");''',
'''  const [raw, setRaw] = useState("");
  const [riskModeUi, setRiskModeUi] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("apexRisk")||"null"); if (s && s.d === new Date().toDateString()) return s.m; } catch(e){}
    return null;
  });
  const setRiskUi = (m) => { setRiskModeUi(m); try { localStorage.setItem("apexRisk", JSON.stringify({m, d:new Date().toDateString()})); } catch(e){} };''',"etat_ui")

# 2. La boite sentiment entre le titre et le textarea
rep('''      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🤖 ANALYSE AUTO — COLLE TES DONNÉES MARKETMILK</div>
      <textarea value={raw}''',
'''      <div style={{fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:8}}>🤖 ANALYSE AUTO — COLLE TES DONNÉES MARKETMILK</div>
      <div style={{marginBottom:8, padding:"8px 10px", background:"#0d1420", borderRadius:6, border:"1px solid #33415555"}}>
        <div style={{fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:5}}>{"③ SENTIMENT DU JOUR (obligatoire) — lis le Risk Meter puis choisis (partagé avec ton Day Trade) :"}</div>
        <div style={{display:"flex", gap:6}}>
          {["RISK-ON","NEUTRE","RISK-OFF"].map(m => (
            <button key={m} onClick={()=>setRiskUi(m)} style={{flex:1, padding:"7px 4px", borderRadius:5, fontSize:8.5, fontWeight:700, cursor:"pointer", border: riskModeUi===m ? "2px solid "+(m==="RISK-ON"?"#4ade80":m==="RISK-OFF"?"#f87171":"#94a3b8") : "1px solid #334155", background: riskModeUi===m ? (m==="RISK-ON"?"#052010":m==="RISK-OFF"?"#200505":"#1a2030") : "#0a0f1a", color: riskModeUi===m ? (m==="RISK-ON"?"#4ade80":m==="RISK-OFF"?"#f87171":"#94a3b8") : "#64748b"}}>{m==="RISK-ON"?"🟢 RISK-ON":m==="RISK-OFF"?"🔴 RISK-OFF":"⚪ NEUTRE"}</button>
          ))}
        </div>
        <a href="https://www.babypips.com/tools/risk-on-risk-off-meter" target="_blank" rel="noopener noreferrer" style={{display:"block", marginTop:6, fontSize:8.5, color:"#7dd3fc", textDecoration:"none"}}>{"🌡️ Ouvrir le Risk-On/Risk-Off Meter (babypips) ↗"}</a>
        {!riskModeUi && <div style={{fontSize:8, color:"#fbbf24", marginTop:4}}>{"⚠ Choisis le sentiment AVANT d\\u0027analyser — sans lui, aucun signal ne peut être validé."}</div>}
        {riskModeUi==="NEUTRE" && <div style={{fontSize:8, color:"#94a3b8", marginTop:4}}>{"NEUTRE = pas de courant de fond : le ③ n\\u0027est pas rempli, aucun signal validé aujourd\\u0027hui. L\\u0027or aussi exige un sentiment net."}</div>}
      </div>
      <textarea value={raw}''',"boite_ui")

# 3. Placeholder mis a jour
rep('placeholder="Colle ici le contenu copié depuis marketmilk.babypips.com (page complète : Currency Strength + Top Gainers/Losers — le signal ① + ② a besoin des deux)..."',
'placeholder="Colle ici le contenu copié depuis marketmilk.babypips.com (page complète : Currency Strength + Top Gainers/Losers) — le scanner croise tout avec ton sentiment ③..."',"placeholder")

fails = []
for old,new,label in reps:
    n = c.count(old)
    print(f"{label}: {n}")
    if n != 1: fails.append(label)
if fails:
    print("=== RIEN ECRIT — echecs:", fails)
else:
    for old,new,label in reps: c = c.replace(old,new,1)
    with open('src/App.jsx','w') as f: f.write(c)
    print("=== UI ECRITE")
