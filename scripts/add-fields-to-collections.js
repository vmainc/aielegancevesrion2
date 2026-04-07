/**
 * PocketBase Add Fields to Existing Collections Script
 * 
 * This script adds the required fields to existing collections that only have the id field.
 * 
 * Usage:
 *   node scripts/add-fields-to-collections.js [adminEmail] [adminPassword] [pocketbaseUrlOverride]
 */

const PocketBase = require('pocketbase/cjs');
const { resolvePocketBaseUrlFromEnv } = require('./lib/resolve-pocketbase-url');

const POCKETBASE_URL = resolvePocketBaseUrlFromEnv(process.argv[4]);

function fieldExists(collection, fieldName) {
  const fields = collection.fields || collection.schema;
  if (!fields || !Array.isArray(fields)) {
    return false;
  }
  return fields.some(field => field.name === fieldName);
}

/** Merge legacy `options` into field (PocketBase 0.22+ flat fields). */
function flattenField(f) {
  if (!f || typeof f !== 'object' || f.options == null) return f;
  const { options, ...rest } = f;
  const opt = { ...options };
  if (f.type === 'select' && Array.isArray(opt.values)) {
    opt.values = opt.values.map((v) =>
      typeof v === 'object' && v !== null && 'value' in v ? v.value : v
    );
  }
  const merged = { ...rest, ...opt };
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
}

