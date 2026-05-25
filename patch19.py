path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup27", 'w') as f:
    f.write(c)

OLD = '''    const loadMFX = async () => {
      try {
        const t = Date.now();
        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$")+"&t="+t);
        const d1 = await r1.json();
        if (d1.error) return;
        const clean = d1.session.replace(/ /g, '+');
        const r2 = await fetch("/api/myfxbook?session="+clean+"&t="+t);
        const d2 = await r2.json();
        if (d2.error) return;
        const map = {};
        d2.symbols.forEach(s => { map[s.name] = s; });
        if (Object.keys(map).length > 0) setApexRetail(map);
      } catch(e) {}
    };
    loadMFX();
    const mfxInterval = setInterval(loadMFX, 30 * 60 * 1000);
    return () => clearInterval(mfxInterval);
  }, []);'''

NEW = '''    const loadMFX = async () => {
      try {
        // Un seul appel — login + outlook côté serveur
        const r = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$")+"&t="+Date.now());
        const d = await r.json();
        if (d.error || !d.symbols) return;
        const map = {};
        d.symbols.forEach(s => { map[s.name] = s; });
        if (Object.keys(map).length > 0) setApexRetail(map);
      } catch(e) {}
    };
    loadMFX();
    const mfxInterval = setInterval(loadMFX, 30 * 60 * 1000);
    return () => clearInterval(mfxInterval);
  }, []);'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Fetch MFX simplifié OK")
else:
    print("ERREUR: bloc pas trouvé")
    idx = c.find("loadMFX")
    print(repr(c[idx-10:idx+200]))

with open(path, 'w') as f:
    f.write(c)
print("Patch19 terminé")
