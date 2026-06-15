export default async function handler(req, res) {
  const { username, passcode } = req.headers;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!process.env.ADMIN_NAME || !process.env.ADMIN_PASSCODE || !url || !key) {
    return res.status(500).json({ error: 'Server missing environment variables.' });
  }

  const isAdminName = (username || '').toLowerCase() === process.env.ADMIN_NAME.toLowerCase();
  const isCorrectPasscode = passcode === process.env.ADMIN_PASSCODE;

  if (isAdminName && !isCorrectPasscode) {
    return res.status(401).json({ error: 'Invalid admin passcode' });
  }

  const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

  // GET: Fetch ALL related tables at once
  if (req.method === 'GET') {
    const [storesRes, visitsRes, confRes, potRes, timeRes] = await Promise.all([
      fetch(`${url}/rest/v1/Location?select=*`, { headers }),
      fetch(`${url}/rest/v1/Visit_Log?select=*`, { headers }),
      fetch(`${url}/rest/v1/Confirmed_Restock_Day?select=*`, { headers }),
      fetch(`${url}/rest/v1/Unconfirmed_Restock_Day?select=*`, { headers }),
      fetch(`${url}/rest/v1/Restock_Time_Bound?select=*`, { headers })
    ]);

    return res.status(200).json({
      stores: await storesRes.json(),
      visits: await visitsRes.json(),
      confirmedDays: await confRes.json(),
      potentialDays: await potRes.json(),
      timeBounds: await timeRes.json()
    });
  }

  // POST: Save Store
  if (req.method === 'POST') {
    const response = await fetch(`${url}/rest/v1/Location`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    });
    return res.status(201).json(await response.json());
  }

  // DELETE: Admin Only
  if (req.method === 'DELETE') {
    if (!isAdminName || !isCorrectPasscode) {
      return res.status(403).json({ error: 'Only admins can delete stores' });
    }
    const storeId = req.query.id;
    await fetch(`${url}/rest/v1/Location?id=eq.${storeId}`, { method: 'DELETE', headers });
    return res.status(204).send();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}