path = "/data/data/com.termux/files/home/apex-forex/api/myfxbook.js"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup", 'w') as f:
    f.write(c)

OLD = '''    url = `https://www.myfxbook.com/api/get-community-outlook.json?session=${encodeURIComponent(session)}`;'''
NEW = '''    url = `https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`;'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("Fix double encodage API OK")
else:
    print("ERREUR: ligne pas trouvée")
    print(repr(c))

with open(path, 'w') as f:
    f.write(c)

print("Patch13 terminé")
