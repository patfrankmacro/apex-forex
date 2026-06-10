with open('src/App.jsx','r') as f: c=f.read()
ok=0;tot=0
def rep(old,new,label):
    global c,ok,tot;tot+=1
    n=c.count(old);print(f"{label}: {n}")
    if n>=1:c=c.replace(old,new,1);ok+=1

# Ajouter filtre 4 dans LA SEQUENCE (apres le bloc 3, avant condition de base)
rep('''<b style={{color:"#a78bfa"}}>LEVERAGED FUNDS ALIGNÉS</b> : le rapport COT (CFTC, publié chaque vendredi) montre ce que les hedge funds font VRAIMENT. La devise forte doit être plus achetée que la faible. C'est la VRAIE position institutionnelle — pas une déduction, des chiffres réels. Si les fonds ne confirment pas, pas de trade.</span></div>''',
    '''<b style={{color:"#a78bfa"}}>LEVERAGED FUNDS ALIGNÉS</b> : le rapport COT (CFTC, publié chaque vendredi) montre ce que les hedge funds font VRAIMENT. La devise forte doit être plus achetée que la faible. C'est la VRAIE position institutionnelle — pas une déduction, des chiffres réels. Si les fonds ne confirment pas, pas de trade.</span></div>
          <div style={{display:"flex", gap:8}}><span style={{color:"#f59e0b", fontWeight:700, minWidth:16}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.5}}><b style={{color:"#f59e0b"}}>MOUVEMENT RÉEL</b> : ta paire doit être dans le Top 5 Gainers (achat) ou Top 5 Losers (vente) de MarketMilk. Un vrai mouvement de prix = volume institutionnel aujourd'hui. Confirme la direction à l'analyse — puis tu attends le Golden Pocket pour entrer.</span></div>''',"liste4")

# Ajouter filtre 4 dans l'exemple CHF/JPY (apres le bloc 3, avant condition de base)
rep('''<b>Leveraged Funds ✓</b> — les hedge funds vendaient le JPY beaucoup plus (-17 555) que le CHF (-5 126). Le CHF était moins vendu = relativement plus fort. La vraie position institutionnelle confirmait la hausse de CHF/JPY.</span></div>''',
    '''<b>Leveraged Funds ✓</b> — les hedge funds vendaient le JPY beaucoup plus (-17 555) que le CHF (-5 126). Le CHF était moins vendu = relativement plus fort. La vraie position institutionnelle confirmait la hausse de CHF/JPY.</span></div>
          <div style={{display:"flex", gap:8, padding:"6px 8px", background:"#001018", borderRadius:5}}><span style={{color:"#f59e0b", fontWeight:700, minWidth:14}}>④</span><span style={{fontSize:9, color:TEXT, lineHeight:1.45}}><b>Mouvement réel ✓</b> — CHF/JPY était dans le Top Gainers ce jour-là : le mouvement haussier était actif et institutionnel, pas théorique.</span></div>''',"ex4")

with open('src/App.jsx','w') as f: f.write(c)
print(f"=== {ok}/{tot}")
