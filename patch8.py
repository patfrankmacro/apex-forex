path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup17", 'w') as f:
    f.write(c)

# 1 - Retail: si vide, on ignore le filtre retail et on montre quand même macro+COT
# On assouplit: si retailData vide, on accepte COT seul comme confirmation partielle
OLD = '''    // Retail
    const rData = retailData[name];
    if (!rData) return;
    const lp = rData.longPercentage, sp = rData.shortPercentage;
    let retailBias, retailStrength;
    if      (lp >= 75) { retailBias = "BAISSIER"; retailStrength = "EXTREME"; }
    else if (sp >= 75) { retailBias = "HAUSSIER"; retailStrength = "EXTREME"; }
    else if (lp >= 65) { retailBias = "BAISSIER"; retailStrength = "FORT"; }
    else if (sp >= 65) { retailBias = "HAUSSIER"; retailStrength = "FORT"; }
    else if (lp >= 55) { retailBias = "BAISSIER"; retailStrength = "MODERE"; }
    else if (sp >= 55) { retailBias = "HAUSSIER"; retailStrength = "MODERE"; }
    else               { retailBias = "NEUTRE";   retailStrength = "NUL"; }

    // Vérifier alignement Retail (contrarian) avec direction
    const retailAligned = (direction === "LONG" && retailBias === "HAUSSIER") ||
                          (direction === "SHORT" && retailBias === "BAISSIER");
    if (!retailAligned || retailStrength === "NUL") return;'''

NEW = '''    // Retail
    const rData = retailData[name];
    let retailBias = "N/A", retailStrength = "N/A", lp = 0, sp = 0;
    const hasRetail = !!rData;
    if (hasRetail) {
      lp = rData.longPercentage; sp = rData.shortPercentage;
      if      (lp >= 75) { retailBias = "BAISSIER"; retailStrength = "EXTREME"; }
      else if (sp >= 75) { retailBias = "HAUSSIER"; retailStrength = "EXTREME"; }
      else if (lp >= 65) { retailBias = "BAISSIER"; retailStrength = "FORT"; }
      else if (sp >= 65) { retailBias = "HAUSSIER"; retailStrength = "FORT"; }
      else if (lp >= 55) { retailBias = "BAISSIER"; retailStrength = "MODERE"; }
      else if (sp >= 55) { retailBias = "HAUSSIER"; retailStrength = "MODERE"; }
      else               { retailBias = "NEUTRE";   retailStrength = "NUL"; }
      // Vérifier alignement Retail (contrarian) avec direction
      const retailAligned = (direction === "LONG" && retailBias === "HAUSSIER") ||
                            (direction === "SHORT" && retailBias === "BAISSIER");
      if (!retailAligned || retailStrength === "NUL") return;
    }'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Retail assoupli OK")
else:
    print("ERREUR: bloc retail pas trouvé")

# 2 - Remplacer SENT_PAIRS pour inclure TOUTES les paires importantes incluant CHFJPY
OLD2 = '''const SENT_PAIRS=[
  {name:"EURUSD",base:"EUR",quote:"USD"},{name:"GBPUSD",base:"GBP",quote:"USD"},
  {name:"USDJPY",base:"USD",quote:"JPY"},{name:"USDCAD",base:"USD",quote:"CAD"},                                                                                                      {name:"AUDUSD",base:"AUD",quote:"USD"},{name:"NZDUSD",base:"NZD",quote:"USD"},
  {name:"USDCHF",base:"USD",quote:"CHF"},{name:"GBPJPY",base:"GBP",quote:"JPY"},
  {name:"EURJPY",base:"EUR",quote:"JPY"},{name:"AUDJPY",base:"AUD",quote:"JPY"},
  {name:"EURAUD",base:"EUR",quote:"AUD"},{name:"GBPAUD",base:"GBP",quote:"AUD"},
  {name:"EURGBP",base:"EUR",quote:"GBP"},{name:"AUDNZD",base:"AUD",quote:"NZD"},
  {name:"CHFJPY",base:"CHF",quote:"JPY"},{name:"GBPCAD",base:"GBP",quote:"CAD"},
  {name:"EURCAD",base:"EUR",quote:"CAD"},{name:"AUDCAD",base:"AUD",quote:"CAD"},
  {name:"NZDJPY",base:"NZD",quote:"JPY"},
];'''

NEW2 = '''const SENT_PAIRS=[
  {name:"EURUSD",base:"EUR",quote:"USD"},{name:"GBPUSD",base:"GBP",quote:"USD"},
  {name:"USDJPY",base:"USD",quote:"JPY"},{name:"USDCAD",base:"USD",quote:"CAD"},
  {name:"AUDUSD",base:"AUD",quote:"USD"},{name:"NZDUSD",base:"NZD",quote:"USD"},
  {name:"USDCHF",base:"USD",quote:"CHF"},{name:"GBPJPY",base:"GBP",quote:"JPY"},
  {name:"EURJPY",base:"EUR",quote:"JPY"},{name:"AUDJPY",base:"AUD",quote:"JPY"},
  {name:"EURAUD",base:"EUR",quote:"AUD"},{name:"GBPAUD",base:"GBP",quote:"AUD"},
  {name:"EURGBP",base:"EUR",quote:"GBP"},{name:"AUDNZD",base:"AUD",quote:"NZD"},
  {name:"CHFJPY",base:"CHF",quote:"JPY"},{name:"GBPCAD",base:"GBP",quote:"CAD"},
  {name:"EURCAD",base:"EUR",quote:"CAD"},{name:"AUDCAD",base:"AUD",quote:"CAD"},
  {name:"NZDJPY",base:"NZD",quote:"JPY"},{name:"NZDCAD",base:"NZD",quote:"CAD"},
  {name:"EURNZD",base:"EUR",quote:"NZD"},{name:"GBPNZD",base:"GBP",quote:"NZD"},
  {name:"AUDCHF",base:"AUD",quote:"CHF"},{name:"NZDCHF",base:"NZD",quote:"CHF"},
  {name:"EURCHF",base:"EUR",quote:"CHF"},{name:"GBPCHF",base:"GBP",quote:"CHF"},
  {name:"CADCHF",base:"CAD",quote:"CHF"},{name:"CADJPY",base:"CAD",quote:"JPY"},
  {name:"EURCNY",base:"EUR",quote:"CNY"},{name:"USDCNY",base:"USD",quote:"CNY"},
  {name:"AUDCNY",base:"AUD",quote:"CNY"},{name:"CADCNY",base:"CAD",quote:"CNY"},
];'''

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print("SENT_PAIRS élargi OK")
else:
    print("ERREUR: SENT_PAIRS pas trouvé - cherche approximation")
    idx = c.find("SENT_PAIRS")
    print("Position SENT_PAIRS:", idx)

with open(path, 'w') as f:
    f.write(c)

print("Patch8 terminé")
