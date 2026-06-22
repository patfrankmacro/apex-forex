import { useState } from "react";

const TEXT = "#cbd5e1", TEXT_DIM = "#94a3b8", TEXT2 = "#e2e8f0";
const GREEN = "#34d399", RED = "#f87171", AMBER = "#fbbf24", BLUE = "#38bdf8", PURPLE = "#c084fc", GOLD = "#d4af37";

function grab(txt, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + "\\s*[\\r\\n]*\\s*(-?[0-9]+(?:\\.[0-9]+)?)\\s*(%|B|M|K)?", "i");
  const m = txt.match(re);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2] === "B") v *= 1000;
  if (m[2] === "K") v /= 1000;
  return v;
}

function grabPrice(txt) {
  const ls = txt.split(/\r?\n/);
  for (let i = 0; i < ls.length - 1; i++) {
    const cur = ls[i].trim();
    const nxt = ls[i+1].trim();
    if (cur === "Price" && /^[0-9]+(\.[0-9]+)?$/.test(nxt)) return parseFloat(nxt);
  }
  return null;
}

function grab52(txt, label) {
  // "52W High\n168.00 6.41%" -> on veut le 2e nombre (le %), pas le prix
  const ls = txt.split(/\r?\n/);
  for (let i = 0; i < ls.length - 1; i++) {
    if (ls[i].trim() === label) {
      const nums = ls[i+1].trim().match(/-?[0-9]+(?:\.[0-9]+)?/g);
      if (nums && nums.length >= 2) return parseFloat(nums[1]);
      if (nums && nums.length === 1) return parseFloat(nums[0]);
    }
  }
  return null;
}

function grabGrowth(txt, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + "\\s*[\\r\\n]*\\s*(-?[0-9]+(?:\\.[0-9]+)?)\\s*%", "gi");
  let m, last = null;
  while ((m = re.exec(txt)) !== null) { last = parseFloat(m[1]); }
  return last;
}

function analyse(raw, manualTicker) {
  const t = raw;
  let ticker = "?";
  if (manualTicker && manualTicker.trim()) {
    ticker = manualTicker.trim().toUpperCase();
  } else {
    const m1 = t.match(/finviz\.com\/stock\?t=([A-Za-z]+)/i);
    if (m1) ticker = m1[1].toUpperCase();
    else {
      const m2 = t.match(/stock\?t=([A-Z]{1,6})/i);
      if (m2) ticker = m2[1].toUpperCase();
    }
  }
  const f = {
    mktcap: grab(t, "Market Cap"), price: grabPrice(t), avgvol: grab(t, "Avg Volume"),
    relvol: grab(t, "Rel Volume"), recom: grab(t, "Recom"), epsQQ: grab(t, "EPS Q/Q"),
    epsThisY: grab(t, "EPS this Y"), salesQQ: grab(t, "Sales Q/Q"), instOwn: grab(t, "Inst Own"),
    instTrans: grab(t, "Inst Trans"), insiderTrans: grab(t, "Insider Trans"), perfHalfY: grab(t, "Perf Half Y"),
    perfYear: grab(t, "Perf Year"), perfQuart: grab(t, "Perf Quarter"), perfMonth: grab(t, "Perf Month"), sma200: grab(t, "SMA200"), sma50: grab(t, "SMA50"), sma20: grab(t, "SMA20"),
    rsi: grab(t, "RSI \\(14\\)"), change: grab(t, "Change"), epsYYTTM: grab(t, "EPS Y/Y TTM"),
    salesYYTTM: grab(t, "Sales Y/Y TTM"), roe: grab(t, "ROE"), debteq: grab(t, "Debt/Eq"),
    atr: grab(t, "ATR (14)"), beta: grab(t, "Beta"), w52high: grab52(t, "52W High"), w52low: grab52(t, "52W Low"),
    epsNextY: grabGrowth(t, "EPS next Y"),
    fwdPE: grab(t, "Forward P/E"),
    peg: grab(t, "PEG"),
    ps: grab(t, "P/S"),
    targetPrice: grab(t, "Target Price"),
    salesAbs: grab(t, "Sales"),
    shsOut: grab(t, "Shs Outstand"),
    epsNextYval: grab(t, "EPS next Y"),
  };
  const surpr = t.match(/EPS\/Sales Surpr\.?\s*[\r\n]*\s*(-?[0-9.]+)%?\s*(-?[0-9.]+)?/i);
  f.epsSurpr = surpr ? parseFloat(surpr[1]) : null;
  f.salesSurpr = surpr && surpr[2] ? parseFloat(surpr[2]) : null;
  const secList = ["Technology","Industrials","Financial","Basic Materials","Healthcare","Real Estate","Utilities","Consumer Cyclical","Communication Services","Consumer Defensive","Energy"];
  f.sector = null;
  const head = t.split(/\r?\n/).slice(0,12).join(" ");
  for (const s of secList) { if (new RegExp(s,"i").test(head)) { f.sector = s; break; } }
  if (!f.sector) { for (const s of secList) { if (new RegExp(s,"i").test(t)) { f.sector = s; break; } } }
  return { ticker, f };
}

const C = (label, val, ok, detail) => ({ label, val, ok, detail });

function checksTechnique(f) {
  return [
    C("Market Cap > $10B (Large)", f.mktcap, f.mktcap!==null && f.mktcap>10000, f.mktcap!==null?(f.mktcap>=1000?(f.mktcap/1000).toFixed(1)+"B":f.mktcap.toFixed(0)+"M"):"?"),
    C("Price > $15", f.price, f.price!==null && f.price>15, f.price!==null?"$"+f.price:"?"),
    C("Avg Volume > 2M", f.avgvol, f.avgvol!==null && f.avgvol>2, f.avgvol!==null?f.avgvol.toFixed(2)+"M":"?"),
    C("ATR > 1.5", f.atr, f.atr!==null && f.atr>1.5, f.atr!==null?f.atr.toFixed(2):"?"),
    C("Beta > 1", f.beta, f.beta!==null && f.beta>1, f.beta!==null?f.beta.toFixed(2):"?"),
    C("Perf Quarter > 20%", f.perfQuart, f.perfQuart!==null && f.perfQuart>20, f.perfQuart!==null?(f.perfQuart>0?"+":"")+f.perfQuart+"%":"?"),
    C("Perf Month Up", f.perfMonth, f.perfMonth!==null && f.perfMonth>0, f.perfMonth!==null?(f.perfMonth>0?"+":"")+f.perfMonth+"%":"?"),
    C("Change Up (jour)", f.change, f.change!==null && f.change>0, f.change!==null?(f.change>0?"+":"")+f.change+"%":"?"),
    C("Prix > SMA20 (court terme)", f.sma20, f.sma20!==null && f.sma20>0, f.sma20!==null?(f.sma20>0?"+":"")+f.sma20+"%":"?"),
    C("SMA50 > SMA200 (Golden Cross)", f.sma50, f.sma50!==null && f.sma200!==null && f.sma50>0 && f.sma200>0, (f.sma50!==null?"SMA50 "+(f.sma50>0?"+":"")+f.sma50+"%":"?")),
    C("Prix > SMA200 (Stage 2)", f.sma200, f.sma200!==null && f.sma200>0, f.sma200!==null?(f.sma200>0?"+":"")+f.sma200+"%":"?"),
    C("52W High/Low > 30%", f.w52low, f.w52low!==null && f.w52low>30, f.w52low!==null?"+"+f.w52low+"%":"?"),
  ];
}

function checksFondamental(f) {
  return [
    C("EPS this Year > 25%", f.epsThisY, f.epsThisY!==null && f.epsThisY>25, f.epsThisY!==null?"+"+f.epsThisY+"%":"?"),
    C("EPS next Year > 25%", f.epsNextY, f.epsNextY!==null && f.epsNextY>25, f.epsNextY!==null?"+"+f.epsNextY+"%":"?"),
    C("EPS Q/Q > 25%", f.epsQQ, f.epsQQ!==null && f.epsQQ>25, f.epsQQ!==null?"+"+f.epsQQ+"%":"?"),
    C("Sales Q/Q > 25%", f.salesQQ, f.salesQQ!==null && f.salesQQ>25, f.salesQQ!==null?"+"+f.salesQQ+"%":"?"),
    C("Both Positive Surprise", f.epsSurpr, f.epsSurpr!==null && f.salesSurpr!==null && f.epsSurpr>0 && f.salesSurpr>0, (f.epsSurpr!==null?f.epsSurpr+"%":"?")+" / "+(f.salesSurpr!==null?f.salesSurpr+"%":"?")),
    C("Inst. Own > 10%", f.instOwn, f.instOwn!==null && f.instOwn>10, f.instOwn!==null?f.instOwn+"%":"?"),
    C("Prix < 25% du 52W High", f.w52high, f.w52high!==null && f.w52high<=25 && f.w52high>=0, f.w52high!==null?"à "+f.w52high+"% du sommet":"?"),
  ];
}

function valorisation(f) {
  const price = f.price;
  const epsN = f.epsNextYval;
  const fwdPE = f.fwdPE;
  const ps = f.ps;
  const salesM = f.salesAbs;
  const shs = f.shsOut;
  if (!price || !epsN) return null;
  const stop = +(price * 0.92).toFixed(2);
  const methodes = [];
  if (fwdPE) methodes.push({ nom: "Forward P/E", calc: "EPS $"+epsN+" x P/E "+fwdPE, cible: +(epsN*fwdPE).toFixed(2) });
  if (ps && salesM && shs) methodes.push({ nom: "Price/Sales", calc: "Ventes x P/S "+ps+" / "+shs+"M actions", cible: +((salesM*ps)/shs).toFixed(2) });
  if (f.targetPrice) methodes.push({ nom: "Consensus analystes", calc: "Target Price Finviz", cible: +f.targetPrice.toFixed(2) });
  if (f.peg && f.epsNextY && f.peg > 0) methodes.push({ nom: "PEG", calc: "EPS $"+epsN+" x PEG "+f.peg+" x croiss "+f.epsNextY+"%", cible: +(epsN*f.peg*(f.epsNextY)).toFixed(2) });
  const cibles = methodes.map(m=>m.cible).filter(x=>x>0 && isFinite(x));
  const low = cibles.length ? Math.min(...cibles) : null;
  const high = cibles.length ? Math.max(...cibles) : null;
  const epsF = f.epsNextYval && f.epsNextYval > 0 ? f.epsNextYval : epsN * 1.25;
  let growthRate = f.epsNextY && f.epsNextY > 0 ? f.epsNextY/100 : 0.25;
  if (growthRate > 0.5) growthRate = 0.5;
  const epsF2 = +(epsF * (1 + growthRate)).toFixed(2);
  const basePE = fwdPE || (price && epsF ? price/epsF : 25);
  const scenarios = [
    { nom: "BULL", hyp: "EPS continuent d'accelerer (+"+Math.round(growthRate*100)+"%) + le marche paie une prime", pe: +(basePE*1.3).toFixed(0), prix: +(epsF2*basePE*1.3).toFixed(2), c: GREEN },
    { nom: "BASE", hyp: "EPS N+2 atteints (+"+Math.round(growthRate*100)+"%), meme P/E qu'aujourd'hui", pe: +basePE.toFixed(0), prix: +(epsF2*basePE).toFixed(2), c: AMBER },
    { nom: "BEAR", hyp: "Croissance decoit, multiples comprimes", pe: +(basePE*0.65).toFixed(0), prix: +(epsF*basePE*0.65).toFixed(2), c: RED },
  ];
  const bullTarget = scenarios[0].prix;
  const baseTarget = scenarios[1].prix;
  const risque = price - stop;
  const gainBull = bullTarget - price;
  const gainBase = baseTarget - price;
  let rrBull = risque>0 ? +(gainBull/risque).toFixed(1) : null;
  let rrBase = risque>0 ? +(gainBase/risque).toFixed(1) : null;
  if (rrBull && rrBull > 20) rrBull = 20;
  if (rrBase && rrBase > 20) rrBase = 20;
  return { price, epsN, stop, methodes, low, high, scenarios, rrBull, rrBase, gainBull:+gainBull.toFixed(2), gainBase:+gainBase.toFixed(2), risque: +risque.toFixed(2) };
}

