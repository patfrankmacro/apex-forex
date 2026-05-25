const GEMINI_KEY = "AIzaSyAtuGh3DQhHLGCNstI_qcvFHQLhvcQj2mY";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

export async function generateBrief(data, ranked, pairs) {
  const summary = ranked.filter(c => c.score !== 0).map(c => {
    const inds = ['cpi','core','unemp','svc','mfg','rate'].map(id => {
      const cell = data[c.code][id];
      if (!cell.now) return null;
      return `${id}=${cell.now}(exp:${cell.exp||'-'})`;
    }).filter(Boolean).join(', ');
    return `${c.code} score:${c.score.toFixed(2)} régime:${c.regime||'?'} [${inds}]`;
  }).join('\n');

  const topPairs = pairs.slice(0, 3).map(p =>
    `${p.strong.code}(${p.regS?.label||'?'}) vs ${p.weak.code}(${p.regW?.label||'?'}) div:${p.div.toFixed(2)}`
  ).join('\n');

  const prompt = `Tu es analyste senior d'un hedge fund Forex (Goldman Sachs style). Génère un BRIEF INSTITUTIONNEL court en français pour swing trading (1 sem - 2 mois).

DONNÉES MACRO ACTUELLES:
${summary}

PAIRES À HAUTE PROBABILITÉ:
${topPairs}

Format ton brief ainsi (max 250 mots):
**📊 LECTURE MACRO** - 2-3 phrases sur le contexte global
**🎯 TRADES RECOMMANDÉS** - 2-3 paires avec direction et raisonnement BC
**⚠️ RISQUES** - 1-2 risques clés à surveiller
**🏦 BIAIS BANQUES CENTRALES** - quelles BC sont hawkish/dovish et pourquoi

Sois précis, professionnel, pense comme un PM. Cite les données économiques concrètes.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
      })
    });
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur: pas de réponse";
  } catch (e) {
    return "Erreur API: " + e.message;
  }
}
