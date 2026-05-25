path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup24", 'w') as f:
    f.write(c)

# Ajouter timestamp dans le fetch pour éviter cache
OLD = '''        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));'''

NEW = '''        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$")+"&t="+Date.now());'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Cache bust ajouté OK")
else:
    print("ERREUR: ligne pas trouvée")

with open(path, 'w') as f:
    f.write(c)

print("Patch16 terminé")
