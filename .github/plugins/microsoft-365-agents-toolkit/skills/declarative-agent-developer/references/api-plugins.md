# API Plugin Architecture for M365 JSON Agents

> **Note:** This guide is for JSON-based agents. API plugins are defined using JSON manifest files that reference OpenAPI specifications.

## Overview

API plugins (also called "actions") allow your M365 Copilot agent to interact with external REST APIs. They consist of:

1. **OpenAPI Specification** - Describes the REST API endpoints, parameters, and responses
2. **API Plugin Manifest** (JSON) - Configures how M365 Copilot interacts with the API
3. **Declarative Agent Reference** - Links the plugin to your agent via the `actions` array

---

## ⛔ Post-`npx -y --package @microsoft/m365agentstoolkit-cli atk add action` Checklist — MANDATORY

After running `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`, you **MUST** complete ALL of these before validating and deploying:

1. **Update `name_for_human`** in ai-plugin.json — descriptive, user-facing name (max 20 chars)
2. **Update `description_for_model`** in ai-plugin.json — detailed guidance for the AI on when and how to use each function
3. **Customize adaptive cards** in `appPackage/adaptiveCards/` for each operation — different layouts per HTTP verb (list view for GET collections, detail view for GET by ID, confirmation for DELETE, etc.)
4. **Add `confirmation` dialogs** for all destructive operations (POST, PUT, PATCH, DELETE)
5. **Deploy** with `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false`

Skipping ANY of these steps = incomplete work. The `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` command generates scaffolding — **you must finish the job** by customizing every generated file.

---

## Adding API Plugins with ATK CLI

> **⚠️ IMPORTANT:** When adding an API, OpenAPI spec, or REST API to your agent, you **MUST** use the `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` command. This is the required method for adding API plugins to M365 Copilot agents. **Do NOT manually create plugin files** - the path resolution between local packaging and M365 service validation is complex and error-prone.

> **⛔ ONE PLUGIN PER API — HARD RULE:** Always add ALL operations from the same OpenAPI spec in a **single** `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` call. List every operation in the `--api-operation` parameter as a comma-separated list. **NEVER** run separate `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` calls for different operations from the same spec — this creates multiple plugins instead of one unified plugin. One OpenAPI spec = one `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` call = one plugin.

### The `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` Command

**ALWAYS use this command** when asked to add an API, OpenAPI specification, or REST API to an M365 Copilot agent:

```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk add action \
  --api-plugin-type api-spec \
  --openapi-spec-type enter-url-or-open-local-file \
  --openapi-spec-location URL_OR_FILE_PATH \
  --api-operation "OPERATIONS_TO_MAP" \
  -i false
```

### Command Parameters

| Parameter | Description |
|-----------|-------------|
| `--api-plugin-type` | Type of plugin. Use `api-spec` for OpenAPI-based plugins. |
| `--openapi-spec-type` | How to provide the spec. Use `enter-url-or-open-local-file`. |
| `--openapi-spec-location` | URL or local file path to the OpenAPI specification. |
| `--api-operation` | Comma-separated list of operations to include (format: `METHOD /path`). |
| `-i false` | Non-interactive mode. |

### ⚠️ CRITICAL: Use Absolute Paths for Local Files

When using a local OpenAPI specification file, you **MUST use an absolute path**:

```bash
# ✅ CORRECT - Absolute path
--openapi-spec-location /home/user/project/openapi.json

# ❌ WRONG - Relative path (will fail!)
--openapi-spec-location ./openapi.json
--openapi-spec-location openapi.json
```

**Why?** The ATK CLI executes from a temporary directory, so relative paths cannot be resolved. Always use the full absolute path to your OpenAPI specification file.

### Operation Format

The `--api-operation` parameter uses the format: `METHOD /path,METHOD /path,...`

**Example with Repairs API (URL):**
```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk add action \
  --api-plugin-type api-spec \
  --openapi-spec-type enter-url-or-open-local-file \
  --openapi-spec-location "https://repairshub.azurewebsites.net/openapi.json" \
  --api-operation "GET /repairs,GET /repairs/{id},POST /repairs,PATCH /repairs/{id},DELETE /repairs/{id}" \
  -i false
```

