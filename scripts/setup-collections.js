/**
 * PocketBase Collection Setup Script
 * 
 * This script creates the required collections for the AI Elegance application.
 * 
 * Usage:
 *   node scripts/setup-collections.js [adminEmail] [adminPassword] [pocketbaseUrl]
 *   (pocketbaseUrl is process.argv[4] — same API base as the app, no trailing slash.)
 * 
 * Or run interactively (it will prompt for credentials):
 *   node scripts/setup-collections.js
 * 
 * Environment variables (loaded from `.env` in project root via dotenv):
 *   POCKETBASE_URL / NUXT_PUBLIC_POCKETBASE_URL / VITE_POCKETBASE_URL — PocketBase API base (no trailing slash)
 *   POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD (or NUXT_POCKETBASE_ADMIN_*)
 */

require('dotenv').config()

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

/** PocketBase 0.22+ expects field props on the field object; legacy `options` is merged in. */
function flattenPb036Fields(fields) {
  if (!fields || !Array.isArray(fields)) return fields;
  return fields.map((f) => {
    if (!f || typeof f !== 'object' || f.options == null) return f;
    const { options, ...rest } = f
    const opt = { ...options }
    if (f.type === 'select' && Array.isArray(opt.values)) {
      opt.values = opt.values.map((v) =>
        typeof v === 'object' && v !== null && 'value' in v ? v.value : v
      )
    }
    const merged = { ...rest, ...opt }
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined))
  })
}

