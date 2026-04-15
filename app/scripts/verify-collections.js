#!/usr/bin/env node

/**
 * PocketBase Collections Verification Script
 *
 * This script verifies that all collections match the expected schema.
 * It checks before and after operations to ensure everything is correct.
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
 * Normalize schema for comparison
 * Filters out system fields (id, created, updated) and normalizes field properties
 * Note: PocketBase doesn't return 'unique' on fields - uniqueness is handled via indexes
 */
function normalizeSchema(schema) {
    if (!schema || !Array.isArray(schema)) return [];
    return schema
        .filter(field => !field.system || field.name === 'id') // Keep id but filter other system fields
        .map(field => ({
            name: field.name,
            type: field.type,
            required: field.required === true, // Normalize to boolean
            presentable: field.presentable === true, // Normalize to boolean
            // Note: unique is not compared - it's handled via indexes
        }))
        .filter(field => field.name !== 'id') // Remove id from comparison
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize indexes for comparison
 */
function normalizeIndexes(indexes) {
    if (!indexes || !Array.isArray(indexes)) return [];
    return indexes.sort();
}

/**
 * Verify a collection matches expected schema
 */
function verifyCollection(collection, expected) {
    const issues = [];

    // Check name
    if (collection.name !== expected.name) {
        issues.push(`Name mismatch: expected "${expected.name}", got "${collection.name}"`);
    }

    // Check type
    if (collection.type !== expected.type) {
        issues.push(`Type mismatch: expected "${expected.type}", got "${collection.type}"`);
    }

    // Check schema
    const currentSchema = normalizeSchema(collection.schema || collection.fields || []);
    const expectedSchema = normalizeSchema(expected.schema || expected.fields || []);

    if (JSON.stringify(currentSchema) !== JSON.stringify(expectedSchema)) {
        issues.push('Schema mismatch');
        console.log('  Current schema:', JSON.stringify(currentSchema, null, 2));
        console.log('  Expected schema:', JSON.stringify(expectedSchema, null, 2));
    }

    // Check indexes
    const currentIndexes = normalizeIndexes(collection.indexes || []);
    const expectedIndexes = normalizeIndexes(expected.indexes || []);

    if (JSON.stringify(currentIndexes) !== JSON.stringify(expectedIndexes)) {
        issues.push('Indexes mismatch');
        console.log('  Current indexes:', currentIndexes);
        console.log('  Expected indexes:', expectedIndexes);
    }

    // Check rules
    const rules = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];
    for (const rule of rules) {
        const current = collection[rule] || '';
        const expectedRule = expected[rule] || '';
        if (current !== expectedRule) {
            issues.push(`${rule} mismatch: expected "${expectedRule}", got "${current}"`);
        }
    }

    return issues;
}

/**
 * Main verification function
 */
async function verify() {
    try {
        console.log('🔍 PocketBase Collections Verification\n');
        console.log(`📍 Connecting to: ${PB_URL}`);

        // Authenticate as admin
        console.log('🔐 Authenticating as admin...');
        await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
        console.log('✅ Authenticated successfully\n');

        // Load expected schema from collections.js
        console.log(`📄 Loading expected schema from collections.js`);
        const expectedSchema = getCollectionsArray();
        console.log(`✅ Loaded ${expectedSchema.length} expected collections\n`);

        // Verify each collection
        let allPassed = true;
        const results = [];

        for (const expected of expectedSchema) {
            console.log(`\n🔍 Verifying collection: ${expected.name}`);
            console.log('─'.repeat(50));

            try {
                // Get actual collection using API directly
                const response = await fetch(`${PB_URL}/api/collections/${expected.name}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': pb.authStore.token,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Collection not found: ${response.status}`);
                }

                const actual = await response.json();

                // Verify
                const issues = verifyCollection(actual, expected);

                if (issues.length === 0) {
                    console.log(`✅ Collection "${expected.name}" matches expected schema`);
                    results.push({ collection: expected.name, status: 'pass', issues: [] });

                    // Special checks for conversations collection
                    if (expected.name === 'conversations') {
                        const fields = actual.fields || [];
                        const hasMd = fields.some(f => f.name === 'md');
                        const hasMessagesJson = fields.some(f => f.name === 'messages_json');
                        console.log(`   Has MD field: ${hasMd ? '✅' : '❌'}`);
                        console.log(`   Has messages_json field: ${hasMessagesJson ? '✅' : '❌'}`);
                    }
                } else {
                    console.log(`❌ Collection "${expected.name}" has ${issues.length} issue(s):`);
                    issues.forEach(issue => console.log(`   - ${issue}`));
                    results.push({ collection: expected.name, status: 'fail', issues });
                    allPassed = false;
                }
            } catch (err) {
                console.log(`❌ Collection "${expected.name}" not found or error: ${err.message}`);
                results.push({ collection: expected.name, status: 'error', error: err.message });
                allPassed = false;
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 VERIFICATION SUMMARY');
        console.log('='.repeat(50));

        const passed = results.filter(r => r.status === 'pass').length;
        const failed = results.filter(r => r.status === 'fail').length;
        const errors = results.filter(r => r.status === 'error').length;

        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️  Errors: ${errors}`);
        console.log(`📄 Total: ${results.length}`);

        if (allPassed) {
            console.log('\n🎉 All collections verified successfully!');
            process.exit(0);
        } else {
            console.log('\n⚠️  Some collections have issues. See details above.');
            process.exit(1);
        }

    } catch (err) {
        console.error('\n💥 Fatal error:', err.message);
        process.exit(1);
    }
}

// Run verification
verify();
