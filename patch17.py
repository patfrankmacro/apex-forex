path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup25", 'w') as f:
    f.write(c)

OLD = '''        const r2 = await fetch("/api/myfxbook?session="+d1.session);
        const d2 = await r2.json();
        console.log("MFX outlook error:", d2.error, "symbols:", d2.symbols?.length);
        if (d2.error) { console.log("MFX outlook ERREUR:", d2.message); return; }'''

NEW = '''        const rawSession = decodeURIComponent(d1.session);
        const r2 = await fetch("/api/myfxbook?session="+encodeURIComponent(rawSession));
        const d2 = await r2.json();
        console.log("MFX outlook error:", d2.error, "symbols:", d2.symbols?.length);
        if (d2.error) { console.log("MFX outlook ERREUR:", d2.message); return; }'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Fix session decode+encode OK")
else:
    print("ERREUR: bloc pas trouvé")

# Même fix dans api/myfxbook.js — le serveur doit PAS encoder
path2 = "/data/data/com.termux/files/home/apex-forex/api/myfxbook.js"
with open(path2, 'r') as f:
    c2 = f.read()
print("API actuelle:")
print(c2)

with open(path, 'w') as f:
    f.write(c)

print("Patch17 terminé")