async function addFieldsToCollections(adminEmail, adminPassword) {
  const pb = new PocketBase(POCKETBASE_URL);

  try {
    console.log('🔐 Authenticating as admin...');
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
    console.log('✅ Authenticated successfully\n');

    // creative_projects — director + continuity (existing installs)
    console.log('🎬 Checking "creative_projects" collection...');
    try {
      const col = await pb.collections.getFirstListItem('name="creative_projects"');
      const fieldsToAdd = [];
      const currentSchema = col.fields || col.schema || [];

      if (!fieldExists(col, 'director')) {
        fieldsToAdd.push({ name: 'director', type: 'json', required: false });
        console.log('  ➕ Will add: director (json)');
      } else {
        console.log('  ✓ director field exists');
      }
      if (!fieldExists(col, 'continuity_memory')) {
        fieldsToAdd.push({
          name: 'continuity_memory',
          type: 'text',
          required: false,
          options: { max: 50000 }
        });
        console.log('  ➕ Will add: continuity_memory (text)');
      } else {
        console.log('  ✓ continuity_memory exists');
      }
      if (!fieldExists(col, 'continuity_last_issues')) {
        fieldsToAdd.push({
          name: 'continuity_last_issues',
          type: 'text',
          required: false,
          options: { max: 20000 }
        });
        console.log('  ➕ Will add: continuity_last_issues (text)');
      } else {
        console.log('  ✓ continuity_last_issues exists');
      }

      if (!fieldExists(col, 'target_length')) {
        fieldsToAdd.push(
          flattenField({
            name: 'target_length',
            type: 'select',
            required: false,
            options: {
              maxSelect: 1,
              values: ['spot', 'short', 'episode', 'feature']
            }
          })
        );
        console.log('  ➕ Will add: target_length (select)');
      } else {
        console.log('  ✓ target_length exists');
      }

      if (fieldsToAdd.length > 0) {
        await pb.collections.update(col.id, {
          fields: [...currentSchema, ...fieldsToAdd.map(flattenField)]
        });
        console.log('✅ creative_projects updated\n');
      } else {
        console.log('✅ creative_projects already has director/continuity fields\n');
      }
    } catch (e) {
      console.log('⚠️  creative_projects not found. Skipping...\n');
    }

    // creative_characters — estimated dialogue / presence share (script import + pie chart)
    console.log('👤 Checking "creative_characters" collection...');
    try {
      const col = await pb.collections.getFirstListItem('name="creative_characters"');
      const currentSchema = col.fields || col.schema || [];
      if (!fieldExists(col, 'screen_share_percent')) {
        await pb.collections.update(col.id, {
          fields: [
            ...currentSchema,
            flattenField({
              name: 'screen_share_percent',
              type: 'number',
              required: false,
              options: { min: 0, max: 100 }
            })
          ]
        });
        console.log('  ➕ Added screen_share_percent (number 0–100)\n');
      } else {
        console.log('  ✓ screen_share_percent exists\n');
      }
    } catch (_e) {
      console.log('⚠️  creative_characters not found. Skipping...\n');
    }

    // creative_scripts — standalone Script Wizard library
    console.log('🧠 Checking "creative_scripts" collection...');
    try {
      const col = await pb.collections.getFirstListItem('name="creative_scripts"');
      const currentSchema = col.fields || col.schema || [];
      const fieldsToAdd = [];

      if (!fieldExists(col, 'status')) {
        fieldsToAdd.push(flattenField({
          name: 'status',
          type: 'select',
          required: true,
          options: {
            maxSelect: 1,
            values: ['draft', 'in_progress', 'final']
          }
        }));
        console.log('  ➕ Will add: status');
      } else {
        console.log('  ✓ status exists');
      }
      if (!fieldExists(col, 'script_text')) {
        fieldsToAdd.push(flattenField({ name: 'script_text', type: 'text', required: false, options: { max: 300000 } }));
        console.log('  ➕ Will add: script_text');
      } else {
        console.log('  ✓ script_text exists');
      }
      if (!fieldExists(col, 'comparable_titles')) {
        fieldsToAdd.push(flattenField({ name: 'comparable_titles', type: 'json', required: false }));
        console.log('  ➕ Will add: comparable_titles');
      } else {
        console.log('  ✓ comparable_titles exists');
      }
      if (!fieldExists(col, 'file')) {
        fieldsToAdd.push(flattenField({
          name: 'file',
          type: 'file',
          required: false,
          options: { maxSelect: 1, maxSize: 52428800 }
        }));
        console.log('  ➕ Will add: file');
      } else {
        console.log('  ✓ file exists');
      }

      if (fieldsToAdd.length > 0) {
        await pb.collections.update(col.id, {
          fields: [...currentSchema, ...fieldsToAdd]
        });
        console.log('✅ creative_scripts updated\n');
      } else {
        console.log('✅ creative_scripts already up to date\n');
      }
    } catch (_e) {
      console.log('⚠️  creative_scripts not found. Skipping...\n');
    }

    // project_assets — allow standalone script assets (project optional)
    console.log('📦 Checking "project_assets" collection...');
    try {
      const col = await pb.collections.getFirstListItem('name="project_assets"');
      const currentSchema = col.fields || col.schema || [];
      const projectField = currentSchema.find(f => f?.name === 'project');
      if (projectField && projectField.required) {
        const updatedFields = currentSchema.map((f) => {
          if (f?.name !== 'project') return flattenField(f);
          return flattenField({
            ...f,
            required: false
          });
        });
        await pb.collections.update(col.id, { fields: updatedFields });
        console.log('  ➕ Updated: project relation is now optional\n');
      } else {
        console.log('  ✓ project relation already optional (or field missing)\n');
      }
    } catch (_e) {
      console.log('⚠️  project_assets not found. Skipping...\n');
    }

    console.log('🎉 Field addition complete!');
    console.log('\nYour collections now have all required fields.');
    console.log('You can verify this in the PocketBase admin UI by checking the collection schemas.');

  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      if (error.message?.includes('auth') || error.status === 404) {
        console.error('❌ Authentication failed. Please check your admin email and password.');
        console.error('\nTo create an admin account, first visit:');
        console.error(`   ${POCKETBASE_URL}/_/`);
        console.error('and complete the initial setup.');
      } else {
        console.error('❌ Error updating collection:', error.message);
        if (error.data) {
          console.error('Details:', JSON.stringify(error.data, null, 2));
        }
      }
    } else {
      console.error('❌ Unexpected error:', error.message);
      if (error.response) {
        console.error('Response:', JSON.stringify(error.response, null, 2));
      }
    }
    process.exit(1);
  }
}

// Main execution
async function main() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log('🚀 PocketBase Add Fields to Collections\n');
  console.log(`Connecting to PocketBase at: ${POCKETBASE_URL}\n`);

  let adminEmail = process.argv[2];
  let adminPassword = process.argv[3];

  if (!adminEmail) {
    adminEmail = await question('Admin Email: ');
  }

  if (!adminPassword) {
    adminPassword = await question('Admin Password: ');
    // Hide password input
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
    process.stdout.write('Admin Password: ' + '*'.repeat(adminPassword.length) + '\n');
  }

  rl.close();

  await addFieldsToCollections(adminEmail, adminPassword);
}

main().catch(console.error);

