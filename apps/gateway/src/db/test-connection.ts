import { Client } from 'pg';

async function test() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'aegis',
    password: 'aegis_dev_password',
    database: 'aegisdb',
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT current_user, current_database(), version()');
    console.log('✅ Connection successful!');
    console.log('User:', result.rows[0].current_user);
    console.log('Database:', result.rows[0].current_database);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', (err as Error).message);
  }
}

test();
