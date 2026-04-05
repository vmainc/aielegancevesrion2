/**
 * PocketBase Collection Setup Script
 * 
 * This script creates the required collections for the AI Elegance application.
 * 
 * Usage:
 *   node scripts/setup-collections.js [adminEmail] [adminPassword] [pocketbaseUrl]
 * 
 * Or run interactively (it will prompt for credentials):
 *   node scripts/setup-collections.js
 * 
 * Environment variables:
 *   VITE_POCKETBASE_URL, NUXT_PUBLIC_POCKETBASE_URL, or POCKETBASE_URL (default: http://127.0.0.1:8090)
 */

const PocketBase = require('pocketbase/cjs');
const { resolvePocketBaseUrlFromEnv } = require('./lib/resolve-pocketbase-url');

const POCKETBASE_URL = resolvePocketBaseUrlFromEnv(process.argv[4]);

async function getUsersCollectionId(pb) {
  try {
    const usersCollection = await pb.collections.getFirstListItem('name="users"');
    return usersCollection.id;
  } catch (error) {
    return '_pb_users_auth_';
  }
}

async function getCollectionIdByName(pb, name) {
  const col = await pb.collections.getFirstListItem(`name="${name}"`);
  return col.id;
}

function logAuthFailure(error, baseUrl) {
  const status = error.status ?? error.statusCode ?? 0
  const body = error.response ?? error.data ?? {}
  console.error('\n❌ Superuser authentication failed.')
  console.error('   HTTP status:', status)
  console.error('   URL (if reported):', error.url || '(n/a)')
  console.error('   Response:', typeof body === 'string' ? body : JSON.stringify(body, null, 2))
  console.error('   Message:', error.message || '(n/a)')
  if (status === 404) {
    console.error('\n   404 usually means the request never reached PocketBase (wrong base URL or nginx).')
    console.error('   Expect:', `${baseUrl.replace(/\/$/, '')}/api/collections/_superusers/auth-with-password`)
  }
  if (status === 400 || status === 401 || status === 403) {
    console.error('\n   Wrong email/password, or superuser does not exist yet.')
    console.error('   Open the admin UI and complete first-time setup or reset password:')
    console.error('   ', `${baseUrl.replace(/\/$/, '')}/_/`)
  }
  console.error('\n   Raw check (replace PASSWORD):')
  console.error(
    `   curl -sS -X POST '${baseUrl.replace(/\/$/, '')}/api/collections/_superusers/auth-with-password' \\\n` +
      `     -H 'Content-Type: application/json' \\\n` +
      `     -d '{"identity":"YOUR_EMAIL","password":"PASSWORD"}'`
  )
}

