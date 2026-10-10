import { Container, CosmosClient } from '@azure/cosmos';
import {
  createDefaultFormSettings,
  type FormSettings,
} from '../models/formSettings';

let cachedClient: CosmosClient | null = null;

export interface CosmosConfig {
  connectionString: string;
  databaseName: string;
  tasksContainerName: string;
  formSettingsContainerName: string;
}

export function getCosmosConfig(): CosmosConfig {
  const connectionString =
    process.env.COSMOS_DB_CONNECTION_STRING ||
    process.env.Values__COSMOS_DB_CONNECTION_STRING ||
    process.env.CosmosDbConnectionString ||
    '';

  const databaseName =
    process.env.COSMOS_DB_DATABASE_NAME ||
    process.env.Values__COSMOS_DB_DATABASE_NAME ||
    'TaskApp';

  const tasksContainerName =
    process.env.COSMOS_DB_CONTAINER_NAME ||
    process.env.Values__COSMOS_DB_CONTAINER_NAME ||
    'Tasks';

  const formSettingsContainerName =
    process.env.COSMOS_DB_FORM_SETTINGS_CONTAINER_NAME ||
    process.env.Values__COSMOS_DB_FORM_SETTINGS_CONTAINER_NAME ||
    'FormSettings';

  return {
    connectionString,
    databaseName,
    tasksContainerName,
    formSettingsContainerName,
  };
}

export function getCosmosClient(): CosmosClient {
  if (cachedClient) {
    return cachedClient;
  }

  const { connectionString } = getCosmosConfig();
  if (!connectionString) {
    throw new Error(
      'Missing Cosmos DB connection string. Set COSMOS_DB_CONNECTION_STRING in local.settings.json or environment variables.',
    );
  }

  cachedClient = new CosmosClient(connectionString);
  return cachedClient;
}

export function setCosmosClient(client: CosmosClient | null): void {
  cachedClient = client;
}

export function getTasksContainer(): Container {
  const { databaseName, tasksContainerName } = getCosmosConfig();
  return getCosmosClient().database(databaseName).container(tasksContainerName);
}

export function getFormSettingsContainer(): Container {
  const { databaseName, formSettingsContainerName } = getCosmosConfig();
  return getCosmosClient().database(databaseName).container(formSettingsContainerName);
}

export function isCosmosNotFound(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? error.code : undefined;
    const statusCode = 'statusCode' in error ? error.statusCode : undefined;
    return code === 404 || statusCode === 404;
  }
  return false;
}

export async function getFormSettingsByOrg(organizationId: string): Promise<FormSettings> {
  try {
    const { resource } = await getFormSettingsContainer()
      .item('default', organizationId)
      .read<FormSettings>();
    return resource ?? createDefaultFormSettings(organizationId);
  } catch (error) {
    if (isCosmosNotFound(error)) return createDefaultFormSettings(organizationId);
    throw error;
  }
}