function autoThese(f, mode, secInfo) {
  const lines = [];
  if (secInfo) {
    if (secInfo.rank <= 3) {
      lines.push("✅ SECTEUR EN TENDANCE — FEU VERT\nLe secteur "+secInfo.name+" est classe #"+secInfo.rank+"/"+secInfo.total+" sur 1 mois (+"+secInfo.month+"%) et +"+secInfo.quart+"% sur 3 mois. C'est un secteur LEADER : le smart money y deplace du capital. Regle Pete respectee — tu chasses dans le bon groupe.");
    } else if (secInfo.rank <= 6) {
      lines.push("⚠️ SECTEUR MOYEN — PRUDENCE\nLe secteur "+secInfo.name+" est classe #"+secInfo.rank+"/"+secInfo.total+" sur 1 mois (+"+secInfo.month+"%). Ni leader, ni a la traine. Privilegie les actions des secteurs du top 3.");
    } else {
      lines.push("❌ SECTEUR FAIBLE — PAS DE TRADE (regle Pete)\nLe secteur "+secInfo.name+" est classe #"+secInfo.rank+"/"+secInfo.total+" sur 1 mois ("+secInfo.month+"%). Le smart money QUITTE ce groupe. On EVITE — cherche dans les secteurs en tete du classement.");
    }
  } else {
    lines.push("ℹ️ SECTEUR NON VERIFIE\nScanne d'abord la section GROUPES (en haut) pour savoir si "+(f.sector?("le secteur "+f.sector):"le secteur de cette action")+" est en tendance. Regle Pete : pas de secteur fort = pas de trade.");
  }
  if (f.change!==null && f.change>0) {
    lines.push("ENERGIE INSTITUTIONNELLE — LE CARBURANT\nL'action monte aujourd'hui (+"+f.change+"%). Une cloture forte au-dessus de l'ouverture (Change from Open +2%) revele que les gros acheteurs ont tenu l'offre toute la journee. Ce sont les grosses bougies vertes pleines — le carburant d'un mouvement explosif.");
  }
  if (f.sma200!==null && f.sma200>0 && f.sma50!==null && f.sma50>0) {
    lines.push("TENDANCE STAGE 2 CONFIRMEE\nPrix au-dessus de la SMA200 (+"+f.sma200+"%) et SMA50 alignee : signature d'une action en Stage 2 selon Minervini/Weinstein. Les institutions accumulent, la tendance de fond est haussiere.");
  }
  if (mode === 2) {
    if (f.epsQQ!==null && f.epsThisY!==null && f.epsNextY!==null && f.epsQQ>0 && f.epsThisY>0 && f.epsNextY>0) {
      const acc = f.epsQQ>50?"EXPLOSIVE":f.epsQQ>25?"SOLIDE":"MODEREE";
      lines.push("ACCELERATION EPS — "+acc+"\nEPS QoQ +"+f.epsQQ+"% · EPS This Year +"+f.epsThisY+"% · EPS Next Year +"+f.epsNextY+"%. Minervini exige cette triple acceleration — moins de 2% des actions y parviennent.");
    }
    if (f.salesQQ!==null) {
      if (f.salesQQ>=25) {
        const qual = f.salesQQ>50?"EXPLOSIVE":"FORTE";
        const ventesAcc = (f.epsQQ!==null && f.epsQQ>0) ? "EPS et ventes accelerent ensemble : double validation de la qualite." : "A surveiller : les EPS doivent suivre cette dynamique.";
        lines.push("CROISSANCE DES VENTES — "+qual+"\nSales QoQ +"+f.salesQQ+"% (>25%) confirme que la croissance vient de VRAIES ventes. "+ventesAcc);
      } else if (f.salesQQ>0) {
        lines.push("CROISSANCE DES VENTES — MODEREE (sous le seuil Minervini)\nSales QoQ +"+f.salesQQ+"% : c'est une croissance POSITIVE et saine, mais SOUS les 25% exiges par le screener strict Minervini. Ce n'est pas une baisse — l'entreprise grandit. Simplement, le rythme de vente n'atteint pas le seuil d'hyper-croissance. Les EPS (+"+(f.epsQQ!==null?f.epsQQ:"?")+"%) progressent plus vite, souvent grace aux marges. Pour le screener 1 (Pete, technique), aucun probleme. Pour Minervini, ce critere precis n'est juste pas rempli.");
      } else {
        lines.push("VENTES EN BAISSE — VIGILANCE\nSales QoQ "+f.salesQQ+"% est negatif ce trimestre. Les revenus reculent : signal de prudence, meme si les EPS tiennent (marges/rachats).");
      }
    }
    if (f.epsSurpr!==null && f.salesSurpr!==null && f.epsSurpr>0 && f.salesSurpr>0) {
      lines.push("BOTH POSITIVE SURPRISE — EFFET CASCADE\nEPS Surprise +"+f.epsSurpr+"% · Revenue Surprise +"+f.salesSurpr+"%. (1) les algos detectent → (2) les analystes relevent leurs cibles → (3) les fonds augmentent leur allocation → (4) le prix monte 10-30%.");
    }
    if (f.instTrans!==null && f.instTrans>0) {
      const intensite = f.instTrans>10?"ACCUMULATION FORTE (+10%)":"ACCUMULATION EN COURS";
      lines.push("INST. TRANSACTIONS +"+f.instTrans+"% — "+intensite+"\nLes fonds ont AUGMENTE leur position de "+f.instTrans+"%. Quand le smart money accumule en silence, c'est le signal le plus fiable. Ils achetent progressivement sur plusieurs semaines.");
    }
  }
  lines.push("VERIFIE LE CLUSTER SECTORIEL\nRegle Pete : si plusieurs actions de la MEME industrie sortent ensemble dans ton scan (ex: 3-4 semi-conducteurs), c'est la preuve que les institutions accumulent tout le groupe. C'est la que sont les trades les plus explosifs.");
  if (lines.length===0) return "Donnees insuffisantes. Verifie que tu as colle le tableau complet de Finviz.";
  return lines.join("\n\n---\n\n");
}

function autoVigilance(f) {
  const lines = [];
  if (f.insiderTrans!==null && f.insiderTrans<-20) lines.push("Insider Trans "+f.insiderTrans+"% → les DIRIGEANTS vendent massivement. A surveiller de pres.");
  else if (f.insiderTrans!==null && f.insiderTrans<0) lines.push("Insider Trans "+f.insiderTrans+"% → ventes de dirigeants. A surveiller.");
  if (f.rsi!==null && f.rsi>70) lines.push("RSI "+f.rsi+" → surachat (>70). Risque de repli. Attends un pullback / une consolidation du drapeau avant d'entrer.");
  else if (f.rsi!==null && f.rsi>65) lines.push("RSI "+f.rsi+" → proche surachat (70). Surveille une consolidation.");
  if (f.roe!==null && f.roe<10) lines.push("ROE "+f.roe+"% → rendement sur capital faible (<10%). Rentabilite fragile.");
  if (f.debteq!==null && f.debteq>1) lines.push("Debt/Equity "+f.debteq+" → endettement eleve. Vulnerable en cas de ralentissement.");
  if (f.instTrans!==null && f.instTrans<0) lines.push("Inst. Trans "+f.instTrans+"% → les FONDS reduisent leur position. Le smart money sort.");
  if (f.relvol!==null && f.relvol<1.5) lines.push("Rel Volume "+f.relvol+"x → volume relatif faible. Le breakout n'est pas confirme par un gros volume.");
  if (lines.length===0) lines.push("Aucun signal de vigilance majeur. Reste vigilant sur le chart (Bull Flag, volume du breakout).");
  return lines.join("\n\n");
}

function parseGroups(raw) {
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const sectors = [];
  for (const ln of lines) {
    const parts = ln.split(/\t+|\s{2,}/).map(p=>p.trim()).filter(Boolean);
    if (parts.length < 5) continue;
    let idx = 0;
    if (/^[0-9]+$/.test(parts[0])) idx = 1;
    const name = parts[idx];
    if (!name || /perf|name|volume/i.test(name)) continue;
    const nums = parts.slice(idx+1).map(p=>{
      const m = p.match(/(-?[0-9]+(?:\.[0-9]+)?)%/);
      return m ? parseFloat(m[1]) : null;
    }).filter(x=>x!==null);
    if (nums.length < 3) continue;
    // Finviz Groups: Perf Week, Perf Month, Perf Quart, Perf Half, Perf Year, Perf YTD, AvgVol, RelVol, Change...
    // Change (1 jour) = avant-dernier nombre si beaucoup de colonnes, sinon on prend nums[2] en repli
    const oneDay = nums.length >= 9 ? nums[8] : (nums.length>=7 ? nums[nums.length-1] : null);
    // Rel Volume = le ratio (sans %) qui suit immediatement l'Avg Volume (un nombre en B/M/K)
    let relVol = null;
    const allm = [...ln.matchAll(/(-?[0-9]+(?:\.[0-9]+)?)(%|B|M|K)?/g)];
    for (let k=1;k<allm.length;k++){
      const prevSuf = allm[k-1][2];
      const curSuf = allm[k][2];
      if ((prevSuf==="B"||prevSuf==="M"||prevSuf==="K") && !curSuf){
        relVol = parseFloat(allm[k][1]); break;
      }
    }
    // Avg Volume = 1er nombre en B/M/K ; Volume (du jour) = dernier nombre en B/M/K
    const volNums = allm.filter(m=>m[2]==="B"||m[2]==="M"||m[2]==="K");
    const toM = (m)=> m[2]==="B"?parseFloat(m[1])*1000 : m[2]==="K"?parseFloat(m[1])/1000 : parseFloat(m[1]);
    const avgVol = volNums.length>=1 ? toM(volNums[0]) : null;
    const volume = volNums.length>=2 ? toM(volNums[volNums.length-1]) : null;
    sectors.push({ name, week: nums[0], month: nums[1], quart: nums[2], oneDay, relVol, avgVol, volume });
  }
  return sectors;
}

