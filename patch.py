import re

path = '/data/data/com.termux/files/home/apex-forex/src/App.jsx'
with open(path, 'r') as f:
    c = f.read()

# 1. FONCTIONS + CONSTANTES SENTIMENT
additions = '''
const SENT_PAIRS=[
  {name:"EURUSD",base:"EUR",quote:"USD"},{name:"GBPUSD",base:"GBP",quote:"USD"},
  {name:"USDJPY",base:"USD",quote:"JPY"},{name:"USDCAD",base:"USD",quote:"CAD"},
  {name:"AUDUSD",base:"AUD",quote:"USD"},{name:"NZDUSD",base:"NZD",quote:"USD"},
  {name:"USDCHF",base:"USD",quote:"CHF"},{name:"GBPJPY",base:"GBP",quote:"JPY"},
  {name:"EURJPY",base:"EUR",quote:"JPY"},{name:"AUDJPY",base:"AUD",quote:"JPY"},
  {name:"EURAUD",base:"EUR",quote:"AUD"},{name:"GBPAUD",base:"GBP",quote:"AUD"},
  {name:"EURGBP",base:"EUR",quote:"GBP"},{name:"AUDNZD",base:"AUD",quote:"NZD"},
  {name:"CHFJPY",base:"CHF",quote:"JPY"},{name:"GBPCAD",base:"GBP",quote:"CAD"},
  {name:"EURCAD",base:"EUR",quote:"CAD"},{name:"AUDCAD",base:"AUD",quote:"CAD"},
  {name:"NZDJPY",base:"NZD",quote:"JPY"},
];
const CFTC_CODES={EUR:"099741",GBP:"096742",JPY:"097741",CAD:"090741",AUD:"232741",CHF:"092741",USD:"098662",NZD:"112741"};
const MFX_EMAIL="patrice-bonneau@outlook.com";
const MFX_PASS="Fucktoi69$";

function analyzeRetailS(s){
  if(!s)return null;
  const lp=s.longPercentage,sp=s.shortPercentage;
  if(lp>=75)return{bias:"BAISSIER",strength:"EXTREME",lp,sp};
  if(sp>=75)return{bias:"HAUSSIER",strength:"EXTREME",lp,sp};
  if(lp>=65)return{bias:"BAISSIER",strength:"FORT",lp,sp};
  if(sp>=65)return{bias:"HAUSSIER",strength:"FORT",lp,sp};
  if(lp>=55)return{bias:"BAISSIER",strength:"MODERE",lp,sp};
  if(sp>=55)return{bias:"HAUSSIER",strength:"MODERE",lp,sp};
  return{bias:"NEUTRE",strength:"NUL",lp,sp};
}
function analyzeCurrencyS(d){
  if(!d)return null;
  const range=d.max52-d.min52;
  const pct=range===0?50:Math.round(((d.net-d.min52)/range)*100);
  if(pct>=90)return{bias:"HAUSSIER",strength:"EXTREME",pct};
  if(pct<=10)return{bias:"BAISSIER",strength:"EXTREME",pct};
  if(pct>=65)return{bias:"HAUSSIER",strength:"FORT",pct};
  if(pct<=35)return{bias:"BAISSIER",strength:"FORT",pct};
  if(pct>=55)return{bias:"HAUSSIER",strength:"MODERE",pct};
  if(pct<=45)return{bias:"BAISSIER",strength:"MODERE",pct};
  return{bias:"NEUTRE",strength:"NUL",pct};
}
function analyzePairCOTS(bCur,qCur){
  if(!bCur||!qCur)return null;
  const spread=bCur.pct-qCur.pct,abs=Math.abs(spread);
  const bias=spread>0?"HAUSSIER":spread<0?"BAISSIER":"NEUTRE";
  const strength=abs>=60?"EXTREME":abs>=40?"FORT":abs>=20?"MODERE":"NUL";
  return{bias,strength,spread,base:bCur,quote:qCur};
}
function buildSignalS(rA,pCot){
  if(!rA||!pCot)return{valid:false};
  if(rA.bias==="NEUTRE"||pCot.bias==="NEUTRE")return{valid:false};
  if(rA.bias!==pCot.bias)return{valid:false};
  const rs=rA.strength,cs=pCot.strength;
  const both=rs==="EXTREME"&&cs==="EXTREME";
  const fort=(rs==="EXTREME"||rs==="FORT")&&(cs==="EXTREME"||cs==="FORT");
  const bias=rA.bias;
  let label,color,bg;
  if(bias==="HAUSSIER"){
    if(both){label="\\u{1F525}\\u{1F525} MACRO+SENTIMENT PARFAIT HAUSSIER";color="#22c55e";bg="#14532d";}
    else if(fort){label="\\u{1F525} MACRO+SENTIMENT FORT HAUSSIER";color="#4ade80";bg="#14532d";}
    else{label="\\u2191 MACRO+SENTIMENT HAUSSIER";color="#86efac";bg="#166534";}
  }else{
    if(both){label="\\u{1F525}\\u{1F525} MACRO+SENTIMENT PARFAIT BAISSIER";color="#ef4444";bg="#7f1d1d";}
    else if(fort){label="\\u{1F525} MACRO+SENTIMENT FORT BAISSIER";color="#f87171";bg="#7f1d1d";}
    else{label="\\u2193 MACRO+SENTIMENT BAISSIER";color="#fca5a5";bg="#991b1b";}
  }
  return{valid:true,bias,label,color,bg,retailStrength:rs,cotStrength:cs,bothExtreme:both,rA,pCot};
}
async function fetchCOTApp(code){
  try{
    const url="https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code="+code+"&$order=report_date_as_yyyy_mm_dd DESC&$limit=55";
    const rows=await(await fetch(url)).json();
    if(!rows||!rows.length)return null;
    const nets=rows.map(r=>parseFloat(r.noncomm_positions_long_all||0)-parseFloat(r.noncomm_positions_short_all||0));
    return{net:Math.round(nets[0]),max52:Math.max(...nets),min52:Math.min(...nets)};
  }catch(e){return null;}
}
async function fetchRetailApp(){
  try{
    const r1=await fetch("/api/myfxbook?email="+encodeURIComponent(MFX_EMAIL)+"&password="+encodeURIComponent(MFX_PASS));
    const d1=await r1.json();
    if(d1.error)return{};
    const r2=await fetch("/api/myfxbook?session="+d1.session);
    const d2=await r2.json();
    if(d2.error)return{};
    const map={};
    d2.symbols.forEach(s=>{map[s.name]=s;});
    return map;
  }catch(e){return{};}
}
'''

