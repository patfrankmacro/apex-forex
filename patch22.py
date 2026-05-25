path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup29", 'w') as f:
    f.write(c)

OLD = '''  const ranked = useMemo(() =>
    CURR.map(c => ({...c, score:calcScore(data,c.code)})).sort((a,b)=>b.score-a.score)'''

NEW = '''  const REGIME_RANK = { "GOLDILOCKS":3, "SURCHAUFFE":2, "RÉCESSION":-2, "STAGFLATION":-3 };
  const ranked = useMemo(() =>
    CURR.map(c => ({...c, score:calcScore(data,c.code)})).sort((a,b)=>{
      const rA = getRegime(data,a.code);
      const rB = getRegime(data,b.code);
      const rankA = rA ? (REGIME_RANK[rA.label] ?? 0) : 0;
      const rankB = rB ? (REGIME_RANK[rB.label] ?? 0) : 0;
      if (rankB !== rankA) return rankB - rankA;
      return b.score - a.score;
    })'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Tri par régime OK")
else:
    print("ERREUR: ranked pas trouvé")

with open(path, 'w') as f:
    f.write(c)
print("Patch22 terminé")
