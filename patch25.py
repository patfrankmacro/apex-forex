import re
path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()
with open(path + ".backup32", 'w') as f:
    f.write(c)

# Remplacer les usages de .flag dans le JSX par FlagImg
replacements = [
    # ligne 322
    ('{curr.flag}', '<FlagImg code={curr.code} size={18} />'),
    # ligne 467
    ('{curr.flag} {curr.code}', '<FlagImg code={curr.code} size={16} /> {curr.code}'),
    # ligne 513
    ('{curr.flag} {curr.code} — P{cot?.pct}%', '<FlagImg code={curr.code} size={14} /> {curr.code} — P{cot?.pct}%'),
    # ligne 575
    ('{c.flag} {c.code}', '<FlagImg code={c.code} size={16} /> {c.code}'),
    # ligne 580
    ('{curr.flag} {curr.code} — {curr.label} ({curr.bc})', '<FlagImg code={curr.code} size={18} /> {curr.code} — {curr.label} ({curr.bc})'),
    # TradeApex baseFlag/quoteFlag
    ('{t.baseFlag}{t.quoteFlag}', '<FlagImg code={t.base} size={18} /><FlagImg code={t.quote} size={18} />'),
    # ligne 448 strong/weak flags
    ('{strong.flag} {strong.code}', '<FlagImg code={strong.code} size={16} /> {strong.code}'),
    ('{weak.flag} {weak.code}', '<FlagImg code={weak.code} size={16} /> {weak.code}'),
]

for old, new in replacements:
    if old in c:
        c = c.replace(old, new)
        print(f"✓ Remplacé: {old[:40]}")
    else:
        print(f"✗ Pas trouvé: {old[:40]}")

# Aussi dans RankView - ligne 1184 area
c = c.replace('{c.flag}\n', '<FlagImg code={c.code} size={20} />\n')

with open(path, 'w') as f:
    f.write(c)
print("Patch25 terminé")
