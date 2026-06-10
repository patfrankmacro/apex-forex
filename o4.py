with open('src/App.jsx','r') as f: c=f.read()
ok=0;tot=0
def rep(old,new,label):
    global c,ok,tot;tot+=1
    n=c.count(old);print(f"{label}: {n}")
    if n>=1:c=c.replace(old,new,1);ok+=1

# Sequence du jour etape 4
rep('{n:"4", icon:"🎯", color:"#4ade80", t:"3/3 ? DIRECTION CONFIRMÉE", sub:"Les 3 cochés = vrai flux institutionnel. Carte VERTE = achat ▲ · Carte ROUGE = vente ▼"},',
    '{n:"4", icon:"🎯", color:"#4ade80", t:"4/4 ? DIRECTION CONFIRMÉE", sub:"Les 4 cochés = vrai flux institutionnel. Carte VERTE = achat ▲ · Carte ROUGE = vente ▼"},',"seq4")

# Intro LA SEQUENCE
rep('L\'app vérifie ces 3 filtres OBLIGATOIRES sur tes 7 paires quand tu colles tes données. Une alerte n\'apparaît QUE si les 3 sont cochés. Chaque filtre mesure une chose DIFFÉRENTE : où est le capital (Currency Strength), qui est piégé en face (retail), et ce que les vraies institutions font (Leveraged Funds). Quand les 3 convergent, tu suis les big boys avec le maximum de preuves.',
    'L\'app vérifie ces 4 filtres OBLIGATOIRES sur tes 7 paires quand tu colles tes données. Une alerte n\'apparaît QUE si les 4 sont cochés. Chaque filtre mesure une chose DIFFÉRENTE : où est le capital (Currency Strength), qui est piégé en face (retail), ce que les vraies institutions font (Leveraged Funds), et si le mouvement est réel aujourd\'hui (Top Gainers/Losers). Quand les 4 convergent, tu suis les big boys avec le maximum de preuves.',"intro_seq")

# Meilleure
rep('parmi les paires qui passent les 3 filtres,','parmi les paires qui passent les 4 filtres,',"meilleure")

# Exemple CHF/JPY intro
rep('Pourquoi CHF/JPY ACHAT cochait les 3 filtres APEX','Pourquoi CHF/JPY ACHAT cochait les 4 filtres APEX',"ex_intro")

# Exemple CHF/JPY conclusion
rep('✅ Les 3 filtres réunis = ALERTE APEX.','✅ Les 4 filtres réunis = ALERTE APEX.',"ex_concl")

with open('src/App.jsx','w') as f: f.write(c)
print(f"=== {ok}/{tot}")
