import re

path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

# Backup
with open(path + ".backup12", 'w') as f:
    f.write(c)

# La nouvelle section TradeApex à injecter
TRADE_APEX = '''
// ============================================================
// TRADE APEX — Confluence Macro + COT + Retail
// ============================================================

const VALID_DIVERGENCE = [
  ["GOLDILOCKS","RECESSION"],["RECESSION","GOLDILOCKS"],
  ["GOLDILOCKS","STAGFLATION"],["STAGFLATION","GOLDILOCKS"],
  ["SURCHAUFFE","RECESSION"],["RECESSION","SURCHAUFFE"],
  ["SURCHAUFFE","STAGFLATION"],["STAGFLATION","SURCHAUFFE"],
];

function isValidMacroDivergence(rBase, rQuote) {
  if (!rBase || !rQuote) return false;
  return VALID_DIVERGENCE.some(([a,b]) => a === rBase.label && b === rQuote.label);
}

function getMacroDirection(rBase, rQuote) {
  const strong = ["GOLDILOCKS","SURCHAUFFE"];
  if (strong.includes(rBase.label)) return "LONG";
  return "SHORT";
}

function getMacroPts(rBase, rQuote) {
  const scoreMap = { GOLDILOCKS:100, SURCHAUFFE:80, RECESSION:-80, STAGFLATION:-100 };
  const b = scoreMap[rBase.label] || 0;
  const q = scoreMap[rQuote.label] || 0;
  return Math.abs(b - q);
}

function getApexSignalStrength(macroPts, cotStrength, retailStrength) {
  const strongLevels = ["EXTREME","FORT"];
  const cotStrong = strongLevels.includes(cotStrength);
  const retailStrong = strongLevels.includes(retailStrength);
  const bothExtreme = cotStrength === "EXTREME" && retailStrength === "EXTREME";
  if (bothExtreme && macroPts >= 160)
    return { label:"🔥🔥🔥 APEX PARFAIT", color:"#00ff88", bg:"#001a0d", priority:4 };
  if (bothExtreme)
    return { label:"🔥🔥 APEX FORT", color:"#22c55e", bg:"#052010", priority:3 };
  if (cotStrong && retailStrong)
    return { label:"🔥 APEX CONFIRMÉ", color:"#4ade80", bg:"#0a2e18", priority:2 };
  return { label:"↑↓ APEX BIAIS", color:"#86efac", bg:"#0d1f14", priority:1 };
}

function TradeApex({ data, cotData, retailData }) {
  const trades = [];

  SENT_PAIRS.forEach(({ name, base, quote }) => {
    const rBase  = getRegime(data, base);
    const rQuote = getRegime(data, quote);
    if (!rBase || !rQuote) return;
    if (!isValidMacroDivergence(rBase, rQuote)) return;

    const direction = getMacroDirection(rBase, rQuote);
    const macroPts  = getMacroPts(rBase, rQuote);

    // COT
    const CFTC_MAP = {EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
    const bCotRaw  = cotData[CFTC_MAP[base]];
    const qCotRaw  = cotData[CFTC_MAP[quote]];
    if (!bCotRaw || !qCotRaw) return;

    const cotRange_b = bCotRaw.max52 - bCotRaw.min52;
    const cotRange_q = qCotRaw.max52 - qCotRaw.min52;
    const bPct = cotRange_b === 0 ? 50 : Math.round(((bCotRaw.net - bCotRaw.min52) / cotRange_b) * 100);
    const qPct = cotRange_q === 0 ? 50 : Math.round(((qCotRaw.net - qCotRaw.min52) / cotRange_q) * 100);
    const cotSpread = bPct - qPct;
    const cotAbs = Math.abs(cotSpread);
    const cotBias = cotSpread > 0 ? "HAUSSIER" : "BAISSIER";
    const cotStrength = cotAbs >= 60 ? "EXTREME" : cotAbs >= 40 ? "FORT" : cotAbs >= 20 ? "MODERE" : "NUL";

    // Vérifier alignement COT avec direction
    const cotAligned = (direction === "LONG" && cotBias === "HAUSSIER") ||
                       (direction === "SHORT" && cotBias === "BAISSIER");
    if (!cotAligned) return;

    // Retail
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
    if (!retailAligned || retailStrength === "NUL") return;

    const sig = getApexSignalStrength(macroPts, cotStrength, retailStrength);

    const baseFlag = CURR.find(c => c.code === base)?.flag || "";
    const quoteFlag = CURR.find(c => c.code === quote)?.flag || "";

    trades.push({
      name, base, quote, baseFlag, quoteFlag,
      direction, macroPts, rBase, rQuote,
      cotBias, cotStrength, bPct, qPct, cotSpread,
      retailBias, retailStrength, lp, sp,
      sig,
    });
  });

  trades.sort((a, b) => b.sig.priority - a.sig.priority || b.macroPts - a.macroPts);

  return (
    <div style={{padding:12}}>
      <div style={{background:"#050810",border:"1px solid #00ff8844",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#00ff88",fontWeight:700}}>⚡ TRADE APEX — CONFLUENCE 3/3</div>
          <div style={{fontSize:8,color:"#4a5070",marginTop:2}}>Macro divergence + COT instits + Retail contrarian</div>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:"#00ff88"}}>{trades.length}</div>
      </div>

      {trades.length === 0 && (
        <div style={{padding:24,textAlign:"center",background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e"}}>
          <div style={{fontSize:12,color:"#4a5070",marginBottom:4}}>Aucun signal APEX actif</div>
          <div style={{fontSize:9,color:"#2a2a3e"}}>Les 3 conditions doivent être alignées</div>
        </div>
      )}

      {trades.map(t => (
        <div key={t.name} style={{background:"#08080f",border:"1px solid "+t.sig.color+"55",borderRadius:10,padding:14,marginBottom:12,animation:"fadeIn 0.3s ease"}}>

          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:16,fontWeight:700,color:"#c8d4f0",letterSpacing:1}}>
              {t.baseFlag}{t.quoteFlag} {t.base}/{t.quote}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,fontWeight:700,color:t.sig.color,background:t.sig.bg,padding:"4px 10px",borderRadius:4}}>{t.sig.label}</div>
              <div style={{fontSize:9,color: t.direction==="LONG"?"#00ff88":"#ef4444",marginTop:3,fontWeight:700,letterSpacing:2}}>
                {t.direction} {t.base}/{t.quote}
              </div>
            </div>
          </div>

          {/* 3 confirmations */}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>

            {/* 1 - MACRO */}
            <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid #00aaff"}}>
              <div style={{fontSize:8,color:"#00aaff",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 1 — MACRO DIVERGENCE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
                <div style={{background:t.rBase.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rBase.border+"55"}}>
                  <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}>{t.baseFlag} {t.base}</div>
                  <div style={{fontSize:10,color:t.rBase.color,fontWeight:700}}>{t.rBase.icon} {t.rBase.label}</div>
                </div>
                <div style={{fontSize:9,color:"#4a5070",textAlign:"center"}}>vs<br/><span style={{color:"#00aaff",fontWeight:700}}>+{t.macroPts}pts</span></div>
                <div style={{background:t.rQuote.bg,borderRadius:4,padding:"6px 8px",border:"1px solid "+t.rQuote.border+"55"}}>
                  <div style={{fontSize:9,color:"#c8d4f0",fontWeight:700}}>{t.quoteFlag} {t.quote}</div>
                  <div style={{fontSize:10,color:t.rQuote.color,fontWeight:700}}>{t.rQuote.icon} {t.rQuote.label}</div>
                </div>
              </div>
            </div>

            {/* 2 - COT */}
            <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid "+(t.cotBias==="HAUSSIER"?"#4ade80":"#f87171")}}>
              <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 2 — COT INSTITUTIONNELS</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:9,color:"#94a3b8"}}>
                  {t.baseFlag} P{t.bPct}% &nbsp;vs&nbsp; {t.quoteFlag} P{t.qPct}%
                  <span style={{color:"#4a5070",marginLeft:6}}>spread {t.cotSpread>0?"+":""}{t.cotSpread}</span>
                </div>
                <div style={{fontSize:10,fontWeight:700,color:t.cotBias==="HAUSSIER"?"#4ade80":"#f87171"}}>
                  {t.cotBias} — {t.cotStrength}
                </div>
              </div>
            </div>

            {/* 3 - RETAIL */}
            <div style={{background:"#0c0c18",borderRadius:6,padding:"8px 10px",borderLeft:"3px solid "+(t.retailBias==="HAUSSIER"?"#4ade80":"#f87171")}}>
              <div style={{fontSize:8,color:"#94a3b8",letterSpacing:2,marginBottom:4,fontWeight:700}}>✅ 3 — RETAIL CONTRARIAN</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontSize:8,color:"#4a5070"}}>
                  LONG {t.lp}% &nbsp;·&nbsp; SHORT {t.sp}%
                </div>
                <div style={{fontSize:10,fontWeight:700,color:t.retailBias==="HAUSSIER"?"#4ade80":"#f87171"}}>
                  Contrarian {t.retailBias} — {t.retailStrength}
                </div>
              </div>
              <div style={{height:4,background:"#f87171",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:t.lp+"%",height:"100%",background:"#4ade80"}}/>
              </div>
            </div>

          </div>

          {/* Conclusion */}
          <div style={{marginTop:8,background:t.sig.bg,border:"1px solid "+t.sig.color+"44",borderRadius:6,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:12,color:t.sig.color,fontWeight:700,letterSpacing:1}}>
              {t.direction === "LONG" ? "🚀" : "📉"} {t.direction} {t.base}/{t.quote} — CONFLUENCE TOTALE
            </div>
            <div style={{fontSize:8,color:"#4a5070",marginTop:3}}>
              Macro +{t.macroPts}pts · COT {t.cotStrength} · Retail {t.retailStrength}
            </div>
          </div>

        </div>
      ))}
    </div>
  );
}
'''

