path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup15", 'w') as f:
    f.write(c)

# Supprimer le useEffect mal placé dans ScoreBar
OLD = '''
  // Fetch COT + Retail pour TradeApex
  useEffect(() => {
    // COT fetch
    const COT_CODES = ["099741","096742","097741","090741","232741","092741","098662","112741"];
    Promise.all(COT_CODES.map(async code => {
      try {
        const url = "https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
        const rows = await (await fetch(url)).json();
        if (!rows?.length) return [code, null];
        const nets = rows.map(r => parseFloat(r.noncomm_positions_long_all||0) - parseFloat(r.noncomm_positions_short_all||0));
        return [code, { net: Math.round(nets[0]), max52: Math.max(...nets), min52: Math.min(...nets) }];
      } catch { return [code, null]; }
    })).then(res => {
      const map = {};
      res.forEach(([code, val]) => { if (val) map[code] = val; });
      setApexCot(map);
    });
    // Retail fetch
    (async () => {
      try {
        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));
        const d1 = await r1.json();
        if (d1.error) return;
        const r2 = await fetch("/api/myfxbook?session="+d1.session);
        const d2 = await r2.json();
        if (d2.error) return;
        const map = {};
        d2.symbols.forEach(s => { map[s.name] = s; });
        setApexRetail(map);
      } catch {}
    })();
  }, []);

return ('''

NEW = '''
return ('''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("useEffect mal placé supprimé OK")
else:
    print("ERREUR: bloc pas trouvé")
    import re
    idx = c.find("Fetch COT + Retail")
    print("Position:", idx)
    print(repr(c[idx-5:idx+50]))

# Maintenant ajouter le useEffect au bon endroit — après les useState dans App
# Chercher après la déclaration de apexRetail
OLD2 = '''  const [apexCot, setApexCot]       = useState({});
  const [apexRetail, setApexRetail] = useState({});'''

NEW2 = '''  const [apexCot, setApexCot]       = useState({});
  const [apexRetail, setApexRetail] = useState({});

  // Fetch COT + Retail pour TradeApex
  useEffect(() => {
    const COT_CODES = ["099741","096742","097741","090741","232741","092741","098662","112741"];
    Promise.all(COT_CODES.map(async code => {
      try {
        const url = "https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
        const rows = await (await fetch(url)).json();
        if (!rows?.length) return [code, null];
        const nets = rows.map(r => parseFloat(r.noncomm_positions_long_all||0) - parseFloat(r.noncomm_positions_short_all||0));
        return [code, { net: Math.round(nets[0]), max52: Math.max(...nets), min52: Math.min(...nets) }];
      } catch { return [code, null]; }
    })).then(res => {
      const map = {};
      res.forEach(([code, val]) => { if (val) map[code] = val; });
      setApexCot(map);
    });
    (async () => {
      try {
        const r1 = await fetch("/api/myfxbook?email="+encodeURIComponent("patrice-bonneau@outlook.com")+"&password="+encodeURIComponent("Fucktoi69$"));
        const d1 = await r1.json();
        if (d1.error) return;
        const r2 = await fetch("/api/myfxbook?session="+d1.session);
        const d2 = await r2.json();
        if (d2.error) return;
        const map = {};
        d2.symbols.forEach(s => { map[s.name] = s; });
        setApexRetail(map);
      } catch {}
    })();
  }, []);'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print("useEffect ajouté dans App OK")
else:
    print("ERREUR: useState apexCot pas trouvé")

with open(path, 'w') as f:
    f.write(c)

print("Patch6 terminé")
