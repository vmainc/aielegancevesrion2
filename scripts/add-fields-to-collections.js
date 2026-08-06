/**
 * PocketBase Add Fields to Existing Collections Script
 * 
 * This script adds the required fields to existing collections that only have the id field.
 * 
 * Usage:
 *   node scripts/add-fields-to-collections.js [adminEmail] [adminPassword] [pocketbaseUrlOverride]
 *
 * Credentials default from `.env`: POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD (or NUXT_POCKETBASE_ADMIN_*).
 */

require('dotenv').config()

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
              values: ['spot', 'short', 'music_video', 'episode', 'feature']
            }
          })
        );
        console.log('  ➕ Will add: target_length (select)');
      } else {
        console.log('  ✓ target_length exists');
      }

      if (!fieldExists(col, 'workflow_mode')) {
        fieldsToAdd.push(
          flattenField({
            name: 'workflow_mode',
            type: 'select',
            required: false,
            options: {
              maxSelect: 1,
              values: ['import', 'idea', 'generate', 'scratch']
            }
          })
        );
        console.log('  ➕ Will add: workflow_mode (select)');
      } else {
        console.log('  ✓ workflow_mode exists');
      }

      if (!fieldExists(col, 'preferred_model_id')) {
        fieldsToAdd.push(
          flattenField({
            name: 'preferred_model_id',
            type: 'text',
            required: false,
            options: { max: 100 }
          })
        );
        console.log('  ➕ Will add: preferred_model_id (text)');
      } else {
        console.log('  ✓ preferred_model_id exists');
      }

      if (!fieldExists(col, 'target_duration_seconds')) {
        fieldsToAdd.push(
          flattenField({
            name: 'target_duration_seconds',
            type: 'number',
            required: false,
            options: { min: 15, max: 3600, onlyInt: true }
          })
        );
        console.log('  ➕ Will add: target_duration_seconds (number 15–3600)');
      } else {
        console.log('  ✓ target_duration_seconds exists');
      }

      if (!fieldExists(col, 'adapt_to_film')) {
        fieldsToAdd.push({ name: 'adapt_to_film', type: 'json', required: false });
        console.log('  ➕ Will add: adapt_to_film (json)');
      } else {
        console.log('  ✓ adapt_to_film exists');
      }

      // Ensure workflow_mode select includes adapt
      let schemaForAdd = currentSchema
      const workflowField = currentSchema.find((f) => f?.name === 'workflow_mode');
      if (workflowField) {
        const values = workflowField.values || workflowField.options?.values || [];
        const flat = values.map((v) => (typeof v === 'object' && v && 'value' in v ? v.value : v));
        if (!flat.includes('adapt')) {
          const nextValues = [...new Set([...flat, 'adapt', 'import', 'idea', 'generate', 'scratch'])];
          const updatedFields = currentSchema.map((f) => {
            if (f?.name !== 'workflow_mode') return flattenField(f);
            return flattenField({
              ...f,
              values: nextValues,
              options: { ...(f.options || {}), maxSelect: 1, values: nextValues }
            });
          });
          await pb.collections.update(col.id, { fields: updatedFields });
          console.log('  ➕ Updated workflow_mode values to include adapt');
          const refreshed = await pb.collections.getOne(col.id);
          schemaForAdd = refreshed.fields || refreshed.schema || updatedFields;
        }
      }

      if (fieldsToAdd.length > 0) {
        await pb.collections.update(col.id, {
          fields: [...schemaForAdd, ...fieldsToAdd.map(flattenField)]
        });
        console.log('✅ creative_projects updated\n');
      } else {
        console.log('✅ creative_projects already has director/continuity/adapt fields\n');
      }
    } catch (e) {
      console.log('⚠️  creative_projects not found. Skipping...\n');
    }

    // creative_characters — estimated dialogue / presence share (script import + pie chart)
    console.log('👤 Checking "creative_characters" collection...');
    try {
      const col = await pb.collections.getFirstListItem('name="creative_characters"');
      const currentSchema = col.fields || col.schema || [];
      const charFieldsToAdd = [];
      if (!fieldExists(col, 'screen_share_percent')) {
        charFieldsToAdd.push(flattenField({
          name: 'screen_share_percent',
          type: 'number',
          required: false,
          options: { min: 0, max: 100 }
        }));
      }
      if (!fieldExists(col, 'voice_description')) {
        charFieldsToAdd.push(flattenField({
          name: 'voice_description',
          type: 'text',
          required: false,
          options: { max: 2000 }
        }));
      }
      if (!fieldExists(col, 'appearance_description')) {
        charFieldsToAdd.push(flattenField({
          name: 'appearance_description',
          type: 'text',
          required: false,
          options: { max: 4000 }
        }));
      }
      if (!fieldExists(col, 'personality')) {
        charFieldsToAdd.push(flattenField({
          name: 'personality',
          type: 'text',
          required: false,
          options: { max: 4000 }
        }));
      }
      if (!fieldExists(col, 'signature_details')) {
        charFieldsToAdd.push(flattenField({
          name: 'signature_details',
          type: 'text',
          required: false,
          options: { max: 2000 }
        }));
      }
      if (!fieldExists(col, 'avoid_description')) {
        charFieldsToAdd.push(flattenField({
          name: 'avoid_description',
          type: 'text',
          required: false,
          options: { max: 2000 }
        }));
      }
      if (charFieldsToAdd.length) {
        await pb.collections.update(col.id, {
          fields: [...currentSchema, ...charFieldsToAdd]
        });
        console.log(`  ➕ Added ${charFieldsToAdd.map(f => f.name).join(', ')} to creative_characters\n`);
      } else {
        console.log('  ✓ creative_characters fields up to date\n');
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

    // project_assets — scene / shot / character relations (formal linkage)
    console.log('📦 Checking "project_assets" story linkage fields...');
    try {
      const col = await pb.collections.getFirstListItem('name="project_assets"');
      const currentSchema = col.fields || col.schema || [];
      const fieldsToAdd = [];

      const creativeScenesId = await pb.collections.getFirstListItem('name="creative_scenes"').then((c) => c.id).catch(() => null);
      const creativeShotsId = await pb.collections.getFirstListItem('name="creative_shots"').then((c) => c.id).catch(() => null);
      const creativeCharactersId = await pb.collections.getFirstListItem('name="creative_characters"').then((c) => c.id).catch(() => null);

      if (!fieldExists(col, 'scene') && creativeScenesId) {
        fieldsToAdd.push({
          name: 'scene',
          type: 'relation',
          required: false,
          options: {
            collectionId: creativeScenesId,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ['heading']
          }
        });
        console.log('  ➕ Will add: scene (relation)');
      }
      if (!fieldExists(col, 'shot') && creativeShotsId) {
        fieldsToAdd.push({
          name: 'shot',
          type: 'relation',
          required: false,
          options: {
            collectionId: creativeShotsId,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ['title']
          }
        });
        console.log('  ➕ Will add: shot (relation)');
      }
      if (!fieldExists(col, 'character') && creativeCharactersId) {
        fieldsToAdd.push({
          name: 'character',
          type: 'relation',
          required: false,
          options: {
            collectionId: creativeCharactersId,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ['name']
          }
        });
        console.log('  ➕ Will add: character (relation)');
      }

      if (fieldsToAdd.length) {
        const updatedFields = [...currentSchema.map(flattenField), ...fieldsToAdd.map(flattenField)];
        await pb.collections.update(col.id, { fields: updatedFields });
        console.log('  ✅ project_assets linkage fields added\n');
      } else {
        console.log('  ✓ project_assets linkage fields already present\n');
      }
    } catch (_e) {
      console.log('⚠️  project_assets not found. Skipping linkage fields...\n');
    }

    // bible_facts — review statuses for continuity write-back (existing installs)
    console.log('📖 Checking "bible_facts" status values...');
    try {
      const col = await pb.collections.getFirstListItem('name="bible_facts"');
      const currentSchema = col.fields || col.schema || [];
      const statusField = currentSchema.find((f) => f?.name === 'status');
      if (statusField && statusField.type === 'select') {
        const flat = flattenField(statusField);
        const existing = Array.isArray(flat.values) ? flat.values : [];
        const required = ['active', 'tentative', 'draft', 'needs_review', 'contradicted', 'retired'];
        const merged = [...existing];
        let changed = false;
        for (const v of required) {
          if (!merged.includes(v)) {
            merged.push(v);
            changed = true;
          }
        }
        if (changed) {
          const updatedFields = currentSchema.map((f) => {
            if (f?.name !== 'status') return flattenField(f);
            return flattenField({ ...f, options: { ...(f.options || {}), values: merged.map((v) => ({ value: v })) } });
          });
          await pb.collections.update(col.id, { fields: updatedFields });
          console.log('  ➕ Added draft / needs_review to bible_facts.status\n');
        } else {
          console.log('  ✓ bible_facts.status already includes review values\n');
        }
      } else {
        console.log('  ⚠️  bible_facts.status field missing or not select — run setup-collections.js\n');
      }
    } catch (_e) {
      console.log('⚠️  bible_facts not found. Skipping status migration...\n');
    }

    // bible_entities — tentative status for seeded entities (existing installs)
    console.log('📖 Checking "bible_entities" status values...');
    try {
      const col = await pb.collections.getFirstListItem('name="bible_entities"');
      const currentSchema = col.fields || col.schema || [];
      const statusField = currentSchema.find((f) => f?.name === 'status');
      if (statusField && statusField.type === 'select') {
        const flat = flattenField(statusField);
        const existing = Array.isArray(flat.values) ? flat.values : [];
        const required = ['active', 'tentative', 'draft', 'retired', 'contradicted'];
        const merged = [...existing];
        let changed = false;
        for (const v of required) {
          if (!merged.includes(v)) {
            merged.push(v);
            changed = true;
          }
        }
        if (changed) {
          const updatedFields = currentSchema.map((f) => {
            if (f?.name !== 'status') return flattenField(f);
            return flattenField({ ...f, options: { ...(f.options || {}), values: merged.map((v) => ({ value: v })) } });
          });
          await pb.collections.update(col.id, { fields: updatedFields });
          console.log('  ➕ Added tentative to bible_entities.status\n');
        } else {
          console.log('  ✓ bible_entities.status already includes tentative\n');
        }
      }
    } catch (_e) {
      console.log('⚠️  bible_entities not found. Skipping status migration...\n');
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

  let adminEmail =
    process.argv[2] ||
    process.env.POCKETBASE_ADMIN_EMAIL ||
    process.env.NUXT_POCKETBASE_ADMIN_EMAIL ||
    ''
  let adminPassword =
    process.argv[3] ||
    process.env.POCKETBASE_ADMIN_PASSWORD ||
    process.env.NUXT_POCKETBASE_ADMIN_PASSWORD ||
    ''

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

