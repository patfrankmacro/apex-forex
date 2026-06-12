with open('src/App.jsx','r') as f: c=f.read()
reps = []
def rep(old,new,label): reps.append((old,new,label))

# 1. Seuil 4 -> 3


# 2. Fenetre 11h-16h (660-960)
rep('      if (minsET < 630 || minsET > 660) {','      if (minsET < 660 || minsET > 960) {',"fenetre")
rep('        const avant = minsET < 630;','        const avant = minsET < 660;',"avant")

# 3. Etat riskMode partage (cle apexRisk) — insere pres de GAP_MIN
rep('      const GAP_MIN = 4;',
'''      const GAP_MIN = 3;
      let riskMode = null;
      try { const s = JSON.parse(localStorage.getItem("apexRisk")||"null"); if (s && s.d === new Date().toDateString()) riskMode = s.m; } catch(e){}
      const riskAligned = (quote, dir) => {
        if (!riskMode || riskMode === "NEUTRE") return false;
        const quoteRefuge = (quote === "JPY");
        if (quoteRefuge) return dir === "ACHAT" ? riskMode === "RISK-ON" : riskMode === "RISK-OFF";
        return dir === "ACHAT" ? riskMode === "RISK-OFF" : riskMode === "RISK-ON";
      };''',"etat_risk")

# 4. Verdict a 3 conditions + raison sentiment
rep('        if (dg.f1 && dg.f4) { dg.status = "passe"; dg.reason = "SIGNAL ("+dg.gems+" bonus)"; } else { dg.statu',
'''        dg.f3sent = riskAligned(quote, dg.dir==="ACHAT"||dg.dir==="LONG"||dg.verdict==="ACHAT"?"ACHAT":"VENTE");
        if (dg.f1 && dg.f4 && !dg.f3sent) dg.reason = riskMode ? (riskMode==="NEUTRE" ? "③ sentiment NEUTRE — pas de courant de fond" : "③ "+riskMode+" pousse cette paire dans l\\u0027autre sens") : "③ choisis le sentiment du jour";
        if (dg.f1 && dg.f4 && dg.f3sent) { dg.status = "passe"; dg.reason = "SIGNAL ①②③ ("+dg.gems+" bonus)"; } else { dg.statu''',"verdict")

# 5. Candidats : le sentiment bloque aussi
rep('''        if (!f1ok) return;
        if (!f4ok) return;''',
'''        if (!f1ok) return;
        if (!f4ok) return;
        if (!riskAligned(quote, verdict==="ACHAT"?"ACHAT":"VENTE")) return;''',"candidats")

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
    print("=== MOTEUR v26 ECRIT")
