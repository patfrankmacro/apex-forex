path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup21", 'w') as f:
    f.write(c)

# Le session est déjà encodé par MyFXBook, faut pas le ré-encoder
# Utiliser directement sans encodeURIComponent

OLD = '''        const r2 = await fetch("/api/myfxbook?session="+encodeURIComponent(d1.session));'''
NEW = '''        const r2 = await fetch("/api/myfxbook?session="+d1.session);'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Fix ApexRetail OK")
else:
    print("ERREUR apex r2")

OLD2 = '''    const r2=await fetch("/api/myfxbook?session="+encodeURIComponent(d1.session));'''
NEW2 = '''    const r2=await fetch("/api/myfxbook?session="+d1.session);'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print("Fix fetchRetailApp OK")
else:
    print("ERREUR fetchRetail r2")

# Aussi vérifier SentimentView.jsx
path2 = "/data/data/com.termux/files/home/apex-forex/src/SentimentView.jsx"
with open(path2, 'r') as f:
    c2 = f.read()

OLD3 = "const r = await fetch(`/api/myfxbook?session=${session}`);"
if OLD3 in c2:
    print("SentimentView session OK - pas de double encodage")
else:
    print("SentimentView - vérifie manuellement")
    idx = c2.find("session")
    print(repr(c2[idx:idx+100]))

with open(path, 'w') as f:
    f.write(c)

print("Patch12 terminé")
