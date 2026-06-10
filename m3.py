with open('src/App.jsx','r') as f: c=f.read()
old = '''          strongRank: sRank[strongCur], weakRank: sRank[weakCur], strengthLen: nStr});'''
new = '''          strongRank: sRank[strongCur], weakRank: sRank[weakCur], strengthLen: nStr,
          inTop: f4ok, weakRepeat, strongRepeat});'''
n=c.count(old); print("push_f4:",n)
if n==1: c=c.replace(old,new)
with open('src/App.jsx','w') as f: f.write(c)
print("=== ok")
