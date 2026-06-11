with open('src/App.jsx','r') as f: lines = f.readlines()
found = {"p4":0,"p4b":0}
for i,l in enumerate(lines):
    if "quand le retail est piégé à contre-sens, que les Leveraged Funds confirment la même direction" in l:
        lines[i] = l.replace("quand le retail est piégé à contre-sens, que les Leveraged Funds confirment la même direction, ET que le mouvement du jour a une direction (Top 5 Gainers/Losers) et de l\u0027énergie (Most Volatile).","quand le mouvement du jour est réel (Top 5 Gainers/Losers) — c\u0027est LE SIGNAL. Les 💎 (retail piégé, Leveraged Funds alignés, Most Volatile) mesurent ensuite le carburant derrière la cassure.")
        if "LE SIGNAL" in lines[i]: found["p4"]+=1
    if "dernière confirmation" in l and "retail contrarien" in l:
        lines[i] = l.replace("dernière confirmation","un 💎, pas une condition"); found["p4b"]+=1
for k,v in sorted(found.items()): print(f"{k}: {v}")
if all(v==1 for v in found.values()):
    with open('src/App.jsx','w') as f: f.writelines(lines)
    print("=== ECRIT")
else:
    print("=== RIEN ECRIT")
    # debug : montrer la ligne du retail si p4b a echoue
    for i,l in enumerate(lines):
        if "dernière confirmation" in l: print("LIGNE RETAIL:", i+1, l[:150])