/** PocketBase validates rules after fields exist; create collection first, then apply rules (Admin API). */
async function createCollectionThenRules(pb, body) {
  const {
    listRule,
    viewRule,
    updateRule,
    deleteRule,
    createRule,
    ...rest
  } = body;
  const col = await pb.collections.create({
    ...rest,
    fields: flattenPb036Fields(rest.fields)
  });
  await pb.collections.getOne(col.id);
  await new Promise((r) => setTimeout(r, 800));
  const rulePatch = {};
  if (listRule !== undefined) rulePatch.listRule = listRule;
  if (viewRule !== undefined) rulePatch.viewRule = viewRule;
  if (updateRule !== undefined) rulePatch.updateRule = updateRule;
  if (deleteRule !== undefined) rulePatch.deleteRule = deleteRule;
  if (createRule !== undefined) rulePatch.createRule = createRule;
  if (Object.keys(rulePatch).length) {
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await pb.collections.update(col.id, rulePatch);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (lastErr) throw lastErr;
  }
  return col;
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

    // Creative workspace (script import → PocketBase)
    console.log('🎬 Creating creative workspace collections...');
    try {
      await pb.collections.getFirstListItem('name="creative_projects"');
      console.log('⚠️  "creative_projects" already exists, skipping creative trio...\n');
    } catch (_skip) {
      const creativeProjectsData = {
        name: 'creative_projects',
        type: 'base',
        listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        fields: [
          {
            name: 'owned_by',
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
          { name: 'name', type: 'text', required: true, options: { min: 1, max: 500 } },
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
          {
            name: 'workflow_mode',
            type: 'select',
            required: false,
            options: {
              maxSelect: 1,
              values: ['import', 'idea', 'generate', 'scratch']
            }
          },
          { name: 'preferred_model_id', type: 'text', required: false, options: { max: 100 } },
          {
            name: 'target_length',
            type: 'select',
            required: false,
            options: {
              maxSelect: 1,
              values: ['spot', 'short', 'music_video', 'episode', 'feature']
            }
          },
          {
            name: 'target_duration_seconds',
            type: 'number',
            required: false,
            options: { min: 15, max: 3600, onlyInt: true }
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

      const creativeProjectsCol = await createCollectionThenRules(pb, creativeProjectsData);
      const creativeProjectsId = creativeProjectsCol.id;
      console.log('✅ "creative_projects" created\n');

      await createCollectionThenRules(pb, {
        name: 'creative_scenes',
        type: 'base',
        listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        fields: [
          {
            name: 'owned_by',
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

      await createCollectionThenRules(pb, {
        name: 'creative_characters',
        type: 'base',
        listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
        fields: [
          {
            name: 'owned_by',
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
          { name: 'name', type: 'text', required: true, options: { max: 200 } },
          { name: 'role_description', type: 'text', required: false, options: { max: 10000 } },
          {
            name: 'screen_share_percent',
            type: 'number',
            required: false,
            options: { min: 0, max: 100 }
          },
          {
            name: 'voice_description',
            type: 'text',
            required: false,
            options: { max: 2000 }
          },
          {
            name: 'appearance_description',
            type: 'text',
            required: false,
            options: { max: 4000 }
          },
          {
            name: 'personality',
            type: 'text',
            required: false,
            options: { max: 4000 }
          },
          {
            name: 'signature_details',
            type: 'text',
            required: false,
            options: { max: 2000 }
          },
          {
            name: 'avoid_description',
            type: 'text',
            required: false,
            options: { max: 2000 }
          }
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
        await createCollectionThenRules(pb, {
          name: 'creative_shots',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
              name: 'project',
              type: 'relation',
              required: false,
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

    // Library: scripts, character refs, storyboard exports, video renders (per project)
    console.log('📦 Ensuring "project_assets" collection...');
    try {
      await pb.collections.getFirstListItem('name="project_assets"');
      console.log('⚠️  "project_assets" already exists, skipping...\n');
    } catch (_missing) {
      try {
        const creativeProjectsId = await getCollectionIdByName(pb, 'creative_projects');
        const creativeScenesId = await getCollectionIdByName(pb, 'creative_scenes');
        const creativeShotsId = await getCollectionIdByName(pb, 'creative_shots');
        const creativeCharactersId = await getCollectionIdByName(pb, 'creative_characters');
        await createCollectionThenRules(pb, {
          name: 'project_assets',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
              name: 'project',
              type: 'relation',
              required: false,
              options: {
                collectionId: creativeProjectsId,
                cascadeDelete: true,
                minSelect: null,
                maxSelect: 1,
                displayFields: ['name']
              }
            },
            {
              name: 'kind',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'script' },
                  { value: 'character' },
                  { value: 'storyboard' },
                  { value: 'video' },
                  { value: 'other' }
                ]
              }
            },
            { name: 'title', type: 'text', required: true, options: { min: 1, max: 500 } },
            { name: 'notes', type: 'text', required: false, options: { max: 20000 } },
            { name: 'metadata', type: 'json', required: false },
            {
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
            },
            {
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
            },
            {
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
            },
            {
              name: 'sort_order',
              type: 'number',
              required: false,
              options: { min: 0, onlyInt: true }
            },
            {
              name: 'file',
              type: 'file',
              required: false,
              options: {
                maxSelect: 1,
                maxSize: 52428800
              }
            }
          ]
        });
        console.log('✅ "project_assets" created\n');
      } catch (e) {
        console.log('⚠️  Could not create project_assets (is creative_projects missing?):', e.message || e, '\n');
      }
    }

    // Standalone script workspace (not project-bound)
    console.log('🧠 Ensuring "creative_scripts" collection...');
    try {
      await pb.collections.getFirstListItem('name="creative_scripts"');
      console.log('⚠️  "creative_scripts" already exists, skipping...\n');
    } catch (_missing) {
      try {
        await createCollectionThenRules(pb, {
          name: 'creative_scripts',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
            { name: 'title', type: 'text', required: true, options: { min: 1, max: 500 } },
            {
              name: 'status',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [{ value: 'draft' }, { value: 'in_progress' }, { value: 'final' }]
              }
            },
            { name: 'source_filename', type: 'text', required: false, options: { max: 500 } },
            { name: 'script_text', type: 'text', required: false, options: { max: 300000 } },
            { name: 'synopsis', type: 'text', required: false, options: { max: 20000 } },
            { name: 'treatment', type: 'text', required: false, options: { max: 50000 } },
            { name: 'genre', type: 'text', required: false, options: { max: 200 } },
            { name: 'tone', type: 'text', required: false, options: { max: 500 } },
            { name: 'themes', type: 'json', required: false },
            { name: 'comparable_titles', type: 'json', required: false },
            {
              name: 'file',
              type: 'file',
              required: false,
              options: {
                maxSelect: 1,
                maxSize: 52428800
              }
            }
          ]
        });
        console.log('✅ "creative_scripts" created\n');
      } catch (e) {
        console.log('⚠️  Could not create creative_scripts:', e.message || e, '\n');
      }
    }

    // Production Bible — PASS 6 foundation collections
    console.log('📖 Ensuring Production Bible collections...');
    try {
      const creativeProjectsId = await getCollectionIdByName(pb, 'creative_projects');

      console.log('  Ensuring "bible_entities"...');
      try {
        await pb.collections.getFirstListItem('name="bible_entities"');
        console.log('  ⚠️  "bible_entities" already exists, skipping...');
      } catch (_missing) {
        await createCollectionThenRules(pb, {
          name: 'bible_entities',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
              name: 'entity_type',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'character' },
                  { value: 'location' },
                  { value: 'prop' },
                  { value: 'creature' },
                  { value: 'species' },
                  { value: 'organization' },
                  { value: 'technology' },
                  { value: 'world_rule' },
                  { value: 'event' },
                  { value: 'style_rule' },
                  { value: 'concept' }
                ]
              }
            },
            { name: 'name', type: 'text', required: true, options: { max: 500 } },
            { name: 'slug', type: 'text', required: false, options: { max: 200 } },
            { name: 'aliases', type: 'json', required: false },
            { name: 'summary', type: 'text', required: false, options: { max: 5000 } },
            { name: 'description', type: 'text', required: false, options: { max: 50000 } },
            {
              name: 'status',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'active' },
                  { value: 'tentative' },
                  { value: 'draft' },
                  { value: 'retired' },
                  { value: 'contradicted' }
                ]
              }
            },
            { name: 'confidence', type: 'number', required: false, options: { min: 0, max: 1 } },
            { name: 'source_type', type: 'text', required: false, options: { max: 100 } },
            { name: 'source_id', type: 'text', required: false, options: { max: 200 } },
            { name: 'actor_type', type: 'text', required: false, options: { max: 50 } },
            { name: 'actor_id', type: 'text', required: false, options: { max: 200 } }
          ]
        });
        console.log('  ✅ "bible_entities" created');
      }

      let bibleEntitiesId;
      try {
        bibleEntitiesId = await getCollectionIdByName(pb, 'bible_entities');
      } catch (_e) {
        bibleEntitiesId = null;
      }

      console.log('  Ensuring "bible_facts"...');
      try {
        await pb.collections.getFirstListItem('name="bible_facts"');
        console.log('  ⚠️  "bible_facts" already exists, skipping...');
      } catch (_missing) {
        if (!bibleEntitiesId) throw new Error('bible_entities collection is required before bible_facts');
        await createCollectionThenRules(pb, {
          name: 'bible_facts',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
              name: 'entity',
              type: 'relation',
              required: false,
              options: {
                collectionId: bibleEntitiesId,
                cascadeDelete: false,
                minSelect: null,
                maxSelect: 1,
                displayFields: ['name']
              }
            },
            { name: 'fact_type', type: 'text', required: false, options: { max: 100 } },
            { name: 'statement', type: 'text', required: true, options: { max: 10000 } },
            { name: 'structured_value', type: 'json', required: false },
            { name: 'scope_type', type: 'text', required: false, options: { max: 50 } },
            { name: 'scope_id', type: 'text', required: false, options: { max: 200 } },
            {
              name: 'status',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'active' },
                  { value: 'tentative' },
                  { value: 'draft' },
                  { value: 'needs_review' },
                  { value: 'contradicted' },
                  { value: 'retired' }
                ]
              }
            },
            { name: 'confidence', type: 'number', required: false, options: { min: 0, max: 1 } },
            { name: 'source_type', type: 'text', required: false, options: { max: 100 } },
            { name: 'source_id', type: 'text', required: false, options: { max: 200 } },
            { name: 'actor_type', type: 'text', required: false, options: { max: 50 } },
            { name: 'actor_id', type: 'text', required: false, options: { max: 200 } }
          ]
        });
        console.log('  ✅ "bible_facts" created');
      }

      console.log('  Ensuring "bible_relationships"...');
      try {
        await pb.collections.getFirstListItem('name="bible_relationships"');
        console.log('  ⚠️  "bible_relationships" already exists, skipping...');
      } catch (_missing) {
        await createCollectionThenRules(pb, {
          name: 'bible_relationships',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
            { name: 'from_type', type: 'text', required: true, options: { max: 50 } },
            { name: 'from_id', type: 'text', required: true, options: { max: 200 } },
            { name: 'to_type', type: 'text', required: true, options: { max: 50 } },
            { name: 'to_id', type: 'text', required: true, options: { max: 200 } },
            { name: 'relationship_type', type: 'text', required: true, options: { max: 200 } },
            { name: 'role', type: 'text', required: false, options: { max: 500 } },
            { name: 'strength', type: 'number', required: false, options: { min: 0, max: 1 } },
            {
              name: 'status',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'active' },
                  { value: 'tentative' },
                  { value: 'retired' },
                  { value: 'contradicted' }
                ]
              }
            },
            { name: 'source_type', type: 'text', required: false, options: { max: 100 } },
            { name: 'source_id', type: 'text', required: false, options: { max: 200 } },
            { name: 'actor_type', type: 'text', required: false, options: { max: 50 } },
            { name: 'actor_id', type: 'text', required: false, options: { max: 200 } }
          ]
        });
        console.log('  ✅ "bible_relationships" created');
      }

      console.log('✅ Production Bible collections ensured\n');
    } catch (e) {
      console.log('⚠️  Could not ensure Production Bible collections:', e.message || e, '\n');
    }

    // Guide messages + creative decisions — persistent memory (Phase 1)
    console.log('💬 Ensuring guide_messages and creative_decisions collections...');
    try {
      const creativeProjectsId = await getCollectionIdByName(pb, 'creative_projects');

      console.log('  Ensuring "guide_messages"...');
      try {
        await pb.collections.getFirstListItem('name="guide_messages"');
        console.log('  ⚠️  "guide_messages" already exists, skipping...');
      } catch (_missing) {
        await createCollectionThenRules(pb, {
          name: 'guide_messages',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
            { name: 'client_id', type: 'text', required: true, options: { max: 50 } },
            {
              name: 'role',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [{ value: 'user' }, { value: 'assistant' }]
              }
            },
            { name: 'content', type: 'text', required: true, options: { max: 12000 } },
            { name: 'suggestions', type: 'json', required: false },
            { name: 'created_at_client', type: 'text', required: false, options: { max: 50 } }
          ]
        });
        console.log('  ✅ "guide_messages" created');
      }

      console.log('  Ensuring "creative_decisions"...');
      try {
        await pb.collections.getFirstListItem('name="creative_decisions"');
        console.log('  ⚠️  "creative_decisions" already exists, skipping...');
      } catch (_missing) {
        await createCollectionThenRules(pb, {
          name: 'creative_decisions',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '',
          deleteRule: '',
          fields: [
            {
              name: 'owned_by',
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
            { name: 'actor_type', type: 'text', required: true, options: { max: 50 } },
            { name: 'actor_id', type: 'text', required: false, options: { max: 200 } },
            { name: 'source_type', type: 'text', required: true, options: { max: 100 } },
            { name: 'source_id', type: 'text', required: false, options: { max: 200 } },
            {
              name: 'target_type',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'project' },
                  { value: 'director' },
                  { value: 'character' }
                ]
              }
            },
            { name: 'target_id', type: 'text', required: true, options: { max: 200 } },
            { name: 'field', type: 'text', required: true, options: { max: 200 } },
            { name: 'old_value', type: 'text', required: false, options: { max: 50000 } },
            { name: 'new_value', type: 'text', required: true, options: { max: 50000 } },
            { name: 'rationale', type: 'text', required: false, options: { max: 2000 } },
            {
              name: 'status',
              type: 'select',
              required: true,
              options: {
                maxSelect: 1,
                values: [
                  { value: 'applied' },
                  { value: 'rejected' },
                  { value: 'superseded' }
                ]
              }
            },
            { name: 'applied_at', type: 'date', required: true }
          ]
        });
        console.log('  ✅ "creative_decisions" created');
      }

      console.log('✅ Guide memory collections ensured\n');
    } catch (e) {
      console.log('⚠️  Could not ensure guide memory collections:', e.message || e, '\n');
    }

    // Project timelines — PASS 28 cloud persistence
    console.log('🎬 Ensuring project_timelines collection...');
    try {
      const creativeProjectsId = await getCollectionIdByName(pb, 'creative_projects');

      console.log('  Ensuring "project_timelines"...');
      try {
        await pb.collections.getFirstListItem('name="project_timelines"');
        console.log('  ⚠️  "project_timelines" already exists, skipping...');
      } catch (_missing) {
        await createCollectionThenRules(pb, {
          name: 'project_timelines',
          type: 'base',
          listRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          viewRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          createRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          updateRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          deleteRule: '@request.auth.id != "" && owned_by = @request.auth.id',
          fields: [
            {
              name: 'owned_by',
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
            { name: 'title', type: 'text', required: true, options: { max: 200 } },
            { name: 'timeline_json', type: 'json', required: true },
            { name: 'schema_version', type: 'number', required: true, options: { min: 1, max: 100 } },
            { name: 'revision', type: 'number', required: true, options: { min: 1, max: 999999 } },
            { name: 'source', type: 'text', required: false, options: { max: 50 } },
            { name: 'imported_from_local', type: 'bool', required: false },
            { name: 'local_backup_key', type: 'text', required: false, options: { max: 300 } }
          ]
        });
        console.log('  ✅ "project_timelines" created');
      }

      console.log('✅ project_timelines collection ensured\n');
    } catch (e) {
      console.log('⚠️  Could not ensure project_timelines:', e.message || e, '\n');
    }

    console.log('🎉 All collections have been set up successfully!');
    console.log('\nCollections created:');
    console.log('  ✓ creative_projects / creative_scenes / creative_characters - Script import workspace (if created this run)');
    console.log('  ✓ creative_shots - Storyboard shots per scene (if created this run)');
    console.log('  ✓ project_assets - Per-project assets (scripts, characters, storyboards, video, files)');
    console.log('  ✓ creative_scripts - Standalone Script Wizard library');
    console.log('  ✓ bible_entities / bible_facts / bible_relationships - Production Bible foundation (if created this run)');
    console.log('  ✓ guide_messages / creative_decisions - Project Guide chat + decision log (if created this run)');
    console.log('  ✓ project_timelines - Per-project timeline documents (if created this run)');
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

