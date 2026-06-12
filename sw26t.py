with open('src/App.jsx','r') as f: c=f.read()
reps = []
def rep(old,new,label): reps.append((old,new,label))

# 1. Bandeau
rep('Système court terme (1-3 jours) — LE SIGNAL : ① divergence ≥4r + ② Top 5 · LA QUALITÉ : BONUS Retail · Fonds · Énergie · Tu suis les big boys de Londres',
    'Système court terme (1-3 jours) — LE SIGNAL : ① divergence ≥3r + ② Top 5 + ③ sentiment aligné · LA QUALITÉ : BONUS Retail · Fonds · Énergie · Tu suis les desks de Londres ET New York',"bandeau")

# 2. Sous-titre APEX
rep('APEX INSTITUTIONNEL · SIGNAL ① + ② · BONUS QUALITÉ','APEX INSTITUTIONNEL · SIGNAL ① ② ③ · BONUS QUALITÉ',"soustitre")

# 3. Etape 2 sequence : pole verifie sur la fenetre elargie
rep('Ouvre le graphique H1. Le prix doit bouger dans UNE seule direction depuis 3h du matin jusqu\u0027à maintenant, sans avoir changé de sens à l\u0027ouverture de New York (8h). Si oui : le pôle est valide, il confirme les news de l\u0027étape 1. Si le prix s\u0027est inversé à 8h : pas de trade aujourd\u0027hui.',
    'Ouvre le graphique H1. Le prix doit bouger dans UNE seule direction depuis 3h du matin, sans inversion à l\u0027ouverture de New York (8h) ni pendant la session NY. Si oui : le pôle Londres+NY est valide, il confirme les news de l\u0027étape 1. Inversé en route : pas de trade aujourd\u0027hui.',"etape_pole")

# 4. Message horaire du moteur (le texte de blocage)
n_msg = c.count('Le Swing FX s')
print("messages horaires trouves:", n_msg)

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
    print("=== TEXTES 4A ECRITS")
