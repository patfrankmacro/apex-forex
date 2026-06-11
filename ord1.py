with open('src/App.jsx','r') as f: lines = f.readlines()
ok = True

# === 1. LA SEQUENCE (lignes 3240-3244, index 3239-3243) : ① 💎r 💎f ② 💎e -> ① ② 💎r 💎f 💎e
i = 3239
if "①" in lines[i] and "DIVERGENCE" in lines[i] and "②" in lines[i+3] and "MOUVEMENT" in lines[i+3]:
    l1, lr, lf, l2, le = lines[i], lines[i+1], lines[i+2], lines[i+3], lines[i+4]
    lines[i], lines[i+1], lines[i+2], lines[i+3], lines[i+4] = l1, l2, lr, lf, le
    print("sequence: reordonnee")
else:
    ok = False; print("sequence: ECHEC structure", lines[i][:60])

# === 2. EXEMPLE CHF/JPY : renumeroter et reordonner
# Trouver les 5 items par contenu
idx = {}
for j,l in enumerate(lines):
    if "Divergence ✓</b> — CHF fort" in l or ("Divergence ✓" in l and "CHF fort" in l): idx["div"] = j
    if "Retail contrarien ✓" in l and "CHF/JPY montait" in l: idx["ret"] = j
    if "Leveraged Funds ✓" in l and "-17 555" in l: idx["lf"] = j
    if "Mouvement réel ✓" in l and "Top Gainers ce jour" in l: idx["mvt"] = j
    if "Énergie ✓" in l and "Top 5 Most Volatile" in l and "CHF/JPY" in l: idx["ene"] = j
print("exemple items trouves:", sorted(idx.keys()))
if len(idx) == 5:
    # Renumeroter les badges
    lines[idx["ret"]] = lines[idx["ret"]].replace('minWidth:14}}>②</span>','minWidth:14}}>💎</span>').replace('<b>Retail contrarien ✓</b>','<b>💎 Retail ✓</b>')
    lines[idx["lf"]]  = lines[idx["lf"]].replace('minWidth:14}}>③</span>','minWidth:14}}>💎</span>').replace('<b>Leveraged Funds ✓</b>','<b>💎 Fonds ✓</b>')
    lines[idx["mvt"]] = lines[idx["mvt"]].replace('<b>Mouvement réel ✓</b>','<b>② Mouvement réel ✓</b>') if '② Mouvement' not in lines[idx["mvt"]] else lines[idx["mvt"]]
    # Reordonner physiquement : div, mvt, ret, lf, ene (les 5 lignes sont consecutives ?)
    ordre_actuel = sorted(idx.values())
    contenu = {k: lines[v] for k,v in idx.items()}
    if ordre_actuel == list(range(ordre_actuel[0], ordre_actuel[0]+5)):
        base = ordre_actuel[0]
        for off,k in enumerate(["div","mvt","ret","lf","ene"]):
            lines[base+off] = contenu[k]
        print("exemple: reordonne")
    else:
        print("exemple: lignes non consecutives", ordre_actuel); ok = False
else:
    ok = False

# === 3. Cartes RADAR : "Retail + Leveraged Funds alignés" -> langage diamants (global par ligne)
n3 = 0
for j,l in enumerate(lines):
    if "Retail + Leveraged Funds alignés. Colle MarketMilk" in l:
        lines[j] = l.replace("Retail + Leveraged Funds alignés.","💎 Retail + 💎 Fonds déjà allumés.")
        n3 += 1
print("cartes_radar:", n3)

if ok:
    with open('src/App.jsx','w') as f: f.writelines(lines)
    print("=== ECRIT")
else:
    print("=== RIEN ECRIT")
