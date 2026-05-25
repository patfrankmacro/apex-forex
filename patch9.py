path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup18", 'w') as f:
    f.write(c)

OLD = '''const VALID_DIVERGENCE = [
  ["GOLDILOCKS","RECESSION"],["RECESSION","GOLDILOCKS"],
  ["GOLDILOCKS","STAGFLATION"],["STAGFLATION","GOLDILOCKS"],
  ["SURCHAUFFE","RECESSION"],["RECESSION","SURCHAUFFE"],
  ["SURCHAUFFE","STAGFLATION"],["STAGFLATION","SURCHAUFFE"],
];'''

NEW = '''const VALID_DIVERGENCE = [
  ["GOLDILOCKS","RÉCESSION"],["RÉCESSION","GOLDILOCKS"],
  ["GOLDILOCKS","STAGFLATION"],["STAGFLATION","GOLDILOCKS"],
  ["SURCHAUFFE","RÉCESSION"],["RÉCESSION","SURCHAUFFE"],
  ["SURCHAUFFE","STAGFLATION"],["STAGFLATION","SURCHAUFFE"],
];'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("VALID_DIVERGENCE corrigé OK")
else:
    print("ERREUR: VALID_DIVERGENCE pas trouvé")
    idx = c.find("VALID_DIVERGENCE")
    print(repr(c[idx:idx+300]))

with open(path, 'w') as f:
    f.write(c)

print("Patch9 terminé")
