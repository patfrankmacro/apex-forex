with open('src/App.jsx','r') as f: c=f.read()
ok=0;tot=0
def rep(old,new,label):
    global c,ok,tot;tot+=1
    n=c.count(old);print(f"{label}: {n}")
    if n>=1:c=c.replace(old,new,1);ok+=1

# Calculer f4 juste apres le calcul du COT (avant la raison de blocage)
rep('        dg.fcot = fcotok; dg.lfStrongNet=lfStrongNet; dg.lfWeakNet=lfWeakNet; dg.lfMiss=lfMiss; dg.strongCur=strongCur; dg.weakCur=weakCur;',
    '''        dg.fcot = fcotok; dg.lfStrongNet=lfStrongNet; dg.lfWeakNet=lfWeakNet; dg.lfMiss=lfMiss; dg.strongCur=strongCur; dg.weakCur=weakCur;
        // FILTRE 4 - mouvement reel : la paire doit etre dans le Top 5 du bon cote
        // LONG -> dans Top Gainers ; SHORT -> dans Top Losers
        const f4ok = (direction==="LONG") ? gainersSet.has(wpair) : losersSet.has(wpair);
        // signal renforce : la devise faible perd sur plusieurs paires (ou forte gagne sur plusieurs)
        const weakRepeat = loserCurCount[weakCur]||0;
        const strongRepeat = gainerCurCount[strongCur]||0;
        dg.f4 = f4ok; dg.weakRepeat = weakRepeat; dg.strongRepeat = strongRepeat;
        const topEmpty = (gainersSet.size===0 && losersSet.size===0);
        dg.topEmpty = topEmpty;''',"calc_f4")

# Ajouter la raison de blocage f4 (apres le bloc fcot, avant "else dg.reason = PASSE TOUT")
rep('''        else if (!dg.fcot) dg.reason = lfMiss ? "Leveraged Funds non disponibles" : (strongCur+" pas plus favorisé que "+weakCur+" par les fonds");
        else dg.reason = "PASSE TOUT";
        dg.status = dg.f1&&dg.f5&&dg.fcot ? "passe" : "bloque";''',
    '''        else if (!dg.fcot) dg.reason = lfMiss ? "Leveraged Funds non disponibles" : (strongCur+" pas plus favorisé que "+weakCur+" par les fonds");
        else if (!dg.f4) dg.reason = topEmpty ? "Top Gainers/Losers absent (colle le snapshot complet)" : (wpair+" pas dans le Top 5 "+(direction==="LONG"?"Gainers":"Losers")+" — mouvement pas confirmé");
        else dg.reason = "PASSE TOUT";
        dg.status = dg.f1&&dg.f5&&dg.fcot&&dg.f4 ? "passe" : "bloque";''',"reason_f4")

# Integrer f4 dans le verdict candidat
rep('''        if (!f1ok) return;
        if (!f5ok) return;
        if (!fcotok) return;''',
    '''        if (!f1ok) return;
        if (!f5ok) return;
        if (!fcotok) return;
        if (!f4ok) return;''',"verdict_f4")

with open('src/App.jsx','w') as f: f.write(c)
print(f"=== {ok}/{tot}")
