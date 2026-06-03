# M365 JSON Agent Developer Examples

This document provides workflow examples for common M365 Copilot JSON-based agent development scenarios.

> **Note:** This guide is for JSON-based agents that use `.json` manifest files directly.

---

## Example 1: Development and Provisioning

Complete workflow for provisioning a JSON-based agent to a development environment:

```bash
# Install dependencies (if any)
npm install

# Provision agent to development environment (no compile step needed for JSON agents)
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false
```

**Result:** Returns a test URL like `https://m365.cloud.microsoft/chat/?titleId=T_abc123xyz` to test the agent in Microsoft 365 Copilot.

**Use case:** Testing agent functionality in a live environment during development.

---

## Example 2: Provision and Share Agent

Workflow for provisioning and sharing an agent with your organization:

```bash
# Provision agent to target environment
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env dev --interactive false

# Share agent with tenant users
npx -y --package @microsoft/m365agentstoolkit-cli atk share --scope tenant --env dev
```

**Result:** Agent becomes available to all users in the Microsoft 365 tenant.

**Use case:** Deploying a shared agent for organizational use after testing and validation.

---

## Example 3: Package Agent for Distribution

Workflow for creating an agent package for distribution:

```bash
# Package agent for distribution
npx -y --package @microsoft/m365agentstoolkit-cli atk package --env prod
```

**Result:** Creates a distributable package file that can be uploaded to the Microsoft 365 admin center or shared externally.

**Use case:** Creating a final package for production deployment or external distribution.

---

## Example 4: Basic Declarative Agent JSON

A minimal declarative agent manifest file (`declarativeAgent.json`):

```json
{
  "version": "v1.6",
  "name": "My Support Agent",
  "description": "An agent to help with customer support inquiries",
  "instructions": "You are a helpful customer support agent. Help users find information about their issues and guide them to solutions. Be polite and professional at all times."
}
```

---

## Example 5: Agent with Capabilities

A declarative agent with SharePoint and Email capabilities:

```json
{
  "version": "v1.6",
  "name": "Knowledge Base Agent",
  "description": "An agent that searches company knowledge bases and emails",
  "instructions": "You help employees find information from our SharePoint knowledge base and relevant emails. Always cite your sources when providing information.",
  "capabilities": [
    {
      "name": "OneDriveAndSharePoint",
      "items_by_url": [
        {
          "url": "https://contoso.sharepoint.com/sites/KnowledgeBase/Documents"
        }
      ]
    },
    {
      "name": "Email"
    }
  ]
}
```

---

## Example 6: Agent with Conversation Starters

A declarative agent with helpful conversation starters:

```json
{
  "version": "v1.6",
  "name": "HR Assistant",
  "description": "An agent that helps employees with HR-related questions",
  "instructions": "You are an HR assistant helping employees with common HR questions about policies, benefits, and procedures.",
  "conversation_starters": [
    {
      "title": "Time Off Policy",
      "text": "What is our company's time off policy?"
    },
    {
      "title": "Benefits Overview",
      "text": "Can you explain our health insurance benefits?"
    },
    {
      "title": "Expense Reports",
      "text": "How do I submit an expense report?"
    }
  ]
}
```

---

## Example 7: Agent with API Plugin Action

A declarative agent connected to an external API:

