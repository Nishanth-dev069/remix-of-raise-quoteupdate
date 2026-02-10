import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env.local manually since we don't have dotenv and want to keep deps minimal
const envPath = path.resolve(__dirname, '../.env.local');
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
    if (match) {
        databaseUrl = match[1];
    }
}

if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment or .env.local');
    process.exit(1);
}

const sql = postgres(databaseUrl, {
    ssl: { rejectUnauthorized: false },
    max: 1 // We only need one connection for migration
});

async function main() {
    try {
        console.log('🔌 Connecting to database...');

        // 1. Add 'features' column to 'products' table
        console.log("Checking 'products' table for 'features' column...");
        await sql`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
    `;
        console.log("✅ 'features' column added (or already exists).");

        // 2. Fix Storage RLS
        console.log("Fixing RLS policies for 'products' storage bucket...");

        // Create bucket if not exists (idempotent-ish check)
        await sql`
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('products', 'products', true)
      ON CONFLICT (id) DO NOTHING;
    `;
        console.log("✅ 'products' bucket ensured.");

        // Drop existing policies to avoid conflicts/duplicates and ensure clean slate for this bucket
        // Note: This might be aggressive, but "Minimal, targeted fixes" implies getting it to work.
        // We will drop policies specifically for this bucket if possible, or just create IF NOT EXISTS with a unique name.
        // Let's go with DROP + CREATE to be sure we fix "new row violates row-level security policy".

        // Policy: Allow authenticated users to upload (INSERT)
        await sql`
      DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
    `;
        await sql`
      CREATE POLICY "Allow authenticated uploads"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'products');
    `;
        console.log("✅ Created 'Allow authenticated uploads' policy.");

        // Policy: Allow public read (SELECT) - usually needed for images
        await sql`
      DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
    `;
        await sql`
      CREATE POLICY "Allow public read"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'products');
    `;
        console.log("✅ Created 'Allow public read' policy.");

        // Policy: Allow authenticated update/delete (optional but good for admin)
        await sql`
      DROP POLICY IF EXISTS "Allow authenticated update/delete" ON storage.objects;
    `;
        await sql`
      CREATE POLICY "Allow authenticated update/delete"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = 'products')
      WITH CHECK (bucket_id = 'products');
    `;
        console.log("✅ Created 'Allow authenticated update/delete' policy.");

        console.log('🎉 Database fixes applied successfully!');
    } catch (err) {
        console.error('❌ Error applying fixes:', err);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

main();
