#!/usr/bin/env node

/**
 * PocketBase Collections Setup Script
 *
 * This script creates and updates collections in PocketBase using the admin API.
 * It reads the schema from collections.js and ensures all collections are properly
 * configured with fields, indexes, and access rules.
 *
 * The script is flexible and handles:
 * - Creating new collections
 * - Updating existing collections (adding new fields, updating rules)
 * - Resolving relation field dependencies
 * - Handling field additions incrementally
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCollectionsArray } from './collections.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
let env = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
} catch (error) {
  console.error('❌ Error: Could not read .env file');
  process.exit(1);
}

// Configuration from .env
const PB_URL = env.PB_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD;

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error('❌ Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

// Initialize PocketBase client
const pb = new PocketBase(PB_URL);

/**
 * Resolve relation field collection IDs
 * Converts collection names to actual IDs
 */
async function resolveRelationFields(fields) {
  const resolved = [];
  for (const field of fields) {
    if (field.type === 'relation' && field.collectionId) {
      try {
        const targetCollection = await pb.collections.getOne(field.collectionId);
        resolved.push({
          ...field,
          collectionId: targetCollection.id,
        });
      } catch (error) {
        // If collection doesn't exist yet, keep the name (will be resolved later)
        resolved.push(field);
      }
    } else {
      resolved.push(field);
    }
  }
  return resolved;
}

/**
 * Check if collections are different (for update detection)
 */
function collectionsAreDifferent(existing, desired) {
  // Compare field names
  const existingFieldNames = (existing.fields || []).map(f => f.name).sort();
  const desiredFieldNames = (desired.fields || []).map(f => f.name).sort();

  if (JSON.stringify(existingFieldNames) !== JSON.stringify(desiredFieldNames)) {
    return true;
  }

  // Compare rules
  const rules = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];
  for (const rule of rules) {
    const existingRule = existing[rule] || '';
    const desiredRule = desired[rule] || '';
    if (existingRule !== desiredRule) {
      return true;
    }
  }

  // Compare indexes
  const existingIndexes = (existing.indexes || []).sort().join(',');
  const desiredIndexes = (desired.indexes || []).sort().join(',');
  if (existingIndexes !== desiredIndexes) {
    return true;
  }

  return false;
}

/**
 * Create a collection
 */
async function createCollection(collectionData) {
  try {
    console.log(`\n📦 Creating collection: ${collectionData.name}`);

    // Resolve relation fields
    const fields = await resolveRelationFields(collectionData.fields || []);

    // Prepare collection data
    const data = {
      name: collectionData.name,
      type: collectionData.type,
      system: collectionData.system || false,
      fields: fields,
    };

    // Temporarily remove indexes and rules if fields reference other collections
    const hasRelationFields = fields.some(f => f.type === 'relation');
    const indexes = collectionData.indexes || [];
    const rules = {
      listRule: collectionData.listRule || null,
      viewRule: collectionData.viewRule || null,
      createRule: collectionData.createRule || null,
      updateRule: collectionData.updateRule || null,
      deleteRule: collectionData.deleteRule || null,
    };

    // Check if rules reference fields
    const hasFieldRefsInRules = Object.values(rules).some(rule => {
      if (!rule) return false;
      return fields.some(field => {
        const patterns = [
          new RegExp(`\\b${field.name}\\s*[=!<>]`),
          new RegExp(`\\b${field.name}\\s*[|&]`),
          new RegExp(`\\b${field.name}\\.id\\s*[=!<>]`),
        ];
        return patterns.some(pattern => pattern.test(rule));
      });
    });

    // If rules reference fields, create with simplified rules first
    if (hasFieldRefsInRules) {
      const tempRules = { ...rules };
      Object.keys(tempRules).forEach(ruleKey => {
        if (tempRules[ruleKey]) {
          const hasFieldRef = fields.some(field => {
            const patterns = [
              new RegExp(`\\b${field.name}\\s*[=!<>]`),
              new RegExp(`\\b${field.name}\\s*[|&]`),
              new RegExp(`\\b${field.name}\\.id\\s*[=!<>]`),
            ];
            return patterns.some(pattern => pattern.test(tempRules[ruleKey]));
          });

          if (hasFieldRef) {
            // Temporarily use simple rule
            data[ruleKey] = ruleKey === 'createRule' ? '' : '@request.auth.id != ""';
          } else {
            data[ruleKey] = tempRules[ruleKey];
          }
        }
      });
    } else {
      // Add rules directly
      Object.assign(data, rules);
    }

    // Create collection
    console.log(`   📤 Creating with ${fields.length} fields...`);
    const collection = await pb.collections.create(data);
    console.log(`   ✅ Collection created (ID: ${collection.id})`);

    // Verify fields were created
    const createdFields = collection.fields || [];
    console.log(`   📊 Created with ${createdFields.length} fields`);

    // Update rules if needed (after fields exist)
    if (hasFieldRefsInRules) {
      console.log(`   🔄 Updating rules...`);
      try {
        await pb.collections.update(collection.id, rules);
        console.log(`   ✅ Rules updated`);
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not update rules: ${error.message}`);
      }
    }

    // Add indexes
    if (indexes.length > 0) {
      console.log(`   🔄 Adding indexes...`);
      try {
        await pb.collections.update(collection.id, { indexes });
        console.log(`   ✅ Indexes added`);
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not add indexes: ${error.message}`);
      }
    }

    return collection;
  } catch (error) {
    console.error(`   ❌ Error creating collection "${collectionData.name}":`, error.message);
    if (error.data) {
      console.error(`   📋 Error details:`, JSON.stringify(error.data, null, 2));
    }
    throw error;
  }
}