function parseStockList(txt) {
  // Vue "Performance" Finviz, format vertical (1 valeur par ligne) OU tabulaire.
  // Colonnes: No Ticker Week Month Quart Half YTD Year 3Y 5Y 10Y VolW VolM AvgVol RelVol Price Change Volume
  const lines = txt.split(/\r?\n/).map(l=>l.trim());
  const rows = [];
  const toVol = (x)=>{ if(!x) return null; const u=String(x).slice(-1); let v=parseFloat(String(x).replace(/,/g,'')); if(u==='B')v*=1000; if(u==='K')v/=1000; return isNaN(v)?null:v; };
  const toN = (x)=>{ if(x==null) return null; const v=parseFloat(String(x).replace('%','').replace(/,/g,'')); return isNaN(v)?null:v; };
  // --- Format vertical : un ticker seul sur une ligne, suivi de ~17 valeurs ---
  let i=0;
  while(i<lines.length){
    if(/^[A-Z]{1,5}$/.test(lines[i]) && /^-?[0-9]/.test(lines[i+1]||'')){
      const v=[]; let j=i+1;
      while(j<lines.length && v.length<17 && /^-?[0-9.,]+%?$|^-$|^[0-9.,]+[BMK]$/.test(lines[j])){ v.push(lines[j]); j++; }
      if(v.length>=15){
        rows.push({ ticker:lines[i], week:toN(v[0]), month:toN(v[1]), quart:toN(v[2]),
          volWk:toN(v[9]), volMo:toN(v[10]), avgVol:toVol(v[11]), relVol:toN(v[12]),
          price:toN(v[13]), change:toN(v[14]), volume:toVol(v[15]) });
        i=j; continue;
      }
    }
    i++;
  }
  // --- Format tabulaire fallback ---
  if(rows.length===0){
    for(const ln of lines){
      const t=ln.split(/\t|\s{2,}/).map(x=>x.trim()).filter(Boolean);
      if(t.length>=16 && /^[0-9]+$/.test(t[0]) && /^[A-Z]{1,5}$/.test(t[1])){
        rows.push({ ticker:t[1], week:toN(t[2]), month:toN(t[3]), quart:toN(t[4]),
          volWk:toN(t[11]), volMo:toN(t[12]), avgVol:toVol(t[13]), relVol:toN(t[14]),
          price:toN(t[15]), change:toN(t[16]), volume:toVol(t[17]) });
      }
    }
  }
  const seen=new Set(); return rows.filter(r=>{ if(seen.has(r.ticker))return false; seen.add(r.ticker); return true; });
}

function parseTechList(txt){
  // Vue Technical Finviz: No Ticker Beta ATR SMA20 SMA50 SMA200 52WHigh 52WLow RSI Price Change ChgOpen Gap Volume
  const lines = txt.split(/\r?\n/).map(l=>l.trim());
  const out = {};
  const toN=(x)=>{ if(x==null)return null; const v=parseFloat(String(x).replace('%','').replace(/,/g,'')); return isNaN(v)?null:v; };
  let i=0;
  while(i<lines.length){
    if(/^[A-Z]{1,5}$/.test(lines[i]) && /^-?[0-9]/.test(lines[i+1]||'')){
      const v=[]; let j=i+1;
      while(j<lines.length && v.length<14 && /^-?[0-9.,]+%?$|^-$/.test(lines[j])){ v.push(lines[j]); j++; }
      if(v.length>=13){
        out[lines[i]] = { beta:toN(v[0]), atr:toN(v[1]), sma20:toN(v[2]), sma50:toN(v[3]), sma200:toN(v[4]), high52:toN(v[5]), low52:toN(v[6]), rsi:toN(v[7]), price:toN(v[8]), change:toN(v[9]), chgOpen:toN(v[10]), gap:toN(v[11]) };
        i=j; continue;
      }
    }
    i++;
  }
  // tabulaire fallback
  if(Object.keys(out).length===0){
    for(const ln of lines){
      const t=ln.split(/\t|\s{2,}/).map(x=>x.trim()).filter(Boolean);
      if(t.length>=14 && /^[0-9]+$/.test(t[0]) && /^[A-Z]{1,5}$/.test(t[1])){
        out[t[1]]={ beta:toN(t[2]), atr:toN(t[3]), sma20:toN(t[4]), sma50:toN(t[5]), sma200:toN(t[6]), high52:toN(t[7]), low52:toN(t[8]), rsi:toN(t[9]), price:toN(t[10]), change:toN(t[11]), chgOpen:toN(t[12]), gap:toN(t[13]) };
      }
    }
  }
  return out;
}

function rankStocks(rows, tech) {
  // CONVERGENCE MOMENTUM x VOLATILITE (Pete). Il faut etre fort sur les DEUX axes.
  // Liquidite = filtre d'entree facon Pete (terrain institutionnel), pas un facteur de tri.
  return rows.map(r=>{
    const t = (tech && tech[r.ticker]) ? tech[r.ticker] : {};
    const price = r.price!=null?r.price : t.price;
    const change = r.change!=null?r.change : t.change;
    const why=[]; const flags=[];
    const dollarVol = (price!=null && r.volume!=null) ? price*r.volume : null;

    // ===== FILTRE LIQUIDITE (comme Pete: actions liquides/institutionnelles) =====
    let liquide = true;
    if(dollarVol!=null && dollarVol<1e9){ liquide=false; flags.push("hors terrain institutionnel (<$1B/j) — Pete exige des actions très liquides"); }
    else if(dollarVol!=null && dollarVol>=20e9){ why.push("liquidité massive ($"+(dollarVol/1e9).toFixed(0)+"B/j)"); }
    else if(dollarVol!=null && dollarVol>=5e9){ why.push("bonne liquidité institutionnelle ($"+(dollarVol/1e9).toFixed(1)+"B/j)"); }

    // ===== SCORE MOMENTUM (0-100) — le mois mene =====
    let mom=0;
    // 1 MOIS = le coeur (poids le plus fort)
    if(r.month!=null){ if(r.month>60)mom+=42; else if(r.month>40)mom+=36; else if(r.month>25)mom+=27; else if(r.month>12)mom+=16; else mom+=6; }
    // 5 JOURS = acceleration recente (determine si l'accumulation CONTINUE)
    let accelere = false;
    if(r.month!=null && r.week!=null){ const ry=r.month/4.3; if(r.week>=ry*1.05){mom+=16;accelere=true;} else if(r.week>0){mom+=7;} else {mom-=12;flags.push("5j NÉGATIF — momentum cassé");} }
    else if(r.week!=null && r.week>0){ mom+=7; accelere=true; }
    // 3 MOIS = ancrage de solidite, MAIS conditionnel a l'acceleration recente (sinon = trop tard)
    if(r.quart!=null){
      if(accelere){
        // l'accumulation continue : le 3 mois confirme la solidite = bonus plein
        if(r.quart>100)mom+=18; else if(r.quart>50)mom+=13; else if(r.quart>20)mom+=8; else mom+=2;
        if(r.quart>50) why.push("tendance solide (3M +"+r.quart+"%) + accélération = accumulation en cours");
      } else {
        // 3 mois fort MAIS momentum recent qui faiblit = signal "trop tard"
        if(r.quart>150){ mom+=2; flags.push("3M +"+r.quart+"% mais 5j ne suit plus — possible TROP TARD (accumulation finie)"); }
        else if(r.quart>50){ mom+=5; }
        else mom+=2;
      }
    }
    if(t.chgOpen!=null){ if(t.chgOpen>=5)mom+=14; else if(t.chgOpen>=2)mom+=9; else if(t.chgOpen>0)mom+=3; else {mom-=8;flags.push("clôture sous l'ouverture");} }
    if(r.relVol!=null){ if(r.relVol>=1.8)mom+=6; else if(r.relVol>=1.2)mom+=3; }
    if(change!=null && change<0){ mom-=5; }
    mom = Math.max(0, Math.min(100, mom));
    if(r.month!=null && r.month>40) why.push("LEADER du mois (+"+r.month+"%/21j)");
    if(t.chgOpen!=null && t.chgOpen>=2) why.push("Change from Open +"+t.chgOpen+"% (carburant Pete)");

    // ===== SCORE VOLATILITE (0-100) — amplitude de mouvement =====
    let vol=0;
    const atrPct = (t.atr!=null && price!=null && price>0) ? (t.atr/price*100) : null;
    if(atrPct!=null){ if(atrPct>=8)vol+=55; else if(atrPct>=6)vol+=45; else if(atrPct>=4)vol+=32; else if(atrPct>=2.5)vol+=18; else vol+=6; }
    else vol+=25; // pas d'ATR fourni: neutre
    if(t.beta!=null){ if(t.beta>=3.5)vol+=45; else if(t.beta>=2.5)vol+=38; else if(t.beta>=1.5)vol+=28; else if(t.beta>=1)vol+=15; else vol+=4; }
    else vol+=20;
    vol = Math.max(0, Math.min(100, vol));
    if(atrPct!=null && atrPct>=6) why.push("forte amplitude (ATR "+atrPct.toFixed(1)+"%/j)");
    if(t.beta!=null && t.beta>=1.5) why.push("Beta "+t.beta+" (volatil)");

    // ===== CONVERGENCE : moyenne geometrique (il faut les DEUX forts) =====
    let score = Math.round(Math.sqrt(mom*vol));
    if(!liquide) score = Math.round(score*0.55); // relegue les non-institutionnels facon Pete
    if(mom<35) flags.push("momentum insuffisant");
    if(vol<35) flags.push("volatilité insuffisante (bouge peu)");

    return { ...r, ...t, price, change, score, mom:Math.round(mom), vol:Math.round(vol), why, flags, dollarVol, liquide };
  }).sort((a,b)=>b.score-a.score);
}

