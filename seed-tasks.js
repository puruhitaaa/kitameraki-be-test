const crypto = require('crypto');
const { CosmosClient } = require('@azure/cosmos');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Configuration resolution
const connectionString =
  process.env.COSMOS_DB_CONNECTION_STRING ||
  'AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

const databaseName = process.env.COSMOS_DB_DATABASE_NAME || 'TaskApp';
const containerName = process.env.COSMOS_DB_CONTAINER_NAME || 'Tasks';
const organizationId =
  process.env.ORGANIZATION_ID || '11111111-1111-4111-8111-111111111111';

// Parse CLI flags
const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith('--count='));
const seedCount = countArg
  ? parseInt(countArg.split('=')[1], 10)
  : parseInt(process.env.SEED_COUNT || '100', 10);
const clean = args.includes('--clean');

// Realistic templates for task generation
const DOMAINS = [
  {
    category: 'frontend',
    verbs: ['Implement', 'Refactor', 'Optimize', 'Redesign', 'Fix bug in', 'Add unit tests for'],
    features: [
      'Task table pagination component',
      'Debounced search filter input',
      'Dark mode theme switcher',
      'Accessible keyboard navigation',
      'Responsive mobile drawer menu',
      'Dynamic form builder renderer',
      'CSV task export modal',
      'Bulk action confirmation dialog',
      'Multi-select priority dropdown',
      'Due date picker calendar with timezone support',
    ],
    tagsList: [
      ['frontend', 'ui'],
      ['frontend', 'accessibility'],
      ['frontend', 'performance'],
      ['frontend', 'forms'],
      ['frontend', 'components'],
    ],
  },
  {
    category: 'backend',
    verbs: ['Build', 'Benchmark', 'Harden', 'Document', 'Instrument', 'Migrate'],
    features: [
      'Cosmos DB parameterized query indexes',
      'Bulk task deletion concurrency handling',
      'Form settings patch endpoint',
      'OpenTelemetry distributed tracing exporter',
      'Tenant isolation validation middleware',
      'Health check readiness and liveness probes',
      'Zod request validation for task schemas',
      'Connection pooling for Cosmos DB client',
      'Rate limiting per tenant organization',
      'Azure Functions v4 cold-start optimization',
    ],
    tagsList: [
      ['backend', 'api'],
      ['backend', 'database'],
      ['backend', 'performance'],
      ['backend', 'security'],
      ['backend', 'monitoring'],
    ],
  },
  {
    category: 'devops',
    verbs: ['Configure', 'Automate', 'Review', 'Upgrade', 'Audit', 'Provision'],
    features: [
      'Cosmos DB local emulator Docker compose service',
      'GitHub Actions CI matrix for Node 20 and 22',
      'Terraform module for Azure Cosmos DB account',
      'Dependency security audit and automated PRs',
      'Staging deployment environment secrets',
      'Synthetic user synthetic smoke test pipeline',
      'Container registry image vulnerability scanner',
      'Nginx reverse proxy with CORS headers',
      'Automated database backup retention policy',
      'Static asset compression with Brotli',
    ],
    tagsList: [
      ['infrastructure', 'docker'],
      ['infrastructure', 'ci-cd'],
      ['security', 'audit'],
      ['devops', 'cloud'],
    ],
  },
  {
    category: 'qa',
    verbs: ['Verify', 'Profile', 'Stress test', 'Write regression suite for', 'Validate', 'Smoke test'],
    features: [
      'End-to-end task creation and edit user flow',
      'Cross-browser compatibility on Firefox and Safari',
      'High-latency network handling and offline indicators',
      'Large dataset rendering with 1,000 items',
      'Keyboard accessibility screen reader announcements',
      'Edge case validation with special UTF-8 characters',
      'Form settings drag-and-drop column layout',
      'Token expiration and re-authentication flow',
      'Rapid concurrent task status toggles',
      'Exported JSON schema alignment with TaskApp API',
    ],
    tagsList: [
      ['qa', 'testing'],
      ['qa', 'regression'],
      ['bug', 'critical'],
      ['testing', 'e2e'],
    ],
  },
];

const STATUSES = ['todo', 'in-progress', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];

function generateTasks(count, orgId) {
  const tasks = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const domain = DOMAINS[i % DOMAINS.length];
    const verb = domain.verbs[Math.floor(i / DOMAINS.length) % domain.verbs.length];
    const feature = domain.features[(i * 3) % domain.features.length];
    const title = `${verb} ${feature} (Task #${i + 1})`.slice(0, 100);

    const status = STATUSES[i % STATUSES.length];
    const priority = PRIORITIES[Math.floor(i / 2) % PRIORITIES.length];

    // Due dates distributed between -14 days ago and +45 days from now
    const dayOffset = (i % 60) - 14;
    const dueDate = new Date(now + dayOffset * dayMs).toISOString();

    const tags = domain.tagsList[i % domain.tagsList.length];

    const description =
      `Detailed tracking for: ${feature}.\n` +
      `Category: ${domain.category}. Priority level: ${priority}. Target status: ${status}.\n` +
      `Ensure full alignment with architectural guidelines, multi-tenant safety, and automated test coverage.`;

    tasks.push({
      id: crypto.randomUUID(),
      organizationId: orgId,
      title,
      description,
      dueDate,
      priority,
      status,
      tags,
    });
  }

  return tasks;
}

async function seed() {
  console.log(`Connecting to Cosmos DB...`);
  console.log(`Database:     ${databaseName}`);
  console.log(`Container:    ${containerName}`);
  console.log(`Organization: ${organizationId}`);
  console.log(`Task Count:   ${seedCount}`);

  const client = new CosmosClient(connectionString);

  // Ensure database exists
  const { database } = await client.databases.createIfNotExists({ id: databaseName });
  // Ensure container exists
  const { container } = await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ['/organizationId'] },
  });

  if (clean) {
    console.log(`\n--clean flag provided. Removing existing tasks for organization ${organizationId}...`);
    const query = {
      query: 'SELECT c.id FROM c WHERE c.organizationId = @orgId',
      parameters: [{ name: '@orgId', value: organizationId }],
    };
    const { resources: existingTasks } = await container.items.query(query).fetchAll();
    console.log(`Found ${existingTasks.length} existing tasks to delete.`);

    const deleteBatchSize = 10;
    for (let i = 0; i < existingTasks.length; i += deleteBatchSize) {
      const batch = existingTasks.slice(i, i + deleteBatchSize);
      await Promise.all(
        batch.map((t) => container.item(t.id, organizationId).delete())
      );
    }
    console.log(`✓ Deleted ${existingTasks.length} existing tasks.`);
  }

  console.log(`\nGenerating ${seedCount} tasks...`);
  const tasks = generateTasks(seedCount, organizationId);

  console.log(`Inserting tasks into '${containerName}' in batches of 10...`);
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map((task) => container.items.create(task)));
    inserted += batch.length;
    process.stdout.write(`  Progress: ${inserted}/${tasks.length} tasks inserted...\r`);
  }

  console.log(`\n✓ Successfully seeded ${inserted} tasks for organization ${organizationId}.`);
}

seed().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
