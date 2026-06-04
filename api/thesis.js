export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { pairs, type } = req.body || {};
    if (!pairs || pairs.length === 0) return res.json({ error: true, message: "Aucune paire fournie" });

    const today = new Date().toLocaleDateString("fr-CA"); // YYYY-MM-DD
    const pairList = pairs.map(p => p.pair || p).join(", ");

    let prompt = "";
    if (type === "OR") {
      prompt = `Tu es un analyste institutionnel spécialisé dans le trading de l'or (XAU/USD).
Aujourd'hui c'est le ${today}. Une opportunité de trade OR a été détectée.

Utilise le web search pour trouver les vraies nouvelles des DERNIÈRES 12 HEURES SEULEMENT concernant :
1. La faiblesse ou force du dollar américain (USD) ce matin
2. Les news macro US récentes (inflation, emploi, Fed)
3. Les achats/ventes institutionnels sur l'or aujourd'hui
4. La session de Londres sur l'or ce matin (banques bullion)

Construis une thèse institutionnelle COURTE et PRÉCISE (max 5 lignes) qui explique :
- Pourquoi les banques bullion de Londres ont acheté ou vendu l'or ce matin
- Quel catalyseur fondamental a poussé l'USD dans cette direction
- Comment NY va amplifier ce mouvement

RÈGLE ABSOLUE : N'invente RIEN. Utilise UNIQUEMENT les faits trouvés via web search des dernières 12h.
Si tu ne trouves pas de catalyseur concret récent, dis exactement : "Pas de catalyseur fondamental identifié ce matin — mouvement technique de session."
Réponds en français. Sois direct et précis comme un trader institutionnel.`;
    } else {
      prompt = `Tu es un analyste institutionnel forex spécialisé dans les sessions de Londres et New York.
Aujourd'hui c'est le ${today}. Une opportunité de trade a été détectée sur : ${pairList}.

Utilise le web search pour trouver les vraies nouvelles des DERNIÈRES 12 HEURES SEULEMENT concernant :
1. Les devises impliquées dans ces paires : ${pairList}
2. Les news de la session asiatique (Tokyo) qui ont influencé ces devises
3. Les news de la session de Londres ce matin
4. Les données économiques européennes publiées aujourd'hui (inflation, emploi, PIB)
5. Cherche sur financialjuice.com et investing.com les headlines du matin

Construis une thèse institutionnelle COURTE et PRÉCISE (max 6 lignes) qui explique :
- Ce qui s'est passé en session asiatique sur ces devises
- Pourquoi les banques de Londres ont bougé ces devises ce matin
- Le catalyseur fondamental (données éco, banque centrale, risk-on/off)
- Comment NY va amplifier à 8h ET

RÈGLE ABSOLUE : N'invente RIEN. Utilise UNIQUEMENT les faits trouvés via web search des dernières 12h.
Si tu ne trouves pas de catalyseur concret récent, dis exactement : "Pas de catalyseur fondamental identifié ce matin — mouvement technique de session de Londres."
Réponds en français. Sois direct et précis. Commence directement par la thèse sans introduction.`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();

    return res.json({ thesis: text });
  } catch(e) {
    return res.json({ error: true, message: e.message });
  }
}
