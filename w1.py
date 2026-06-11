with open('src/App.jsx','r') as f: c=f.read()
ancre = '''>⚡ ANALYSER</button>'''
bloc = ancre + '''

      {!result && (()=>{
        let hist=[];
        try { hist = JSON.parse(localStorage.getItem("apexHistory")||"[]"); } catch(e){}
        const today = new Date().toLocaleDateString("fr-CA");
        const h = hist.find(x=>x.date===today);
        if (!h) return null;
        const has = h.signaux && h.signaux.length>0;
        return (
          <div style={{marginTop:10, padding:"10px", background: has?"#052010":"#0f1622", borderRadius:6, border:"1px solid "+(has?"#4ade8055":"#1e3a5f")}}>
            <div style={{fontSize:9, color: has?"#4ade80":"#94a3b8", fontWeight:700, marginBottom:6}}>📌 TON ANALYSE DU JOUR — faite à {h.heure} · {h.strongest} fort → {h.weakest} faible</div>
            {has ? h.signaux.map((s,i)=>(
              <div key={i} style={{padding:"6px 8px", background:"#0a2818", borderRadius:4, marginBottom:4, fontSize:9, color:"#86efac", fontWeight:700}}>
                🎯 {s.pair.slice(0,3)}/{s.pair.slice(3,6)} {s.dir==="LONG"?"▲ ACHAT":"▼ VENTE"} · divergence {s.gap}r · 5/5 — surveille le drapeau, entre à la cassure (fin NY/Tokyo)
              </div>
            )) : <div style={{fontSize:8.5, color:"#94a3b8", marginBottom:4}}>Aucun signal 5/5 aujourd\\u0027hui — pas de trade, c\\u0027est la discipline.</div>}
            <div style={{fontSize:8, color:"#7dd3fc", fontWeight:700, margin:"6px 0 4px"}}>Le diagnostic de tes 7 paires :</div>
            {(h.diag||[]).map((d,i)=>(
              <div key={i} style={{fontSize:7.5, color: d.status==="passe"?"#4ade80":"#94a3b8", lineHeight:1.5, padding:"2px 0"}}>
                {d.status==="passe"?"✅":"·"} {d.pair.slice(0,3)}/{d.pair.slice(3,6)} {d.dir==="LONG"?"▲":"▼"} — {d.status==="passe"?"5/5 PASSE":d.reason}
              </div>
            ))}
            <div style={{fontSize:7, color:"#4a5070", marginTop:5, fontStyle:"italic"}}>Cette lecture reste affichée toute la journée — ta référence pendant le drapeau et jusqu\\u0027à la cassure.</div>
          </div>
        );
      })()}'''
n = c.count(ancre); print("ancre:", n)
if n==1:
    c = c.replace(ancre, bloc, 1)
    c = c.replace("aujourd\\u0027hui", "aujourd'hui").replace("c\\u0027est", "c'est").replace("jusqu\\u0027à", "jusqu'à")
    with open('src/App.jsx','w') as f: f.write(c)
    print("=== ecrit")
else:
    print("=== RIEN ECRIT (securite)")
