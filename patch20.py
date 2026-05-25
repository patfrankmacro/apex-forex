path = "/data/data/com.termux/files/home/apex-forex/src/SentimentView.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup", 'w') as f:
    f.write(c)

OLD = '''async function myfxLogin() {
  const r = await fetch(`/api/myfxbook?email=${encodeURIComponent(MYFXBOOK_EMAIL)}&password=${encodeURIComponent(MYFXBOOK_PASS)}`);
  const d = await r.json();
  if (d.error) throw new Error(d.message);
  return d.session;
}

async function myfxOutlook(session) {
  const r = await fetch(`/api/myfxbook?session=${session}`);
  const d = await r.json();
  if (d.error) throw new Error(d.message);
  const map = {};
  d.symbols.forEach(s => { map[s.name] = s; });
  return map;
}'''

NEW = '''async function myfxLoadAll() {
  const r = await fetch(`/api/myfxbook?email=${encodeURIComponent(MYFXBOOK_EMAIL)}&password=${encodeURIComponent(MYFXBOOK_PASS)}&t=${Date.now()}`);
  const d = await r.json();
  if (d.error || !d.symbols) throw new Error(d.message || "No symbols");
  const map = {};
  d.symbols.forEach(s => { map[s.name] = s; });
  return map;
}'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("myfxLogin+Outlook fusionnés OK")
else:
    print("ERREUR: bloc pas trouvé")

# Fix l'appel dans loadRetail
OLD2 = '''  const loadRetail = useCallback(async () => {
    setStatus("loading");
    try {
      const session = await myfxLogin();
      const data    = await myfxOutlook(session);
      setRetail(data);
      setLastUp(new Date().toLocaleTimeString("fr-CA"));
      setStatus("ok");
    } catch { setStatus("error"); }
  }, []);'''

NEW2 = '''  const loadRetail = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await myfxLoadAll();
      setRetail(data);
      setLastUp(new Date().toLocaleTimeString("fr-CA"));
      setStatus("ok");
    } catch { setStatus("error"); }
  }, []);'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print("loadRetail simplifié OK")
else:
    print("ERREUR: loadRetail pas trouvé")

with open(path, 'w') as f:
    f.write(c)
print("Patch20 terminé")
