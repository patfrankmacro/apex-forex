with open('src/App.jsx','r') as f: c=f.read()
reps = []
def rep(old,new,label): reps.append((old,new,label))

# === 1. MOTEUR : fenetre 10h30-11h00 ===
rep('if (minsET < 630 || minsET > 655) {','if (minsET < 630 || minsET > 660) {',"fenetre")

# === 2. MOTEUR : verdict signal ①+② , gems ===
rep('''        // raison de blocage''','''        // raison de blocage
        // SIGNAL = ① divergence + ② Top 5. Retail/Fonds/Energie = diamants (qualite, non bloquants)
        dg.gems = (dg.f5?1:0) + (dg.fcot?1:0) + (dg.fvol?1:0);''',"gems_calc")

rep('''        if (!dg.f1) dg.reason = forceGap<GAP_MIN ? ("divergence "+forceGap+" rangs (<4)") : "force pas du bon cote";
        else if (!dg.f5) dg.reason = dg.rMiss ? "retail Myfxbook absent" : ("retail "+(direction==="LONG"?"SHORT "+rShort:"LONG "+rLong)+"% (<70%)");
        else if (!dg.fcot) dg.reason = "Leveraged Funds non alignes";
        else if (!dg.f4) dg.reason = topEmpty ? "Top Gainers/Losers absent (colle le snapshot complet)" : (wpair+" pas dans le Top 5 "+(direction==="LONG"?"Gainers":"Losers")+" — mouvement pas confirmé");
        else if (!dg.fvol) dg.reason = volEmpty ? "Most Volatile absent (colle le snapshot complet)" : (dg.inLeast ? wpair+" dans le LEAST Volatile — paire endormie" : wpair+" pas dans le Top 5 Most Volatile — pas d'énergie");
        else dg.reason = "5/5";
        dg.status = dg.f1&&dg.f5&&dg.fcot&&dg.f4&&dg.fvol ? "passe" : "bloque";''',
'''        if (!dg.f1) dg.reason = forceGap<GAP_MIN ? ("divergence "+forceGap+" rangs (<4)") : "force pas du bon cote";
        else if (!dg.f4) dg.reason = topEmpty ? "Top Gainers/Losers absent (colle le snapshot complet)" : (wpair+" pas dans le Top 5 "+(direction==="LONG"?"Gainers":"Losers")+" — mouvement pas confirmé");
        else dg.reason = "SIGNAL ("+dg.gems+" 💎)";
        dg.status = dg.f1&&dg.f4 ? "passe" : "bloque";''',"verdict")

# === 3. MOTEUR : candidats sur ①+② ===
rep('''        // CANDIDAT REEL si les 5 filtres passent
        if (!f1ok) return;
        if (!f5ok) return;
        if (!fcotok) return;
        if (!f4ok) return;
        if (!fvolok) return;''',
'''        // CANDIDAT REEL si SIGNAL (① divergence + ② Top 5)
        if (!f1ok) return;
        if (!f4ok) return;
        const gems = (f5ok?1:0) + (fcotok?1:0) + (fvolok?1:0);''',"candidats")

rep('candidates.push({pair:wpair, base, quote, direction, forceGap, isMaxDiv, score,',
    'candidates.push({pair:wpair, base, quote, direction, forceGap, isMaxDiv, score, gems, gemRetail:f5ok, gemLF:fcotok, gemVol:fvolok,',"stock")

# === 4. usdRank dans les deux setResult ===
rep('strongest, weakest, diag7: diagnostic, degrade}); return; }',
    'strongest, weakest, usdRank: (strength.indexOf("USD")>=0?strength.indexOf("USD")+1:null), diag7: diagnostic, degrade}); return; }',"usdrank_zero")
rep('setResult({ strongest, weakest, top, diag7: diagnostic, degrade });',
    'setResult({ strongest, weakest, usdRank: (strength.indexOf("USD")>=0?strength.indexOf("USD")+1:null), top, diag7: diagnostic, degrade });',"usdrank_top")

# === 5. AFFICHAGE diagnostic : ligne + statut + legende + titre ===
rep('<div style={{fontSize:8, color:TEXT_DIM, fontFamily:"monospace"}}>① {d.f1?"✓":"✗"} Divergence {d.forceGap!=null?d.forceGap+"r":"?"} · ② {d.f5?"✓":"✗"} Retail ≥70% · ③ {d.fcot?"✓":"✗"} LF · ④ {d.f4?"✓":"✗"} Top5 · ⑤ {d.fvol?"✓":"✗"} Vol</div>',
    '<div style={{fontSize:8, color:TEXT_DIM, fontFamily:"monospace"}}>① {d.f1?"✓":"✗"} Divergence {d.forceGap!=null?d.forceGap+"r":"?"} · ② {d.f4?"✓":"✗"} Top5 | 💎 {d.f5?"✓":"✗"} Retail · 💎 {d.fcot?"✓":"✗"} Fonds · 💎 {d.fvol?"✓":"✗"} Énergie</div>',"diagline")

