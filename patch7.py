path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup16", 'w') as f:
    f.write(c)

# Ajouter debug info dans le rendu TradeApex quand trades.length === 0
OLD = '''      {trades.length === 0 && (
        <div style={{padding:24,textAlign:"center",background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e"}}>
          <div style={{fontSize:12,color:"#4a5070",marginBottom:4}}>Aucun signal APEX actif</div>
          <div style={{fontSize:9,color:"#2a2a3e"}}>Les 3 conditions doivent être alignées</div>
        </div>
      )}'''

NEW = '''      {trades.length === 0 && (
        <div style={{padding:16,background:"#08080f",borderRadius:8,border:"1px solid #1a1a2e"}}>
          <div style={{fontSize:12,color:"#4a5070",marginBottom:8,textAlign:"center"}}>Aucun signal APEX actif</div>
          <div style={{fontSize:9,color:"#00aaff",marginBottom:4}}>DEBUG:</div>
          <div style={{fontSize:8,color:"#4a5070",lineHeight:2}}>
            Paires analysées: {SENT_PAIRS.length}<br/>
            COT keys: {Object.keys(cotData).length}<br/>
            Retail keys: {Object.keys(retailData).length}<br/>
            Data devises: {Object.keys(data).filter(k=>hasData(data,k)).join(", ") || "AUCUNE"}<br/>
            {SENT_PAIRS.slice(0,3).map(p=>{
              const rB = getRegime(data,p.base);
              const rQ = getRegime(data,p.quote);
              return p.name+": "+( rB?rB.label:"noReg")+" vs "+(rQ?rQ.label:"noReg");
            }).join(" | ")}
          </div>
        </div>
      )}'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Debug ajouté OK")
else:
    print("ERREUR: bloc pas trouvé")

with open(path, 'w') as f:
    f.write(c)

print("Patch7 terminé")
