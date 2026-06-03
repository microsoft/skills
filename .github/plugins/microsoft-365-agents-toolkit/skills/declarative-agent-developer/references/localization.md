# Localization Workflow

## Quick Reference — Complete Localization Checklist

**For adding localization to an agent (Workflow A):**

1. ⛔ Tokenize `declarativeAgent.json` → replace `name`, `description`, all `conversation_starters[].title` and `.text` with `[[token]]` syntax
2. ⛔ Create language files → `en.json` (default) + one per additional language, each with `name.short`, `name.full`, `description.short`, `description.full`, and `localizationKeys` mapping EVERY token
3. ⛔ Update `manifest.json` → add `localizationInfo` with `defaultLanguageTag`, `defaultLanguageFile`, `additionalLanguages`
4. ⛔ Deploy → `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false`

**For adding a language to an already-localized agent (Workflow B):**

1. Read existing default language file to get the list of `localizationKeys`
2. Create new `{lang}.json` with the SAME set of keys, translated values
3. Add new entry to `additionalLanguages` in `manifest.json`
4. ⛔ Deploy

---

This document provides step-by-step instructions for localizing an M365 Copilot declarative agent into multiple languages.

Localization spans two layers: the **app manifest** (`manifest.json`) and the **declarative agent manifest** (`declarativeAgent.json`). Both use the same set of language files, but reference strings differently.

> **Important:** If an agent supports more than one language, you must provide a separate language file for **every** supported language, including the default language. Single-language agents do not require language files.

---

## ⛔ STOP — READ THIS FIRST

### Two Localization Scenarios

| Scenario | What to do |
|----------|------------|
| **Agent has NO localization yet** (no `localizationInfo` in `manifest.json`, no `[[tokens]]` in `declarativeAgent.json`) | Follow **Workflow A: Add Localization to an Agent** — you must tokenize, externalize instructions, create ALL language files, and update `manifest.json` |
| **Agent is ALREADY localized** (`localizationInfo` exists, manifests use `[[tokens]]`) | Follow **Workflow B: Add a Language to an Already-Localized Agent** — you only create a new language file and update `localizationInfo` |

**⛔ MANDATORY:** You MUST check which scenario applies BEFORE making any changes. Read `manifest.json` to see if `localizationInfo` exists, and read `declarativeAgent.json` to see if it already uses `[[token]]` syntax.

### ⛔ Anti-Patterns — NEVER Do These

| ❌ Anti-Pattern | Why It Fails | ✅ Correct Approach |
|----------------|-------------|---------------------|
| Replacing strings directly with translated text in `declarativeAgent.json` | Hardcoded translations don't support multi-language switching. Only one language works at a time. | Use `[[token]]` syntax and create language files with `localizationKeys`. |
| Leaving instructions inline in `declarativeAgent.json` when localizing | Instructions must be separated from localizable content. Inline instructions block proper tokenization. | Create `appPackage/instructions.txt` and set `"instructions": "$[file]('instructions.txt')"`. |
| Creating language files without tokenizing `declarativeAgent.json` first | Language file `localizationKeys` are only resolved when the manifest uses `[[token]]` syntax. Without tokens, the language files have no effect. | Always tokenize the manifest BEFORE creating language files. |
| Using `[[token]]` for the instructions field | Instructions are NOT localizable. The LLM consumes them in a single language. | Use `$[file]('instructions.txt')` for instructions. Never tokenize them. |
| Setting `defaultLanguageTag` to a non-English language without an `en.json` fallback | The default language must have the default language file. English should typically be the default. | Set `defaultLanguageTag: "en"` and `defaultLanguageFile: "en.json"`. Add other languages as `additionalLanguages`. |

### How Localization Works

| Layer | Key style | Example |
|-------|-----------|---------|
| App manifest (`manifest.json`) | JSONPath expressions | `name.short`, `description.full` |
| Agent / plugin manifests | Double-bracket tokens resolved via `localizationKeys` | `[[agent_name]]`, `[[plugin_description]]` |

Both types of localized strings live in the **same** language file per locale.

---

## Workflow A: Add Localization to an Agent

Use this workflow when localizing an agent for the **first time** — the agent currently has hardcoded strings and no `localizationInfo`.

### Step A1: Tokenize Agent Manifests — MANDATORY

