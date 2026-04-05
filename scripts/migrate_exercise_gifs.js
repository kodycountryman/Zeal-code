/**
 * One-time migration script: Download ExerciseDB GIFs → Upload to Supabase Storage
 *
 * Usage: node scripts/migrate_exercise_gifs.js
 *
 * Requires: npm install @supabase/supabase-js (in project root, already a dev dep)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Supabase config ──
const SUPABASE_URL = 'https://vpkbabjvjkiyvowdboul.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwa2JhYmp2amtpeXZvd2Rib3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDQxNjYsImV4cCI6MjA5MDkyMDE2Nn0.50PU9TJIsn5LOFnZKCvo2EC3qSsz7zW43IQyJnU4Q68';
const BUCKET = 'exercise-gifs';

// ── Exercise mapping (Zeal ID → ExerciseDB ID) ──
const MAPPING = JSON.parse(fs.readFileSync('/tmp/exercise_mapping_final.json', 'utf-8'));

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    request(url);
  });
}

async function uploadToSupabase(filePath, buffer) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'image/gif',
        'Content-Length': buffer.length,
        'x-upsert': 'true',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Upload failed ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const zealIds = Object.keys(MAPPING);
  console.log(`Starting migration: ${zealIds.length} exercises to upload\n`);

  const results = { success: [], failed: [], skipped: [] };
  const schemaPath = path.join(__dirname, '..', 'mocks', 'exerciseSchema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const exercises = Array.isArray(schema) ? schema : schema.exercises;

  for (let i = 0; i < zealIds.length; i++) {
    const zealId = zealIds[i];
    const edbId = MAPPING[zealId];
    const gifUrl = `https://static.exercisedb.dev/media/${edbId}.gif`;
    const storagePath = `${zealId}.gif`;
    const progress = `[${i + 1}/${zealIds.length}]`;

    try {
      // Download GIF
      process.stdout.write(`${progress} ${zealId}... downloading`);
      const buffer = await fetchBuffer(gifUrl);

      // Upload to Supabase
      process.stdout.write(' → uploading');
      await uploadToSupabase(storagePath, buffer);

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
      results.success.push({ zealId, publicUrl, size: buffer.length });
      console.log(` → done (${(buffer.length / 1024).toFixed(0)}KB)`);

      // Update schema entry
      const ex = exercises.find(e => e.id === zealId);
      if (ex) ex.media_url = publicUrl;

      // Rate limit: 200ms between requests
      await sleep(200);
    } catch (err) {
      console.log(` → FAILED: ${err.message}`);
      results.failed.push({ zealId, error: err.message });
    }
  }

  // Save updated schema
  fs.writeFileSync(schemaPath, JSON.stringify(exercises, null, 2) + '\n');

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`SUCCESS: ${results.success.length}`);
  console.log(`FAILED:  ${results.failed.length}`);
  console.log(`TOTAL SIZE: ${(results.success.reduce((s, r) => s + r.size, 0) / 1024 / 1024).toFixed(1)}MB`);

  if (results.failed.length > 0) {
    console.log('\nFailed exercises:');
    results.failed.forEach(f => console.log(`  ${f.zealId}: ${f.error}`));
  }

  // Save results
  fs.writeFileSync('/tmp/migration_results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /tmp/migration_results.json');
  console.log('Schema updated: mocks/exerciseSchema.json');
}

main().catch(console.error);
