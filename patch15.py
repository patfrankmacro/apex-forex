path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup23", 'w') as f:
    f.write(c)

OLD = '''    (async () => {
      try {
        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));
        const d1 = await r1.json();
        if (d1.error) return;
        const sessionClean = decodeURIComponent(d1.session);
        const r2 = await fetch("/api/myfxbook?session="+encodeURIComponent(sessionClean));
        const d2 = await r2.json();
        if (d2.error) return;
        const map = {};
        d2.symbols.forEach(s => { map[s.name] = s; });
        setApexRetail(map);
      } catch {}
    })();'''

NEW = '''    (async () => {
      try {
        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));
        const d1 = await r1.json();
        console.log("MFX login:", d1.error, "session:", d1.session?.slice(0,20));
        if (d1.error) { console.log("MFX login ERREUR:", d1.message); return; }
        const r2 = await fetch("/api/myfxbook?session="+d1.session);
        const d2 = await r2.json();
        console.log("MFX outlook error:", d2.error, "symbols:", d2.symbols?.length);
        if (d2.error) { console.log("MFX outlook ERREUR:", d2.message); return; }
        const map = {};
        d2.symbols.forEach(s => { map[s.name] = s; });
        console.log("MFX retail chargé:", Object.keys(map).length, "paires");
        setApexRetail(map);
      } catch(e) { console.log("MFX catch erreur:", e.message); }
    })();'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Debug logs ajoutés OK")
else:
    print("ERREUR: bloc pas trouvé")
    idx = c.find("patrice-bonneau@outlook.com")
    print(repr(c[idx-50:idx+200]))

with open(path, 'w') as f:
    f.write(c)

print("Patch15 terminé")
