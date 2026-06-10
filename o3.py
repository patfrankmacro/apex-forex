with open('src/App.jsx','r') as f: c=f.read()
anchor = '''          <div style={{fontSize:10, color:"#a5b4fc", fontWeight:700, marginBottom:4}}>🎯 POURQUOI LES 4 ENSEMBLE — la convergence</div>'''
# on insere le bloc 4 juste avant le conteneur de la convergence
# le conteneur convergence ouvre juste avant cette ligne ; on cherche son ouverture
bloc4 = '''        <div style={{marginBottom:10, padding:"10px 11px", background:"#0a1420", borderRadius:6, borderLeft:"3px solid #f59e0b"}}>
          <div style={{fontSize:10, color:"#f59e0b", fontWeight:700, marginBottom:4}}>④ MOUVEMENT RÉEL (Top Gainers/Losers) — la preuve que les gros ont bougé AUJOURD'HUI</div>
          <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6}}>Une paire majeure ne bouge pas de 0,3-0,4 % dans la journée à cause du retail. <b style={{color:"#f59e0b"}}>Un vrai mouvement de prix = du volume institutionnel.</b> Le Top Gainers/Losers te montre où ce volume s'est déversé aujourd'hui : c'est la preuve que le mouvement n'est pas théorique, il se passe vraiment.<br/><br/>
          On exige que ta paire soit dans le <b style={{color:"#f59e0b"}}>Top 5</b> du bon côté (Top Gainers si tu achètes, Top Losers si tu vends). Signal encore plus fort : ta devise faible perd sur <b>plusieurs paires</b> à la fois (ex : l'AUD sur 4 paires) = faiblesse généralisée, pas un coup isolé.<br/><br/>
          <b style={{color:"#f59e0b"}}>Attention :</b> ce filtre confirme la DIRECTION à l'analyse (10h-12h), il ne dit pas d'entrer maintenant. Tu attends toujours le pullback au Golden Pocket pour entrer — jamais sur l'extension.</div>
        </div>

'''
# Trouver le conteneur convergence (la div qui contient l'anchor). On insere le bloc4 avant cette div.
# Cherchons le pattern d'ouverture du conteneur convergence
import re
idx = c.find(anchor)
print("anchor trouve:", idx!=-1)
if idx!=-1:
    # remonter pour trouver le <div ... qui ouvre ce conteneur (la ligne juste avant l'anchor)
    before = c[:idx]
    open_div = before.rfind('        <div style={{padding:"10px 11px"')
    print("conteneur conv trouve:", open_div!=-1)
    if open_div!=-1:
        c = c[:open_div] + bloc4 + c[open_div:]
with open('src/App.jsx','w') as f: f.write(c)
print("=== ok")
