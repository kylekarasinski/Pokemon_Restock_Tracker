export default async function handler(req, res) {
  // 1. Extract the credentials sent by your frontend
  const { username, passcode } = req.headers;

  // 2. Validate against the hidden environment variables
  if (username !== process.env.ADMIN_NAME || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  // 3. Handle GET requests (Fetch Stores)
  if (req.method === 'GET') {
    const response = await fetch(`${url}/rest/v1/Location?select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await response.json();
    return res.status(200).json(data);
  }

  // 4. Handle POST requests (Save Store)
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
    const data = await response.json();
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}