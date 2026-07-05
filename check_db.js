import fs from 'fs';

// Read .env file
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Keys of returned JSON:', Object.keys(data));
    if (data.definitions) {
      console.log('Available definitions:', Object.keys(data.definitions));
    }
  } catch (err) {
    console.error('Error fetching OpenAPI spec:', err);
  }
}

run();