```json
{
  "version": "v1.6",
  "name": "Repairs Agent",
  "description": "An agent that helps manage repair tickets",
  "instructions": "You help users create, find, and track repair tickets. Use the repairs API to search for existing tickets and create new ones when requested.",
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

## Example 8: API Plugin Manifest

A complete API plugin manifest file (`plugins/repairs-plugin.json`):

```json
{
  "schema_version": "v2.4",
  "name_for_human": "Repairs API",
  "namespace": "repairs",
  "description_for_human": "Search and manage repair tickets",
  "description_for_model": "Use this plugin to search for repair tickets, get details about specific repairs, and create new repair requests.",
  "functions": [
    {
      "name": "searchRepairs",
      "description": "Search for repair tickets by keyword or status"
    },
    {
      "name": "getRepair",
      "description": "Get details about a specific repair ticket",
      "parameters": {
        "type": "object",
        "properties": {
          "repairId": {
            "type": "string",
            "description": "The unique ID of the repair ticket"
          }
        },
        "required": ["repairId"]
      }
    },
    {
      "name": "createRepair",
      "description": "Create a new repair ticket",
      "parameters": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "Title of the repair"
          },
          "description": {
            "type": "string",
            "description": "Detailed description of the issue"
          }
        },
        "required": ["title", "description"]
      },
      "capabilities": {
        "confirmation": {
          "type": "AdaptiveCard",
          "title": "Create Repair?",
          "body": "Create a new repair ticket?"
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
        "url": "https://api.contoso.com/openapi.yaml"
      }
    }
  ]
}
```

---

## Example 9: Full Agent with All Features

A complete agent combining all features:

```json
{
  "version": "v1.6",
  "id": "customer-support-agent",
  "name": "Customer Support Agent",
  "description": "A comprehensive support agent for customer inquiries",
  "instructions": "You are a professional customer support agent for Contoso.\n\nResponsibilities:\n1. Search the knowledge base for relevant documentation\n2. Look up repair tickets and their status\n3. Create new repair tickets when requested\n4. Search support emails for context\n\nGuidelines:\n- Always be polite and professional\n- Cite sources when providing information\n- Ask clarifying questions when needed\n- Never share confidential information",
  "capabilities": [
    {
      "name": "OneDriveAndSharePoint",
      "items_by_url": [
        {
          "url": "https://contoso.sharepoint.com/sites/Support/Documents"
        }
      ]
    },
    {
      "name": "Email",
      "shared_mailbox": "support@contoso.com"
    },
    {
      "name": "WebSearch",
      "sites": [
        {
          "url": "https://docs.contoso.com"
        }
      ]
    }
  ],
  "actions": [
    {
      "id": "repairsApi",
      "file": "plugins/repairs-plugin.json"
    }
  ],
  "conversation_starters": [
    {
      "title": "Check Repair Status",
      "text": "What is the status of my repairs?"
    },
    {
      "title": "Search Knowledge Base",
      "text": "How do I troubleshoot connection issues?"
    },
    {
      "title": "Create New Ticket",
      "text": "I need to create a new support ticket"
    }
  ],
  "disclaimer": {
    "text": "This agent provides general support assistance. For urgent issues, please contact our support hotline."
  }
}
```

---

## Example 10: Localized Agent

A declarative agent with tokenized strings for multi-language support.

### Tokenized `declarativeAgent.json`

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.6/schema.json",
  "version": "v1.6",
  "name": "[[agent_name]]",
  "description": "[[agent_description]]",
  "instructions": "$[file]('instructions.txt')",
  "conversation_starters": [
    {
      "title": "[[starter_status_title]]",
      "text": "[[starter_status_text]]"
    },
    {
      "title": "[[starter_kb_title]]",
      "text": "[[starter_kb_text]]"
    }
  ],
  "disclaimer": {
    "text": "[[disclaimer_text]]"
  }
}
```

### `manifest.json` with `localizationInfo`

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/vDevPreview/MicrosoftTeams.schema.json",
  "manifestVersion": "devPreview",
  "localizationInfo": {
    "defaultLanguageTag": "en",
    "defaultLanguageFile": "en.json",
    "additionalLanguages": [
      {
        "languageTag": "fr",
        "file": "fr.json"
      }
    ]
  },
  "name": {
    "short": "Support Agent",
    "full": "Customer Support Agent"
  },
  "description": {
    "short": "Get help with support issues",
    "full": "An agent that helps resolve customer support issues using internal knowledge bases."
  },
  "copilotAgents": {
    "declarativeAgents": [
      {
        "id": "declarativeAgent",
        "file": "declarativeAgent.json"
      }
    ]
  }
}
```

### Default language file (`en.json`)

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/vDevPreview/MicrosoftTeams.Localization.schema.json",
  "name.short": "Support Agent",
  "name.full": "Customer Support Agent",
  "description.short": "Get help with support issues",
  "description.full": "An agent that helps resolve customer support issues using internal knowledge bases.",
  "localizationKeys": {
    "agent_name": "Customer Support Agent",
    "agent_description": "An agent that helps resolve customer support issues using internal knowledge bases.",
    "starter_status_title": "Check ticket status",
    "starter_status_text": "What is the status of my open tickets?",
    "starter_kb_title": "Search knowledge base",
    "starter_kb_text": "How do I reset my password?",
    "disclaimer_text": "This agent provides general support guidance. For urgent issues, contact the helpdesk."
  }
}
```

### French language file (`fr.json`)

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/vDevPreview/MicrosoftTeams.Localization.schema.json",
  "name.short": "Agent de support",
  "name.full": "Agent de support client",
  "description.short": "Obtenez de l'aide pour vos problèmes",
  "description.full": "Un agent qui aide à résoudre les problèmes de support client à l'aide des bases de connaissances internes.",
  "localizationKeys": {
    "agent_name": "Agent de support client",
    "agent_description": "Un agent qui aide à résoudre les problèmes de support client à l'aide des bases de connaissances internes.",
    "starter_status_title": "Vérifier le statut du ticket",
    "starter_status_text": "Quel est le statut de mes tickets ouverts ?",
    "starter_kb_title": "Rechercher la base de connaissances",
    "starter_kb_text": "Comment réinitialiser mon mot de passe ?",
    "disclaimer_text": "Cet agent fournit des conseils de support généraux. Pour les problèmes urgents, contactez le service d'assistance."
  }
}
```

**Reference:** [localization.md](localization.md) for the full localization workflow
