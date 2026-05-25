path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup22", 'w') as f:
    f.write(c)

# Fix: encoder proprement le session dans le useEffect ApexRetail
OLD = '''        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));
        const d1 = await r1.json();
        if (d1.error) return;
        const r2 = await fetch("/api/myfxbook?session="+d1.session);'''

NEW = '''        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));
        const d1 = await r1.json();
        if (d1.error) return;
        const sessionClean = decodeURIComponent(d1.session);
        const r2 = await fetch("/api/myfxbook?session="+encodeURIComponent(sessionClean));'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Fix session decode+encode OK")
else:
    print("ERREUR: bloc pas trouvé")

# Même fix dans api/myfxbook.js — retirer le encodeURIComponent côté serveur
path2 = "/data/data/com.termux/files/home/apex-forex/api/myfxbook.js"
with open(path2, 'r') as f:
    c2 = f.read()

# S'assurer que l'API ne ré-encode pas
OLD2 = '''    url = `https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`;'''
if OLD2 in c2:
    print("API myfxbook.js déjà correct - pas de double encodage")
else:
    OLD2b = '''    url = `https://www.myfxbook.com/api/get-community-outlook.json?session=${encodeURIComponent(session)}`;'''
    NEW2 = '''    url = `https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`;'''
    if OLD2b in c2:
        c2 = c2.replace(OLD2b, NEW2, 1)
        with open(path2, 'w') as f:
            f.write(c2)
        print("API myfxbook.js corrigé OK")

with open(path, 'w') as f:
    f.write(c)

print("Patch14 terminé")
