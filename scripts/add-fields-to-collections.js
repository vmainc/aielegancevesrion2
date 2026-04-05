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
  if (!collection.schema || !Array.isArray(collection.schema)) {
    return false;
  }
  return collection.schema.some(field => field.name === fieldName);
}

async function addFieldsToCollections(adminEmail, adminPassword) {
  const pb = new PocketBase(POCKETBASE_URL);

  try {
    console.log('🔐 Authenticating as admin...');
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
    console.log('✅ Authenticated successfully\n');

    // Get users collection ID for relations
    console.log('🔍 Looking up users collection...');
    let usersCollectionId;
    try {
      const usersCollection = await pb.collections.getFirstListItem('name="users"');
      usersCollectionId = usersCollection.id;
      console.log(`✅ Found users collection (ID: ${usersCollectionId})\n`);
    } catch (error) {
      usersCollectionId = '_pb_users_auth_';
      console.log(`⚠️  Using default users collection ID: ${usersCollectionId}\n`);
    }

    // Update questions collection
    console.log('📝 Checking "questions" collection...');
    try {
      const questionsCollection = await pb.collections.getFirstListItem('name="questions"');
      console.log('✅ Found questions collection\n');

      const fieldsToAdd = [];
      const currentSchema = questionsCollection.schema || [];

      // Check for question field
      if (!fieldExists(questionsCollection, 'question')) {
        fieldsToAdd.push({
          name: 'question',
          type: 'text',
          required: true,
          options: { min: 1, max: 5000 }
        });
        console.log('  ➕ Will add: question (text, required)');
      } else {
        console.log('  ✓ question field already exists');
      }

      // Check for responses field
      if (!fieldExists(questionsCollection, 'responses')) {
        fieldsToAdd.push({
          name: 'responses',
          type: 'json',
          required: false
        });
        console.log('  ➕ Will add: responses (json, optional)');
      } else {
        console.log('  ✓ responses field already exists');
      }

      // Check for user field
      if (!fieldExists(questionsCollection, 'user')) {
        fieldsToAdd.push({
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
        });
        console.log('  ➕ Will add: user (relation to users, required)');
      } else {
        console.log('  ✓ user field already exists');
      }

      if (fieldsToAdd.length > 0) {
        console.log(`\n📝 Adding ${fieldsToAdd.length} field(s) to questions collection...`);
        const updatedSchema = [...currentSchema, ...fieldsToAdd];
        await pb.collections.update(questionsCollection.id, {
          schema: updatedSchema
        });
        console.log('✅ Questions collection updated successfully\n');
      } else {
        console.log('✅ All required fields already exist in questions collection\n');
      }

    } catch (error) {
      console.log('⚠️  Questions collection not found. Skipping...\n');
    }

    // Update user_points collection
    console.log('🎯 Checking "user_points" collection...');
    try {
      const userPointsCollection = await pb.collections.getFirstListItem('name="user_points"');
      console.log('✅ Found user_points collection\n');

      const fieldsToAdd = [];
      const currentSchema = userPointsCollection.schema || [];

      // Check for user field
      if (!fieldExists(userPointsCollection, 'user')) {
        fieldsToAdd.push({
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
        });
        console.log('  ➕ Will add: user (relation to users, required, unique)');
      } else {
        console.log('  ✓ user field already exists');
      }

      // Check for points field
      if (!fieldExists(userPointsCollection, 'points')) {
        fieldsToAdd.push({
          name: 'points',
          type: 'number',
          required: true,
          options: { min: 0 }
        });
        console.log('  ➕ Will add: points (number, required, min: 0)');
      } else {
        console.log('  ✓ points field already exists');
      }

      if (fieldsToAdd.length > 0) {
        console.log(`\n🎯 Adding ${fieldsToAdd.length} field(s) to user_points collection...`);
        const updatedSchema = [...currentSchema, ...fieldsToAdd];
        await pb.collections.update(userPointsCollection.id, {
          schema: updatedSchema
        });
        console.log('✅ User points collection updated successfully\n');
      } else {
        console.log('✅ All required fields already exist in user_points collection\n');
      }

    } catch (error) {
      console.log('⚠️  User points collection not found. Skipping...\n');
    }

    // creative_projects — director + continuity (existing installs)
    console.log('🎬 Checking "creative_projects" collection...');
    try {
      const col = await pb.collections.getFirstListItem('name="creative_projects"');
      const fieldsToAdd = [];
      const currentSchema = col.schema || [];

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

      if (fieldsToAdd.length > 0) {
        await pb.collections.update(col.id, { schema: [...currentSchema, ...fieldsToAdd] });
        console.log('✅ creative_projects updated\n');
      } else {
        console.log('✅ creative_projects already has director/continuity fields\n');
      }
    } catch (e) {
      console.log('⚠️  creative_projects not found. Skipping...\n');
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