/**
 * Update a collection (adds missing fields, updates rules/indexes)
 */
async function updateCollection(collectionId, collectionData) {
  try {
    console.log(`\n🔄 Updating collection: ${collectionData.name}`);

    // Get current collection
    const current = await pb.collections.getOne(collectionId);

    // Resolve relation fields
    const desiredFields = await resolveRelationFields(collectionData.fields || []);
    const currentFields = current.fields || [];

    // Check for missing fields
    const currentFieldNames = currentFields.map(f => f.name);
    const desiredFieldNames = desiredFields.map(f => f.name);
    const missingFields = desiredFields.filter(f => !currentFieldNames.includes(f.name));

    if (missingFields.length > 0) {
      console.log(`   📤 Adding ${missingFields.length} new field(s)...`);

      // Get non-system fields for update
      const nonSystemFields = currentFields
        .filter(f => !f.system || f.name === 'id')
        .map(f => {
          const { id, ...clean } = f;
          return clean;
        })
        .filter(f => f.name !== 'id');

      // Add new fields
      const updatedFields = [...nonSystemFields, ...missingFields];

      try {
        await pb.collections.update(collectionId, { fields: updatedFields });
        console.log(`   ✅ Added fields: ${missingFields.map(f => f.name).join(', ')}`);
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not add fields: ${error.message}`);
      }
    }

    // Update rules if changed
    const rulesToUpdate = {};
    ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'].forEach(rule => {
      const currentRule = current[rule] || '';
      const desiredRule = collectionData[rule] || '';
      if (currentRule !== desiredRule) {
        rulesToUpdate[rule] = desiredRule;
      }
    });

    if (Object.keys(rulesToUpdate).length > 0) {
      console.log(`   🔄 Updating rules...`);
      try {
        await pb.collections.update(collectionId, rulesToUpdate);
        console.log(`   ✅ Rules updated`);
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not update rules: ${error.message}`);
      }
    }

    // Update indexes if changed
    const currentIndexes = (current.indexes || []).sort().join(',');
    const desiredIndexes = (collectionData.indexes || []).sort().join(',');

    if (currentIndexes !== desiredIndexes) {
      console.log(`   🔄 Updating indexes...`);
      try {
        await pb.collections.update(collectionId, { indexes: collectionData.indexes || [] });
        console.log(`   ✅ Indexes updated`);
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not update indexes: ${error.message}`);
      }
    }

    console.log(`   ✅ Collection updated successfully`);
    return await pb.collections.getOne(collectionId);
  } catch (error) {
    console.error(`   ❌ Error updating collection "${collectionData.name}":`, error.message);
    if (error.data) {
      console.error(`   📋 Error details:`, JSON.stringify(error.data, null, 2));
    }
    throw error;
  }
}

/**
 * Main setup function
 */
async function setup() {
  try {
    console.log('🚀 PocketBase Collections Setup\n');
    console.log(`📍 Connecting to: ${PB_URL}`);

    // Authenticate as admin
    console.log('🔐 Authenticating as admin...');
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('✅ Authenticated successfully\n');

    // Load collections from schema
    const collections = getCollectionsArray();
    console.log(`📄 Loaded ${collections.length} collections from schema\n`);

    // Process each collection
    const results = [];
    for (const collectionData of collections) {
      try {
        // Check if collection exists
        let existing;
        try {
          existing = await pb.collections.getOne(collectionData.name);
        } catch (error) {
          existing = null;
        }

        if (existing) {
          // Check if update is needed
          if (collectionsAreDifferent(existing, collectionData)) {
            const result = await updateCollection(existing.id, collectionData);
            results.push({ collection: collectionData.name, status: 'updated', result });
          } else {
            console.log(`⏭️  Collection "${collectionData.name}" is up to date`);
            results.push({ collection: collectionData.name, status: 'skipped', result: existing });
          }
        } else {
          // Create new collection
          const result = await createCollection(collectionData);
          results.push({ collection: collectionData.name, status: 'created', result });
        }
      } catch (error) {
        results.push({ collection: collectionData.name, status: 'error', error: error.message });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SETUP SUMMARY');
    console.log('='.repeat(50));

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`✅ Created: ${created}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📄 Total: ${results.length}`);

    if (errors > 0) {
      console.log('\n❌ Collections with errors:');
      results.filter(r => r.status === 'error').forEach(r => {
        console.log(`   - ${r.collection}: ${r.error}`);
      });
      process.exit(1);
    }

    // Verify rules are correctly applied
    console.log('\n🔍 Verifying security rules...');
    let verificationPassed = true;

    for (const collectionData of collections) {
      try {
        const existing = await pb.collections.getOne(collectionData.name);
        const rules = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];

        for (const rule of rules) {
          const expectedRule = collectionData[rule] || '';
          const actualRule = existing[rule] || '';

          if (expectedRule !== actualRule) {
            console.error(`   ❌ ${collectionData.name}.${rule} mismatch:`);
            console.error(`      Expected: ${expectedRule}`);
            console.error(`      Actual: ${actualRule}`);
            verificationPassed = false;
          }
        }
      } catch (error) {
        console.error(`   ❌ Error verifying ${collectionData.name}: ${error.message}`);
        verificationPassed = false;
      }
    }

    if (verificationPassed) {
      console.log('   ✅ All security rules verified');
    } else {
      console.error('\n⚠️  Warning: Some security rules do not match expected values');
      console.error('   Please review and update manually if needed');
    }

    console.log('\n🎉 Setup complete!');
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (error.data) {
      console.error('Error details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

// Run setup
setup();
