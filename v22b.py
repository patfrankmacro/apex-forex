with open('src/App.jsx','r') as f: c=f.read()
reps = []
def rep(old,new,label): reps.append((old,new,label))

rep('if (minsET < 630 || minsET > 655) {','if (minsET < 630 || minsET > 660) {',"fenetre")

rep('''        // raison de blocage''','''        // raison de blocage
        dg.gems = (dg.f5?1:0) + (dg.fcot?1:0) + (dg.fvol?1:0);''',"gems_calc")

rep('''        else dg.reason = "PASSE TOUT";
        dg.status = dg.f1&&dg.f5&&dg.fcot&&dg.f4&&dg.fvol ? "passe" : "bloque";''',
'''        else dg.reason = "SIGNAL ("+dg.gems+" GEMS)";
        if (dg.f1 && dg.f4) { dg.status = "passe"; dg.reason = "SIGNAL ("+dg.gems+" GEMS)"; } else { dg.status = "bloque"; if (dg.f1 && !dg.f4) dg.reason = topEmpty ? "Top Gainers/Losers absent (colle le snapshot complet)" : (wpair+" pas dans le Top 5 "+(direction==="LONG"?"Gainers":"Losers")+" — mouvement pas confirmé"); }''',"verdict")

rep('''        // CANDIDAT REEL si les 5 filtres passent
        if (!f1ok) return;
        if (!f5ok) return;
        if (!fcotok) return;
        if (!f4ok) return;
        if (!fvolok) return;''',
'''        // CANDIDAT REEL si SIGNAL (divergence + Top 5)
        if (!f1ok) return;
        if (!f4ok) return;
        const gems = (f5ok?1:0) + (fcotok?1:0) + (fvolok?1:0);''',"candidats")

rep('candidates.push({pair:wpair, base, quote, direction, forceGap, isMaxDiv, score,',
    'candidates.push({pair:wpair, base, quote, direction, forceGap, isMaxDiv, score, gems, gemRetail:f5ok, gemLF:fcotok, gemVol:fvolok,',"stock")

rep('strongest, weakest, diag7: diagnostic, degrade}); return; }',
    'strongest, weakest, usdRank: (strength.indexOf("USD")>=0?strength.indexOf("USD")+1:null), diag7: diagnostic, degrade}); return; }',"usdrank_zero")
rep('setResult({ strongest, weakest, top, diag7: diagnostic, degrade });',
    'setResult({ strongest, weakest, usdRank: (strength.indexOf("USD")>=0?strength.indexOf("USD")+1:null), top, diag7: diagnostic, degrade });',"usdrank_top")

rep('① {d.f1?"✓":"✗"} Divergence {d.forceGap!=null?d.forceGap+"r":"?"} · ② {d.f5?"✓":"✗"} Retail ≥70% · ③ {d.fcot?"✓":"✗"} LF · ④ {d.f4?"✓":"✗"} Top5 · ⑤ {d.fvol?"✓":"✗"} Vol',
    '① {d.f1?"✓":"✗"} Divergence {d.forceGap!=null?d.forceGap+"r":"?"} · ② {d.f4?"✓":"✗"} Top5 | 💎 {d.f5?"✓":"✗"} Retail · 💎 {d.fcot?"✓":"✗"} Fonds · 💎 {d.fvol?"✓":"✗"} Énergie',"diagline")

rep('{d.status==="passe"?"✓ PASSE TOUT — alerte !":"✗ bloque : "+d.reason}',
    '{d.status==="passe"?("🎯 SIGNAL — "+((d.f5?1:0)+(d.fcot?1:0)+(d.fvol?1:0))+" 💎"):"✗ bloque : "+d.reason}',"statut")

rep('Vert = passe les 5 filtres · Rouge = bloque. Tri : prêtes en haut. LF = Leveraged Funds · Top5 = paire dans le Top 5 Gainers/Losers.',
    'Vert = SIGNAL (① divergence ≥4r + ② Top 5). Les 💎 (Retail, Fonds, Énergie) mesurent la qualité : 0 = BRUT, 1-2 = CONFIRMÉ, 3 = PARFAIT.',"legende")