Replace ALL user-facing strings in `declarativeAgent.json` (and `plugin.json`, if applicable) with tokenized keys wrapped in double brackets (`[[key_name]]`).

**You MUST tokenize ALL of these fields:**

| Field | Token example |
|-------|---------------|
| `name` | `[[agent_name]]` |
| `description` | `[[agent_description]]` |
| Every `conversation_starters[].title` | `[[starter_travel_title]]`, `[[starter_remote_title]]`, etc. |
| Every `conversation_starters[].text` | `[[starter_travel_text]]`, `[[starter_remote_text]]`, etc. |
| `disclaimer.text` (if present) | `[[disclaimer_text]]` |

**Token key rules:**
- Must match the pattern: `^[a-zA-Z_][a-zA-Z0-9_]*$`
- Use descriptive, snake_case names (e.g., `starter_vpn_title` not `key1`)
- Keep names consistent across agent and plugin manifests

**Example — tokenized `declarativeAgent.json`:**

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.6/schema.json",
  "version": "v1.6",
  "name": "[[agent_name]]",
  "description": "[[agent_description]]",
  "instructions": "$[file]('instructions.txt')",
  "conversation_starters": [
    {
      "title": "[[starter_vpn_title]]",
      "text": "[[starter_vpn_text]]"
    },
    {
      "title": "[[starter_password_title]]",
      "text": "[[starter_password_text]]"
    }
  ],
  "disclaimer": {
    "text": "[[disclaimer_text]]"
  }
}
```

**If API plugin exists — tokenize `plugin.json` too:**

```json
{
  "schema_version": "v2.4",
  "name_for_human": "[[plugin_name]]",
  "description_for_human": "[[plugin_description]]",
  "description_for_model": "[[plugin_model_description]]"
}
```

**⛔ NEVER skip tokenization.** Writing localization files without first tokenizing the manifests makes localization non-functional. The manifests MUST use `[[token]]` syntax for the language files to take effect.

**✅ POST-TOKENIZATION CHECKPOINT — Verify before proceeding to Step A2:**
- [ ] `name` field uses `[[agent_name]]` or similar token
- [ ] `description` field uses `[[agent_description]]` or similar token
- [ ] Every `conversation_starters[].title` uses a `[[token]]`
- [ ] Every `conversation_starters[].text` uses a `[[token]]`
- [ ] `instructions` field is NOT tokenized (it should remain as `$[file]('instructions.txt')` or inline text — never `[[token]]`)

**If any box is unchecked, STOP and fix it before continuing.**

### Step A2: Create Language Files — MANDATORY

Create one JSON file per language in `appPackage/`, named `{languageTag}.json` (e.g., `en.json`, `fr.json`, `ja.json`).

**Every language file MUST contain:**

1. **`$schema`** — The localization schema reference
2. **App manifest strings** — `name.short`, `name.full`, `description.short`, `description.full` (all four are REQUIRED)
3. **`localizationKeys` object** — One entry per `[[token]]` used in `declarativeAgent.json` and `plugin.json`, using the token name WITHOUT brackets

**Default language file (`en.json`) — use the ORIGINAL English values from the agent:**

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/vDevPreview/MicrosoftTeams.Localization.schema.json",
  "name.short": "IT Help Desk",
  "name.full": "IT Help Desk Agent",
  "description.short": "Resolve common IT issues",
  "description.full": "Helps employees resolve common IT issues using internal knowledge bases and ticketing systems.",
  "localizationKeys": {
    "agent_name": "IT Help Desk Agent",
    "agent_description": "Helps employees resolve common IT issues using internal knowledge bases and ticketing systems.",
    "starter_vpn_title": "VPN issues",
    "starter_vpn_text": "I can't connect to the corporate VPN. What should I try?",
    "starter_password_title": "Password reset",
    "starter_password_text": "How do I reset my password?",
    "disclaimer_text": "This agent provides general IT guidance. For urgent issues, contact the helpdesk directly."
  }
}
```