c = c.replace(
    'const PAIR_ORDER = ["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY","CNY"];',
    'const PAIR_ORDER = ["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY","CNY"];\n' + additions
)

# 2. STATE
c = c.replace(
    'const [view, setView] = useState("table");',
    'const [view, setView] = useState("table");\n  const [sentRetail, setSentRetail] = useState({});\n  const [sentCot, setSentCot] = useState({});'
)

# 3. USEEFFECT SENTIMENT
c = c.replace(
    '    return () => unsub();\n  }, []);',
    '''    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadSent() {
      const retail = await fetchRetailApp();
      setSentRetail(retail);
      const codes = [...new Set(Object.values(CFTC_CODES))];
      const cotRes = {};
      await Promise.all(codes.map(async code => { cotRes[code] = await fetchCOTApp(code); }));
      setSentCot(cotRes);
    }
    loadSent();
    const ri = setInterval(loadSent, 60*60*1000);
    return () => clearInterval(ri);
  }, []);'''
)

# 4. ALLPAIRS — filtre macro + sentiment alignés
old = '''  const allPairs = useMemo(() => {
    const pairs = [];
    for (let i=0;i<withData.length;i++) for (let j=i+1;j<withData.length;j++) {
      const a=withData[i],b=withData[j];
      const strong=a.score>=b.score?a:b, weak=a.score>=b.score?b:a;
      const div=strong.score-weak.score;
      if (div<0.08) continue;
      const regS=getRegime(data,strong.code), regW=getRegime(data,weak.code);
      const perfect=regS&&regW&&["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)&&["RECESSION","STAGFLATION"].includes(regW.label);
      pairs.push({strong,weak,div,regS,regW,perfect});
    }
    return pairs.sort((a,b)=>(b.div+(b.perfect?0.5:0))-(a.div+(a.perfect?0.5:0)));
  },[data,withData]);'''

new = '''  const allPairs = useMemo(() => {
    const pairs = [];
    for (let i=0;i<withData.length;i++) for (let j=i+1;j<withData.length;j++) {
      const a=withData[i],b=withData[j];
      const strong=a.score>=b.score?a:b, weak=a.score>=b.score?b:a;
      const div=strong.score-weak.score;
      if (div<0.08) continue;
      const regS=getRegime(data,strong.code), regW=getRegime(data,weak.code);
      const perfect=regS&&regW&&["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)&&["RECESSION","STAGFLATION"].includes(regW.label);
      // ── CROISEMENT MACRO + SENTIMENT ──────────────────────────────────
      const sentPair = SENT_PAIRS.find(p =>
        (p.base===strong.code && p.quote===weak.code) ||
        (p.base===weak.code   && p.quote===strong.code)
      );
      let sentSig = null;
      if (sentPair) {
        const rA   = analyzeRetailS(sentRetail[sentPair.name]);
        const bCur = analyzeCurrencyS(sentCot[CFTC_CODES[sentPair.base]]);
        const qCur = analyzeCurrencyS(sentCot[CFTC_CODES[sentPair.quote]]);
        const pCot = analyzePairCOTS(bCur, qCur);
        const raw  = buildSignalS(rA, pCot);
        if (raw.valid) {
          const strongIsBase = sentPair.base === strong.code;
          // Direction sentiment doit correspondre à la direction macro
          const aligned = (raw.bias==="HAUSSIER" && strongIsBase) ||
                          (raw.bias==="BAISSIER" && !strongIsBase);
          if (aligned) sentSig = raw;
        }
      }
      if (!sentSig) continue; // Seulement paires avec DOUBLE confirmation
      pairs.push({strong,weak,div,regS,regW,perfect,sentSig});
    }
    return pairs.sort((a,b)=>(b.div+(b.perfect?0.5:0))-(a.div+(a.perfect?0.5:0)));
  },[data,withData,sentRetail,sentCot]);'''

c = c.replace(old, new)

# 5. TRADECARD — accepte sentSig
c = c.replace(
    'function TradeCard({ strong, weak, div, regS, regW, perfect }) {',
    'function TradeCard({ strong, weak, div, regS, regW, perfect, sentSig }) {'
)

with open(path, 'w') as f:
    f.write(c)

n = c.count('sentSig')
print(f"Patch OK — {n} occurrences sentSig")
if 'SENT_PAIRS' not in c:
    print("ERREUR: SENT_PAIRS non trouvé")
if 'loadSent' not in c:
    print("ERREUR: useEffect sentiment non trouvé")
