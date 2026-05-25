path = '/data/data/com.termux/files/home/apex-forex/src/App.jsx'
with open(path, 'r') as f:
    c = f.read()

# 1. FIX ALLPAIRS — ajouter filtre régime obligatoire + stocker strongIsBase
old_regime = '''      const perfect=regS&&regW&&["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)&&["RECESSION","STAGFLATION"].includes(regW.label);
      // ── CROISEMENT MACRO + SENTIMENT ──────────────────────────────────
      const sentPair = SENT_PAIRS.find(p =>'''

new_regime = '''      const perfect=regS&&regW&&["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)&&["RECESSION","STAGFLATION"].includes(regW.label);
      // Filtre strict: seulement bonne économie vs mauvaise économie
      if (!regS || !regW) continue;
      if (!["GOLDILOCKS","SURCHAUFFE"].includes(regS.label)) continue;
      if (!["RECESSION","STAGFLATION"].includes(regW.label)) continue;
      // ── CROISEMENT MACRO + SENTIMENT ──────────────────────────────────
      const sentPair = SENT_PAIRS.find(p =>'''

c = c.replace(old_regime, new_regime)

# Stocker strongIsBase dans sentSig
c = c.replace(
    '          if (aligned) sentSig = raw;',
    '          if (aligned) sentSig = {...raw, strongIsBase};'
)

