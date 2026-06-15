export default async function handler(req, res) {
  const { username, passcode } = req.headers;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  // Make case-insensitive checks
  const isAdminName = (username || '').toLowerCase() === process.env.ADMIN_NAME.toLowerCase();
  const isCorrectPasscode = passcode === process.env.ADMIN_PASSCODE;

  // THE GATEKEEPER: If Kyle is trying to enter, check the passcode. 
  // If a friend is entering, skip this check completely.
  if (isAdminName && !isCorrectPasscode) {
    return res.status(401).json({ error: 'Invalid admin passcode' });
  }

  // GET: Fetch Stores (Open to friends, Admin passed the check above)
  if (req.method === 'GET') {
    const response = await fetch(`${url}/rest/v1/Location?select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    return res.status(200).json(await response.json());
  }

  // POST: Save Store (Open to friends, Admin passed the check above)
  if (req.method === 'POST') {
    const response = await fetch(`${url}/rest/v1/Location`, {
      method: 'POST',
      headers: { 
        'apikey': key, 
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(req.body)
    });
    return res.status(201).json(await response.json());
  }

  // DELETE: STRICTLY Admin Only
  if (req.method === 'DELETE') {
    if (!isAdminName || !isCorrectPasscode) {
      return res.status(403).json({ error: 'Only admins can delete stores' });
    }
    
    const storeId = req.query.id;
    await fetch(`${url}/rest/v1/Location?id=eq.${storeId}`, {
      method: 'DELETE',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    
    return res.status(204).send();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}