# Injecter avant "export default function App"
target = "export default function App"
if target in c:
    c = c.replace(target, TRADE_APEX + "\n" + target)
    print("TradeApex injecté OK")
else:
    print("ERREUR: export default function App pas trouvé")
    exit(1)

# Maintenant trouver la section Trade dans le render et la remplacer
# On cherche le tab Trade et on y ajoute TradeApex avec les données

# Chercher où cotData et retailData sont disponibles dans App
# On va passer cotData et retailData depuis App vers TradeApex
# D'abord vérifier si App a déjà des états COT/retail

if "cotData" in c:
    print("cotData déjà présent dans App")
else:
    # Ajouter les états et le fetch dans App
    # Trouver useState existants dans App
    old_states = "const [activeTab, setActiveTab] = useState"
    if old_states not in c:
        # essayer autre chose
        old_states = "const [tab, setTab] = useState"
    
    if old_states in c:
        new_states = """const [apexCot, setApexCot]       = useState({});
  const [apexRetail, setApexRetail] = useState({});
  """ + old_states
        c = c.replace(old_states, new_states)
        print("États apexCot/apexRetail ajoutés")

# Chercher useEffect existant pour y ajouter le fetch COT/retail
# On injecte un useEffect séparé avant le return de App
old_return = "return (\n    <div"
if old_return not in c:
    old_return = "return(\n    <div"