**Example with local file (absolute path):**
```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk add action \
  --api-plugin-type api-spec \
  --openapi-spec-type enter-url-or-open-local-file \
  --openapi-spec-location /home/user/myproject/nhl-openapi.json \
  --api-operation "GET /v1/standings/now,GET /v1/score/now,GET /v1/schedule/now" \
  -i false
```

### What the Command Creates

After running `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`, the following files are created/updated:

```
appPackage/
├── declarativeAgent.json     # Updated with action reference
├── ai-plugin.json            # API plugin manifest (generated)
├── adaptiveCards/            # Response templates (auto-generated)
│   ├── getRepairs.json
│   ├── getRepairById.json
│   └── ...
└── apiSpecificationFile/
    ├── openapi.yaml          # OpenAPI spec (converted to 3.0 if needed)
    └── openapi.yaml.original # Original spec (if converted)
```

> **Note:** OpenAPI 3.1 specifications are automatically converted to OpenAPI 3.0 format for compatibility.

### Post-Generation: Enhance the Plugin

After running `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`, you **MUST** enhance the generated files:

1. **Update `name_for_human`** - Make it descriptive and user-friendly
2. **Update `description_for_model`** - Add detailed guidance on when and how to use each function
3. **🎨 Update adaptive cards for each action** - Customize the auto-generated cards in `appPackage/adaptiveCards/` to present meaningful, well-structured data for each operation

**Example plugin enhancement:**
```json
{
  "name_for_human": "NHL Data API",
  "description_for_human": "Access real-time NHL standings, scores, and player statistics",
  "description_for_model": "Use this plugin to access real-time NHL data. Call getCurrentStandings for league standings. Call getTodaysScores for today's game scores or getScoresByDate for historical scores (YYYY-MM-DD format). Call getCurrentTeamStats or getCurrentRoster with a 3-letter team code (TOR, BOS, NYR, MTL, EDM, VGK, etc.). Always provide context about the data format and available parameters."
}
```

The `description_for_model` is critical - it tells the AI when to use each function and what parameters to provide.

### 🎨 Post-Generation: Enhance Adaptive Cards for Each Action

The `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` command auto-generates basic adaptive cards in `appPackage/adaptiveCards/` — one per operation. These default cards are generic and only display raw data. **You MUST customize each card** to provide a valuable UX tailored to the data each action returns.

#### ⚠️ CRITICAL: Check ALL Operations Have Adaptive Cards

After running `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`, **verify that an adaptive card exists for EVERY operation**. The command may not generate cards for POST, PATCH, or DELETE operations. **If any operation is missing an adaptive card, CREATE one manually** in `appPackage/adaptiveCards/`.

- **GET operations** → List or detail layout showing returned data
- **POST operations** → Confirmation/summary layout showing what was created
- **PATCH operations** → Summary layout showing what was updated
- **DELETE operations** → Confirmation layout confirming what was deleted

#### Why Customize Adaptive Cards?

- **Default cards are generic** — they list all response fields as plain text with no hierarchy or formatting
- **Users expect rich, scannable output** — titles, subtitles, key metrics, and visual hierarchy help users quickly understand results
- **Different actions need different layouts** — a list of items needs a different card than a single detail view or a confirmation response

#### How to Enhance Each Card

For **each** adaptive card file generated in `appPackage/adaptiveCards/`:

1. **Examine the API response schema** — understand what fields each operation returns
2. **Identify the most important fields** — determine what users care about most (title, status, date, assignee, etc.)
3. **Design a clear visual hierarchy** — use `weight: "Bolder"`, `size: "Medium"/"Large"`, `spacing`, and `separator` to create structure
4. **Use appropriate layouts** — `ColumnSet` for side-by-side data, `FactSet` for key-value pairs, `Container` for grouping
5. **Add conditional styling** — use `"color"` properties and `"style"` to highlight important states (e.g., urgent, overdue)
6. **Include action buttons** — add `Action.OpenUrl` for links to external resources when the data includes URLs
7. **Handle arrays with `$foreach`** — use `${$root}` for the items array and `${$data}` for individual items within the template

