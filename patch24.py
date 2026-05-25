path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup31", 'w') as f:
    f.write(c)

# Remplacer les emojis drapeaux par des images URL countryflags.io
FLAG_MAP = {
    "🇺🇸": "US", "🇪🇺": "EU", "🇨🇦": "CA", "🇨🇭": "CH",
    "🇦🇺": "AU", "🇯🇵": "JP", "🇬🇧": "GB", "🇳🇿": "NZ", "🇨🇳": "CN"
}

# Ajouter une fonction FlagImg dans le code
OLD = '''const BG = "#050508", BG2 = "#08080f", BG3 = "#0c0c18";'''

NEW = '''function FlagImg({ code, size=20 }) {
  const map = { "🇺🇸":"US","🇪🇺":"EU","🇨🇦":"CA","🇨🇭":"CH","🇦🇺":"AU","🇯🇵":"JP","🇬🇧":"GB","🇳🇿":"NZ","🇨🇳":"CN",
    "USD":"US","EUR":"EU","CAD":"CA","CHF":"CH","AUD":"AU","JPY":"JP","GBP":"GB","NZD":"NZ","CNY":"CN" };
  const cc = map[code] || code;
  return <img src={`https://flagcdn.com/w40/${cc.toLowerCase()}.png`} width={size} height={size*0.75} style={{borderRadius:2,objectFit:"cover",verticalAlign:"middle"}} alt={code} />;
}

const BG = "#050508", BG2 = "#08080f", BG3 = "#0c0c18";'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("FlagImg ajouté OK")
else:
    print("ERREUR: BG pas trouvé")

with open(path, 'w') as f:
    f.write(c)
print("Patch24 terminé - drapeaux à remplacer manuellement dans les composants")
