path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup20", 'w') as f:
    f.write(c)

# Fix double encodage session dans le fetch ApexRetail
OLD = '''        const r2 = await fetch("/api/myfxbook?session="+d1.session);'''
NEW = '''        const r2 = await fetch("/api/myfxbook?session="+encodeURIComponent(d1.session));'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Fix session encodage ApexRetail OK")
else:
    print("ERREUR: ligne r2 apex pas trouvée")

# Fix aussi dans fetchRetailApp (ligne 111)
OLD2 = '''    const r2=await fetch("/api/myfxbook?session="+d1.session);'''
NEW2 = '''    const r2=await fetch("/api/myfxbook?session="+encodeURIComponent(d1.session));'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print("Fix session encodage fetchRetailApp OK")
else:
    print("ERREUR: ligne r2 fetchRetailApp pas trouvée")

with open(path, 'w') as f:
    f.write(c)

print("Patch11 terminé")