function analyseGroups(sectors) {
  if (!sectors.length) return null;
  const byMonth = [...sectors].sort((a,b)=>b.month-a.month);
  // regime risk-on/off
  const def = sectors.find(s=>/defensive/i.test(s.name));
  const tech = sectors.find(s=>/technolog/i.test(s.name));
  let regime = "NEUTRE";
  if (tech && def) {
    if (tech.month > def.month + 3) regime = "RISK-ON";
    else if (def.month > tech.month + 3) regime = "RISK-OFF";
  }
  // FLUX par secteur (lecture 21j + 5j + 1j ensemble, comme Pete)
  const maxAbs = Math.max(...byMonth.map(s=>Math.abs(s.month)), 1);
  const enriched = byMonth.map(s => {
    const rythme = s.month/3; // rythme hebdo theorique sur 21j
    const oneDay = s.oneDay!=null ? s.oneDay : 0;
    let flux, code, dir;
    // direction court terme
    if (s.week > rythme*1.05) dir = "up";
    else if (s.week < rythme*0.6) dir = "down";
    else dir = "flat";
    if (s.month >= 2) {
      // secteur en tendance de fond positive
      if (dir==="up" && oneDay >= 0) { flux="ACCUMULATION"; code="acc"; }
      else { flux="ESSOUFFLEMENT"; code="ess"; }
    } else if (s.month <= -4) {
      flux = (oneDay < -0.5 && s.week < 0) ? "CAPITULATION" : "DISTRIBUTION";
      code = "dist";
      // mais si le court terme repasse nettement positif sur un fond tres negatif = rotation entrante
      if (s.week > 0 && oneDay > 0) { flux="ROTATION ENTRANTE"; code="rot"; }
    } else {
      // fond faible/neutre (-4 a +2)
      if (s.week > 0.5) { flux="ROTATION ENTRANTE"; code="rot"; }
      else if (s.week < -1) { flux="DISTRIBUTION"; code="dist"; }
      else if (Math.abs(s.month) < 0.3) { flux="SANS FLUX"; code="dead"; }
      else { flux="CONSOLIDATION"; code="cons"; }
    }
    const barLen = Math.round((Math.abs(s.month)/maxAbs)*8);
    return { ...s, flux, code, dir, bar: barLen };
  }).map((s,i)=>({ ...s, rank: i+1 }));
  const buy = enriched.filter(s=>s.code==="acc");
  const watch = enriched.filter(s=>s.code==="rot");
  const avoid = enriched.filter(s=>s.code==="dist");
  return { byMonth, enriched, regime, buy, watch, avoid };
}

function sectorOfTicker(f, groups) {
  if (!groups || !f.sector) return null;
  const g = groups.byMonth.find(s=>s.name.toLowerCase().includes(f.sector.toLowerCase()) || f.sector.toLowerCase().includes(s.name.toLowerCase()));
  if (!g) return null;
  const rank = groups.byMonth.indexOf(g)+1;
  return { ...g, rank, total: groups.byMonth.length };
}

function convictionScore(f, secInfo, s1passed, s1total, s2passed, s2total) {
  let score = 0;
  // Secteur (25 pts) — le filtre n1 de Pete
  if (secInfo) { if (secInfo.rank<=3) score+=25; else if (secInfo.rank<=6) score+=10; }
  // Technique Pete (25 pts) — proportionnel
  score += Math.round((s1passed/s1total)*25);
  // Fondamental Minervini (25 pts)
  const fondPassed = s2passed - s1passed;
  const fondTotal = s2total - s1total;
  if (fondTotal>0) score += Math.round((fondPassed/fondTotal)*25);
  // Smart money / qualite (25 pts)
  let sm = 0;
  if (f.instTrans!==null && f.instTrans>0) sm+=7;
  if (f.epsSurpr!==null && f.salesSurpr!==null && f.epsSurpr>0 && f.salesSurpr>0) sm+=7;
  if (f.change!==null && f.change>=2) sm+=6;
  if (f.rsi!==null && f.rsi<70) sm+=5;
  score += sm;
  if (score>100) score=100;
  let label, color;
  if (score>=85) { label="CONVICTION TRES FORTE"; color="#34d399"; }
  else if (score>=70) { label="CONVICTION FORTE"; color="#a3e635"; }
  else if (score>=55) { label="CONVICTION MOYENNE"; color="#fbbf24"; }
  else { label="CONVICTION FAIBLE"; color="#f87171"; }
  return { score, label, color };
}

function InsideCandleSVG() {
  return (
    <svg viewBox="0 0 320 210" style={{width:"100%", height:"auto", background:"#0a0e16", borderRadius:8, border:"1px solid #1a2230"}}>
      <line x1="55" y1="50" x2="300" y2="50" stroke="#475569" strokeWidth="1" strokeDasharray="4,3" />
      <line x1="55" y1="150" x2="300" y2="150" stroke="#475569" strokeWidth="1" strokeDasharray="4,3" />
      <text x="240" y="46" fill="#94a3b8" fontSize="7.5">HAUT mere</text>
      <text x="240" y="162" fill="#94a3b8" fontSize="7.5">BAS mere</text>
      <line x1="80" y1="50" x2="80" y2="150" stroke="#34d399" strokeWidth="1.5" />
      <rect x="68" y="65" width="24" height="75" fill="#34d399" rx="2" />
      <text x="58" y="178" fill="#34d399" fontSize="8" fontWeight="bold">1. MERE</text>
      <line x1="150" y1="78" x2="150" y2="122" stroke="#fbbf24" strokeWidth="1.5" />
      <rect x="138" y="88" width="24" height="26" fill="#fbbf24" rx="2" />
      <text x="120" y="178" fill="#fbbf24" fontSize="8" fontWeight="bold">2. INSIDE</text>
      <text x="106" y="190" fill="#64748b" fontSize="6.5">(contenue dans la mere)</text>
      <line x1="220" y1="25" x2="220" y2="70" stroke="#22d3ee" strokeWidth="1.5" />
      <rect x="208" y="32" width="24" height="50" fill="#22d3ee" rx="2" />
      <text x="184" y="178" fill="#22d3ee" fontSize="8" fontWeight="bold">3. BREAKOUT</text>
      <text x="244" y="40" fill="#22d3ee" fontSize="7" fontWeight="bold">ENTREE</text>
      <text x="244" y="50" fill="#64748b" fontSize="6.5">cloture + volume</text>
      <line x1="128" y1="122" x2="175" y2="122" stroke="#f87171" strokeWidth="1.3" />
      <text x="92" y="125" fill="#f87171" fontSize="6.5" fontWeight="bold">STOP</text>
    </svg>
  );
}

function BullFlagSVG() {
  return (
    <svg viewBox="0 0 320 200" style={{width:"100%", height:"auto", background:"#0a0e16", borderRadius:8, border:"1px solid #1a2230"}}>
      <line x1="20" y1="180" x2="60" y2="80" stroke="#34d399" strokeWidth="3" />
      <text x="22" y="195" fill="#34d399" fontSize="8" fontWeight="bold">LE MAT</text>
      <line x1="60" y1="80" x2="130" y2="100" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,2" />
      <line x1="60" y1="100" x2="130" y2="120" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,2" />
      <polyline points="60,80 75,108 90,92 105,116 120,100 130,110" fill="none" stroke="#1f3864" strokeWidth="2.5" />
      <text x="68" y="138" fill="#38bdf8" fontSize="8" fontWeight="bold">DRAPEAU</text>
      <text x="62" y="148" fill="#64748b" fontSize="6.5">(volume baisse)</text>
      <circle cx="130" cy="110" r="5" fill="#d4af37" stroke="#1f3864" strokeWidth="1.5" />
      <line x1="130" y1="110" x2="200" y2="30" stroke="#34d399" strokeWidth="3" />
      <text x="160" y="35" fill="#34d399" fontSize="8" fontWeight="bold">BREAKOUT</text>
      <text x="158" y="45" fill="#64748b" fontSize="6.5">(gros volume)</text>
      <line x1="130" y1="110" x2="130" y2="30" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4,3" />
      <text x="135" y="60" fill="#d4af37" fontSize="7.5" fontWeight="bold">OBJECTIF</text>
      <text x="135" y="70" fill="#d4af37" fontSize="6.5">= hauteur</text>
      <text x="135" y="79" fill="#d4af37" fontSize="6.5">du mat</text>
      <line x1="60" y1="130" x2="230" y2="130" stroke="#f87171" strokeWidth="1.3" strokeDasharray="2,2" />
      <text x="232" y="133" fill="#f87171" fontSize="7" fontWeight="bold">STOP</text>
    </svg>
  );
}

function Row({ c }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", borderBottom:"1px solid #1e293b"}}>
      <span style={{fontSize:9, color: c.ok?TEXT2:TEXT_DIM}}>{c.ok?"✅":"❌"} {c.label}</span>
      <span style={{fontSize:8.5, color: c.ok?GREEN:RED, fontWeight:700}}>{c.detail}</span>
    </div>
  );
}