#### Example: Before vs After Enhancement

**❌ Auto-generated card (generic — poor UX):**
```json
{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "id: ${if(id, id, 'N/A')}",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "title: ${if(title, title, 'N/A')}",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "description: ${if(description, description, 'N/A')}",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "assignedTo: ${if(assignedTo, assignedTo, 'N/A')}",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "date: ${if(date, date, 'N/A')}",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "image: ${if(image, image, 'N/A')}",
      "wrap": true
    }
  ]
}
```

**✅ Enhanced card (rich UX — tailored to data):**
```json
{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    {
      "type": "ColumnSet",
      "columns": [
        {
          "type": "Column",
          "width": "auto",
          "items": [
            {
              "type": "Image",
              "url": "${image}",
              "size": "Medium",
              "altText": "${title}"
            }
          ]
        },
        {
          "type": "Column",
          "width": "stretch",
          "items": [
            {
              "type": "TextBlock",
              "text": "${title}",
              "weight": "Bolder",
              "size": "Medium",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "Assigned to: ${assignedTo}",
              "spacing": "None",
              "isSubtle": true,
              "wrap": true
            }
          ]
        }
      ]
    },
    {
      "type": "TextBlock",
      "text": "${description}",
      "wrap": true,
      "spacing": "Medium"
    },
    {
      "type": "FactSet",
      "separator": true,
      "facts": [
        {
          "title": "Repair ID",
          "value": "#${id}"
        },
        {
          "title": "Date",
          "value": "${date}"
        }
      ]
    }
  ]
}
```

#### Example: List Action Card (Array Response with `$foreach`)

When an action returns an array of items, use the `$foreach` data binding pattern to render each item:

```json
{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    {
      "type": "Container",
      "$data": "${$root}",
      "separator": true,
      "items": [
        {
          "type": "TextBlock",
          "text": "${title}",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "Assigned to: ${assignedTo}",
                  "isSubtle": true,
                  "spacing": "None",
                  "wrap": true
                }
              ]
            },
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "${date}",
                  "isSubtle": true,
                  "spacing": "None",
                  "horizontalAlignment": "Right"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### Card Design Guidelines Per Action Type

| Action Type | Recommended Layout | Key Elements |
|-------------|-------------------|--------------|
| **List / Search** (GET returning array) | Repeating `Container` with `$data: "${$root}"` | Title, subtitle, key status field per item, separator between items |
| **Get by ID** (GET returning single object) | `ColumnSet` + `FactSet` | Image/icon, title, description, key-value pairs for metadata |
| **Create** (POST) | Confirmation summary | Show created item's key fields, success indicator |
| **Update** (PATCH/PUT) | Before/after or summary | Show updated fields, confirmation status |
| **Delete** (DELETE) | Simple confirmation | Item identifier, success message |

---

## When to Use API Plugins

Use API plugins (actions) when the agent needs to:
- **Call external APIs** not available through M365 capabilities
- **Perform CRUD operations** (Create, Read, Update, Delete)
- **Access real-time transactional data** from external systems
- **Modify state** in external systems (create tickets, update records)
- **Integrate with line-of-business systems** (CRM, ticketing, databases)

**Don't use API plugins when:**
- M365 capabilities already provide the data (use capabilities like `OneDriveAndSharePoint`, `Email`, etc.)
- Read-only access to documents is sufficient
- No external API interaction needed

## API Plugin vs Capabilities Decision Tree

```
Need external API?
  Yes → Create API Plugin Action
  No → Use built-in Capability
    ↓
Need real-time transactional data?
  Yes → API Plugin
  No → Capability (SharePoint, Connectors)
    ↓
Need CRUD operations?
  Yes → API Plugin
  No → Capability
    ↓
Need to modify state?
  Yes → API Plugin
  No → Capability
