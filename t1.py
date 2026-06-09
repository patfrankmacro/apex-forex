with open('src/App.jsx','r') as f: c=f.read()
ok=0; tot=0
def rep(old,new,label):
    global c,ok,tot; tot+=1
    n=c.count(old); print(f"{label}: {n}")
    if n>=1: c=c.replace(old,new,1); ok+=1

# Supprimer les variables mortes (gainers/losers/mostVol/volRankPair/leastVol/TOP_RANK/SESSION/LONDON/NY)
rep('''      const gainers  = grabPairs("Top Gainers", ["Top Losers","Volatility","Most Volatile"]);
      const losers   = grabPairs("Top Losers", ["Volatility","Most Volatile","Currency Volatility"]);
      const mostVol  = grabPairs("Most Volatile", ["Least Volatile","MarketMilk","Copyright"]);
      const volRankPair = {}; mostVol.forEach((p)=>volRankPair[p.pair]={rank:p.rank, chg:p.chg});''',
    '''      // (Top Gainers/Losers et Most Volatile ne sont plus utilises — systeme APEX 3 filtres)''',"vars1")

rep('      const leastVol = grabPairs("Least Volatile", ["MarketMilk","Copyright","Manage"]).map(p=>p.pair);\n','',"vars2")
rep('      const TOP_RANK = 2; // SNIPER ELITE: la paire doit etre #1 ou #2 des gainers/losers (le coeur de la tempete)\n','',"vars3")
rep('      const SESSION_CURS = ["EUR","GBP","USD","CHF","CAD"]; // actives 6h-11h ET\n','',"vars4")
rep('      const LONDON_CURS = ["EUR","GBP","CHF"];   // devises de Londres\n','',"vars5")
rep('      const NY_CURS = ["USD","CAD"];             // amplifient quand NY ouvre a 8h\n','',"vars6")

# Nettoyer le placeholder du textarea
rep('Colle ici tout le contenu copié depuis marketmilk.babypips.com (Currency Strength, Volatility Meter, Gainers, Losers, Most Volatile)...',
    'Colle ici le contenu copié depuis marketmilk.babypips.com (le Currency Strength Meter suffit pour la divergence)...',"placeholder")

# Nettoyer le texte ressources "momentum"
rep('🥛 1. MarketMilk <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— force, volatilité, momentum (colle ici pour l\'analyse)</span>',
    '🥛 1. MarketMilk <span style={{color:TEXT_DIM, fontWeight:400, fontSize:9}}>— Currency Strength des devises (colle ici pour l\'analyse)</span>',"ressources")

with open('src/App.jsx','w') as f: f.write(c)
print(f"=== {ok}/{tot}")
