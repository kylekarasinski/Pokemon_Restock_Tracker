export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/Users?select=*`, {
    headers: {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
    }
  });
  
  const data = await response.json();
  return res.status(200).json(data);
}