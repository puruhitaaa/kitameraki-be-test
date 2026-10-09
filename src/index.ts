import { app } from '@azure/functions';

// In local development with Cosmos DB Emulator, allow self-signed certificates
if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development' || !process.env.WEBSITE_INSTANCE_ID) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

app.setup({
  enableHttpStream: true,
});