function Accordion({ icon, titre, color, open, setOpen, children }) {
  return (
    <div style={{marginBottom:7, background:"#0a1018", borderRadius:8, border:"1px solid #1a2230", overflow:"hidden"}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", cursor:"pointer"}}>
        <span style={{fontSize:10, color:color, fontWeight:800, letterSpacing:0.5}}>{icon} {titre}</span>
        <span style={{fontSize:11, color:color}}>{open?"▲":"▼"}</span>
      </div>
      {open && <div style={{padding:"0 12px 12px 12px", fontSize:9, color:TEXT, lineHeight:1.65, whiteSpace:"pre-wrap"}}>{children}</div>}
    </div>
  );
}

function StockAnalyseView() {
  const [raw, setRaw] = useState("");
  const [ticker, setTicker] = useState("");
  const [groupsRaw, setGroupsRaw] = useState("");
  const [groupsRes, setGroupsRes] = useState(null);
  const [openGroups, setOpenGroups] = useState(false);
  const [selSector, setSelSector] = useState(null);
  const [listRaw, setListRaw] = useState("");
  const [techRaw, setTechRaw] = useState("");
  const [listRes, setListRes] = useState(null);
  const [openList, setOpenList] = useState(false);
  const [res, setRes] = useState(null);
  const [a1,setA1]=useState(false),[a2,setA2]=useState(false),[a3,setA3]=useState(false),
        [a4,setA4]=useState(false),[a5,setA5]=useState(false),[a6,setA6]=useState(false),
        [a7,setA7]=useState(false),[a8,setA8]=useState(false),[a9,setA9]=useState(false),
        [a10,setA10]=useState(false),[a11,setA11]=useState(false);

  const scanGroups = () => {
    if (!groupsRaw.trim()) { setGroupsRes(null); return; }
    const sectors = parseGroups(groupsRaw);
    setGroupsRes(analyseGroups(sectors));
  };
  const analyzeList = () => {
    if (!listRaw.trim()) { setListRes(null); return; }
    const rows = parseStockList(listRaw);
    const tech = techRaw.trim() ? parseTechList(techRaw) : null;
    setListRes(rankStocks(rows, tech));
  };

  const run = () => {
    if (!raw.trim()) { setRes({error:"Colle d'abord le tableau de stats Finviz de l'action."}); return; }
    const { ticker: tk, f } = analyse(raw, ticker);
    const secInfo = sectorOfTicker(f, groupsRes);
    const tech = checksTechnique(f);
    const s1passed = tech.filter(c=>c.ok).length;
    const s1total = tech.length;
    const fond = checksFondamental(f);
    const s2all = [...tech, ...fond];
    const s2passed = s2all.filter(c=>c.ok).length;
    const s2total = s2all.length;
    const conviction = convictionScore(f, secInfo, s1passed, s1total, s2passed, s2total);
    setRes({
      ticker: tk, f, tech, fond, secInfo, conviction,
      s1passed, s1total, s2passed, s2total,
      these: autoThese(f, 2, secInfo), vig: autoVigilance(f), valo: valorisation(f),
    });
  };

  return (
    <div style={{maxWidth:540, margin:"0 auto", padding:"0 4px"}}>
      <div style={{textAlign:"center", marginBottom:10}}>
        <div style={{fontSize:15, color:PURPLE, fontWeight:900, letterSpacing:1.5, marginBottom:5}}>📊 STOCK ANALYSE</div>
        <div style={{fontSize:9, color:PURPLE+"aa", fontWeight:700, letterSpacing:1}}>SECTEUR → 2 SCREENERS → BULL FLAG · PETE + MINERVINI</div>
      </div>

      <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:10, padding:"8px 10px", background:"#0d0a18", borderRadius:8, border:"1px solid #2a1f3a"}}>
        Va sur <b style={{color:PURPLE}}>finviz.com/stock?t=TICKER</b>, copie le tableau de stats complet et colle-le ci-dessous. L'app analyse les <b style={{color:BLUE}}>2 screeners d'un coup</b> : Technique (Pete) + Technique & Fondamental (Minervini).
      </div>

      <div style={{marginBottom:10, background:"#0a1018", borderRadius:8, border:"1px solid #1a2230", overflow:"hidden"}}>
        <div onClick={()=>setOpenGroups(!openGroups)} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", cursor:"pointer"}}>
          <span style={{fontSize:10, color:GOLD, fontWeight:800, letterSpacing:0.5}}>🔄 1. SCAN SECTEURS (GROUPS) — à faire en premier</span>
          <span style={{fontSize:11, color:GOLD}}>{openGroups?"▲":"▼"}</span>
        </div>
        {openGroups && (
          <div style={{padding:"0 12px 12px 12px"}}>
            <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6, marginBottom:8}}>
              Va sur <b style={{color:GOLD}}>finviz.com/groups</b> (Sector, trié par Perf Month), copie le tableau et colle-le ici.
            </div>
            <textarea value={groupsRaw} onChange={e=>setGroupsRaw(e.target.value)} placeholder="Colle le tableau Groups Finviz (Name, Perf Week, Perf Month, Perf Quart...)"
              style={{width:"100%", minHeight:70, background:"#0a0a12", color:TEXT2, border:"1px solid #2a1f3a", borderRadius:8, padding:10, fontSize:8.5, fontFamily:"monospace", boxSizing:"border-box", marginBottom:8}} />
            <button onClick={scanGroups} style={{width:"100%", padding:"9px", background:GOLD, color:"#1a1505", border:"none", borderRadius:8, fontSize:11, fontWeight:900, letterSpacing:0.5, cursor:"pointer"}}>📊 SCANNER LES SECTEURS</button>
            <a href="https://finviz.com/groups?g=sector&v=140&o=-perf4w" target="_blank" rel="noreferrer" style={{display:"block", textAlign:"center", fontSize:9, color:GOLD, marginTop:6}}>🔗 Ouvrir Groups Finviz ↗</a>
            {groupsRes && (
              <div style={{marginTop:10}}>
                <div style={{padding:"8px 10px", borderRadius:8, marginBottom:8, textAlign:"center", background: groupsRes.regime==="RISK-ON"?"#052010":groupsRes.regime==="RISK-OFF"?"#200505":"#1a1500", border:"1px solid "+(groupsRes.regime==="RISK-ON"?GREEN:groupsRes.regime==="RISK-OFF"?RED:AMBER)+"55"}}>
                  <span style={{fontSize:11, fontWeight:800, color: groupsRes.regime==="RISK-ON"?GREEN:groupsRes.regime==="RISK-OFF"?RED:AMBER}}>
                    {groupsRes.regime==="RISK-ON"?"🟢 RISK-ON — cycliques mènent":groupsRes.regime==="RISK-OFF"?"🔴 RISK-OFF — défensifs mènent":"🟡 RÉGIME NEUTRE"}
                  </span>
                </div>

                {/* TABLEAU UNIQUE — flux par secteur */}
                <div style={{padding:"8px 8px", background:"#0a1018", borderRadius:8, marginBottom:8, border:"1px solid #1a2230"}}>
                  <div style={{fontSize:7, color:TEXT_DIM, marginBottom:4, fontStyle:"italic"}}>👆 Tape un secteur pour voir le détail · 🔥 = volume institutionnel élevé</div>
                  <div style={{display:"flex", fontSize:7, color:TEXT_DIM, fontWeight:700, padding:"0 0 4px 0", borderBottom:"1px solid #1a2230"}}>
                    <span style={{flex:0.4}}>#</span>
                    <span style={{flex:2}}>SECTEUR</span>
                    <span style={{flex:1.6, textAlign:"right"}}>21j</span>
                    <span style={{flex:1, textAlign:"right"}}>5j</span>
                    <span style={{flex:0.9, textAlign:"right"}}>1j</span>
                    <span style={{flex:2, textAlign:"right"}}>FLUX</span>
                  </div>
                  {groupsRes.enriched.map((s,i)=>{
                    const fc = s.code==="acc"?GREEN : s.code==="rot"?AMBER : s.code==="dist"?RED : s.code==="ess"?"#fb923c" : TEXT_DIM;
                    const emoji = s.code==="acc"?"💰" : s.code==="rot"?"🌱" : s.code==="dist"?"🩸" : s.code==="ess"?"⏸" : s.code==="dead"?"💤":"➡️";
                    const arrow = s.dir==="up"?"▲":s.dir==="down"?"▼":"─";
                    const hot = s.relVol!=null && s.relVol>=1.8;
                    const open = selSector===s.name;
                    return (
                      <div key={i} style={{borderBottom:"1px solid #141c28"}}>
                        <div onClick={()=>setSelSector(open?null:s.name)} style={{display:"flex", alignItems:"center", padding:"3px 0", cursor:"pointer"}}>
                          <span style={{flex:0.4, fontSize:7, color:TEXT_DIM}}>{s.rank}</span>
                          <span style={{flex:2, fontSize:8, color:TEXT2}}>{s.name}{hot?" 🔥":""}</span>
                          <span style={{flex:1.6, textAlign:"right", display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3}}>
                            <span style={{display:"inline-block", height:5, width:(s.bar*3)+"px", background:fc, borderRadius:2}}></span>
                            <span style={{fontSize:8, color:fc, fontWeight:700}}>{s.month>0?"+":""}{s.month}%</span>
                          </span>
                          <span style={{flex:1, textAlign:"right", fontSize:7.5, color: s.dir==="up"?GREEN:s.dir==="down"?RED:TEXT_DIM}}>{arrow}{s.week>0?"+":""}{s.week}</span>
                          <span style={{flex:0.9, textAlign:"right", fontSize:7.5, color:(s.oneDay!=null&&s.oneDay<0)?RED:TEXT_DIM}}>{s.oneDay!=null?(s.oneDay>0?"+":"")+s.oneDay:"—"}</span>
                          <span style={{flex:2, textAlign:"right", fontSize:7, color:fc, fontWeight:700}}>{emoji} {s.flux}</span>
                        </div>
                        {open && (
                          <div style={{padding:"6px 8px 8px 8px", fontSize:7.5, color:TEXT, lineHeight:1.6, background:"#0d1420", borderRadius:6, marginBottom:4}}>
                            <div style={{color:fc, fontWeight:700, marginBottom:3}}>{emoji} {s.flux} — rang #{s.rank}/{groupsRes.enriched.length}</div>
                            <div style={{marginBottom:3}}>📅 21j <b>{s.month>0?"+":""}{s.month}%</b> (fond) · 📆 5j <b>{s.week>0?"+":""}{s.week}%</b> (direction) · ☀️ 1j <b>{s.oneDay!=null?(s.oneDay>0?"+":"")+s.oneDay+"%":"—"}</b> (pouls)</div>
                            <div style={{marginBottom:3, color:TEXT_DIM}}>{s.relVol!=null?"🔊 RelVol "+s.relVol+"x":""}{s.avgVol!=null?" · 📊 Vol moy "+(s.avgVol>=1000?(s.avgVol/1000).toFixed(2)+"B":s.avgVol.toFixed(0)+"M"):""}{s.volume!=null?" · 📈 Vol jour "+(s.volume>=1000?(s.volume/1000).toFixed(2)+"B":s.volume.toFixed(0)+"M"):""}{s.avgVol!=null&&s.volume!=null?" ("+(s.volume/s.avgVol>=1.2?"⬆ "+(s.volume/s.avgVol).toFixed(1)+"x la moyenne, forte participation":s.volume/s.avgVol<0.8?"⬇ sous la moyenne, peu d'intérêt":"≈ normal")+")":""}</div>
                            <div style={{color:TEXT_DIM}}>{
                              s.code==="acc" ? "Les 3 horizons alignes a la hausse : le smart money charge ce secteur. CHASSE tes actions ici — courant porteur maximal." :
                              s.code==="ess" ? "Fond solide mais le court terme ralentit (ou jour rouge). La hausse se fatigue. Ne chasse pas, attends que ca se confirme." :
                              s.code==="rot" ? "Less bearish : le fond est faible mais le 5j repasse positif. Premiers capitaux qui reviennent. WATCHLIST, pas encore d'achat." :
                              s.code==="dist" ? "Le flux se tarit, le smart money sort. Meme une belle action ici nage a contre-courant. EVITE." :
                              s.code==="dead" ? "Aucun flux directionnel net. Secteur sans interet institutionnel pour l'instant." :
                              "Range neutre, pas de direction claire."
                            }{hot?" 🔥 RelVol eleve = activite institutionnelle inhabituelle aujourd'hui.":""}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3 BLOCS D'ACTION */}
                {groupsRes.buy.length>0 && (
                  <div style={{padding:"7px 10px", background:"#052010", borderRadius:8, marginBottom:5, border:"1px solid #14321f"}}>
                    <div style={{fontSize:9, color:GREEN, fontWeight:800}}>💰 CHASSE ICI — {groupsRes.buy.map(s=>s.name).join(" · ")}</div>
                  </div>
                )}
                {groupsRes.watch.length>0 && (
                  <div style={{padding:"7px 10px", background:"#1a1500", borderRadius:8, marginBottom:5, border:"1px solid "+AMBER+"44"}}>
                    <div style={{fontSize:9, color:AMBER, fontWeight:800}}>🌱 SURVEILLE — {groupsRes.watch.map(s=>s.name).join(" · ")}</div>
                  </div>
                )}
                {groupsRes.avoid.length>0 && (
                  <div style={{padding:"7px 10px", background:"#200505", borderRadius:8, border:"1px solid #3a1f1f"}}>
                    <div style={{fontSize:9, color:RED, fontWeight:800}}>🩸 ÉVITE — {groupsRes.avoid.map(s=>s.name).join(" · ")}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== CLASSEMENT ACTIONS (suivre la liquidite) ===== */}
        <div style={{marginTop:14, border:"1px solid #2a3441", borderRadius:12, overflow:"hidden"}}>
          <div onClick={()=>setOpenList(!openList)} style={{padding:"12px 14px", background:"#10141c", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <span style={{fontSize:12, fontWeight:800, color:GOLD}}>🏦 2. CLASSER MES ACTIONS — suivre la liquidité</span>
            <span style={{color:GOLD}}>{openList?"▲":"▼"}</span>
          </div>
          {openList && (
            <div style={{padding:"12px 14px", background:"#0a0e16"}}>
              <div style={{fontSize:9, color:TEXT_DIM, marginBottom:8, lineHeight:1.5}}>Colle la liste de ton screener Finviz (vue Performance). L'app classe tes actions du PLUS au MOINS institutionnel : force de fond, accélération 5j/21j/1j, volume en dollars (smart money), et pénalise les actions sur-étendues qu'il est trop tard pour chasser.</div>
              <div style={{fontSize:8.5, color:GOLD, marginBottom:3, fontWeight:700}}>① Vue PERFORMANCE</div>
              <textarea value={listRaw} onChange={e=>setListRaw(e.target.value)} placeholder="Colle la vue Performance (Ticker, Perf Week, Month, Quart... Price, Change, Volume)" style={{width:"100%", minHeight:70, background:"#070a10", color:TEXT, border:"1px solid #2a3441", borderRadius:8, padding:8, fontSize:9, fontFamily:"monospace", boxSizing:"border-box"}} />
              <div style={{fontSize:8.5, color:GOLD, margin:"8px 0 3px", fontWeight:700}}>② Vue TECHNICAL (optionnel mais recommandé — Beta, ATR, SMA, 52W High, Change from Open, RSI)</div>
              <textarea value={techRaw} onChange={e=>setTechRaw(e.target.value)} placeholder="Colle la vue Technical (Ticker, Beta, ATR, SMA20/50/200, 52W High, RSI, Price, Change, Change from Open, Gap, Volume)" style={{width:"100%", minHeight:70, background:"#070a10", color:TEXT, border:"1px solid #2a3441", borderRadius:8, padding:8, fontSize:9, fontFamily:"monospace", boxSizing:"border-box"}} />
              <button onClick={analyzeList} style={{width:"100%", marginTop:8, padding:"11px", background:GOLD, color:"#0a0e16", border:"none", borderRadius:8, fontSize:12, fontWeight:800, cursor:"pointer"}}>🏦 CLASSER LES ACTIONS</button>

              {listRes && listRes.length>0 && (
                <div style={{marginTop:12}}>
                  <div style={{fontSize:9, color:TEXT_DIM, marginBottom:6}}>{listRes.length} actions classées — ordre de qualité institutionnelle (suis la liquidité de haut en bas) :</div>
                  {listRes.map((r,i)=>{
                    const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+".";
                    const sc = r.score>=70?GREEN : r.score>=45?AMBER : r.score>=25?"#fb923c" : RED;
                    return (
                      <div key={i} style={{padding:"8px 10px", background:i<3?"#0d1a12":"#0d1420", borderRadius:8, marginBottom:5, border:"1px solid "+(i<3?"#16331f":"#1a2230")}}>
                        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                          <span style={{fontSize:12, fontWeight:800, color:TEXT}}>{medal} {r.ticker}</span>
                          <span style={{fontSize:8, color:TEXT_DIM}}>${r.price!=null?r.price:"?"} · {r.dollarVol!=null?"$"+(r.dollarVol/1e9).toFixed(1)+"B échangés":""}</span>
                          <div style={{display:"flex", alignItems:"center", gap:5}}>
                            <div style={{width:50, height:6, background:"#1a2230", borderRadius:3, overflow:"hidden"}}><div style={{width:r.score+"%", height:"100%", background:sc}}></div></div>
                            <span style={{fontSize:10, fontWeight:800, color:sc}}>{r.score}</span>
                          </div>
                        </div>
                        <div style={{display:"flex", gap:8, marginTop:3, marginBottom:1}}>
                          <span style={{fontSize:7.5, color:r.mom>=60?GREEN:r.mom>=35?AMBER:RED, fontWeight:700}}>⚡ Momentum {r.mom}</span>
                          <span style={{fontSize:7.5, color:r.vol>=60?GREEN:r.vol>=35?AMBER:RED, fontWeight:700}}>🌊 Volatilité {r.vol}</span>
                          <span style={{fontSize:7, color:TEXT_DIM}}>(convergence = {r.score})</span>
                        </div>
                        <div style={{fontSize:7.5, color:TEXT_DIM, marginTop:0}}>21j <b style={{color:r.month>0?GREEN:RED}}>{r.month>0?"+":""}{r.month}%</b> · 5j <b style={{color:r.week>0?GREEN:RED}}>{r.week>0?"+":""}{r.week}%</b> · 1j <b style={{color:r.change>0?GREEN:RED}}>{r.change>0?"+":""}{r.change}%</b> · 3M {r.quart>0?"+":""}{r.quart}%{r.relVol!=null?" · RelVol "+r.relVol+"x":""}</div>
                        {(r.chgOpen!=null||r.high52!=null||r.atr!=null||r.rsi!=null||r.beta!=null) && (
                          <div style={{fontSize:7.5, color:TEXT_DIM, marginTop:2}}>{r.chgOpen!=null?"ChgOpen "+(r.chgOpen>0?"+":"")+r.chgOpen+"%":""}{r.high52!=null?" · à "+r.high52+"% du 52WH":""}{r.atr!=null?" · ATR "+r.atr:""}{r.beta!=null?" · β"+r.beta:""}{r.rsi!=null?" · RSI "+r.rsi:""}</div>
                        )}
                        {r.why.length>0 && <div style={{fontSize:7.5, color:GREEN, marginTop:2}}>✓ {r.why.slice(0,2).join(" · ")}</div>}
                        {r.flags.length>0 && <div style={{fontSize:7.5, color:AMBER, marginTop:2}}>⚠ {r.flags.slice(0,2).join(" · ")}</div>}
                      </div>
                    );
                  })}
                  <div style={{fontSize:7.5, color:TEXT_DIM, marginTop:6, fontStyle:"italic"}}>⚠️ Vérifie le secteur de chaque action dans ton scan ci-dessus : ne chasse que celles dont le secteur est en 💰 ACCUMULATION. Pas un conseil financier.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input value={ticker} onChange={e=>setTicker(e.target.value)} placeholder="⚠️ TICKER OBLIGATOIRE (ex: ENTG, ALAB, RSI...)"
        style={{width:"100%", background:"#0a0a12", color:"#c084fc", border:"1px solid #2a1f3a", borderRadius:8, padding:"9px 10px", fontSize:12, fontWeight:800, letterSpacing:1, fontFamily:"monospace", boxSizing:"border-box", marginBottom:8, textTransform:"uppercase"}} />
      <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Colle ici le tableau de stats Finviz (Price, ATR, Beta, EPS Q/Q, SMA200...)"
        style={{width:"100%", minHeight:90, background:"#0a0a12", color:TEXT2, border:"1px solid #2a1f3a", borderRadius:8, padding:10, fontSize:9, fontFamily:"monospace", boxSizing:"border-box", marginBottom:8}} />

      <button onClick={run} style={{width:"100%", padding:"11px", background:PURPLE, color:"#1a0a2a", border:"none", borderRadius:8, fontSize:12, fontWeight:900, letterSpacing:1, cursor:"pointer", marginBottom:6}}>⚡ ANALYSER</button>
      <a href="https://finviz.com/screener.ashx" target="_blank" rel="noreferrer" style={{display:"block", textAlign:"center", fontSize:9, color:PURPLE, marginBottom:14}}>🔍 Ouvrir Finviz ↗</a>

      {res?.error && <div style={{fontSize:9, color:AMBER, padding:"10px 12px", background:"#1a1500", borderRadius:8, lineHeight:1.5}}>{res.error}</div>}

      {res?.ticker && (() => {
        const s1pct = Math.round(res.s1passed/res.s1total*100);
        const s2pct = Math.round(res.s2passed/res.s2total*100);
        const verdictOf = (passed, total) => passed===total ? {t:"✅ VALIDÉ", c:GREEN, bg:"#052010"} : (total-passed)===1 ? {t:"❌ 1 manque", c:AMBER, bg:"#1a1500"} : {t:"❌ NON", c:RED, bg:"#200505"};
        const v1 = verdictOf(res.s1passed, res.s1total);
        const v2 = verdictOf(res.s2passed, res.s2total);
        return (
        <div>
          <div style={{textAlign:"center", marginBottom:10}}>
            <div style={{fontSize:18, color:TEXT2, fontWeight:900}}>{res.ticker}</div>
            {res.secInfo ? (
              <div style={{display:"inline-block", marginTop:4, padding:"3px 10px", borderRadius:20, fontSize:9, fontWeight:800,
                background: res.secInfo.rank<=3?"#052010":"#200505",
                color: res.secInfo.rank<=3?GREEN:RED,
                border:"1px solid "+(res.secInfo.rank<=3?GREEN:RED)+"55"}}>
                {res.secInfo.rank<=3?"✅":"❌"} {res.secInfo.name} · #{res.secInfo.rank}/{res.secInfo.total} secteurs
              </div>
            ) : (
              <div style={{display:"inline-block", marginTop:4, padding:"3px 10px", borderRadius:20, fontSize:9, fontWeight:700, background:"#1a1500", color:AMBER, border:"1px solid "+AMBER+"44"}}>
                ℹ️ Scanne les SECTEURS (en haut) pour valider la tendance
              </div>
            )}
          </div>

          <div style={{display:"flex", gap:8, marginBottom:12}}>
            <div style={{flex:1, padding:"10px 8px", background:v1.bg, borderRadius:10, border:"1px solid "+v1.c+"55", textAlign:"center"}}>
              <div style={{fontSize:9, color:BLUE, fontWeight:800, marginBottom:3}}>⚙️ S1 · TECHNIQUE</div>
              <div style={{fontSize:11, color:v1.c, fontWeight:800}}>{v1.t}</div>
              <div style={{fontSize:9, color:TEXT_DIM, marginTop:2}}>{res.s1passed}/{res.s1total} ({s1pct}%)</div>
            </div>
            <div style={{flex:1, padding:"10px 8px", background:v2.bg, borderRadius:10, border:"1px solid "+v2.c+"55", textAlign:"center"}}>
              <div style={{fontSize:9, color:GREEN, fontWeight:800, marginBottom:3}}>📈 S2 · TECH + FONDA</div>
              <div style={{fontSize:11, color:v2.c, fontWeight:800}}>{v2.t}</div>
              <div style={{fontSize:9, color:TEXT_DIM, marginTop:2}}>{res.s2passed}/{res.s2total} ({s2pct}%)</div>
            </div>
          </div>

          {res.conviction && (
            <div style={{padding:"12px 14px", background:"#0a0e16", borderRadius:10, marginBottom:12, border:"1px solid "+res.conviction.color+"44"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
                <span style={{fontSize:10, color:res.conviction.color, fontWeight:800, letterSpacing:0.5}}>🎯 SCORE DE CONVICTION</span>
                <span style={{fontSize:18, color:res.conviction.color, fontWeight:900}}>{res.conviction.score}<span style={{fontSize:11, color:TEXT_DIM}}>/100</span></span>
              </div>
              <div style={{height:8, background:"#1a2230", borderRadius:4, overflow:"hidden", marginBottom:5}}>
                <div style={{height:"100%", width:res.conviction.score+"%", background:res.conviction.color, borderRadius:4}}></div>
              </div>
              <div style={{fontSize:9, color:res.conviction.color, fontWeight:700, textAlign:"center"}}>{res.conviction.label}</div>
              <div style={{fontSize:7.5, color:"#64748b", textAlign:"center", marginTop:4, lineHeight:1.4}}>Secteur 25 · Technique 25 · Fondamental 25 · Smart money 25</div>
            </div>
          )}

          <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10}}>
            <div style={{fontSize:10, color:BLUE, fontWeight:700, marginBottom:6}}>⚙️ TECHNIQUE — base Pete (Screener 1)</div>
            {res.tech.map((c,i)=><Row key={i} c={c} />)}
          </div>

          <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10}}>
            <div style={{fontSize:10, color:GREEN, fontWeight:700, marginBottom:6}}>📈 FONDAMENTAL — couche Minervini (Screener 2)</div>
            {res.fond.map((c,i)=><Row key={i} c={c} />)}
          </div>

          <div style={{padding:"10px 12px", background:"#0a1810", borderRadius:8, marginBottom:10, border:"1px solid #14321f"}}>
            <div style={{fontSize:10, color:GREEN, fontWeight:700, marginBottom:6}}>🧠 THÈSE — POURQUOI LE SMART MONEY EST LÀ</div>
            <div style={{fontSize:9, color:TEXT, lineHeight:1.65, whiteSpace:"pre-wrap"}}>{res.these}</div>
          </div>

          <div style={{padding:"10px 12px", background:"#1a1500", borderRadius:8, marginBottom:10, border:"1px solid #3a2a1f"}}>
            <div style={{fontSize:10, color:AMBER, fontWeight:700, marginBottom:6}}>⚠️ VIGILANCE</div>
            <div style={{fontSize:9, color:TEXT, lineHeight:1.65, whiteSpace:"pre-wrap"}}>{res.vig}</div>
          </div>

          {res.valo && (
            <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10, border:"1px solid #1a2a3a"}}>
              <div style={{fontSize:10, color:BLUE, fontWeight:700, marginBottom:8}}>💰 VALORISATION — 4 MÉTHODES</div>
              {res.valo.methodes.map((m,i)=>(
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #1e293b"}}>
                  <span style={{fontSize:8.5, color:TEXT_DIM}}>{m.nom} <span style={{color:"#475569"}}>({m.calc})</span></span>
                  <span style={{fontSize:9, color:BLUE, fontWeight:700}}>${m.cible}</span>
                </div>
              ))}
              {res.valo.low && <div style={{fontSize:9, color:TEXT2, marginTop:6}}>Fourchette : <b style={{color:GREEN}}>${res.valo.low}</b> — <b style={{color:GREEN}}>${res.valo.high}</b></div>}
            </div>
          )}

          {res.valo && (
            <div style={{padding:"10px 12px", background:"#0a1220", borderRadius:8, marginBottom:10, border:"1px solid #1a2a3a"}}>
              <div style={{fontSize:10, color:PURPLE, fontWeight:700, marginBottom:8}}>🎯 3 SCÉNARIOS</div>
              {res.valo.scenarios.map((s,i)=>(
                <div key={i} style={{marginBottom:7}}>
                  <div style={{display:"flex", justifyContent:"space-between"}}>
                    <span style={{fontSize:10, color:s.c, fontWeight:800}}>{s.nom} — ${s.prix} <span style={{color:TEXT_DIM, fontWeight:400}}>(P/E {s.pe})</span></span>
                  </div>
                  <div style={{fontSize:8, color:TEXT_DIM, lineHeight:1.4}}>{s.hyp}</div>
                </div>
              ))}
              {res.valo.rrBase && (
                <div style={{marginTop:6, padding:"7px 9px", background:"#0a1810", borderRadius:6}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
                    <span style={{fontSize:9, color:TEXT_DIM}}>R/R Base Case (réaliste)</span>
                    <span style={{fontSize:10, color: res.valo.rrBase>=3?GREEN:AMBER, fontWeight:800}}>{res.valo.rrBase}:1</span>
                  </div>
                  <div style={{display:"flex", justifyContent:"space-between"}}>
                    <span style={{fontSize:9, color:TEXT_DIM}}>R/R Bull Case (optimiste)</span>
                    <span style={{fontSize:10, color: res.valo.rrBull>=3?GREEN:AMBER, fontWeight:800}}>{res.valo.rrBull}:1</span>
                  </div>
                  <div style={{fontSize:7.5, color:"#64748b", marginTop:4, lineHeight:1.4}}>Risque ${res.valo.risque} (stop ${res.valo.stop}) · gain Base ${res.valo.gainBase} / Bull ${res.valo.gainBull}. {res.valo.rrBase>=3?"✅ Base Case respecte le 3:1.":"⚠️ Base Case sous 3:1 — le Bull Case doit justifier l'entrée."}</div>
                </div>
              )}
            </div>
          )}

          {res.f.price && (
            <div style={{padding:"10px 12px", background:"#13100a", borderRadius:8, marginBottom:12, border:"1px solid "+GOLD+"44"}}>
              <div style={{fontSize:10, color:GOLD, fontWeight:700, marginBottom:6}}>🚩 PLAN BULL FLAG (WEEKLY)</div>
              <div style={{fontSize:9, color:TEXT, lineHeight:1.7}}>
                <b style={{color:GOLD}}>Entrée :</b> cassure du haut du drapeau sur bougie weekly forte + gros volume.{"\n"}
                <b style={{color:RED}}>Stop :</b> sous le bas du drapeau (~${(res.f.price*0.92).toFixed(2)}, repère -8%).{"\n"}
                <b style={{color:GREEN}}>Objectif 1 :</b> projeter la hauteur du mât depuis le breakout.{"\n"}
                <b style={{color:BLUE}}>Objectif 2 :</b> affiner avec les niveaux de Fibonacci.
              </div>
              <div style={{marginTop:8, padding:"8px 10px", background:"#0a1810", borderRadius:6, border:"1px solid #14321f"}}>
                <div style={{fontSize:9, color:GREEN, fontWeight:800, marginBottom:4}}>✅ N'ENTRE QU'APRÈS CONFIRMATION (méthode Pete)</div>
                <div style={{fontSize:8.5, color:TEXT, lineHeight:1.6}}>
                  Ne devine pas le breakout — attends la PREUVE que les institutions ont acheté :{"\n"}
                  <b style={{color:GREEN}}>1. Clôture au-dessus</b> du niveau (pas juste une mèche qui retombe = ils ont tenu l'offre).{"\n"}
                  <b style={{color:GREEN}}>2. Volume ≥ 1.5-2x</b> la moyenne sur la bougie de cassure (les gros sont entrés, pas le retail).{"\n"}
                  <b style={{color:GREEN}}>3. Le retest tient</b> : le prix revient tester le niveau cassé et rebondit dessus (l'ancienne résistance devient support).{"\n"}
                  <span style={{color:TEXT_DIM, fontStyle:"italic"}}>Patience : Pete attend ~15 min après l'ouverture que le marché révèle sa direction. Pas de FOMO.</span>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      <div style={{marginTop:16, marginBottom:6, fontSize:10, color:PURPLE, fontWeight:800, letterSpacing:1, textAlign:"center"}}>📚 LA MÉTHODE — PETE + MINERVINI</div>

      <Accordion icon="🏛️" titre="LES 2 SCREENERS — POURQUOI DEUX" color={BLUE} open={a1} setOpen={setA1}>
{`Les deux sont également valables — ils font deux jobs complémentaires.

SCREENER 1 — TECHNIQUE PUR (Pete) : approche complète et autosuffisante. Rotation sectorielle + momentum + smart money. 11 filtres (Price>$15, Vol>2M, ATR>1.5, Beta>1, Change from Open +2%, 20-Day High, SMA50>SMA200, Price>SMA200...). Sort des trades explosifs à elle seule.

SCREENER 2 — TECH + FONDAMENTAL (Pete + Minervini) : la même base technique, PLUS la couche fondamentale (EPS This Y/Next Y/QoQ >25%, Sales QoQ >25%, Both Positive, Inst Own >10%). Minervini ajoute du pouce — une dimension de conviction.`}
      </Accordion>

      <Accordion icon="🔄" titre="ROTATION SECTORIELLE TOP-DOWN" color={GREEN} open={a2} setOpen={setA2}>
{`La smart money déplace d'énormes capitaux d'un secteur à l'autre. Approche descendante (Pete) :

1. MACRO — Groups Finviz, Performance. Trie par "Month" (= 21 jours de bourse). Identifie le secteur n°1.
2. MESO — Dans ce secteur, trouve l'industrie qui domine.
3. MICRO — Isole les 10-15 leaders de cette industrie.

Regarde sur 1 mois ET 3 mois : un secteur top sur les deux = leadership confirmé. On ne trade QUE dans les secteurs en tête — comme Pete.`}
      </Accordion>

      <Accordion icon="🌊" titre="LIRE LE FLOW INSTITUTIONNEL (5j / 21j / 1j)" color={GREEN} open={a11} setOpen={setA11}>
{`Le scan secteurs en haut classe les 11 secteurs comme le "Daily Ticker" de Pete. Voici comment LIRE le flux d'argent institutionnel a travers les 3 horizons, et pourquoi chacun compte.

━━━ LES 3 HORIZONS ET LEUR PSYCHOLOGIE ━━━

📅 21 JOURS (1 mois) — LA TENDANCE DE FOND
C'est la colonne MAITRESSE, celle qui classe le tableau. Un fonds institutionnel met des SEMAINES a batir une position (il ne peut pas acheter des milliards d'un coup sans faire exploser le prix). Le 21j revele cette accumulation lente et lourde. Un secteur fort sur 21j = le smart money y est deja installe. C'est la fondation.

📆 5 JOURS (1 semaine) — LA DIRECTION RECENTE
Le 5j dit si la tendance ACCELERE ou RALENTIT. On le compare au rythme du 21j : un mois a +9% = environ +3%/semaine en rythme normal. Si le 5j fait MIEUX que ce rythme -> l'argent afflue encore plus vite (acceleration). S'il fait moins -> le flux se tarit (essoufflement). C'est le signal d'alerte precoce.

☀️ 1 JOUR (aujourd'hui) — LE POULS
Le 1j confirme que le secteur est encore vivant AUJOURD'HUI. Un secteur fort sur 21j et 5j mais ROUGE aujourd'hui = prudence, le momentum cale a l'instant T. C'est le filtre final avant d'acheter : on n'entre pas un jour ou le secteur saigne.

━━━ COMMENT LIRE LE FLUX (la logique de Pete) ━━━

💰 ACCUMULATION = 21j fort + 5j accelere + 1j positif
Les 3 alignes a la hausse. Le smart money charge MAINTENANT. C'est ICI qu'on chasse nos actions. Risque minimal, courant porteur maximal.

⏸ ESSOUFFLEMENT = 21j fort MAIS 5j ralentit ou 1j negatif
La fondation tient mais le flux faiblit. Pete dirait : ne chasse pas, la hausse se fatigue. On attend ou on surveille.

🌱 ROTATION ENTRANTE = 21j faible/negatif MAIS 5j repasse positif
Le fameux "less bearish" de Pete : avant d'etre haussier, un secteur devient d'abord MOINS baissier. Les premiers capitaux reviennent en douce. On met en WATCHLIST — pas encore d'achat, mais on prepare.

🩸 DISTRIBUTION / CAPITULATION = 21j qui faiblit + 5j negatif
Le smart money SORT. Meme une belle action de ce secteur nage a contre-courant. On EVITE totalement.

━━━ LEQUEL CHOISIR POUR UN TRADE ━━━

La regle d'or de Pete : "Start with the sector. Find the leaders."
1. On achete UNIQUEMENT dans les secteurs 💰 ACCUMULATION (les 3 horizons alignes).
2. Pourquoi c'est crucial : 3 actions sur 4 suivent leur secteur. Une action geniale dans un secteur en DISTRIBUTION va galerer ; une action moyenne dans un secteur en ACCUMULATION sera portee par le flux institutionnel.
3. Les fonds ne peuvent pas tout acheter : ils concentrent sur les 3-5 meilleurs secteurs. Si ton action est dans un de ces secteurs, tu surfes sur LEURS milliards.

En resume : le secteur d'abord, l'action ensuite. Le flux institutionnel se lit dans la convergence des 3 horizons. Pas de secteur fort = pas de trade.`}
      </Accordion>

      <Accordion icon="⚡" titre="LE CHANGE FROM OPEN +2% — LE CARBURANT" color={AMBER} open={a3} setOpen={setA3}>
{`Le critère le plus puissant de Pete pour mesurer l'implication institutionnelle DANS la journée.

Change from Open = (Clôture − Ouverture) / Ouverture × 100. Critère : >= +2%.

Si une action ne fait que monter depuis l'ouverture jusqu'à clôturer +2%, la Smart Money a "tenu l'offre" et acheté toute la journée. Ça crée de grosses bougies vertes pleines — le "Fuel".

Bougie pleine = accumulation continue. Gap qui retombe = faux signal.`}
      </Accordion>

      <Accordion icon="🎯" titre="LE CLUSTER SECTORIEL — SIGNAL ULTIME" color={PURPLE} open={a4} setOpen={setA4}>
{`Quand plusieurs actions de la MÊME industrie sortent ensemble dans ton scan (ex: 3-4 semi-conducteurs), c'est la preuve que les institutions accumulent tout le groupe.

Exemple : un scan qui sort ALAB, MU, CRDO, SNDK, ENTG, TSM — presque tous semi-conducteurs = rotation institutionnelle majeure.

Comment l'exploiter : repère l'industrie la plus représentée, confirme dans Groups (1m + 3m), croise avec le Screener 2, prends position sur les 2-4 meilleurs Bull Flags du cluster.`}
      </Accordion>

      <Accordion icon="📈" titre="BOTH POSITIVE SURPRISE — EFFET CASCADE" color={GREEN} open={a5} setOpen={setA5}>
{`Ce filtre mesure la SURPRISE vs les attentes des analystes.

EPS seul : l'entreprise coupe ses coûts pour battre les EPS mais les ventes déçoivent. Faible.
Revenue seul : ventes surprennent mais bénéfices déçoivent. Marges. Ambigu.
BOTH POSITIVE : bat SIMULTANÉMENT EPS et ventes = croissance réelle. Le plus puissant.

L'effet cascade : (1) les algos détectent, (2) les analystes relèvent leurs cibles, (3) les fonds augmentent l'allocation, (4) le prix monte 10-30%.`}
      </Accordion>

      <Accordion icon="🚩" titre="LE BULL FLAG EN WEEKLY — TON ENTRÉE" color={GOLD} open={a6} setOpen={setA6}>
<div style={{marginBottom:10}}><BullFlagSVG /></div>
{`Ton entrée se fait sur un Bull Flag (drapeau haussier), surtout en WEEKLY (position trading, semaines à mois).

LE MÂT : forte hausse initiale, quasi verticale (le carburant).
LE DRAPEAU : consolidation en pente légèrement descendante, encadrée par 2 droites parallèles. Le volume DIMINUE.
LE BREAKOUT : cassure de la droite haute sur GROS volume weekly.

Plan : Entrée à la cassure. Stop sous le drapeau. Objectif = hauteur du mât projetée depuis le breakout, affinée avec Fibonacci.

Pourquoi weekly : filtre le bruit, le volume hebdo confirme l'engagement institutionnel.`}
      </Accordion>

      <Accordion icon="🕯️" titre="L'INSIDE CANDLE — LE SETUP DE PETE" color={PURPLE} open={a10} setOpen={setA10}>
<div style={{marginBottom:10}}><InsideCandleSVG /></div>
{`L'inside candle est le signal d'entrée court terme de Pete Renzulli. Attention : Finviz ne le donne PAS — tu le repères à l'oeil sur le chart.

QU'EST-CE QUE C'EST ?
Une bougie dont le range (haut ET bas) est entierement CONTENU dans la bougie precedente (la "bougie mere"). Le marche fait une pause, il se comprime. Sur le schema ci-dessus : la bougie jaune (inside) tient entierement entre le haut et le bas de la grande bougie verte.

POURQUOI C'EST PUISSANT ?
La compression = les vendeurs s'epuisent, l'energie s'accumule. Quand le prix CASSE le haut de la bougie mere sur volume -> mouvement explosif. C'est le mini-equivalent du Bull Flag, mais sur 1-2 bougies.

LA RECETTE COMPLETE DE PETE :
1. INSIDE CANDLE = le setup (compression, point d'entree net)
2. ATR = mesure la volatilite pour placer ton stop et ton objectif au bon endroit
3. PATIENCE = attends ~15 min apres l'ouverture que le marche revele sa direction. Ne saute jamais dans les 2 premieres minutes (FOMO = tu achetes le plus haut).
4. BEST IDEA ONLY = ne trade QUE ta meilleure idee du jour. Pas 10 trades mediocres — 1 seul trade A+.

LES FOOTPRINTS DU SMART MONEY (ce que Pete cherche) :
- Accumulation silencieuse : montee par paliers reguliers, jamais en explosion.
- Pullbacks rachetes : chaque repli est immediatement absorbe (les fonds defendent leurs niveaux).
- Cloture dans le haut de la bougie : ils ont tenu l'offre toute la journee.
- Volume sur les hausses, faible sur les baisses : signature de l'accumulation.`}
      </Accordion>

      <Accordion icon="🏦" titre="COMMENT LES FONDS ANALYSENT" color={BLUE} open={a7} setOpen={setA7}>
{`Les fonds (BlackRock, Vanguard, Fidelity, T. Rowe...) gèrent des milliards avec des analystes inaccessibles au public.

Ils ne peuvent pas tout mettre sur une action : ils achètent les 3-5 meilleures d'un secteur en rotation. Si tu détiens une action de qualité d'un secteur en rotation, tu bénéficies de leurs flux d'achat.

Ils achètent progressivement sur plusieurs semaines pour ne pas faire monter le prix — c'est ce qui crée la consolidation (le drapeau). Inst. Trans positif = ils accumulent maintenant.`}
      </Accordion>

      <Accordion icon="🛡️" titre="GESTION DU RISQUE — RÈGLES ABSOLUES" color={RED} open={a8} setOpen={setA8}>
{`Minervini : "Les gagnants coupent leurs pertes vite et laissent courir leurs gains."

• Stop Loss : -7 à -8% sous l'entrée, sans exception.
• Ratio R/R : minimum 3:1. Stop -8% = objectif minimum +24%.
• Taille position : max 10-15% du portefeuille sur une action.
• Nombre de positions : 5 à 10 max.
• Ne jamais moyenner à la baisse.
• Trailing stop : quand +20-30%, remonte ton stop.
• Marché baissier : réduis l'exposition / passe en cash.`}
      </Accordion>

      <Accordion icon="📅" titre="LA ROUTINE QUOTIDIENNE" color={AMBER} open={a9} setOpen={setA9}>
{`CHAQUE SEMAINE (week-end / lundi) :
• Groups Finviz : classe les secteurs sur 1m et 3m. Top 3 confirmé.
• Fore vers l'industrie dominante.

CHAQUE MATIN :
• Screener 1 (Pete) : repère les CLUSTERS.
• Screener 2 (Minervini) : croise pour la couche fondamentale.
• Analyse les charts weekly : cherche les Bull Flags. Note la droite haute.
• Pose tes alertes sur le niveau de breakout.

AVANT CHAQUE ENTRÉE — 4 questions :
1. Secteur dans le top 1m + 3m ?
2. Cluster (plusieurs actions de l'industrie) ?
3. Bull Flag weekly prêt à casser sur gros volume ?
4. R/R >= 3:1 avec mon stop ?`}
      </Accordion>

      <div style={{fontSize:8, color:TEXT_DIM, textAlign:"center", marginTop:14, marginBottom:8, lineHeight:1.5}}>
        ⚠️ Document éducatif. Pas un conseil financier.{"\n"}Création Patrice Bonneau · Méthode Pete + Minervini
      </div>
    </div>
  );
}

export default StockAnalyseView;
