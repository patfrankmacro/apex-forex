import re

path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup13", 'w') as f:
    f.write(c)

pattern = r'\{view==="trade" && \(.*?\n      \)\}'
match = re.search(pattern, c, re.DOTALL)
if match:
    NEW = '{view==="trade" && (\n        <TradeApex data={data} cotData={apexCot} retailData={apexRetail} />\n      )}'
    c = c[:match.start()] + NEW + c[match.end():]
    print("Bloc trade remplacé OK")
else:
    print("ERREUR - debug:")
    idx = c.find('view==="trade"')
    print(repr(c[idx:idx+400]))

with open(path, 'w') as f:
    f.write(c)

print("Patch4 terminé")
