let cachedSession = null;
let sessionExpiry = 0;

async function getSession() {
  const now = Date.now();
  if (cachedSession && now < sessionExpiry) return cachedSession;
  
  const r = await fetch(`https://www.myfxbook.com/api/login.json?email=${encodeURIComponent("patrice-bonneau@outlook.com")}&password=${encodeURIComponent("Fucktoi69$")}`);
  const d = await r.json();
  
  if (!d.error && d.session) {
    cachedSession = d.session;
    sessionExpiry = now + 6 * 60 * 60 * 1000; // 6 heures
    return cachedSession;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    let session = await getSession();
    
    if (!session) {
      return res.json({ error: true, message: "Login failed" });
    }

    const r = await fetch(`https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`);
    const d = await r.json();

    // Si session expiree, relogin et retry
    if (d.error) {
      cachedSession = null;
      sessionExpiry = 0;
      session = await getSession();
      if (!session) return res.json({ error: true, message: "Re-login failed" });
      const r2 = await fetch(`https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`);
      return res.json(await r2.json());
    }

    return res.json(d);
  } catch(e) {
    res.json({ error: true, message: e.message });
  }
}
