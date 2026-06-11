with open('src/App.jsx','r') as f: lines = f.readlines()
found = {"p1":0,"p2a":0,"p2b":0,"p3":0,"p4":0,"p4b":0}
for i,l in enumerate(lines):
    if "le Currency Strength Meter suffit pour la divergence" in l:
        lines[i] = l.replace("(le Currency Strength Meter suffit pour la divergence)","(page complète : Currency Strength + Top Gainers/Losers — le signal a besoin des deux)"); found["p1"]+=1
    if "BIAIS LEVERAGED FUNDS — FILTRE ③" in l:
        lines[i] = l.replace("FILTRE ③","BONUS 💎"); found["p2a"]+=1
    if "SENTIMENT RETAIL — FILTRE ②" in l:
        lines[i] = l.replace("FILTRE ②","BONUS 💎"); found["p2b"]+=1
    if "Spike artificiel possible — ne lis pas ici." in l:
        lines[i] = l.replace("Spike artificiel possible — ne lis pas ici.","11h00 = la dernière limite de ta fenêtre : analyse AVANT que le spike du Fix ne déforme le classement."); found["p3"]+=1
    if "Le principe : acheter la devise la plus FORTE contre la plus FAIBLE" in l:
        lines[i] = l.replace("quand le retail est piégé à contre-sens, que les Leveraged Funds confirment la même direction, ET que le mouvement du jour a une direction (Top 5 Gainers/Losers) et de l\u0027énergie (Most Volatile).","quand le mouvement du jour est réel (Top 5 Gainers/Losers) — c\u0027est LE SIGNAL. Les 💎 (retail piégé, Leveraged Funds alignés, Most Volatile) mesurent ensuite le carburant derrière la cassure."); found["p4"]+=1
    if "Le retail contrarien (≥70%) : dernière confirmation." in l:
        lines[i] = l.replace("Le retail contrarien (≥70%) : dernière confirmation.","Le retail contrarien (≥70%) : un 💎, pas une condition."); found["p4b"]+=1
for k,v in sorted(found.items()): print(f"{k}: {v}")
if all(v==1 for v in found.values()):
    with open('src/App.jsx','w') as f: f.writelines(lines)
    print("=== ECRIT")
else:
    print("=== RIEN ECRIT")
