export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    // Login frais à chaque appel (Vercel serverless = pas de mémoire entre appels)
    const loginR = await fetch(`https://www.myfxbook.com/api/login.json?email=${encodeURIComponent("patrice-bonneau@outlook.com")}&password=${encodeURIComponent("Fucktoi69$")}`);
    const loginD = await loginR.json();

    if (loginD.error || !loginD.session) {
      return res.json({ error: true, message: "Login failed: " + loginD.message });
    }

    const session = loginD.session;
    const r = await fetch(`https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`);
    const d = await r.json();

    return res.json(d);
  } catch(e) {
    res.json({ error: true, message: e.message });
  }
}
