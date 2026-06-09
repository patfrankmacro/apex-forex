with open('src/App.jsx','r') as f: c=f.read()
old = '''        if (rows.length===0) return null;
        // tri: les plus extremes en haut
        rows.sort((a,b)=> Math.max(b.lp,b.sp) - Math.max(a.lp,a.sp));'''
new = '''        // Si pas de donnees retail : message clair (connexion Myfxbook)
        if (rows.length===0) {
          const connected = (typeof window!=="undefined") ? window.__mfxConnected : undefined;
          return (
            <div style={{ marginBottom:14, padding:14, background:"#1a1000", border:"1px solid #fbbf2466", borderRadius:8, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:6 }}>⚠ SENTIMENT RETAIL NON DISPONIBLE</div>
              <div style={{ fontSize:9, color:TEXT, lineHeight:1.6, marginBottom:10 }}>
                Le tableau retail (filtre ②) n'a pas pu charger les données Myfxbook. {connected===false?"La connexion à Myfxbook a échoué ou expiré.":"Les données ne sont pas encore arrivées."} Sans le retail, le filtre ② ne peut pas être vérifié.
              </div>
              <a href="https://www.myfxbook.com/community/outlook" target="_blank" rel="noreferrer" style={{ display:"inline-block", padding:"8px 14px", background:"#fbbf24", color:"#1a1500", fontSize:10, fontWeight:700, borderRadius:6, textDecoration:"none" }}>🔗 Ouvrir Myfxbook</a>
              <div style={{ fontSize:7.5, color:"#475569", marginTop:8, fontStyle:"italic" }}>Le tableau se chargera automatiquement dès que la connexion sera rétablie. Recharge la page si besoin.</div>
            </div>
          );
        }
        // tri: les plus extremes en haut
        rows.sort((a,b)=> Math.max(b.lp,b.sp) - Math.max(a.lp,a.sp));'''
n=c.count(old); print("popup retail:",n)
if n==1: c=c.replace(old,new)
with open('src/App.jsx','w') as f: f.write(c)
print("=== ok")
