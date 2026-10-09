# Kitameraki Backend Service (`kitameraki-be-test`)

Azure Functions (Node.js v4 programming model) backend service backed by Azure Cosmos DB for the Task Management and Form Settings application.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Available Scripts](#available-scripts)
- [API Reference](#api-reference)
- [Refactoring & Security Improvements](#refactoring--security-improvements)
- [Automated Testing](#automated-testing)

---

## Overview

- **Runtime:** Azure Functions v4 (`@azure/functions` ^4.0.0)
- **Language:** TypeScript 5 (compiled to ES2022 / CommonJS)
- **Database:** Azure Cosmos DB (`@azure/cosmos` ^4.0.0)
  - Database: `TaskApp`
  - Containers:
    - `Tasks` (Partition key: `/organizationId`)
    - `FormSettings` (Partition key: `/organizationId`)
- **Validation:** Zod schemas aligned with `task.schema.json`

---

## Prerequisites

- **Node.js:** `v20.x` or `v24.x`
- **npm:** `v10.x` or `v11.x`
- **Azure Functions Core Tools v4:**
  ```bash
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```
- **Cosmos DB (choose one):**
  - **Option A (Local Emulator):** Docker / Docker Desktop installed and running.
  - **Option B (Cloud Instance):** An active Azure Cosmos DB account connection string.

---

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment settings:**
   Copy the provided configuration template:
   ```bash
   cp local.settings.json.example local.settings.json
   ```
   The template includes `AZURE_FUNCTIONS_ENVIRONMENT: "Development"`, which instructs the Functions runtime to accept the local Cosmos DB emulator's self-signed TLS certificate during local development.

3. **Start & initialize local Cosmos DB:**
   - **If using the local emulator with Docker:**
     1. Start the emulator container:
        ```bash
        ./setup-emulator.sh
        ```
        *(This runs the `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator` container and waits until the endpoint at `https://localhost:8081` is healthy).*
     2. Initialize the database and containers:
        ```bash
        npm run init-db
        ```
        *(Creates the `TaskApp` database along with `Tasks` and `FormSettings` containers partitioned by `/organizationId`).*
   - **If using a live Azure Cosmos DB instance:**
     Update `COSMOS_DB_CONNECTION_STRING` in `local.settings.json` with your primary connection string, then run `npm run init-db` to provision the database and containers if they do not yet exist.

4. **Build TypeScript source:**
   ```bash
   npm run build
   ```

5. **Run unit tests:**
   ```bash
   npm test
   ```

6. **Start local Azure Functions host:**
   ```bash
   npm start
   ```
   Functions will be available at `http://localhost:7071/api/*`.

---

## Configuration

Settings are managed via `local.settings.json` (for local development) and Azure App Service Application Settings (in production):

| Setting | Description | Default |
|---|---|---|
| `AzureWebJobsStorage` | WebJobs storage connection string | `UseDevelopmentStorage=true` |
| `FUNCTIONS_WORKER_RUNTIME` | Functions worker runtime | `node` |
| `AZURE_FUNCTIONS_ENVIRONMENT` | Functions environment (`Development` trusts local emulator TLS) | `Development` |
| `COSMOS_DB_CONNECTION_STRING` | Primary Azure Cosmos DB connection string | `AccountEndpoint=...` |
| `COSMOS_DB_DATABASE_NAME` | Cosmos DB database name | `TaskApp` |
| `COSMOS_DB_CONTAINER_NAME` | Tasks container name | `Tasks` |
| `COSMOS_DB_FORM_SETTINGS_CONTAINER_NAME` | Form settings container name | `FormSettings` |
| `Host.CORS` | Allowed CORS origins for frontend dev server | `http://localhost:5173` |

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run build` | `tsc` | Compiles TypeScript source to `dist/` |
| `npm run watch` | `tsc -w` | Compiles in watch mode |
| `npm run clean` | `rimraf dist` | Removes build output directory |
| `npm run prestart` | `npm run clean && npm run build` | Cleans and compiles before starting |
| `npm start` | `NODE_TLS_REJECT_UNAUTHORIZED=0 func start` | Starts local Azure Functions host on port `7071` |
| `npm run init-db` | `node init-db.js` | Initializes `TaskApp` database and containers in Cosmos DB |
| `npm test` | `vitest run` | Runs the test suite |
| `npm run test:watch` | `vitest` | Runs the test suite in interactive watch mode |
| `npm run lint` | `tsc --noEmit` | Validates TypeScript typing without emitting code |
---

## API Reference

All requests require the tenant partition identifier (`organizationId`).

### Task Endpoints

#### 1. `GET /api/GetTasks`
Retrieves all tasks for the specified organization.
- **Query Parameters:**
  - `organizationId` (string, required): Organization UUID.
- **Response:** `200 OK`
  ```json
  [
    {
      "id": "e2a0b12e-...",
      "organizationId": "11111111-...",
      "title": "Invoice Customer",
      "description": "Send monthly invoice",
      "status": "todo",
      "priority": "high",
      "dueDate": "2026-11-20T14:30:00.000Z",
      "tags": ["finance"]
    }
  ]
  ```

#### 2. `GET /api/GetTask`
Retrieves a single task by ID and organization.
- **Query Parameters:**
  - `id` (string, required): Task ID.
  - `organizationId` (string, required): Organization UUID.
- **Response:** `200 OK` with task object, or `404 Not Found`.

#### 3. `POST /api/InsertTask`
Creates a new task.
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "organizationId": "11111111-...",
    "title": "Prepare Sprint Demo",
    "description": "Sprint 42 demo deck",
    "status": "in-progress",
    "priority": "medium",
    "dueDate": "2026-11-20T10:00:00.000Z",
    "tags": ["demo", "sprint"]
  }
  ```
  *(If `id` is omitted, a UUID v4 is automatically generated)*
- **Response:** `201 Created` with created task object.

#### 4. `POST /api/UpdateTask`
Updates mutable fields of an existing task using Cosmos DB `set` patch operations.
- **Query Parameters:**
  - `id` (string, required): Task ID.
  - `organizationId` (string, required): Organization UUID.
- **Request Body:** Partial object with fields to update (e.g. `{"status": "completed"}`).
  *(Immutable fields such as `id` and `organizationId` are rejected with 400 Bad Request).*
- **Response:** `200 OK` with updated task object, or `404 Not Found`.

#### 5. `DELETE /api/DeleteTask`
Deletes a task by ID.
- **Query Parameters:**
  - `id` (string, required): Task ID.
  - `organizationId` (string, required): Organization UUID.
- **Response:** `200 OK` `{"message": "Task deleted successfully"}`, or `404 Not Found`.

#### 6. `DELETE /api/BulkDeleteTasks`
Deletes multiple tasks concurrently in a single request.
- **Query Parameters:**
  - `organizationId` (string, required): Organization UUID.
- **Request Body:** Array of task ID strings:
  ```json
  ["task-id-1", "task-id-2", "task-id-3"]
  ```
- **Response:** `200 OK`
  ```json
  {
    "totalRequested": 3,
    "deletedCount": 3,
    "failedCount": 0,
    "failures": []
  }
  ```

---

### Form Settings Endpoints (Part 2)

#### 7. `GET /api/GetFormSettings`
Retrieves the form settings configuration for the organization.
- **Query Parameters:**
  - `organizationId` (string, required): Organization UUID.
- **Response:** `200 OK` (returns default schema if none yet configured).

#### 8. `POST /api/SaveFormSettings`
Saves or updates customizable form field settings.
- **Request Body:**
  ```json
  {
    "id": "default",
    "organizationId": "11111111-...",
    "fields": [
      {
        "id": "field-1",
        "name": "clientEmail",
        "label": "Client Email",
        "type": "email",
        "row": 0,
        "column": 0,
        "required": true
      },
      {
        "id": "field-2",
        "name": "meetingTime",
        "label": "Meeting Time",
        "type": "datetime",
        "row": 0,
        "column": 1,
        "required": false
      }
    ]
  }
  ```
- **Response:** `200 OK` with saved settings.

---

## Refactoring & Security Improvements

1. **SQL Injection Remediation (`GetTasks.ts`):**
   - **Before:** Direct string concatenation: `query: "SELECT * FROM c WHERE c.organizationId = '" + organizationId + "'"` allowing complete database traversal via payloads like `' OR '1'='1`.
   - **After:** Parameterized query execution using `@organizationId` parameter binding, guaranteeing tenant isolation.

2. **Singleton `CosmosClient` Pattern (`src/shared/cosmosClient.ts`):**
   - **Before:** Instantiating `new CosmosClient("...")` inside the request handler of every function on every invocation, causing high latency, connection pool churning, and socket exhaustion under load.
   - **After:** Shared singleton client instance cached across function invocations according to Microsoft Azure best practices, with environment-driven configuration and test injection seams.

3. **Asynchronous Batch Execution (`BulkDeleteTasks.ts`):**
   - **Before:** Used `body.forEach(async id => ...)` without `Promise.all` or `await`, resulting in unhandled promise execution, dropped errors, and returning HTTP 200 before deletions finished.
   - **After:** Uses `Promise.allSettled` to await all deletions concurrently, tracking individual failures and returning accurate execution metrics.

4. **Input Validation & System Path Whitelisting (`src/models/`):**
   - Integrated Zod runtime validation enforcing property types, max lengths, enums, and required fields according to `task.schema.json`.
   - Blocked destructive patches targeting partition keys (`/organizationId`), primary keys (`/id`), and Cosmos DB internal metadata (`/_rid`, `/_self`, `/_etag`).

5. **Cosmos DB Resilient Patching:**
   - Switched patch operations from `"replace"` to `"set"`, preventing runtime crashes when patching optional or newly introduced custom form fields that may not exist on older documents.

6. **Standardized HTTP Responses & Error Handling (`src/shared/http.ts`):**
   - Standardized status codes: `200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, and `500 Internal Server Error`.
   - Handled Cosmos DB 404 errors gracefully instead of crashing with unhandled 500s.

7. **TypeScript Strict Mode:**
   - Upgraded `tsconfig.json` to `"strict": true`, targeting modern `ES2022`, eliminating untyped references and runtime assumptions.

---

## Automated Testing

The project includes 28 unit tests powered by Vitest, verifying all endpoints with in-memory Cosmos DB container mocks:

```bash
npm test
```

Test coverage includes:
- Multi-tenant data isolation and SQL injection attack prevention.
- Retrieval, creation, patching, and deletion happy paths and error states.
- 400 Bad Request handling for missing parameters and invalid payloads.
- 404 Not Found handling for missing documents.
- Bulk deletion concurrency and partial failure reporting.
- Form settings retrieval and custom field persistence.