# 2. REMPLACER TradeCard complet
new_tc = '''function TradeCard({ strong, weak, div, regS, regW, perfect, sentSig }) {
  const [open, setOpen] = useState(false);
  const pairName = getPairName(strong.code, weak.code);
  const strongFirst = PAIR_ORDER.indexOf(strong.code) <= PAIR_ORDER.indexOf(weak.code);
  const dirColor = strongFirst ? "#00ff88" : "#ff3b3b";
  const dirLabel = strongFirst ? "LONG " + pairName : "SHORT " + pairName;
  const rA = sentSig?.rA;
  const pCot = sentSig?.pCot;
  const strongCOT = sentSig?.strongIsBase ? pCot?.base : pCot?.quote;
  const weakCOT   = sentSig?.strongIsBase ? pCot?.quote : pCot?.base;
  const isBothEx  = sentSig?.bothExtreme;

  return (
    <div style={{ marginBottom:10, borderRadius:6, overflow:"hidden",
      border:`1px solid ${isBothEx?"#00ff8866":sentSig?.color+"44"}` }}>

      {/* HEADER */}
      <div onClick={() => setOpen(o=>!o)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
          cursor:"pointer", background: isBothEx?"#001a0d":BG2,
          borderLeft:`3px solid ${sentSig?.color||BORDER}` }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontSize:14, fontWeight:700, color:TEXT, fontFamily:"'IBM Plex Mono'", letterSpacing:2 }}>{pairName}</span>
            {isBothEx && <span style={{ fontSize:8, color:"#00ff88", border:"1px solid #00ff8844", borderRadius:2, padding:"2px 7px", letterSpacing:1 }}>🔥 SETUP PARFAIT</span>}
          </div>
          <div style={{ fontSize:9, color:TEXT_DIM }}>
            {strong.flag} {strong.code} <span style={{ color:regS?.color }}>{regS?.label}</span> {"vs"} {weak.flag} {weak.code} <span style={{ color:regW?.color }}>{regW?.label}</span>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:12, fontWeight:700, color:dirColor, fontFamily:"'IBM Plex Mono'", marginBottom:2 }}>{dirLabel}</div>
          <div style={{ fontSize:9, color:TEXT_DIM }}>Div: +{(div*100).toFixed(0)}pts</div>
        </div>
        <span style={{ fontSize:9, color:TEXT_DIM }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ background:"#06060e", borderTop:`1px solid ${BORDER}`, padding:12 }}>

          {/* MACRO */}
          <div style={{ fontSize:8, color:"#a855f7", letterSpacing:2, fontWeight:700, marginBottom:8 }}>▸ DIVERGENCE MACRO</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            {[{curr:strong,reg:regS,side:"LONG — ACHÈTE"},{curr:weak,reg:regW,side:"SHORT — VENDS"}].map(({curr,reg,side})=>(
              <div key={curr.code} style={{ padding:10, background:reg?.bg||BG, borderRadius:4, border:`1px solid ${reg?.border||BORDER}44` }}>
                <div style={{ fontSize:8, color:reg?.color||TEXT_DIM, letterSpacing:2, marginBottom:6 }}>{side}</div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT }}>{curr.flag} {curr.code}</div>
                <div style={{ fontSize:11, color:reg?.color||TEXT_DIM, marginTop:4, fontWeight:700 }}>{reg?.icon} {reg?.label}</div>
                <div style={{ fontSize:9, color:TEXT_DIM, marginTop:2 }}>Score: {curr.score>=0?"+":""}{curr.score.toFixed(3)}</div>
              </div>
            ))}
          </div>

          {/* RETAIL */}
          {rA && (
            <div style={{ background:"#070b14", borderRadius:6, padding:10, marginBottom:8,
              borderLeft:`2px solid ${rA.bias==="HAUSSIER"?"#4ade80":"#f87171"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontSize:8, color:"#475569", letterSpacing:1 }}>RETAIL — MYFXBOOK</div>
                <div style={{ fontSize:9, fontWeight:700, color:rA.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                  Contrarian: {rA.bias} {rA.strength==="EXTREME"?"⚠":""}
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:5 }}>
                <span style={{ color:"#4ade80", fontWeight:700 }}>LONG {rA.lp}%</span>
                <span style={{ color:"#f87171", fontWeight:700 }}>SHORT {rA.sp}%</span>
              </div>
              <div style={{ height:6, background:"#f87171", borderRadius:3, overflow:"hidden", marginBottom:5 }}>
                <div style={{ width:rA.lp+"%", height:"100%", background:"#4ade80" }}/>
              </div>
              <div style={{ fontSize:8, color:"#64748b" }}>
                {rA.bias==="HAUSSIER"
                  ? rA.sp+"% retail SHORT (extrême) → contrarian fort: ACHETER"
                  : rA.lp+"% retail LONG (extrême) → contrarian fort: VENDRE"}
              </div>
            </div>
          )}

          {/* COT */}
          {pCot && strongCOT && weakCOT && (
            <div style={{ background:"#070b14", borderRadius:6, padding:10, marginBottom:8,
              borderLeft:`2px solid ${pCot.bias==="HAUSSIER"?"#4ade80":"#f87171"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:8, color:"#475569", letterSpacing:1 }}>COT INSTITS — {strong.code} vs {weak.code}</div>
                <div style={{ fontSize:9, fontWeight:700, color:pCot.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                  Instits: {pCot.bias} {pCot.strength==="EXTREME"?"⚠":""}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:6 }}>
                {[{curr:strong,cot:strongCOT},{curr:weak,cot:weakCOT}].map(({curr,cot})=>(
                  <div key={curr.code}>
                    <div style={{ fontSize:8, color:"#475569", marginBottom:3 }}>
                      {curr.flag} {curr.code} — P{cot?.pct}%
                    </div>
                    <div style={{ height:5, background:"#1e3a5f", borderRadius:2, position:"relative", marginBottom:3 }}>
                      <div style={{ position:"absolute", left:0, width:"10%", height:"100%", background:"#4ade8033" }}/>
                      <div style={{ position:"absolute", right:0, width:"10%", height:"100%", background:"#f8717133" }}/>
                      <div style={{ position:"absolute", left:(cot?.pct||50)+"%", top:-2, width:2, height:9,
                        background:cot?.bias==="HAUSSIER"?"#4ade80":"#f87171", transform:"translateX(-50%)" }}/>
                    </div>
                    <div style={{ fontSize:8, color:cot?.bias==="HAUSSIER"?"#4ade80":"#f87171" }}>
                      {cot?.bias} — {cot?.strength}
                    </div>
                    <div style={{ fontSize:7, color:"#475569", marginTop:1 }}>Net: {cot?.net>=0?"+":""}{cot?.net?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:8, color:"#64748b" }}>
                Base P{strongCOT?.pct}% vs Quote P{weakCOT?.pct}% (spread {pCot.spread>0?"+":""}{pCot.spread}pts)
              </div>
            </div>
          )}

          {/* ACTION FINALE */}
          <div style={{ padding:"12px 14px", background:sentSig?.bg||BG2, borderRadius:4,
            border:`1px solid ${sentSig?.color||BORDER}88` }}>
            <div style={{ fontSize:8, color:sentSig?.color, letterSpacing:2, marginBottom:6, fontWeight:700 }}>
              CONVERGENCE MACRO + SENTIMENT
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:dirColor, fontFamily:"'IBM Plex Mono'", marginBottom:5 }}>
              {dirLabel}
            </div>
            <div style={{ fontSize:10, color:sentSig?.color, marginBottom:5 }}>{sentSig?.label}</div>
            <div style={{ fontSize:9, color:"#94a3b8" }}>
              Retail: {sentSig?.retailStrength} | COT: {sentSig?.cotStrength} | Div: +{(div*100).toFixed(0)}pts
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
'''

# Remplacer TradeCard entre sa signature et DataView
parts = c.split('function TradeCard(')
if len(parts) == 2:
    before = parts[0]
    rest = parts[1]
    end_idx = rest.find('\nfunction DataView(')
    after = rest[end_idx:]
    c = before + new_tc + after
    print("TradeCard remplacé OK")
else:
    print("ERREUR: TradeCard pas trouvé")

with open(path, 'w') as f:
    f.write(c)

print("Patch2 terminé!")
