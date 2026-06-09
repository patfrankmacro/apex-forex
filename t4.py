with open('src/App.jsx','r') as f: c=f.read()
old = '''        if (buys.length===0 && sells.length===0) return null;'''
new = '''        if (buys.length===0 && sells.length===0) {
          return (
            <div style={{ marginBottom:14, padding:14, background:"#0a0a1e", border:"1px solid #a78bfa66", borderRadius:8, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#a78bfa", fontWeight:700, marginBottom:6 }}>⚠ LEVERAGED FUNDS NON DISPONIBLES</div>
              <div style={{ fontSize:9, color:TEXT, lineHeight:1.6, marginBottom:10 }}>
                Le tableau COT (filtre ③) n'a pas pu charger les données CFTC. Sans les Leveraged Funds, le filtre ③ ne peut pas être vérifié. Les données se rechargent automatiquement chaque vendredi soir (publication CFTC).
              </div>
              <a href="https://www.tradingster.com/cot" target="_blank" rel="noreferrer" style={{ display:"inline-block", padding:"8px 14px", background:"#a78bfa", color:"#1a0a2e", fontSize:10, fontWeight:700, borderRadius:6, textDecoration:"none" }}>🔗 Voir le COT (Tradingster)</a>
              <div style={{ fontSize:7.5, color:"#475569", marginTop:8, fontStyle:"italic" }}>Recharge la page si le tableau ne réapparaît pas.</div>
            </div>
          );
        }'''
n=c.count(old); print("popup LF:",n)
if n==1: c=c.replace(old,new)
with open('src/App.jsx','w') as f: f.write(c)
print("=== ok")