**Additional language file (`fr.json`) — use translations provided by the user:**

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/vDevPreview/MicrosoftTeams.Localization.schema.json",
  "name.short": "Support informatique",
  "name.full": "Agent de support informatique",
  "description.short": "Résoudre les problèmes informatiques courants",
  "description.full": "Aide les employés à résoudre les problèmes informatiques courants à l'aide des bases de connaissances internes.",
  "localizationKeys": {
    "agent_name": "Agent de support informatique",
    "agent_description": "Aide les employés à résoudre les problèmes informatiques courants à l'aide des bases de connaissances internes.",
    "starter_vpn_title": "Problèmes de VPN",
    "starter_vpn_text": "Je n'arrive pas à me connecter au VPN de l'entreprise. Que dois-je essayer ?",
    "starter_password_title": "Réinitialisation du mot de passe",
    "starter_password_text": "Comment réinitialiser mon mot de passe ?",
    "disclaimer_text": "Cet agent fournit des conseils informatiques généraux. Pour les problèmes urgents, contactez le service d'assistance directement."
  }
}
```

**⛔ CRITICAL:** The `localizationKeys` in EVERY language file must have the EXACT SAME set of keys. If `en.json` has `agent_name`, `agent_description`, `starter_vpn_title`, etc., then `fr.json` must also have ALL of those same keys. Missing keys cause runtime resolution failures.

**If the user did not provide translations for some strings** (e.g., conversation starters), you MUST ask the user for them. Do NOT invent translations.

### Step A3: Add `localizationInfo` to `manifest.json` — MANDATORY

Add the `localizationInfo` section to `manifest.json`:

```json
{
  "localizationInfo": {
    "defaultLanguageTag": "en",
    "defaultLanguageFile": "en.json",
    "additionalLanguages": [
      {
        "languageTag": "fr",
        "file": "fr.json"
      },
      {
        "languageTag": "es",
        "file": "es.json"
      }
    ]
  }
}
```

**Rules:**
- `defaultLanguageTag` and `defaultLanguageFile` are always required
- Each additional language needs an entry in `additionalLanguages`
- Language files live in `appPackage/` alongside the manifests
- Use language-only tags (e.g., `en` rather than `en-us`) for top-level translations; add region-specific overrides only when needed

### Step A4: Deploy — MANDATORY

After completing ALL localization changes, deploy the agent:

```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false
```

Then read `M365_TITLE_ID` from `env/.env.local` and present the test link. **⛔ Never skip deployment after localization changes.**

---

## Workflow B: Add a Language to an Already-Localized Agent

Use this workflow when the agent is ALREADY localized (manifests use `[[tokens]]`, `localizationInfo` exists, language files exist) and the user wants to add another language.

**⛔ Do NOT re-tokenize manifests or recreate existing language files.** Only create the NEW language file and update `localizationInfo`.

### Step B1: Read Existing Localization Setup

1. Read `manifest.json` — note the `localizationInfo` section (default language, existing additional languages)
2. Read the default language file (e.g., `en.json`) — note ALL keys in `localizationKeys` (these are the keys the new file must also have)
3. Read `declarativeAgent.json` — confirm it uses `[[token]]` syntax (if not, switch to Workflow A)

### Step B2: Create the New Language File

Create `appPackage/{languageTag}.json` with:

1. `$schema` — same as existing language files
2. `name.short`, `name.full`, `description.short`, `description.full` — translated values from the user
3. `localizationKeys` — one entry per key from the default language file, with translated values from the user

**⛔ CRITICAL:** The new file MUST have the EXACT SAME set of `localizationKeys` as the default language file. Copy the key names from the existing default language file and fill in translated values.

### Step B3: Update `localizationInfo` in `manifest.json`

Add the new language to the `additionalLanguages` array:

```json
{
  "languageTag": "pt-BR",
  "file": "pt-BR.json"
}
```

**⛔ Do NOT modify existing language files or the `defaultLanguageFile` entry.** Only add to `additionalLanguages`.

### Step B4: Deploy — MANDATORY

Deploy the agent:

```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false
```

Then present the test link. **⛔ Never skip deployment.**

---

## Localizable Fields Reference

**Declarative agent manifest:**

| Field | Description | Max length | Required |
|---|---|---|---|
| `name` | Display name of the agent | 100 chars | ✔️ |
| `description` | Description shown to users | 1,000 chars | ✔️ |
| `conversation_starters[].title` | Short title for a conversation starter | — | |
| `conversation_starters[].text` | Full prompt text for a conversation starter | — | |
| `disclaimer.text` | Disclaimer shown at conversation start | — | |

**API plugin manifest:**

| Field | Description | Max length | Required |
|---|---|---|---|
| `name_for_human` | Short, human-readable plugin name | 20 chars | ✔️ |
| `description_for_human` | Human-readable description | 100 chars | ✔️ |
| `description_for_model` | Description provided to the model | 2,048 chars | |
| `conversation_starters[].title` | Title for plugin conversation starters | — | |
| `conversation_starters[].text` | Text for plugin conversation starters | — | |

### Required App Manifest Keys in Every Language File

| Key | Description | Max length | Required |
|---|---|---|---|
| `name.short` | Short app name | 30 chars | ✔️ |
| `name.full` | Full app name | 100 chars | ✔️ |
| `description.short` | Short app description | 80 chars | ✔️ |
| `description.full` | Full app description | 4,000 chars | ✔️ |

---

## Language Resolution Order

The Microsoft 365 host resolves strings in the following order:

1. Start with the **default language** strings
2. Overwrite with the user's **language-only** file (e.g., `en`)
3. Overwrite with the user's **language + region** file (e.g., `en-gb`), if available

For example, if the default language is `fr`, and you provide `en` and `en-gb` files, a user with locale `en-gb` sees: `fr` → overwritten by `en` → overwritten by `en-gb`.

> **Tip:** Provide top-level, language-only translations (e.g., `en` rather than `en-us`). Add region-specific overrides only for the few strings that need them.

---

## Project Structure

A localized app package includes the language files alongside the manifests:

```text
my-agent/
├── appPackage/
│   ├── manifest.json
│   ├── declarativeAgent.json
│   ├── instructions.txt            # externalized instructions (NOT tokenized)
│   ├── plugin.json                 # optional
│   ├── en.json                     # default language file
│   ├── fr.json                     # French language file
│   ├── es.json                     # Spanish language file
│   ├── color.png
│   └── outline.png
├── env/
│   └── .env.dev
└── m365agents.yml
```

---

## Critical Rules

1. **Every `[[token]]` must have a matching `localizationKeys` entry** in every language file. Missing keys cause runtime failures.
2. **Keep token names descriptive** — use `starter_vpn_title` not `key1`.
3. **Do NOT localize instructions** — externalize to `instructions.txt` via `$[file]('instructions.txt')`. Never use `[[tokens]]` for instructions.
4. **Schema version consistency** — `$schema` in language files must match `manifest.json`.
5. **Always deploy after localization changes.**
6. **Do NOT invent translations** — ask the user for translated strings. Never machine-translate without confirmation.
7. **Tokenization is MANDATORY** — language files have no effect without `[[token]]` syntax in the manifests.

---

## ⛔ FINAL GATE — Before Responding to the User

**STOP.** Before writing your response, verify ALL of the following:

- [ ] `declarativeAgent.json` uses `[[token]]` syntax for ALL localizable fields (name, description, every conversation starter title/text, disclaimer)
- [ ] `instructions` field is NOT tokenized (never use `[[token]]` for instructions)
- [ ] A default language file exists (e.g., `en.json`) with `name.short`, `name.full`, `description.short`, `description.full`, and ALL `localizationKeys`
- [ ] Every additional language file has the EXACT SAME set of `localizationKeys` as the default
- [ ] `manifest.json` has `localizationInfo` with `defaultLanguageTag`, `defaultLanguageFile`, and `additionalLanguages`
- [ ] I deployed with `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false`
- [ ] I presented the test link

**If you cannot check ALL boxes, you are NOT done.** Go back and complete the missing steps.

---

## Error Handling

| Error | Action |
|-------|--------|
| Token in manifest has no matching `localizationKeys` entry | **Stop.** List the missing keys and the language files that need them. Ask the user to provide the translations. |
| Language file referenced in `localizationInfo` doesn't exist | **Stop.** List the missing files. Ask the user to provide them or remove the language from `additionalLanguages`. |
| `localizationInfo.defaultLanguageFile` is missing | **Stop.** Inform the user that a default language file is required when `localizationInfo` is present. |
| Agent has only one language | Inform the user that language files are not required for single-language agents. Ask if they want to add more languages. |

---

## Learn More

- [Localize your agent](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/localize-agents) — Official Microsoft localization guide for agents
- [Localize your app (Microsoft Teams)](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/apps-localization) — General Teams app localization reference
- [Localization schema reference](https://learn.microsoft.com/en-us/microsoftteams/platform/resources/schema/localization-schema) — JSON schema for localization files
