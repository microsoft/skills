# Known Limitations (Preview)

Source: [Microsoft Entra Agent ID FAQ](https://learn.microsoft.com/en-us/entra/agent-id/faq) — the successor to the retired preview known-issues page. Items the FAQ no longer lists are marked `[VERIFY]`; re-check before quoting.

## API & Object Model

1. **API surface** — Agent ID resources are published in both `/beta` and `/v1.0` (agentIdentity and agentIdentityBlueprint have v1.0 reference pages); this skill's samples use `/beta`, which remains supported
2. **Sponsor type restrictions** — sponsors can be users (including guests) or select groups: dynamic membership (security or Microsoft 365) and assigned Microsoft 365 groups are accepted; role-assignable groups, assigned security groups, and service principals are rejected. A sponsor is required at create for agent identities and blueprints.
3. **BlueprintPrincipal not auto-created** — requires explicit `POST /servicePrincipals` after Blueprint creation
4. **Agent Identities cannot have password credentials** — credentials belong on the Blueprint only (`PropertyNotCompatibleWithAgentIdentity` error)
5. **Agent Identities have no backing application object** — they are service-principal-only entities
6. **Blueprint needs explicit `identifierUris`** — not set by default, required for OAuth2 scope resolution (`api://{app-id}/.default`)
7. **No Graph relationship filtering for Agent IDs** — `/ownedObjects`, `/deletedItems`, `/owners` etc. return all types; must client-side filter by `odata.type`
8. **Orphaned agent users after deletion** — deleting a blueprint or identity does NOT auto-delete its agent users; clean up manually via admin center or Graph API

## Roles & Permissions

9. **`Directory.AccessAsUser.All` hard rejection** — if present on the client, all other Agent ID delegated permissions are ignored → 403 Forbidden
10. **Delegated creation requires specific roles or ownership** — delegated permission paths exist for creating Agent Identities (Agent ID Developer / Agent ID Administrator / AI Administrator, or an owner of the blueprint/blueprint principal with `AgentIdentity.Create.All`, `AgentIdentity.ReadWrite.All`, or `AgentIdentity.ReadWrite.ManagedBy`). The earlier "no viable delegated permission" limitation no longer applies; the FAQ also documents that high-risk Graph permissions (`Application.ReadWrite.All`, `RoleManagement.ReadWrite.All`, `User.ReadWrite.All`, `Directory.AccessAsUser.All`) are blocked from being granted to agents.
11. **No quick-start permission bundle** — must discover and grant 18+ individual Agent Identity permissions
12. **Permission propagation delay** — 30–120+ seconds after admin consent before tokens include new claims; use delegated permissions where possible and add retry with exponential backoff
13. **Global Reader cannot list agent identities** — `GET /servicePrincipals/graph.agentIdentity` returns 403; use `GET /servicePrincipals` instead
14. **Custom roles cannot include Agent ID actions** — use built-in roles (Agent ID Administrator, Agent ID Developer)
15. **Administrative units not supported** — cannot add agent identities, blueprints, or blueprint principals to admin units; use `owners` property instead
16. **Agent ID Admin cannot update agent user photos** — use User Administrator role

## Admin Center & Management

17. **No admin-center delete/restore for Agent ID objects** — creation via the admin center is supported, but deleting/restoring agent identity objects requires Microsoft Graph / PowerShell. `[VERIFY]`
18. **`/me` endpoint unavailable** in `client_credentials` flow — use `az ad signed-in-user show` or Graph delegated permissions for user context

## Authentication & Consent

19. **No SSO to web apps** — Agent IDs cannot sign in via Microsoft Entra ID sign-in pages (no OpenID Connect or SAML); use web APIs instead
20. **Admin consent workflow (ACW) broken** — does not work properly for permissions requested by Agent IDs; contact tenant admin directly
21. **Cannot grant app permissions to blueprint principals** — grant application permissions to individual agent identities instead
22. **Cannot assign app roles where target resource is an agent identity** — use blueprint principal as the target resource
23. **Risk-based step-up blocks consent silently** — no "risky" indication in the UX

## Groups, Logs & Monitoring

24. **Group membership nuances** — agent users CAN be added to groups, including dynamic groups (per the FAQ). Agent identities cannot be members of role-assignable groups, and highly privileged directory roles are blocked for agent identities. Dynamic-group membership for agent identities themselves is not addressed in current docs `[VERIFY]`.
25. **Audit logs do not distinguish Agent IDs** — operations on blueprints/identities logged as `ApplicationManagement`, agent users as `User Management`; cross-reference object IDs via Graph to determine entity type
26. **Graph activity logs do not distinguish Agent IDs** — agent identity requests logged as applications, agent user requests as users; join with sign-in logs

## Performance & Scale

27. **Sequential creation requests may fail** — creating multiple entities in quick succession (e.g., blueprint → principal → identity) can return `400 Bad Request: Object with id {id} not found`; especially with application permissions. Use delegated permissions where possible and add exponential backoff retry.

## Product Integrations

28. **Copilot Studio** — only custom engine agents are supported; Agent IDs are used for channel auth only (not connectors or tools)
29. **MSAL complexity** — Agent ID scenarios require managing Federated Identity Credentials manually. For .NET use [Microsoft.Identity.Web.AgentIdentities](https://github.com/AzureAD/microsoft-identity-web/blob/master/src/Microsoft.Identity.Web.AgentIdentities/README.AgentIdentities.md). For other languages use the [Microsoft Entra SDK for Agent ID](https://learn.microsoft.com/en-us/entra/msidweb/agent-id-sdk/overview).

## Reporting Issues

Report unlisted issues via [aka.ms/agentidfeedback](https://aka.ms/agentidfeedback).
