export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const { email, password, session } = req.query;

  try {
    if (email && password) {
      // Login direct + outlook en un seul appel
      const r1 = await fetch(`https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const d1 = await r1.json();
      if (d1.error) return res.json(d1);

      // Utiliser le session brut directement sans toucher à l'encodage
      const rawSession = d1.session;
      const r2 = await fetch(`https://www.myfxbook.com/api/get-community-outlook.json?session=${rawSession}`);
      const d2 = await r2.json();
      return res.json(d2);
    }

    if (session) {
      const r = await fetch(`https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`);
      const d = await r.json();
      return res.json(d);
    }

    res.json({error:true, message:"Missing params"});
  } catch(e) {
    res.json({error:true, message:e.message});
  }
}