```

---

## API Plugin Manifest Structure (v2.4)

The API plugin manifest is a JSON file that configures how M365 Copilot interacts with your API.

### Basic Structure

```json
{
  "schema_version": "v2.4",
  "name_for_human": "Plugin Name",
  "namespace": "pluginNamespace",
  "description_for_human": "What this plugin does for users",
  "description_for_model": "Detailed instructions for the AI model on when and how to use this plugin",
  "functions": [],
  "runtimes": []
}
```

### Complete Example: Repairs API Plugin

```json
{
  "schema_version": "v2.4",
  "name_for_human": "Repairs API",
  "namespace": "repairs",
  "description_for_human": "Manage repair tickets and track issues",
  "description_for_model": "Use this plugin to search, create, update, and delete repair tickets. Call getRepairs to list all repairs or filter by assignee. Call getRepairById to get details about a specific repair. Call createRepair to create new tickets. Call updateRepair to modify existing repairs. Call deleteRepair to remove completed repairs.",
  "logo_url": "https://repairshub.azurewebsites.net/logo.png",
  "contact_email": "support@contoso.com",
  "legal_info_url": "https://contoso.com/terms",
  "privacy_policy_url": "https://contoso.com/privacy",
  "functions": [
    {
      "name": "getRepairs",
      "description": "Get all repairs, optionally filtered by assignee",
      "capabilities": {
        "response_semantics": {
          "data_path": "$",
          "properties": {
            "title": "$.title",
            "subtitle": "$.assignedTo"
          }
        }
      }
    },
    {
      "name": "getRepairById",
      "description": "Get a specific repair by its ID"
    },
    {
      "name": "createRepair",
      "description": "Create a new repair ticket",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Create Repair?",
          "body": "Are you sure you want to create this repair ticket?"
        }
      }
    },
    {
      "name": "updateRepair",
      "description": "Update an existing repair ticket",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Update Repair?",
          "body": "Are you sure you want to update this repair?"
        }
      }
    },
    {
      "name": "deleteRepair",
      "description": "Delete a repair ticket",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Delete Repair?",
          "body": "Are you sure you want to permanently delete this repair?"
        }
      }
    }
  ],
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "None"
      },
      "spec": {
        "url": "apiSpecificationFile/openapi.json"
      },
      "run_for_functions": ["getRepairs", "getRepairById", "createRepair", "updateRepair", "deleteRepair"]
    }
  ]
}
```

---

## OpenAPI Specification

The OpenAPI specification describes your REST API endpoints. Here's an example based on the Repairs API:

### Example: Repairs API OpenAPI Spec

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Repairs API",
    "description": "A simple service to manage repairs for various items",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://repairshub.azurewebsites.net/"
    }
  ],
  "paths": {
    "/repairs": {
      "get": {
        "operationId": "getRepairs",
        "summary": "Get all repairs",
        "parameters": [
          {
            "name": "assignedTo",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            },
            "description": "Filter repairs by assignee name"
          }
        ],
        "responses": {
          "200": {
            "description": "List of repairs",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Repair"
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createRepair",
        "summary": "Create a new repair",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateRepairRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Repair created",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Repair"
                }
              }
            }
          }
        }
      }
    },
    "/repairs/{id}": {
      "get": {
        "operationId": "getRepairById",
        "summary": "Get a repair by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Repair found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Repair"
                }
              }
            }
          },
          "404": {
            "description": "Repair not found"
          }
        }
      },
      "patch": {
        "operationId": "updateRepair",
        "summary": "Update a repair by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateRepairRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Repair updated",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Repair"
                }
              }
            }
          }
        }
      },
      "delete": {
        "operationId": "deleteRepair",
        "summary": "Delete a repair by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Repair deleted"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Repair": {
        "type": "object",
        "properties": {
          "id": { "type": "number" },
          "title": { "type": "string" },
          "description": { "type": "string" },
          "assignedTo": { "type": "string" },
          "date": { "type": "string" },
          "image": { "type": "string" }
        },
        "required": ["id", "title", "description", "assignedTo", "date", "image"]
      },
      "CreateRepairRequest": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "assignedTo": { "type": "string" },
          "date": { "type": "string" },
          "image": { "type": "string" }
        },
        "required": ["title", "description", "assignedTo", "date", "image"]
      },
      "UpdateRepairRequest": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "assignedTo": { "type": "string" },
          "date": { "type": "string" },
          "image": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Linking API Plugin to Declarative Agent

Reference the API plugin in your `declarativeAgent.json`:

```json
{
  "version": "v1.6",
  "name": "Repairs Agent",
  "description": "An agent to manage repair tickets",
  "instructions": "You help users manage repair tickets. Use the repairs API to search, create, update, and delete repairs.",
  "actions": [
    {
      "id": "repairsPlugin",
      "file": "plugins/repairs-plugin.json"
    }
  ],
  "conversation_starters": [
    {
      "title": "My Repairs",
      "text": "What repairs are assigned to me?"
    },
    {
      "title": "Create Repair",
      "text": "I need to create a new repair ticket"
    }
  ]
}
```

---

## Authentication for API Plugins

### No Authentication

For public APIs or development:

```json
{
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "None"
      },
      "spec": {
        "url": "apiSpecificationFile/openapi.json"
      }
    }
  ]
}
```

### OAuth Authentication

For OAuth2-protected APIs:

```json
{
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "OAuthPluginVault",
        "reference_id": "your-oauth-reference-id"
      },
      "spec": {
        "url": "apiSpecificationFile/openapi.json"
      }
    }
  ]
}
```

### API Key Authentication

For API key-protected APIs:

```json
{
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "ApiKeyPluginVault",
        "reference_id": "your-apikey-reference-id"
      },
      "spec": {
        "url": "apiSpecificationFile/openapi.json"
      }
    }
  ]
}
```

> **Note:** The `reference_id` is obtained when configuring authentication in the Microsoft 365 admin center or through the ATK CLI during provisioning.

---

## API Plugin Best Practices

### 1. Operation Naming in OpenAPI

Use clear `operationId` values that describe the action:

```json
{
  "get": {
    "operationId": "searchTickets",
    "summary": "Search for tickets by keyword or status"
  },
  "post": {
    "operationId": "createTicket",
    "summary": "Create a new ticket"
  }
}
```

✅ Good: `searchTickets`, `createTicket`, `updateTicketStatus`
❌ Bad: `tickets`, `doSomething`, `api1`

### 2. Descriptive Function Entries

Provide detailed descriptions in the plugin manifest:

```json
{
  "functions": [
    {
      "name": "searchTickets",
      "description": "Search for support tickets. Use this when the user asks about finding tickets, checking ticket status, or looking up issues. Supports filtering by status (open, closed, pending) and assignee."
    }
  ]
}
```

### 3. Add Confirmations for Destructive Operations

Always add confirmation dialogs for create, update, and delete operations:

```json
{
  "functions": [
    {
      "name": "deleteTicket",
      "description": "Permanently delete a ticket",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Delete Ticket?",
          "body": "This action cannot be undone. Are you sure you want to delete this ticket?"
        }
      }
    }
  ]
}
```

### 4. Use Response Semantics for Rich Display

Configure how results are displayed to users:

```json
{
  "functions": [
    {
      "name": "getRepairs",
      "description": "Get all repairs",
      "capabilities": {
        "response_semantics": {
          "data_path": "$",
          "properties": {
            "title": "$.title",
            "subtitle": "$.assignedTo",
            "url": "$.url"
          },
          "static_template": {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.5",
            "body": [
              {
                "type": "TextBlock",
                "text": "${title}",
                "weight": "Bolder",
                "size": "Medium"
              },
              {
                "type": "TextBlock",
                "text": "Assigned to: ${assignedTo}",
                "spacing": "None"
              },
              {
                "type": "TextBlock",
                "text": "${description}",
                "wrap": true
              }
            ]
          }
        }
      }
    }
  ]
}
```

---

## Common API Plugin Patterns

### Pattern: CRM Integration

**Plugin Manifest:**
```json
{
  "schema_version": "v2.4",
  "name_for_human": "CRM API",
  "namespace": "crm",
  "description_for_human": "Manage customer accounts and opportunities",
  "description_for_model": "Use this plugin to search for customer accounts, view account details, list opportunities, and update opportunity status in the CRM system.",
  "functions": [
    {
      "name": "searchAccounts",
      "description": "Search for customer accounts by name or industry"
    },
    {
      "name": "getAccount",
      "description": "Get detailed information about a specific account"
    },
    {
      "name": "listOpportunities",
      "description": "List sales opportunities, optionally filtered by account or stage"
    },
    {
      "name": "updateOpportunityStage",
      "description": "Update the stage of a sales opportunity",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Update Opportunity?",
          "body": "Update the opportunity stage?"
        }
      }
    }
  ],
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "OAuthPluginVault",
        "reference_id": "crm-oauth-ref"
      },
      "spec": {
        "url": "apiSpecificationFile/crm-openapi.json"
      }
    }
  ]
}
```

### Pattern: Ticketing System

**Plugin Manifest:**
```json
{
  "schema_version": "v2.4",
  "name_for_human": "Ticket System",
  "namespace": "tickets",
  "description_for_human": "Manage support tickets and track issues",
  "description_for_model": "Use this plugin to search support tickets, create new tickets, add comments, and update ticket status. Always confirm with the user before creating or modifying tickets.",
  "functions": [
    {
      "name": "searchTickets",
      "description": "Search for tickets by keyword, status, or assignee",
      "capabilities": {
        "response_semantics": {
          "data_path": "$.tickets",
          "properties": {
            "title": "$.title",
            "subtitle": "$.status"
          }
        }
      }
    },
    {
      "name": "getTicket",
      "description": "Get detailed information about a specific ticket including comments and history"
    },
    {
      "name": "createTicket",
      "description": "Create a new support ticket",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Create Ticket?",
          "body": "Create a new support ticket?"
        }
      }
    },
    {
      "name": "addComment",
      "description": "Add a comment to an existing ticket",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Add Comment?",
          "body": "Add this comment to the ticket?"
        }
      }
    },
    {
      "name": "updateTicketStatus",
      "description": "Update the status of a ticket (open, in-progress, resolved, closed)",
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Update Status?",
          "body": "Update the ticket status?"
        }
      }
    }
  ],
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "ApiKeyPluginVault",
        "reference_id": "tickets-apikey-ref"
      },
      "spec": {
        "url": "apiSpecificationFile/tickets-openapi.yaml"
      }
    }
  ]
}
```

### Pattern: Analytics/Reporting

**Plugin Manifest:**
```json
{
  "schema_version": "v2.4",
  "name_for_human": "Analytics API",
  "namespace": "analytics",
  "description_for_human": "Query business metrics and generate reports",
  "description_for_model": "Use this plugin to retrieve business metrics, run analytics queries, and generate reports. This is a read-only API for data analysis.",
  "functions": [
    {
      "name": "getMetrics",
      "description": "Get key business metrics for a specified date range"
    },
    {
      "name": "runQuery",
      "description": "Execute a custom analytics query with filters and dimensions"
    },
    {
      "name": "getReport",
      "description": "Get a pre-built report by name or ID"
    }
  ],
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": {
        "type": "OAuthPluginVault",
        "reference_id": "analytics-oauth-ref"
      },
      "spec": {
        "url": "apiSpecificationFile/analytics-openapi.json"
      }
    }
  ]
}
```

---

## Testing API Plugins

### 1. Validate OpenAPI Specification

Before adding to your agent, validate your OpenAPI spec:

```bash
# Using online validator
# Visit https://editor.swagger.io and paste your spec

