import { useState, useMemo, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCLseJPInlsVdFPTuv_yujPiqToqsubXBU",
  authDomain: "pboy-frank-fx.firebaseapp.com",
  databaseURL: "https://pboy-frank-fx-default-rtdb.firebaseio.com",
  projectId: "pboy-frank-fx",
  storageBucket: "pboy-frank-fx.firebasestorage.app",
  messagingSenderId: "892979664134",
  appId: "1:892979664134:web:e950c73f7e4fb6009f3a87"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const INDS = [
  { id:"mfg",   label:"PMI Manuf",    thresh:2.0,  rev:false, w:0.10, te:"manufacturing-pmi" },
  { id:"svc",   label:"PMI Services", thresh:2.0,  rev:false, w:0.15, te:"services-pmi" },
  { id:"unemp", label:"Chomage %",    thresh:0.3,  rev:true,  w:0.20, te:"unemployment-rate" },
  { id:"rate",  label:"Taux %",       thresh:0.25, rev:false, w:0.05, te:"interest-rate" },
  { id:"cpi",   label:"Inflation %",  thresh:0.3,  rev:false, w:0.25, te:"inflation-rate" },
  { id:"core",  label:"Core CPI %",   thresh:0.2,  rev:false, w:0.25, te:"core-inflation-rate" },
];

const CURR = [
  { code:"USD", flag:"🇺🇸", label:"Etats-Unis",  te:"united-states" },
  { code:"EUR", flag:"🇪🇺", label:"Zone Euro",   te:"euro-area" },
  { code:"CAD", flag:"🇨🇦", label:"Canada",      te:"canada" },
  { code:"CHF", flag:"🇨🇭", label:"Suisse",      te:"switzerland" },
  { code:"AUD", flag:"🇦🇺", label:"Australie",   te:"australia" },
  { code:"JPY", flag:"🇯🇵", label:"Japon",       te:"japan" },
  { code:"GBP", flag:"🇬🇧", label:"Royaume-Uni", te:"united-kingdom" },
  { code:"NZD", flag:"🇳🇿", label:"Nvl-Zelande", te:"new-zealand" },
  { code:"CNY", flag:"🇨🇳", label:"Chine",       te:"china" },
];

function mkData() {
  const d = {};
  CURR.forEach(c => { d[c.code] = {}; INDS.forEach(i => { d[c.code][i.id] = { prior:"", exp:"", now:"" }; }); });
  return d;
}

function toN(v) { const n = parseFloat(String(v||"").replace(",",".")); return isNaN(n) ? null : n; }

function getSurp(ind, cell) {
  const n = toN(cell.now), e = toN(cell.exp);
  if (n===null||e===null) return null;
  return ind.rev ? -(n-e) : (n-e);
}

function getMag(ind, s) { return Math.max(-1, Math.min(1, s/ind.thresh)); }

function calcScore(data, code) {
  let t=0, w=0;
  INDS.forEach(ind => {
    const cell = (data[code]||{})[ind.id]||{};
    const s = getSurp(ind, cell);
    if (s===null) return;
    t += getMag(ind,s)*ind.w; w += ind.w;
  });
  return w===0 ? 0 : t;
}

function hasData(data, code) {
  return INDS.some(i => { const c=(data[code]||{})[i.id]||{}; return c.now!==""&&c.now!==undefined; });
}

function getRegime(data, code) {
  if (!hasData(data, code)) return { label:"EN ATTENTE", color:"#334155", bg:"#33415522", bc:"Entrer les donnees pour voir le regime", devise:"Aucun biais" };

  const gn = id => toN(((data[code]||{})[id]||{}).now)||0;
  const ge = id => toN(((data[code]||{})[id]||{}).exp)||0;

  const pmiM=gn("mfg"), pmiS=gn("svc");
  const unemp=gn("unemp"), unempE=ge("unemp");
  const infl=gn("cpi"), inflE=ge("cpi");
  const core=gn("core"), coreE=ge("core");

  const pmi = pmiM>0&&pmiS>0 ? pmiM*0.4+pmiS*0.6 : (pmiM||pmiS);
  const pmiOk    = pmi>0;
  const pmiHigh  = pmiOk && pmi>50 && (pmiM>0?pmiM>ge("mfg"):pmiS>ge("svc"));
  const pmiLow   = pmiOk && pmi<50;
  const inflHigh = (core>0&&core>coreE)||(infl>0&&infl>inflE);
  const inflLow  = (core>0&&core<coreE)&&(infl>0&&infl<inflE);
  const empTight = unemp>0&&unemp<unempE;
  const empLoose = unemp>0&&unemp>unempE;

  if (pmiHigh&&inflHigh&&empTight)  return { label:"SURCHAUFFE",    color:"#f59e0b", bg:"#f59e0b22", bc:"Hawkish — va monter les taux",          devise:"Forte — capitaux entrent" };
  if (pmiHigh&&!inflHigh&&empTight) return { label:"GOLDILOCKS",    color:"#22c55e", bg:"#22c55e22", bc:"Neutre — surveille inflation",           devise:"Stable — depends des autres" };
  if (pmiHigh&&inflHigh&&!empTight) return { label:"SURCHAUFFE",    color:"#f59e0b", bg:"#f59e0b22", bc:"Hawkish — inflation et PMI forts",       devise:"Forte — capitaux entrent" };
  if (pmiLow&&inflHigh&&empLoose)   return { label:"STAGFLATION",   color:"#a855f7", bg:"#a855f722", bc:"Coincee — ne peut ni monter ni baisser", devise:"Incertaine — evite ce trade" };
  if (pmiLow&&empLoose)             return { label:"RECESSION",     color:"#ef4444", bg:"#ef444422", bc:"Dovish — va baisser les taux",           devise:"Faible — capitaux sortent" };
  if (pmiLow&&inflLow)              return { label:"RECESSION",     color:"#ef4444", bg:"#ef444422", bc:"Dovish — baisses de taux a venir",       devise:"Faible — capitaux sortent" };
  if (pmiLow)                       return { label:"RALENTISSEMENT",color:"#f97316", bg:"#f9731622", bc:"Pivot Dovish — baisses a venir",         devise:"S affaiblit progressivement" };

  const sc = calcScore(data,code);
  if (sc>0.20)  return { label:"EXPANSION", color:"#22c55e", bg:"#22c55e22", bc:"Hawkish — maintient les taux hauts",  devise:"Forte — capitaux entrent" };
  if (sc<-0.20) return { label:"RECESSION", color:"#ef4444", bg:"#ef444422", bc:"Dovish — va baisser les taux",        devise:"Faible — capitaux sortent" };
  return               { label:"NEUTRE",    color:"#64748b", bg:"#64748b22", bc:"BC en observation",                  devise:"Stable — pas de biais" };
}

function getStr(score) {
  if (score>=0.35)  return { label:"FORT",   color:"#22c55e", bg:"#14532d" };
  if (score>=0.10)  return { label:"MODERE", color:"#86efac", bg:"#166534" };
  if (score<=-0.35) return { label:"FAIBLE", color:"#ef4444", bg:"#7f1d1d" };
  if (score<=-0.10) return { label:"MODERE", color:"#fca5a5", bg:"#991b1b" };
  return                   { label:"NEUTRE", color:"#fbbf24", bg:"#1f2937" };
}

function cellBg(s,ind) { if(s===null)return"#0d1829"; const m=getMag(ind,s); if(m>0.5)return"#14532d"; if(m>0)return"#166534"; if(m<-0.5)return"#7f1d1d"; if(m<0)return"#991b1b"; return"#1f2937"; }
function cellClr(s,ind) { if(s===null)return"#334155"; const m=getMag(ind,s); if(m>0.5)return"#4ade80"; if(m>0)return"#86efac"; if(m<-0.5)return"#f87171"; if(m<0)return"#fca5a5"; return"#fbbf24"; }

function Inp({code,id,field,data,setCell}) {
  const cell=(data[code]||{})[id]||{};
  const val=cell[field]!==undefined?cell[field]:"";
  const ind=INDS.find(i=>i.id===id);
  const surp=field==="now"?getSurp(ind,cell):null;
  return <input type="number" step="0.1" value={val} onChange={e=>setCell(code,id,field,e.target.value)} placeholder="-"
    style={{width:46,background:field==="now"?cellBg(surp,ind):"#0d1829",border:"1px solid #1e3a5f33",borderRadius:3,
      color:field==="now"?cellClr(surp,ind):"#475569",padding:"3px 2px",fontSize:11,fontFamily:"monospace",
      outline:"none",textAlign:"center",fontWeight:field==="now"?700:400}}/>;
}

function RegimeDetail({data,code,curr}) {
  const reg = getRegime(data,code);
  if (!hasData(data,code)) return (
    <div style={{padding:"8px 12px",color:"#334155",fontSize:10,fontStyle:"italic"}}>Aucune donnee saisie</div>
  );
  return (
    <div style={{padding:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{padding:8,background:"#070b14",borderRadius:6}}>
          <div style={{fontSize:8,color:"#475569",marginBottom:3,letterSpacing:1}}>BANQUE CENTRALE</div>
          <div style={{fontSize:11,color:reg.color,fontWeight:700}}>{reg.bc}</div>
        </div>
        <div style={{padding:8,background:"#070b14",borderRadius:6}}>
          <div style={{fontSize:8,color:"#475569",marginBottom:3,letterSpacing:1}}>DEVISE</div>
          <div style={{fontSize:11,color:reg.color,fontWeight:700}}>{reg.devise}</div>
        </div>
      </div>
      <div style={{fontSize:9,color:"#38bdf8",letterSpacing:2,marginBottom:6,fontWeight:700}}>POURQUOI CE REGIME</div>
      {INDS.map(ind => {
        const cell=(data[code]||{})[ind.id]||{};
        const s=getSurp(ind,cell);
        const now=toN(cell.now), exp=toN(cell.exp), prior=toN(cell.prior);
        if (now===null) return null;
        const mag=s!==null?getMag(ind,s):null;
        const col=mag===null?"#475569":mag>0?"#4ade80":mag<0?"#f87171":"#fbbf24";
        const arr=s===null?"":s>0?"↑":"↓";
        const beat=s===null?"":s>0?"beat":"miss";
        let note="";
        if (ind.id==="cpi"||ind.id==="core") note=now>2?" → au-dessus cible → hawkish":" → sous cible → dovish";
        if (ind.id==="unemp") note=ind.rev?(s!==null&&s>0?" → tres serre → hawkish fort":" → marche du travail faible"):"";
        if (ind.id==="mfg"||ind.id==="svc") note=now>50?" → expansion":" → contraction"+(now<50?" forte":"");
        return (
          <div key={ind.id} style={{fontSize:9,color:col,marginBottom:4,display:"flex",gap:4,flexWrap:"wrap"}}>
            <span style={{color:"#64748b",minWidth:80}}>{ind.label}:</span>
            <span>{now}% {prior!==null?`↑${(now-prior).toFixed(1)}`:""}</span>
            {s!==null&&<span>| {beat}:{mag!==null?(mag>=0?"+":"")+mag.toFixed(2):"?"}</span>}
            <span style={{color:"#475569"}}>{note}</span>
          </div>
        );
      })}
    </div>
  );
}

function GuideView() {
  return (
    <div style={{padding:16}}>
      <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{fontSize:12,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:16,borderBottom:"1px solid #1e3a5f",paddingBottom:8}}>DANS LA TETE DE LA BANQUE CENTRALE</div>
        {[
          {title:"CORE CPI %",pct:"25%",sub:"Cherche: Core Inflation Rate sur Trading Economics",desc:"Le chiffre le plus important. La BC regarde ca EN PREMIER. Est-ce que les prix montent partout dans l economie?",good:"Chiffre publie PLUS HAUT que prevu = BC monte les taux = devise monte",bad:"Chiffre publie PLUS BAS que prevu = BC baisse les taux = devise baisse"},
          {title:"INFLATION %",pct:"25%",sub:"Cherche: Inflation Rate sur Trading Economics",desc:"Confirme le Core CPI. Inclut tout: nourriture, essence, loyer. Seul il est moins fiable. Avec le Core = signal beton.",good:"Les 2 PLUS HAUTS que prevu = signal hawkish tres fort = BC va monter",bad:"Les 2 PLUS BAS que prevu = signal dovish tres fort = BC va baisser"},
          {title:"CHOMAGE %",pct:"20%",sub:"Cherche: Unemployment Rate sur Trading Economics",desc:"Moins de chomage = gens travaillent = ils depensent plus = prix montent = BC monte les taux.",good:"Chiffre publie PLUS BAS que prevu = economie forte = bon pour la devise",bad:"Chiffre publie PLUS HAUT que prevu = economie faible = mauvais pour la devise"},
          {title:"PMI SERVICES",pct:"15%",sub:"Cherche: Services PMI sur Trading Economics",desc:"Est-ce que restaurants, hotels, transports tournent bien? Represente 75% de l economie. Au dessus de 50 = expansion.",good:"Chiffre publie PLUS HAUT que prevu = demande forte = BC hawkish",bad:"Chiffre publie PLUS BAS que prevu = demande faible = BC dovish"},
          {title:"PMI MANUF",pct:"10%",sub:"Cherche: Manufacturing PMI sur Trading Economics",desc:"Est-ce que les usines produisent bien? Souvent le premier signal d un ralentissement a venir.",good:"Chiffre publie PLUS HAUT que prevu = production forte = economie en sante",bad:"Chiffre publie PLUS BAS que prevu = ralentissement industriel"},
        ].map(s=>(
          <div key={s.title} style={{marginBottom:12,padding:12,background:"#070b14",borderRadius:6,border:"1px solid #1e3a5f33"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <div style={{fontSize:12,fontWeight:700,color:"#38bdf8"}}>{s.title}</div>
              <div style={{fontSize:10,color:"#475569"}}>Poids {s.pct}</div>
            </div>
            <div style={{fontSize:9,color:"#475569",marginBottom:6}}>{s.sub}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>{s.desc}</div>
            <div style={{fontSize:10,color:"#4ade80",marginBottom:3}}>✅ {s.good}</div>
            <div style={{fontSize:10,color:"#f87171"}}>❌ {s.bad}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#0a1628",border:"1px solid #f59e0b44",borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{fontSize:12,letterSpacing:3,color:"#f59e0b",fontWeight:700,marginBottom:12,borderBottom:"1px solid #f59e0b33",paddingBottom:8}}>REGLE D OR DE LA BC</div>
        {[["1 mois de beat","Elle note mais n agit pas"],["2 mois de beats","Elle commence a en parler publiquement"],["3 mois de beats","Elle agit sur les taux — c est la que ca bouge"]].map(([r,d])=>(
          <div key={r} style={{display:"flex",gap:12,marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#f59e0b",minWidth:130}}>{r}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#0a1628",border:"1px solid #22c55e44",borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{fontSize:12,letterSpacing:3,color:"#22c55e",fontWeight:700,marginBottom:12,borderBottom:"1px solid #22c55e33",paddingBottom:8}}>EXEMPLE CONCRET — USD vs EUR</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{padding:10,background:"#14532d",borderRadius:6}}>
            <div style={{fontSize:11,fontWeight:700,color:"#4ade80",marginBottom:8}}>🇺🇸 USD — TOUT BAT</div>
            {["Core CPI: prevu 2.7% publie 3.1% ✅","Inflation: prevu 3.3% publie 3.8% ✅","Chomage: prevu 4.1% publie 3.7% ✅","PMI Svc: prevu 51 publie 54 ✅","PMI Mfg: prevu 50 publie 52 ✅"].map(t=><div key={t} style={{fontSize:9,color:"#86efac",marginBottom:3}}>{t}</div>)}
            <div style={{marginTop:8,fontSize:10,color:"#4ade80",fontWeight:700}}>La Fed: economie forte, je monte les taux</div>
          </div>
          <div style={{padding:10,background:"#7f1d1d",borderRadius:6}}>
            <div style={{fontSize:11,fontWeight:700,color:"#f87171",marginBottom:8}}>🇪🇺 EUR — TOUT RATE</div>
            {["Core CPI: prevu 2.5% publie 2.1% ❌","Inflation: prevu 2.3% publie 1.9% ❌","Chomage: prevu 6.0% publie 6.5% ❌","PMI Svc: prevu 50 publie 47 ❌","PMI Mfg: prevu 48 publie 46 ❌"].map(t=><div key={t} style={{fontSize:9,color:"#fca5a5",marginBottom:3}}>{t}</div>)}
            <div style={{marginTop:8,fontSize:10,color:"#f87171",fontWeight:700}}>La BCE: economie faible, je baisse les taux</div>
          </div>
        </div>
        <div style={{marginTop:12,padding:10,background:"#070b14",borderRadius:6,textAlign:"center"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#38bdf8",marginBottom:4}}>LE TRADE</div>
          <div style={{fontSize:11,color:"#4ade80",marginBottom:2}}>LONG USD / SHORT EUR</div>
          <div style={{fontSize:10,color:"#94a3b8"}}>Tu achetes la devise forte, tu vends la devise faible</div>
        </div>
      </div>
      <div style={{background:"#0a1628",border:"1px solid #38bdf844",borderRadius:8,padding:16}}>
        <div style={{fontSize:12,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:12,borderBottom:"1px solid #38bdf833",paddingBottom:8}}>COMMENT LIRE LE SCORE</div>
        {[["Moins de 0.25","Ne trade pas — signal trop faible","#ef4444"],["0.25 a 0.40","Petite position — signal modere","#f59e0b"],["Plus de 0.40","Position normale — signal fort","#22c55e"],["Plus de 0.60","Position maximum — signal tres fort","#4ade80"]].map(([r,d,col])=>(
          <div key={r} style={{display:"flex",gap:12,marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:col,minWidth:120}}>{r}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [data,setData]=useState(mkData);
  const [view,setView]=useState("table");
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState({});
  const timer=useRef(null);

  useEffect(()=>{
    const unsub=onValue(ref(db,"apexdata"),snap=>{
      const val=snap.val();
      if(val){
        const merged=mkData();
        CURR.forEach(c=>{ if(val[c.code]) INDS.forEach(i=>{ if(val[c.code][i.id]) merged[c.code][i.id]=val[c.code][i.id]; }); });
        setData(merged);
      }
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  function setCell(code,id,field,val){
    setData(prev=>{
      const next={...prev};
      next[code]={...prev[code]};
      next[code][id]={...((prev[code]&&prev[code][id])||{}),[field]:val};
      if(timer.current) clearTimeout(timer.current);
      timer.current=setTimeout(()=>set(ref(db,"apexdata"),next),600);
      return next;
    });
  }

  function resetData(){
    if(window.confirm("Effacer toutes les donnees sur tous les appareils?")){
      const d=mkData(); set(ref(db,"apexdata"),d); setData(d);
    }
  }

  function toggleExpand(code){
    setExpanded(p=>({...p,[code]:!p[code]}));
  }

  const ranked=useMemo(()=>
    CURR.map(c=>({...c,score:calcScore(data,c.code),ok:hasData(data,c.code)}))
        .sort((a,b)=>b.score-a.score)
  ,[data]);

  const best=ranked[0], worst=ranked[ranked.length-1];
  const div=(best.score-worst.score).toFixed(2);
  const tradeOk=parseFloat(div)>=0.25;

  const tab=a=>({padding:"6px 12px",fontSize:10,fontFamily:"monospace",cursor:"pointer",borderRadius:4,
    letterSpacing:1,whiteSpace:"nowrap",
    border:a?"1px solid #38bdf8":"1px solid #1e3a5f",
    background:a?"#38bdf820":"transparent",
    color:a?"#38bdf8":"#64748b"});

  if(loading) return(
    <div style={{minHeight:"100vh",background:"#070b14",display:"flex",alignItems:"center",justifyContent:"center",color:"#38bdf8",fontFamily:"monospace",fontSize:16,letterSpacing:3}}>
      CHARGEMENT...
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#070b14",fontFamily:"monospace",color:"#c8d8f0",fontSize:13}}>

      <div style={{background:"#0a1628",borderBottom:"2px solid #1e3a5f",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:3,color:"#38bdf8"}}>APEX MACRO</div>
          <div style={{fontSize:9,color:"#475569",letterSpacing:2}}>FORCE ECONOMIQUE — BIAIS BANQUE CENTRALE — SYNC TEMPS REEL</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["table","TABLEAU"],["rank","CLASSEMENT"],["regime","REGIMES"],["trade","TRADE"],["guide","GUIDE"]].map(([v,l])=>(
            <button key={v} style={tab(view===v)} onClick={()=>setView(v)}>{l}</button>
          ))}
          <button onClick={resetData} style={{...tab(false),border:"1px solid #7f1d1d",color:"#ef4444"}}>RESET</button>
        </div>
      </div>

      <div style={{background:"#090f1e",borderBottom:"1px solid #1e3a5f22",padding:"6px 16px",display:"flex",gap:10,overflowX:"auto"}}>
        {ranked.map(c=>{const st=getStr(c.score);return(
          <div key={c.code} style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:46}}>
            <span style={{fontSize:9,color:st.color,fontWeight:700}}>{c.flag} {c.code}</span>
            <div style={{width:40,height:3,background:"#1e3a5f",borderRadius:2,margin:"2px 0"}}>
              <div style={{width:Math.min(Math.abs(c.score)*100,100)+"%",height:"100%",background:st.color,borderRadius:2}}/>
            </div>
            <span style={{fontSize:7,color:"#475569"}}>{c.score>=0?"+":""}{c.score.toFixed(2)}</span>
          </div>
        );})}
      </div>

      {view==="table"&&(
        <div style={{overflowX:"auto",padding:12}}>
          <div style={{fontSize:9,color:"#475569",marginBottom:6}}>PRIOR → EXP → NOW | vert=beat / rouge=miss | sauvegarde automatique sur tous les appareils</div>
          <table style={{borderCollapse:"collapse",minWidth:950}}>
            <thead>
              <tr>
                <th style={{background:"#0a1628",padding:"6px 10px",fontSize:10,color:"#38bdf8",border:"1px solid #1e3a5f33",textAlign:"left",minWidth:130}}>PAYS</th>
                {INDS.map(ind=>(
                  <th key={ind.id} colSpan={3} style={{background:"#0a1628",padding:"6px 8px",fontSize:10,color:"#38bdf8",border:"1px solid #1e3a5f33",textAlign:"center"}}>
                    <a href={"https://tradingeconomics.com/"+CURR[0].te+"/"+ind.te} target="_blank" rel="noreferrer"
                      style={{color:"#38bdf8",textDecoration:"none"}}>{ind.label}</a>
                  </th>
                ))}
                <th style={{background:"#0a1628",padding:"6px 10px",fontSize:10,color:"#38bdf8",border:"1px solid #1e3a5f33",textAlign:"center",minWidth:80}}>SCORE</th>
                <th style={{background:"#0a1628",padding:"6px 10px",fontSize:10,color:"#38bdf8",border:"1px solid #1e3a5f33",textAlign:"center",minWidth:90}}>REGIME</th>
              </tr>
              <tr>
                <th style={{background:"#0d1d35",border:"1px solid #1e3a5f22"}}/>
                {INDS.map(ind=>["Prior","Exp","Now"].map(f=>(
                  <th key={ind.id+f} style={{background:"#0d1d35",padding:"3px 4px",fontSize:8,color:f==="Now"?"#38bdf8":"#475569",border:"1px solid #1e3a5f22",textAlign:"center"}}>{f}</th>
                )))}
                <th style={{background:"#0d1d35",border:"1px solid #1e3a5f22"}}/>
                <th style={{background:"#0d1d35",border:"1px solid #1e3a5f22"}}/>
              </tr>
            </thead>
            <tbody>
              {ranked.map((c,ri)=>{
                const st=getStr(c.score);
                const reg=getRegime(data,c.code);
                return(
                  <tr key={c.code} style={{background:ri%2===0?"#0a162808":"transparent"}}>
                    <td style={{padding:"5px 10px",border:"1px solid #1e3a5f22",fontWeight:700,color:"#e2f0ff",whiteSpace:"nowrap"}}>
                      {c.flag} {c.label} <span style={{fontSize:9,color:"#475569"}}>#{ri+1}</span>
                    </td>
                    {INDS.map(ind=>["prior","exp","now"].map(field=>(
                      <td key={ind.id+field} style={{padding:"3px 2px",border:"1px solid #1e3a5f22",textAlign:"center"}}>
                        <Inp code={c.code} id={ind.id} field={field} data={data} setCell={setCell}/>
                      </td>
                    )))}
                    <td style={{padding:"5px 8px",border:"1px solid #1e3a5f22",textAlign:"center"}}>
                      <div style={{fontSize:14,fontWeight:700,color:st.color}}>{c.score>=0?"+":""}{c.score.toFixed(2)}</div>
                      <div style={{width:"80%",height:3,background:"#1e3a5f",borderRadius:2,margin:"3px auto 0"}}>
                        <div style={{width:Math.min(Math.abs(c.score)*100,100)+"%",height:"100%",background:st.color,borderRadius:2}}/>
                      </div>
                    </td>
                    <td style={{padding:"5px 8px",border:"1px solid #1e3a5f22",textAlign:"center"}}>
                      <div style={{background:reg.bg,border:"1px solid "+reg.color+"55",borderRadius:4,padding:"3px 6px",fontSize:9,fontWeight:700,color:reg.color}}>{reg.label}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view==="rank"&&(
        <div style={{padding:16}}>
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:16}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:12,borderBottom:"1px solid #1e3a5f",paddingBottom:6}}>CLASSEMENT — FORT vers FAIBLE</div>
            {ranked.map((c,i)=>{const st=getStr(c.score);const reg=getRegime(data,c.code);return(
              <div key={c.code} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"10px 12px",background:"#070b1466",borderRadius:6,border:"1px solid "+st.color+"33"}}>
                <span style={{fontSize:16,fontWeight:700,color:"#1e3a5f",minWidth:28}}>#{i+1}</span>
                <span style={{fontSize:16}}>{c.flag}</span>
                <span style={{fontWeight:700,color:"#e2f0ff",minWidth:40,letterSpacing:2,fontSize:12}}>{c.code}</span>
                <div style={{flex:1,height:8,background:"#1e3a5f",borderRadius:4,overflow:"hidden"}}>
                  <div style={{width:Math.min(Math.abs(c.score)*100,100)+"%",height:"100%",background:st.color,borderRadius:4}}/>
                </div>
                <span style={{fontSize:13,fontWeight:700,color:st.color,minWidth:50,textAlign:"right"}}>{c.score>=0?"+":""}{c.score.toFixed(2)}</span>
                <div style={{background:reg.bg,border:"1px solid "+reg.color+"44",borderRadius:4,padding:"3px 8px",fontSize:9,fontWeight:700,color:reg.color,minWidth:90,textAlign:"center"}}>{reg.label}</div>
              </div>
            );})}
          </div>
        </div>
      )}

      {view==="regime"&&(
        <div style={{padding:16}}>
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:16,marginBottom:16}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:12,borderBottom:"1px solid #1e3a5f",paddingBottom:6}}>REGIME MACRO — CLIQUER POUR DETAILS</div>
            {ranked.map(c=>{
              const reg=getRegime(data,c.code);
              const open=expanded[c.code];
              return(
                <div key={c.code} style={{marginBottom:8,border:"1px solid "+reg.color+"44",borderRadius:8,overflow:"hidden"}}>
                  <div onClick={()=>toggleExpand(c.code)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:reg.bg,cursor:"pointer"}}>
                    <span style={{fontSize:16}}>{c.flag}</span>
                    <span style={{fontWeight:700,color:"#e2f0ff",fontSize:13,letterSpacing:2,minWidth:50}}>{c.code}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:9,color:"#475569",letterSpacing:1,marginBottom:2}}>BANQUE CENTRALE</div>
                      <div style={{fontSize:11,color:reg.color,fontWeight:700}}>{reg.bc}</div>
                    </div>
                    <div style={{textAlign:"right",minWidth:120}}>
                      <div style={{fontSize:9,color:"#475569",letterSpacing:1,marginBottom:2}}>DEVISE</div>
                      <div style={{fontSize:11,color:reg.color,fontWeight:700}}>{reg.devise}</div>
                    </div>
                    <div style={{background:reg.color+"33",border:"1px solid "+reg.color,borderRadius:4,padding:"4px 10px",fontSize:10,fontWeight:700,color:reg.color,marginLeft:8}}>{reg.label}</div>
                    <span style={{color:reg.color,fontSize:12}}>{open?"▲":"▼"}</span>
                  </div>
                  {open&&<div style={{background:"#0a1628"}}><RegimeDetail data={data} code={c.code} curr={c}/></div>}
                </div>
              );
            })}
          </div>
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:16}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:12,borderBottom:"1px solid #1e3a5f",paddingBottom:6}}>REGIME MACRO — DEFINITION</div>
            {[
              {label:"GOLDILOCKS",color:"#22c55e",desc:"PMI fort + CPI bas + Chomage bas",bc:"BC neutre — devises fortes montent"},
              {label:"SURCHAUFFE",color:"#f59e0b",desc:"PMI fort + CPI haut + Chomage bas",bc:"BC hawkish — taux montent — devise monte"},
              {label:"STAGFLATION",color:"#a855f7",desc:"PMI faible + CPI haut + Chomage haut",bc:"BC coincee — evite ce trade"},
              {label:"RECESSION",color:"#ef4444",desc:"PMI faible + CPI bas + Chomage haut",bc:"BC dovish — taux baissent — devise baisse"},
              {label:"RALENTISSEMENT",color:"#f97316",desc:"PMI faible uniquement",bc:"Pivot Dovish — baisses a venir"},
              {label:"EN ATTENTE",color:"#334155",desc:"Aucune donnee saisie",bc:"Entrer les donnees pour voir le regime"},
            ].map(r=>(
              <div key={r.label} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10,padding:"8px 12px",background:"#070b14",borderRadius:6}}>
                <div style={{minWidth:110,fontSize:10,fontWeight:700,color:r.color}}>{r.label}</div>
                <div>
                  <div style={{fontSize:10,color:"#38bdf8",marginBottom:2}}>{r.desc}</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{r.bc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view==="trade"&&(
        <div style={{padding:16}}>
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:16,marginBottom:16}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:16,borderBottom:"1px solid #1e3a5f",paddingBottom:6}}>MEILLEUR TRADE — DIVERGENCE MACRO</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"center",marginBottom:20}}>
              <div style={{textAlign:"center",padding:20,background:"#14532d",border:"2px solid #22c55e66",borderRadius:10}}>
                <div style={{fontSize:10,color:"#86efac",marginBottom:6}}>ECONOMIE FORTE</div>
                <div style={{fontSize:28}}>{best.flag}</div>
                <div style={{fontSize:26,fontWeight:700,color:"#22c55e",letterSpacing:3}}>{best.code}</div>
                <div style={{fontSize:13,color:"#4ade80",fontWeight:700}}>{best.score>=0?"+":""}{best.score.toFixed(2)}</div>
                <div style={{fontSize:10,color:"#86efac",marginTop:4}}>{getRegime(data,best.code).label}</div>
              </div>
              <div style={{textAlign:"center",padding:"10px 4px"}}>
                <div style={{fontSize:9,color:"#64748b",marginBottom:6}}>DIVERGENCE</div>
                <div style={{fontSize:24,fontWeight:700,color:tradeOk?"#22c55e":"#f59e0b"}}>{div}</div>
                <div style={{marginTop:8,padding:"4px 8px",borderRadius:4,background:tradeOk?"#14532d":"#1f2937",border:"1px solid "+(tradeOk?"#22c55e":"#f59e0b"),fontSize:9,fontWeight:700,color:tradeOk?"#22c55e":"#f59e0b"}}>{tradeOk?"✓ TRADE VALIDE":"✗ TROP FAIBLE"}</div>
                <div style={{marginTop:6,fontSize:14,fontWeight:700,color:"#38bdf8"}}>{best.code}/{worst.code}</div>
                <div style={{fontSize:9,color:"#64748b",marginTop:2}}>LONG {best.code} / SHORT {worst.code}</div>
              </div>
              <div style={{textAlign:"center",padding:20,background:"#7f1d1d",border:"2px solid #ef444466",borderRadius:10}}>
                <div style={{fontSize:10,color:"#fca5a5",marginBottom:6}}>ECONOMIE FAIBLE</div>
                <div style={{fontSize:28}}>{worst.flag}</div>
                <div style={{fontSize:26,fontWeight:700,color:"#ef4444",letterSpacing:3}}>{worst.code}</div>
                <div style={{fontSize:13,color:"#f87171",fontWeight:700}}>{worst.score.toFixed(2)}</div>
                <div style={{fontSize:10,color:"#fca5a5",marginTop:4}}>{getRegime(data,worst.code).label}</div>
              </div>
            </div>
            <div style={{background:"#070b14",border:"1px solid #1e3a5f",borderRadius:6,padding:12}}>
              <div style={{fontSize:9,color:"#38bdf8",letterSpacing:2,fontWeight:700,marginBottom:8}}>REGLES</div>
              {[["Moins de 0.25","Ne trade pas","#ef4444"],["0.25 a 0.40","Petite position","#f59e0b"],["Plus de 0.40","Position normale","#22c55e"],["Plus de 0.60","Position maximum","#4ade80"]].map(([r,d,col])=>(
                <div key={r} style={{display:"flex",gap:10,marginBottom:6}}>
                  <span style={{fontSize:10,fontWeight:700,color:col,minWidth:100}}>{r}</span>
                  <span style={{fontSize:10,color:"#94a3b8"}}>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:16}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",fontWeight:700,marginBottom:12,borderBottom:"1px solid #1e3a5f",paddingBottom:6}}>TOUTES LES DIVERGENCES</div>
            {ranked.filter(c=>c.ok).slice(0,5).map(strong=>
              ranked.filter(c=>c.ok).slice(-5).reverse().map(weak=>{
                if(strong.code===weak.code) return null;
                const d=(strong.score-weak.score).toFixed(2);
                if(parseFloat(d)<0.10) return null;
                const ok=parseFloat(d)>=0.25;
                return(
                  <div key={strong.code+weak.code} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"7px 10px",background:"#070b1444",borderRadius:5,border:"1px solid "+(ok?"#22c55e22":"#1e3a5f22")}}>
                    <span>{strong.flag}</span>
                    <span style={{fontWeight:700,color:"#22c55e",fontSize:11}}>{strong.code}</span>
                    <span style={{color:"#475569",fontSize:10}}>vs</span>
                    <span>{weak.flag}</span>
                    <span style={{fontWeight:700,color:"#ef4444",fontSize:11}}>{weak.code}</span>
                    <div style={{flex:1}}/>
                    <span style={{fontWeight:700,color:ok?"#22c55e":"#f59e0b",fontSize:13}}>{d}</span>
                    <span style={{fontSize:9,color:ok?"#22c55e":"#f59e0b",fontWeight:700}}>{ok?"✓":"~"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {view==="guide"&&<GuideView/>}
    </div>
  );
}