async function createCollections(adminEmail, adminPassword) {
  const pb = new PocketBase(POCKETBASE_URL);

  try {
    console.log('🔐 Authenticating as superuser (PocketBase 0.23+ _superusers)...');
    try {
      await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
    } catch (authErr) {
      logAuthFailure(authErr, POCKETBASE_URL)
      process.exit(1)
    }
    console.log('✅ Authenticated successfully\n');

    // Get users collection ID for relations
    console.log('🔍 Looking up users collection...');
    const usersCollectionId = await getUsersCollectionId(pb);
    console.log(`✅ Found users collection (ID: ${usersCollectionId})\n`);

    // Create questions collection
    console.log('📝 Creating "questions" collection...');
    try {
      const existing = await pb.collections.getFirstListItem('name="questions"');
      console.log('⚠️  "questions" collection already exists, skipping...\n');
    } catch (error) {
      const questionsData = {
        name: 'questions',
        type: 'base',
        schema: [
          {
            name: 'question',
            type: 'text',
            required: true,
            options: { min: 1, max: 5000 }
          },
          {
            name: 'responses',
            type: 'json',
            required: false
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          }
        ]
      };

      const questionsCollection = await pb.collections.create(questionsData);
      console.log('✅ "questions" collection created successfully\n');
    }

    // Create user_points collection
    console.log('🎯 Creating "user_points" collection...');
    try {
      const existing = await pb.collections.getFirstListItem('name="user_points"');
      console.log('⚠️  "user_points" collection already exists, skipping...\n');
    } catch (error) {
      const userPointsData = {
        name: 'user_points',
        type: 'base',
        schema: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            unique: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: true,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'points',
            type: 'number',
            required: true,
            options: { min: 0 }
          }
        ]
      };

      await pb.collections.create(userPointsData);
      console.log('✅ "user_points" collection created successfully\n');
    }

    const questionsCollectionId = await getCollectionIdByName(pb, 'questions');

    // Create ratings collection (per-user, per-model ratings on a question)
    console.log('⭐ Creating "ratings" collection...');
    try {
      await pb.collections.getFirstListItem('name="ratings"');
      console.log('⚠️  "ratings" collection already exists, skipping...\n');
    } catch (error) {
      await pb.collections.create({
        name: 'ratings',
        type: 'base',
        schema: [
          {
            name: 'question',
            type: 'relation',
            required: true,
            options: {
              collectionId: questionsCollectionId,
              cascadeDelete: true,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['question']
            }
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'model',
            type: 'text',
            required: true,
            options: { min: 1, max: 200 }
          },
          {
            name: 'rating',
            type: 'number',
            required: true,
            options: { min: 0 }
          }
        ]
      });
      console.log('✅ "ratings" collection created successfully\n');
    }

    // Create comments collection
    console.log('💬 Creating "comments" collection...');
    try {
      await pb.collections.getFirstListItem('name="comments"');
      console.log('⚠️  "comments" collection already exists, skipping...\n');
    } catch (error) {
      await pb.collections.create({
        name: 'comments',
        type: 'base',
        schema: [
          {
            name: 'question',
            type: 'relation',
            required: true,
            options: {
              collectionId: questionsCollectionId,
              cascadeDelete: true,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['question']
            }
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'comment',
            type: 'text',
            required: true,
            options: { min: 1, max: 10000 }
          }
        ]
      });
      console.log('✅ "comments" collection created successfully\n');
    }

    // Creative workspace (script import → PocketBase)
    console.log('🎬 Creating creative workspace collections...');
    try {
      await pb.collections.getFirstListItem('name="creative_projects"');
      console.log('⚠️  "creative_projects" already exists, skipping creative trio...\n');
    } catch (_skip) {
      const creativeProjectsData = {
        name: 'creative_projects',
        type: 'base',
        listRule: '@request.auth.id != "" && user = @request.auth.id',
        viewRule: '@request.auth.id != "" && user = @request.auth.id',
        updateRule: '@request.auth.id != "" && user = @request.auth.id',
        deleteRule: '@request.auth.id != "" && user = @request.auth.id',
        schema: [
          { name: 'name', type: 'text', required: true, options: { min: 1, max: 500 } },
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'aspect_ratio',
            type: 'select',
            required: true,
            options: {
              maxSelect: 1,
              values: [
                { value: '16:9' },
                { value: '9:16' },
                { value: '1:1' }
              ]
            }
          },
          {
            name: 'goal',
            type: 'select',
            required: true,
            options: {
              maxSelect: 1,
              values: [
                { value: 'film' },
                { value: 'social' },
                { value: 'commercial' },
                { value: 'other' }
              ]
            }
          },
          { name: 'synopsis', type: 'text', required: false, options: { max: 20000 } },
          { name: 'treatment', type: 'text', required: false, options: { max: 50000 } },
          { name: 'concept_notes', type: 'text', required: false, options: { max: 50000 } },
          { name: 'genre', type: 'text', required: false, options: { max: 200 } },
          { name: 'tone', type: 'text', required: false, options: { max: 500 } },
          { name: 'themes', type: 'json', required: false },
          { name: 'source_filename', type: 'text', required: false, options: { max: 500 } },
          {
            name: 'director',
            type: 'json',
            required: false
          },
          {
            name: 'continuity_memory',
            type: 'text',
            required: false,
            options: { max: 50000 }
          },
          {
            name: 'continuity_last_issues',
            type: 'text',
            required: false,
            options: { max: 20000 }
          }
        ]
      };

      const creativeProjectsCol = await pb.collections.create(creativeProjectsData);
      const creativeProjectsId = creativeProjectsCol.id;
      console.log('✅ "creative_projects" created\n');

      await pb.collections.create({
        name: 'creative_scenes',
        type: 'base',
        listRule: '@request.auth.id != "" && user = @request.auth.id',
        viewRule: '@request.auth.id != "" && user = @request.auth.id',
        updateRule: '@request.auth.id != "" && user = @request.auth.id',
        deleteRule: '@request.auth.id != "" && user = @request.auth.id',
        schema: [
          {
            name: 'project',
            type: 'relation',
            required: true,
            options: {
              collectionId: creativeProjectsId,
              cascadeDelete: true,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['name']
            }
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'sort_order',
            type: 'number',
            required: true,
            options: { min: 0, onlyInt: true }
          },
          { name: 'heading', type: 'text', required: true, options: { max: 2000 } },
          { name: 'summary', type: 'text', required: false, options: { max: 5000 } },
          { name: 'body', type: 'text', required: false, options: { max: 150000 } }
        ]
      });
      console.log('✅ "creative_scenes" created\n');

      await pb.collections.create({
        name: 'creative_characters',
        type: 'base',
        listRule: '@request.auth.id != "" && user = @request.auth.id',
        viewRule: '@request.auth.id != "" && user = @request.auth.id',
        updateRule: '@request.auth.id != "" && user = @request.auth.id',
        deleteRule: '@request.auth.id != "" && user = @request.auth.id',
        schema: [
          {
            name: 'project',
            type: 'relation',
            required: true,
            options: {
              collectionId: creativeProjectsId,
              cascadeDelete: true,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['name']
            }
          },
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: usersCollectionId,
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          { name: 'name', type: 'text', required: true, options: { max: 200 } },
          { name: 'role_description', type: 'text', required: false, options: { max: 10000 } }
        ]
      });
      console.log('✅ "creative_characters" created\n');
    }

    // Per-scene cinematic shots (storyboard); safe to add if creative workspace already existed
    console.log('🎬 Ensuring "creative_shots" collection...');
    try {
      await pb.collections.getFirstListItem('name="creative_shots"');
      console.log('⚠️  "creative_shots" already exists, skipping...\n');
    } catch (_missing) {
      try {
        const creativeProjectsId = await getCollectionIdByName(pb, 'creative_projects');
        const creativeScenesId = await getCollectionIdByName(pb, 'creative_scenes');
        await pb.collections.create({
          name: 'creative_shots',
          type: 'base',
          listRule: '@request.auth.id != "" && user = @request.auth.id',
          viewRule: '@request.auth.id != "" && user = @request.auth.id',
          updateRule: '@request.auth.id != "" && user = @request.auth.id',
          deleteRule: '@request.auth.id != "" && user = @request.auth.id',
          schema: [
            {
              name: 'project',
              type: 'relation',
              required: true,
              options: {
                collectionId: creativeProjectsId,
                cascadeDelete: true,
                minSelect: null,
                maxSelect: 1,
                displayFields: ['name']
              }
            },
            {
              name: 'scene',
              type: 'relation',
              required: true,
              options: {
                collectionId: creativeScenesId,
                cascadeDelete: true,
                minSelect: null,
                maxSelect: 1,
                displayFields: ['heading']
              }
            },
            {
              name: 'user',
              type: 'relation',
              required: true,
              options: {
                collectionId: usersCollectionId,
                cascadeDelete: false,
                minSelect: null,
                maxSelect: 1,
                displayFields: ['email']
              }
            },
            {
              name: 'sort_order',
              type: 'number',
              required: true,
              options: { min: 0, onlyInt: true }
            },
            { name: 'title', type: 'text', required: true, options: { max: 500 } },
            { name: 'description', type: 'text', required: false, options: { max: 10000 } },
            { name: 'shot_type', type: 'text', required: false, options: { max: 300 } },
            { name: 'camera_move', type: 'text', required: false, options: { max: 300 } },
            { name: 'duration_seconds', type: 'number', required: false, options: { min: 0 } },
            { name: 'image_prompt', type: 'text', required: false, options: { max: 20000 } },
            { name: 'video_prompt', type: 'text', required: false, options: { max: 20000 } }
          ]
        });
        console.log('✅ "creative_shots" created\n');
      } catch (e) {
        console.log('⚠️  Could not create creative_shots (is creative_projects / creative_scenes missing?):', e.message || e, '\n');
      }
    }

    console.log('🎉 All collections have been set up successfully!');
    console.log('\nCollections created:');
    console.log('  ✓ questions - Stores questions and AI model responses');
    console.log('  ✓ user_points - Tracks user points for leaderboard');
    console.log('  ✓ ratings - Per-user ratings per model answer');
    console.log('  ✓ comments - Comments on questions');
    console.log('  ✓ creative_projects / creative_scenes / creative_characters - Script import workspace (if created this run)');
    console.log('  ✓ creative_shots - Storyboard shots per scene (if created this run)');
    console.log('  ✓ users - Created automatically by PocketBase');
    console.log('\n✨ You can now use the application!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Status:', error.status ?? error.statusCode);
    if (error.data) console.error('Details:', JSON.stringify(error.data, null, 2));
    if (error.response) console.error('Response:', JSON.stringify(error.response, null, 2));
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

  console.log('🚀 PocketBase Collection Setup\n');
  console.log(`Connecting to PocketBase at: ${POCKETBASE_URL}\n`);

  let adminEmail = process.argv[2];
  let adminPassword = process.argv[3];

  if (!adminEmail) {
    adminEmail = await question('Admin Email: ');
  }
  adminEmail = String(adminEmail).trim()

  if (!adminPassword) {
    adminPassword = await question('Admin Password: ');
    // Hide password input
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
    process.stdout.write('Admin Password: ' + '*'.repeat(adminPassword.length) + '\n');
  }
  adminPassword = String(adminPassword).trimEnd()

  rl.close();

  await createCollections(adminEmail, adminPassword);
}

main().catch(console.error);

