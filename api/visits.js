export default async function handler(req, res) {
  const { username, passcode } = req.headers;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

  const isAdminName = (username || '').toLowerCase() === process.env.ADMIN_NAME.toLowerCase();
  const isCorrectPasscode = passcode === process.env.ADMIN_PASSCODE;
  if (isAdminName && !isCorrectPasscode) return res.status(401).json({ error: 'Invalid admin passcode' });

  // Create a new Visit Log
  if (req.method === 'POST') {
    const response = await fetch(`${url}/rest/v1/Visit_Log`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    });
    return res.status(201).json(await response.json());
  }

  // Update an existing Visit Log 
  if (req.method === 'PATCH') {
    const id = req.query.id;
    const response = await fetch(`${url}/rest/v1/Visit_Log?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    });
    return res.status(200).json(await response.json());
  }

  // Delete a Visit Log
  if (req.method === 'DELETE') {
    const id = req.query.id;
    await fetch(`${url}/rest/v1/Visit_Log?id=eq.${id}`, { method: 'DELETE', headers });
    return res.status(204).send();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}