rep('{d.status==="passe"?"✓ PASSE TOUT — alerte !":"✗ bloque : "+d.reason}',
    '{d.status==="passe"?("🎯 SIGNAL ①✓②✓ — "+((d.f5?1:0)+(d.fcot?1:0)+(d.fvol?1:0))+" 💎"):"✗ bloque : "+d.reason}',"statut")

rep('Vert = passe les 5 filtres · Rouge = bloque. Tri : prêtes en haut. LF = Leveraged Funds · Top5 = paire dans le Top 5 Gainers/Losers.',
    'Vert = SIGNAL (① divergence ≥4r + ② Top 5). Les 💎 (Retail, Fonds, Énergie) mesurent la qualité : 0 = BRUT, 1-2 = CONFIRMÉ, 3 = PARFAIT.',"legende")

rep('🔍 DIAGNOSTIC — tes 7 paires (pourquoi chacune passe, bloque ou dort)','🔍 DIAGNOSTIC — tes 7 paires (signal ①+②, qualité en 💎)',"titre_diag")

# === 6. Bloc analyse du jour + historique ===
rep('· divergence {s.gap}r · 5/5 — surveille le drapeau','· divergence {s.gap}r · SIGNAL — surveille le drapeau',"jour")
rep('{d.status==="passe"?"5/5 PASSE":d.reason}','{d.status==="passe"?"SIGNAL ①✓②✓":d.reason}',"minidiag")
rep('("— aucun 5/5"+(meilleurBloc?','("— aucun signal ①+②"+(meilleurBloc?',"hist")
rep('le ⑤ (Most Volatile) a bloqué un 4/4 complet {blocVol} fois. 30 jours conservés','Procès des 💎 en cours : note la qualité des cassures (BRUT vs PARFAIT) dans ton journal. 30 jours conservés',"stat")

# === 7. TEXTES : sous-titre + sequence ===
rep('Système court terme (1-3 jours) — 5 filtres : divergence + retail contrarien + Leveraged Funds + mouvement réel (Top 5) + énergie réelle (Most Volatile) · Tu suis les big boys de Londres',
    'Système court terme (1-3 jours) — LE SIGNAL : ① divergence ≥4r + ② Top 5 · LA QUALITÉ : 💎 Retail 💎 Fonds 💎 Énergie · 7 paires + XAU/USD · Tu suis les big boys de Londres',"soustitre")

rep('sub:"① Divergence ≥4r · ② Retail ≥70% · ③ Leveraged Funds · ④ Top 5 Gainers/Losers · ⑤ Top 5 Most Volatile (jamais Least)"',
    'sub:"① Divergence ≥4 rangs · ② Top 5 Gainers (achat) ou Losers (vente). 2/2 = SIGNAL. Or : USD #1-2 = vente, #7-8 = achat."',"etape4")
rep('t:"LES 5 FILTRES"','t:"LE SIGNAL : ① + ②"',"etape4t")
rep('t:"5/5 ? DIRECTION CONFIRMÉE", sub:"Carte VERTE = achat ▲ · Carte ROUGE = vente ▼. Tu identifies — tu n\\u0027entres pas encore."',
    't:"SIGNAL ? LIS SES 💎", sub:"VERTE = achat · ROUGE = vente. 💎 Retail/Fonds/Énergie = qualité : 0 BRUT, 1-2 CONFIRMÉ, 3 PARFAIT. Tu identifies — tu n\\u0027entres pas encore."',"etape5")
rep('Pas de 5/5 aujourd\\u0027hui ? = Pas de trade. C\\u0027est normal. La discipline d\\u0027attendre fait partie de la stratégie.',
    'Pas de signal ①+② ? = Pas de trade, c\\u0027est normal. Un signal BRUT (0 💎) = tradable, mais sans carburant confirmé : taille ta position en conséquence.',"finseq")

# === EXECUTION TOUT-OU-RIEN ===
fails = []
for old,new,label in reps:
    n = c.count(old)
    print(f"{label}: {n}")
    if n != 1: fails.append(label)
if fails:
    print("=== RIEN ECRIT — echecs:", fails)
else:
    for old,new,label in reps:
        c = c.replace(old,new,1)
    c = c.replace("\\u0027","'")
    with open('src/App.jsx','w') as f: f.write(c)
    print("=== TOUS APPLIQUES, fichier ecrit")
