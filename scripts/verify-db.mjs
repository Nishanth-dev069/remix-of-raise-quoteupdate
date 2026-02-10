import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (match) databaseUrl = match[1];
}

const sql = postgres(databaseUrl, { ssl: { rejectUnauthorized: false }, max: 1 });

async function verify() {
    try {
        console.log('🔍 Verifying database state...');

        // Check features column
        const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'features';
    `;
        if (columns.length > 0) {
            console.log('✅ Column "features" exists in "products" table.');
        } else {
            console.error('❌ Column "features" MISSING in "products" table.');
        }

        // Check policies
        const policies = await sql`
      SELECT policyname, cmd, roles 
      FROM pg_policies 
      WHERE tablename = 'objects' AND schemaname = 'storage';
    `;

        console.log('\nActive Storage Policies:');
        policies.forEach(p => console.log(`- ${p.policyname} (${p.cmd})`));

        const authInsert = policies.find(p => p.policyname === 'Allow authenticated uploads' && p.cmd === 'INSERT');
        if (authInsert) console.log('✅ "Allow authenticated uploads" policy found.');
        else console.error('❌ "Allow authenticated uploads" policy MISSING.');

    } catch (err) {
        console.error('❌ Verification failed:', err);
    } finally {
        await sql.end();
    }
}

verify();
