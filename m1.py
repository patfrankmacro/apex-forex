with open('src/App.jsx','r') as f: c=f.read()
old = '''      // (Top Gainers/Losers et Most Volatile ne sont plus utilises — systeme APEX 3 filtres)'''
new = '''      // FILTRE 4 : Top Gainers / Top Losers (confirme que le mouvement est reel et institutionnel)
      const topGainers = grabPairs("Top Gainers", ["Top Losers","Currency Volatility","Most Volatile","Least Volatile"]);
      const topLosers  = grabPairs("Top Losers",  ["Currency Volatility","Most Volatile","Least Volatile","Top Gainers"]);
      const gainersSet = new Set(topGainers.slice(0,5).map(p=>p.pair));
      const losersSet  = new Set(topLosers.slice(0,5).map(p=>p.pair));
      // compte combien de fois une devise apparait du cote perdant / gagnant (signal renforce)
      const loserCurCount = {}; topLosers.slice(0,5).forEach(p=>{ loserCurCount[p.base]=(loserCurCount[p.base]||0)+1; loserCurCount[p.quote]=(loserCurCount[p.quote]||0)+1; });
      const gainerCurCount = {}; topGainers.slice(0,5).forEach(p=>{ gainerCurCount[p.base]=(gainerCurCount[p.base]||0)+1; gainerCurCount[p.quote]=(gainerCurCount[p.quote]||0)+1; });'''
n=c.count(old); print("parse:",n)
if n==1: c=c.replace(old,new)
with open('src/App.jsx','w') as f: f.write(c)
print("=== ok")