if old_return not in c:
    old_return = "  return ("

APEX_EFFECT = """
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

"""

if old_return in c:
    c = c.replace(old_return, APEX_EFFECT + old_return, 1)
    print("useEffect ApexCOT/Retail ajouté")
else:
    print("WARN: return App pas trouvé pour useEffect")

# Maintenant trouver dans le JSX où le tab Trade est rendu
# et remplacer le contenu par <TradeApex>
# Chercher le rendu conditionnel du tab trade/Trade

# Pattern typique: tab === "trade" ou activeTab === "trade"
trade_render_patterns = [
    '{tab === "trade" && <TradeView',
    '{tab==="trade" && <TradeView',
    '{activeTab === "trade"',
    '{activeTab==="trade"',
    'tab === "trade"',
    '"trade"',
]

found_trade = False
for pat in trade_render_patterns:
    if pat in c:
        print(f"Pattern trade trouvé: {pat}")
        found_trade = True
        break

if not found_trade:
    print("WARN: Pattern tab trade pas trouvé - cherche manuellement")
    # Cherche tous les tabs
    import re
    tabs = re.findall(r'tab.*?["\'](\w+)["\']', c[:3000])
    print("Tabs trouvés:", tabs[:10])

with open(path, 'w') as f:
    f.write(c)

print("Patch3 écrit - vérification manuelle nécessaire pour le render")
print("Cherche 'TradeCard' ou le composant Trade dans App pour le remplacer")
