const { CosmosClient } = require('@azure/cosmos');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString =
  process.env.COSMOS_DB_CONNECTION_STRING ||
  'AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

async function init() {
  console.log('Connecting to Cosmos DB Emulator...');
  const client = new CosmosClient(connectionString);

  console.log("Ensuring database 'TaskApp' exists...");
  const { database } = await client.databases.createIfNotExists({ id: 'TaskApp' });
  console.log("✓ Database 'TaskApp' ready");

  console.log("Ensuring container 'Tasks' exists (partition key: /organizationId)...");
  await database.containers.createIfNotExists({
    id: 'Tasks',
    partitionKey: { paths: ['/organizationId'] },
  });
  console.log("✓ Container 'Tasks' ready");

  console.log("Ensuring container 'FormSettings' exists (partition key: /organizationId)...");
  await database.containers.createIfNotExists({
    id: 'FormSettings',
    partitionKey: { paths: ['/organizationId'] },
  });
  console.log("✓ Container 'FormSettings' ready");

  console.log('\nAll databases and containers initialized successfully!');
}

init().catch((err) => {
  console.error('Init failed:', err);
  process.exit(1);
});
