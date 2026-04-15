import PocketBase from 'pocketbase';

const PB_URL = 'https://howicc.aaho.cc';
const ADMIN_EMAIL = 'abdallah.ali.hassan@gmail.com';
const ADMIN_PASSWORD = 'K3x6qpv!hV-Avxzdfg';

async function verifyData() {
  console.log(`Connecting to ${PB_URL}...`);
  const pb = new PocketBase(PB_URL);

  try {
    // Authenticate
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✓ Authenticated as admin');

    // Fetch list of collections to verify existence
    const collectionsList = await pb.collections.getFullList();
    console.log('Available collections:', collectionsList.map(c => c.name).join(', '));

    // Try fetching users to check if it's collection-specific
    try {
      const users = await pb.collection('users').getList(1, 1);
      console.log(`✓ Users collection accessible (found ${users.totalItems} users)`);
    } catch (e) {
      console.error('✗ Failed to fetch users:', e.message);
    }

    // Use raw fetch to get data since SDK is failing
    console.log('Fetching conversations via raw fetch...');
    const token = pb.authStore.token;
    const response = await fetch(`${PB_URL}/api/collections/conversations/records?page=1&perPage=50`, {
      headers: {
        'Authorization': token,
      }
    });

    let conversations = { totalItems: 0, items: [] };

    if (!response.ok) {
      const text = await response.text();
      console.error('Raw fetch failed:', response.status, text);
      throw new Error(`Raw fetch failed: ${response.status}`);
    } else {
      const data = await response.json();
      console.log(`Raw fetch success. Found ${data.totalItems} items.`);
      conversations = data;
    }

    console.log(`\nFound ${conversations.totalItems} total conversations.`);
    console.log(`Checking the last ${conversations.items.length} items for E2E test data...\n`);

    const e2eTitles = [
      'CLI Sync - Private Tutorial',
      'CLI Sync - Unlisted Project',
      'CLI Sync - Public Featured',
      'CLI Sync - Public Unlisted',
      'CLI Sync - Private Debug',
      'Test Private Conversation',
      'Test Unlisted Conversation',
      'Test Public Conversation',
      'Test Publish Conversation',
      'Test Conversation with Secrets'
    ];

    let foundCount = 0;
    let solidCount = 0;

    for (const conv of conversations.items) {
      // Check if this is likely an E2E test conversation
      const isE2E = e2eTitles.some(t => conv.title === t) || conv.title.startsWith('Test ');

      if (isE2E) {
        foundCount++;
        console.log(`[${conv.created}] Found E2E Conversation: "${conv.title}" (${conv.id})`);

        // Verify data integrity
        let isSolid = true;
        const issues = [];

        if (!conv.timeline || !Array.isArray(conv.timeline) || conv.timeline.length === 0) {
          isSolid = false;
          issues.push('Missing or empty timeline');
        }

        if (!conv.checksum) {
          isSolid = false;
          issues.push('Missing checksum');
        }

        if (!conv.slug) {
          isSolid = false;
          issues.push('Missing slug');
        }

        if (conv.visibility !== 'private' && conv.visibility !== 'public' && conv.visibility !== 'unlisted') {
           isSolid = false;
           issues.push(`Invalid visibility: ${conv.visibility}`);
        }

        if (isSolid) {
          console.log(`  ✓ Data integrity check passed`);
          solidCount++;
        } else {
          console.error(`  ✗ Data integrity issues: ${issues.join(', ')}`);
        }
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Found ${foundCount} recent E2E test conversations.`);
    console.log(`- ${solidCount} of them have solid data integrity.`);

    if (foundCount > 0 && foundCount === solidCount) {
      console.log('\n✓ VERIFICATION SUCCESSFUL: Uploaded data is solid.');
    } else if (foundCount === 0) {
      console.warn('\n⚠ WARNING: No recent E2E test data found. Did the tests run against this instance?');
    } else {
      console.error('\n✗ VERIFICATION FAILED: Some data integrity issues found.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error verifying data:', error);
    process.exit(1);
  }
}

verifyData();