rep('🔍 DIAGNOSTIC — tes 7 paires (pourquoi chacune passe, bloque ou dort)','🔍 DIAGNOSTIC — tes 7 paires (signal ①+②, qualité en 💎)',"titre_diag")
rep('· divergence {s.gap}r · 5/5 — surveille le drapeau','· divergence {s.gap}r · SIGNAL — surveille le drapeau',"jour")
rep('{d.status==="passe"?"5/5 PASSE":d.reason}','{d.status==="passe"?"SIGNAL":d.reason}',"minidiag")
rep('("— aucun 5/5"+(meilleurBloc?','("— aucun signal"+(meilleurBloc?',"hist")
rep('le ⑤ (Most Volatile) a bloqué un 4/4 complet {blocVol} fois. 30 jours conservés','Procès des 💎 : note la qualité des cassures (BRUT vs PARFAIT) au journal. 30 jours conservés',"stat")

rep('Système court terme (1-3 jours) — 5 filtres : divergence + retail contrarien + Leveraged Funds + mouvement réel (Top 5) + énergie réelle (Most Volatile) · Tu suis les big boys de Londres',
    'Système court terme (1-3 jours) — LE SIGNAL : ① divergence ≥4r + ② Top 5 · LA QUALITÉ : 💎 Retail 💎 Fonds 💎 Énergie · Tu suis les big boys de Londres',"soustitre")
rep('sub:"① Divergence ≥4r · ② Retail ≥70% · ③ Leveraged Funds · ④ Top 5 Gainers/Losers · ⑤ Top 5 Most Volatile (jamais Least)"',
    'sub:"① Divergence ≥4 rangs · ② Top 5 Gainers (achat) ou Losers (vente). 2/2 = SIGNAL."',"etape4")
rep('t:"LES 5 FILTRES"','t:"LE SIGNAL : ① + ②"',"etape4t")

with open('src/App.jsx','r') as f: pass
fails = []
for old,new,label in reps:
    n = c.count(old)
    print(f"{label}: {n}")
    if n != 1: fails.append(label)

# Les 2 textes a vraies apostrophes : remplacement PAR LIGNE
lines = c.split("\n")
li5 = -1; lifin = -1
for i,l in enumerate(lines):
    if 'DIRECTION CONFIRMÉE' in l: li5 = i
    if "Pas de 5/5 aujourd'hui ? = Pas de trade." in l: lifin = i
print("etape5_ligne:", "OK" if li5>=0 else "INTROUVABLE")
print("finseq_ligne:", "OK" if lifin>=0 else "INTROUVABLE")

if fails or li5<0 or lifin<0:
    print("=== RIEN ECRIT — echecs:", fails)
else:
    for old,new,label in reps:
        c = c.replace(old,new,1)
    lines = c.split("\n")
    for i,l in enumerate(lines):
        if 'DIRECTION CONFIRMÉE' in l:
            indent = l[:len(l)-len(l.lstrip())]
            lines[i] = indent + '{n:"5", icon:"🎯", color:"#34d399", t:"SIGNAL ? LIS SES 💎", sub:"VERTE = achat ▲ · ROUGE = vente ▼. 💎 Retail/Fonds/Énergie = la qualité : 0 BRUT · 1-2 CONFIRMÉ · 3 PARFAIT. Tu identifies — tu n\u0027entres pas encore."},'
        if "Pas de 5/5 aujourd'hui ? = Pas de trade." in l:
            lines[i] = l.replace("Pas de 5/5 aujourd'hui ? = Pas de trade. C'est normal. La discipline d'attendre fait partie de la stratégie.",
                "Pas de signal ①+② ? = Pas de trade, c'est normal. Un signal BRUT (0 💎) reste tradable, mais sans carburant confirmé : taille ta position en conséquence.")
    c = "\n".join(lines)
    c = c.replace("GEMS)", "💎)")
    with open('src/App.jsx','w') as f: f.write(c)
    print("=== TOUS APPLIQUES, fichier ecrit")
