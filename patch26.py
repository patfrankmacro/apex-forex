import re
path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()
with open(path + ".backup33", 'w') as f:
    f.write(c)

# Fix ligne 891/896 - baseFlag/quoteFlag dans TradeApex (encore des emojis)
c = c.replace('{t.baseFlag} {t.base}', '<FlagImg code={t.base} size={14} /> {t.base}')
c = c.replace('{t.quoteFlag} {t.quote}', '<FlagImg code={t.quote} size={14} /> {t.quote}')
c = c.replace('{t.baseFlag} P{t.bPct}%', '<FlagImg code={t.base} size={12} /> P{t.bPct}%')
c = c.replace('{t.quoteFlag} P{t.qPct}%', '<FlagImg code={t.quote} size={12} /> P{t.qPct}%')

# Fix ligne 1184 - tableau
c = c.replace('<span style={{ marginRight:6 }}>{c.flag}</span>', '<FlagImg code={c.code} size={18} />')

# Fix ligne 1221 - rang
c = c.replace('<span style={{ fontSize:16 }}>{c.flag}</span>', '<FlagImg code={c.code} size={20} />')

print("App.jsx drapeaux fixés")

# Fix SentimentView.jsx - ajouter FlagImg
path2 = "/data/data/com.termux/files/home/apex-forex/src/SentimentView.jsx"
with open(path2, 'r') as f:
    c2 = f.read()
with open(path2 + ".backup2", 'w') as f:
    f.write(c2)

# Ajouter FlagImg dans SentimentView
FLAG_FUNC = '''function FlagImg({ code, size=18 }) {
  const map = {"EUR":"eu","GBP":"gb","JPY":"jp","CAD":"ca","AUD":"au","CHF":"ch","USD":"us","NZD":"nz","XAU":"un"};
  const cc = map[code] || code.toLowerCase().slice(0,2);
  return <img src={`https://flagcdn.com/w40/${cc}.png`} width={size} height={size*0.75} style={{borderRadius:2,objectFit:"cover",verticalAlign:"middle"}} alt={code} />;
}

'''

if 'function FlagImg' not in c2:
    c2 = c2.replace('function analyzeRetail', FLAG_FUNC + 'function analyzeRetail')
    print("FlagImg ajouté dans SentimentView")

# Remplacer les FLAG[base] et FLAG[quote] emojis par FlagImg
c2 = re.sub(r'\{FLAG\[(\w+)\]\|\|""\}', r'<FlagImg code={\1} size={16} />', c2)
c2 = re.sub(r'\{FLAG\[base\]\|\|""\}', r'<FlagImg code={base} size={16} />', c2)
c2 = re.sub(r'\{FLAG\[quote\]\|\|""\}', r'<FlagImg code={quote} size={16} />', c2)
c2 = re.sub(r'\{FLAG\[(\w+)\]\}', r'<FlagImg code={\1} size={16} />', c2)

# Fix régimes - axe de force (RégimesView) dans App.jsx
# Chercher où les régimes sont triés/affichés
print("SentimentView drapeaux fixés")

with open(path, 'w') as f:
    f.write(c)
with open(path2, 'w') as f:
    f.write(c2)

print("Patch26 terminé")
