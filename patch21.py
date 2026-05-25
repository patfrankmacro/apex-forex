path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup28", 'w') as f:
    f.write(c)

OLD = '''    const COT_CODES = ["099741","096742","097741","090741","232741","092741","098662","112741"];
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
    });'''

NEW = '''    const COT_CODES = ["099741","096742","097741","090741","232741","092741","098662","112741"];
    const loadCOT = async () => {
      const res = await Promise.all(COT_CODES.map(async code => {
        try {
          const url = "https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
          const rows = await (await fetch(url)).json();
          if (!rows?.length) return [code, null];
          const nets = rows.map(r => parseFloat(r.noncomm_positions_long_all||0) - parseFloat(r.noncomm_positions_short_all||0));
          return [code, { net: Math.round(nets[0]), max52: Math.max(...nets), min52: Math.min(...nets) }];
        } catch { return [code, null]; }
      }));
      const map = {};
      res.forEach(([code, val]) => { if (val) map[code] = val; });
      setApexCot(map);
    };
    loadCOT();
    // Refresh COT chaque vendredi 21h30 EST (publication CFTC) + vérif toutes les heures
    const cotInterval = setInterval(() => {
      const n = new Date();
      const day = n.getUTCDay(); // 5 = vendredi
      const hour = n.getUTCHours();
      const min = n.getUTCMinutes();
      // Vendredi entre 20h30 et 23h UTC (publication CFTC ~20h30 UTC)
      if (day === 5 && hour >= 20 && hour <= 23) loadCOT();
      // Aussi refresh le samedi matin pour être sûr
      if (day === 6 && hour >= 0 && hour <= 2) loadCOT();
    }, 60 * 60 * 1000); // vérif toutes les heures'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("COT refresh automatique ajouté OK")
else:
    print("ERREUR: bloc COT pas trouvé")

# Ajouter clearInterval pour cotInterval dans le return
OLD2 = '''    const mfxInterval = setInterval(loadMFX, 30 * 60 * 1000);
    return () => clearInterval(mfxInterval);'''

NEW2 = '''    const mfxInterval = setInterval(loadMFX, 30 * 60 * 1000);
    return () => { clearInterval(mfxInterval); clearInterval(cotInterval); };'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print("clearInterval cotInterval ajouté OK")
else:
    print("ERREUR: clearInterval pas trouvé")

with open(path, 'w') as f:
    f.write(c)
print("Patch21 terminé")
