path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup14", 'w') as f:
    f.write(c)

OLD = '  const [connected, setConnected] = useState(false);'
NEW = '''  const [connected, setConnected] = useState(false);
  const [apexCot, setApexCot]       = useState({});
  const [apexRetail, setApexRetail] = useState({});'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("useState apexCot/apexRetail ajoutés OK")
else:
    print("ERREUR: ligne connected pas trouvée")

with open(path, 'w') as f:
    f.write(c)

print("Patch5 terminé")
