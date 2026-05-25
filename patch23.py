path = "/data/data/com.termux/files/home/apex-forex/src/App.jsx"
with open(path, 'r') as f:
    c = f.read()

with open(path + ".backup30", 'w') as f:
    f.write(c)

OLD = '''function getStrength(score) {
  if (score >= 0.30)  return { label: "FORT ↑",   color: "#00ff88", bg: "#001a0d" };
  if (score >= 0.08)  return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
  if (score <= -0.30) return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
  if (score <= -0.08) return { label: "MODÉRÉ ↓", color: "#ff8888", bg: "#110000" };
  return                     { label: "NEUTRE →", color: "#888899", bg: "#0a0a14" };
}'''

NEW = '''function getStrength(score, regime) {
  const weakRegimes = ["STAGFLATION","RÉCESSION"];
  const strongRegimes = ["GOLDILOCKS","SURCHAUFFE"];
  const regLabel = regime?.label || "";
  // Si régime faible → toujours rouge peu importe le score
  if (weakRegimes.includes(regLabel)) {
    if (score <= -0.30 || score >= 0.30) return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
    if (score <= -0.08 || score >= 0.08) return { label: "MODÉRÉ ↓", color: "#ff8888", bg: "#110000" };
    return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
  }
  // Si régime fort → toujours vert
  if (strongRegimes.includes(regLabel)) {
    if (score >= 0.30)  return { label: "FORT ↑",   color: "#00ff88", bg: "#001a0d" };
    if (score >= 0.08)  return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
    return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
  }
  // Pas de régime — score seul
  if (score >= 0.30)  return { label: "FORT ↑",   color: "#00ff88", bg: "#001a0d" };
  if (score >= 0.08)  return { label: "MODÉRÉ ↑", color: "#66ffbb", bg: "#002211" };
  if (score <= -0.30) return { label: "FAIBLE ↓", color: "#ff3b3b", bg: "#1a0000" };
  if (score <= -0.08) return { label: "MODÉRÉ ↓", color: "#ff8888", bg: "#110000" };
  return                     { label: "NEUTRE →", color: "#888899", bg: "#0a0a14" };
}'''

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print("getStrength avec régime OK")
else:
    print("ERREUR: getStrength pas trouvé")

# Mettre à jour tous les appels getStrength(c.score) → getStrength(c.score, getRegime(data,c.code))
import re
c = re.sub(r'getStrength\(c\.score\)', 'getStrength(c.score, getRegime(data,c.code))', c)
print("Appels getStrength mis à jour")

with open(path, 'w') as f:
    f.write(c)
print("Patch23 terminé")
