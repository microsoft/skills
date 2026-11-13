# Purview Developer Skill — Acceptance Criteria

## Correct Usage Examples

### ✅ Correct: Using Agent Framework middleware for an agent

The developer uses `.WithPurview()` (C#) or `PurviewPolicyMiddleware` (Python) to add Purview enforcement to an Agent Framework agent. The middleware handles protection scope computation, content processing, and activity logging automatically.

### ✅ Correct: Using Microsoft Graph directly for an LOB app

The developer calls the `protectionScopes/compute`, `processContent`, and `contentActivity` Graph APIs directly from a line-of-business application. The developer caches protection scopes and respects the `executionMode` (`evaluateInline` vs `evaluateOffline`).

### ✅ Correct: Reading sensitivity labels from the tenant endpoint

The developer queries `GET /security/dataSecurityAndGovernance/sensitivityLabels` with appropriate filters (`applicableTo`, label IDs) to discover available labels.

### ✅ Correct: Logging a content activity for compliance

The developer calls `POST /users/{id}/dataSecurityAndGovernance/activities/contentActivities` with proper `processConversationMetadata` entries including `identifier`, `correlationId`, `sequenceNumber`, and activity metadata.

---

## Incorrect Usage Examples

### ❌ Incorrect: Inventing endpoints under `/purview/`

There is no `/purview/` path segment in the Microsoft Graph API. All Purview data security and governance resources are under `/security/dataSecurityAndGovernance/` (tenant-scoped) or `/users/{id}/dataSecurityAndGovernance/` (user-scoped).

### ❌ Incorrect: Using the legacy `/informationProtection/` API

The `/me/informationProtection/policy/labels` endpoint is the legacy Information Protection API. New integrations should use `/security/dataSecurityAndGovernance/sensitivityLabels`.

### ❌ Incorrect: Mixing Agent Framework middleware and direct Graph calls

Using `.WithPurview()` AND manually calling `processContent` or `contentActivity` APIs causes double-counted activity. Choose one integration path.

### ❌ Incorrect: Not caching protection scopes

Calling `protectionScopes/compute` on every user request is unnecessary and inefficient. Cache the response using the `ETag` header and refresh only when the ETag changes.

### ❌ Incorrect: Ignoring execution mode

Always checking the `executionMode` from `protectionScopes/compute`. When mode is `evaluateInline`, the app must wait for the `processContent` verdict. When mode is `evaluateOffline`, the app should act immediately and call `processContent` asynchronously.

### ❌ Incorrect: Using wrong auth scopes

Using generic `https://graph.microsoft.com/.default` without configuring the specific Purview permissions (`ProtectionScopes.Compute.All`, `Content.Process.All`, `ContentActivity.Write`, `SensitivityLabel.Read`) in the Entra app registration.
