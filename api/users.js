export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  // Safety check to prevent fatal crashes if Vercel misses the variables
  if (!process.env.ADMIN_NAME || !process.env.ADMIN_PASSCODE || !url || !key) {
    return res.status(500).json({ error: 'Server missing environment variables.' });
  }

  const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

  // GET: Fetch all users for the login screen
  if (req.method === 'GET') {
    const response = await fetch(`${url}/rest/v1/Users?select=*&order=name`, { headers });
    return res.status(200).json(await response.json());
  }

  // POST: Create a new user profile
  if (req.method === 'POST') {
    const response = await fetch(`${url}/rest/v1/Users`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    });
    return res.status(201).json(await response.json());
  }

  // PATCH: Update an existing user (Saving their new PFP)
  if (req.method === 'PATCH') {
    const id = req.query.id;
    const response = await fetch(`${url}/rest/v1/Users?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    });
    return res.status(200).json(await response.json());
  }

  // DELETE: STRICTLY Admin Only
  if (req.method === 'DELETE') {
    const { username, passcode } = req.headers;
    const isAdminName = (username || '').toLowerCase() === process.env.ADMIN_NAME.toLowerCase();
    const isCorrectPasscode = passcode === process.env.ADMIN_PASSCODE;
    
    // The Gatekeeper: Kick them out if they aren't the admin
    if (!isAdminName || !isCorrectPasscode) {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    const id = req.query.id;
    await fetch(`${url}/rest/v1/Users?id=eq.${id}`, { method: 'DELETE', headers });
    return res.status(204).send();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}