# Or use a local tool
npx @apidevtools/swagger-cli validate openapi.json
```

### 2. Test API Endpoints Directly

Use tools like Bruno, Postman, or REST Client extension to test your API:

```http
### Get all repairs
GET https://repairshub.azurewebsites.net/repairs

### Get repair by ID
GET https://repairshub.azurewebsites.net/repairs/1

### Create a new repair
POST https://repairshub.azurewebsites.net/repairs
Content-Type: application/json

{
  "title": "Fix broken laptop",
  "description": "Screen is cracked",
  "assignedTo": "John Doe",
  "date": "2026-01-20",
  "image": "https://example.com/image.jpg"
}
```

### 3. Provision and Test in M365 Copilot

```bash
# Provision the agent
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false

# Use the returned test URL to test in M365 Copilot
```

Test with various prompts:
- "Show me all repairs"
- "Find repairs assigned to John"
- "Create a new repair for a broken laptop"
- "Update repair #1 to assign it to Jane"

---

## Security Considerations

### 1. Credential Management
- **Never hardcode credentials** in JSON files
- Use `reference_id` for OAuth and API key authentication
- Store secrets in environment variables or secure vaults
- Rotate credentials regularly

### 2. Input Validation
- Validate all inputs in your API backend
- Prevent injection attacks
- Limit string lengths and ranges
- Use strong typing in OpenAPI schemas

### 3. Confirmation Dialogs
- Always add confirmations for state-changing operations
- Be clear about what action will be taken
- Allow users to cancel destructive operations

### 4. Rate Limiting
- Implement rate limiting in your API backend
- Handle 429 (Too Many Requests) responses gracefully
- Consider caching for frequently-accessed data

### 5. Data Privacy
- Only request necessary data from your API
- Follow data residency requirements
- Log API calls for audit purposes
- Handle PII appropriately

---

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Function not found" | `operationId` in OpenAPI doesn't match `name` in functions | Ensure function names match OpenAPI operationIds |
| Authentication fails | Invalid or expired `reference_id` | Re-register authentication in admin center |
| CORS errors | API doesn't allow agent origin | Configure API CORS to allow M365 origins |
| Timeout errors | API response too slow | Optimize API, add caching, increase timeout |
| Schema mismatch | Plugin expects different response format | Update OpenAPI spec to match actual API response |
| "No operations selected" | Empty `--api-operation` parameter | Specify operations in correct format: `METHOD /path` |
| "File not found" during `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` | Relative path used for local OpenAPI spec | **Use absolute path**: `/full/path/to/openapi.json` |
| "File not found in zip archive" during provision | Manual plugin creation with incorrect spec path | **Use `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` command** - do not manually create plugins |
| OpenAPI spec path resolution fails | Path conflicts between zipAppPackage and M365 service | The ATK CLI handles this correctly - always use `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` |

### Why Manual Plugin Creation Fails

If you try to manually create API plugin files, you'll encounter path resolution conflicts:

1. **zipAppPackage** resolves spec paths relative to the plugin file location
2. **M365 extendToM365** resolves spec paths relative to the zip archive root

These different resolution strategies make manual path configuration nearly impossible. The `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` command handles this complexity automatically by:
- Placing the OpenAPI spec in `apiSpecificationFile/`
- Using the correct relative path `apiSpecificationFile/openapi.yaml` in the plugin
- Ensuring the zip archive structure matches the path expectations

---

## Authentication for API Plugins

The examples above use `"auth": {"type": "None"}` (unauthenticated APIs). If your API requires OAuth authentication, see [authentication.md](authentication.md) for:

- Discovering OAuth endpoints from well-known metadata
- Obtaining client credentials (via Dynamic Client Registration or manual entry)
- Configuring the `oauth/register` lifecycle step in `m365agents.yml`
- Using `OAuthPluginVault` in the plugin manifest runtime block

The `oauth/register` step must be added to `m365agents.yml` before `teamsApp/zipAppPackage`. The resulting `<PREFIX>_MCP_AUTH_ID` environment variable is referenced in the plugin's runtime auth block.

---

## Related Documentation

- [Authentication Guide](authentication.md)
- [Plugin Manifest Schema v2.4](https://raw.githubusercontent.com/MicrosoftDocs/m365copilot-docs/refs/heads/main/docs/plugin-manifest-2.4.md)
- [OpenAPI Specification](https://www.openapis.org/what-is-openapi)
- [Repairs API Example](https://repairshub.azurewebsites.net/openapi.json)
- [JSON Schema Reference](schema.md)
