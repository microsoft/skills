# azure-ai-contentsafety-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Harm Categories

| Category | Description |
|----------|-------------|
| `Hate` | Attacks based on identity (race, religion, gender, etc.) |
| `Sexual` | Sexual content, relationships, anatomy |
| `Violence` | Physical harm, weapons, injury |
| `SelfHarm` | Self-injury, suicide, eating disorders |

## Severity Scale

| Level | Text Range | Image Range | Meaning |
|-------|------------|-------------|---------|
| 0 | Safe | Safe | No harmful content |
| 2 | Low | Low | Mild references |
| 4 | Medium | Medium | Moderate content |
| 6 | High | High | Severe content |

## Client Types

| Client | Purpose |
|--------|---------|
| `ContentSafetyClient` | Analyze text and images |
| `BlocklistClient` | Manage custom blocklists |
