/**
 * Prepare artifact schema — prepare-plan.json.
 * Read by prepare PHASE.md Step 9 (write prepare-plan.json).
 */

// ─── Shared type (inlined from session-schemas.ts to avoid cross-ref) ────────

export interface PostDeployRecommendation {
  title: string;
  reason: string;
  effort: "low" | "medium" | "high";
  services?: string[];
}

// ─── Healing types (prepare phase) ───────────────────────────────────────────

export type PrepareHealingTrigger = "quota" | "policy" | "rubric" | "region";
export type PrepareIssueClassification = "AUTO_FIXABLE" | "NEEDS_USER_INPUT";
export type PrepareHealingResult = "fixed" | "needs-input" | "still-failing";

export interface PrepareHealingIssue {
  dimension: string;
  detail: string;
  classification: PrepareIssueClassification;
}

export interface PrepareHealingFix {
  service: string;
  change: string;
  reason: string;
}

export interface PrepareHealingAttempt {
  attempt: number;
  trigger: PrepareHealingTrigger;
  issues: PrepareHealingIssue[];
  fixes: PrepareHealingFix[];
  result: PrepareHealingResult;
}

// ─── prepare-plan.json ───────────────────────────────────────────────────────

export interface PlannedService {
  name: string;
  sku: string;
  purpose: string;
  component: string;
  region: string;
  resourceName: string;
  /** Exact engine version for managed database services (MySQL/PostgreSQL Flexible Server),
   *  sourced from the provider capabilities API during quota validation — NOT guessed.
   *  ARM rejects major-only strings (e.g. MySQL '8.0'); use the exact supported patch
   *  (e.g. '8.0.21'). Omit for non-DB services. */
  version?: string;
}

export interface CostBreakdownItem {
  service: string;
  sku: string;
  monthlyUsd: number;
  note?: string;
}

export interface CostEstimate {
  monthlyUsd: number;
  currency: "USD";
  breakdown: CostBreakdownItem[];
  disclaimer: string;
}

export interface RejectedAlternative {
  service: string;
  reason: string;
}

export interface NamingResource {
  type: string;
  name: string;
}

export interface NamingConfig {
  pattern: string;
  /** The computed prefix used for all resource names: {project}-{env}-{suffix}.
   *  deploymentVariables.environmentName MUST equal this value. */
  resourcePrefix: string;
  resources: NamingResource[];
}

export type QuotaSource = "cli" | "fallback";

export interface QuotaCheck {
  resource: string;
  region: string;
  required: number;
  available: number;
  sufficient: boolean;
  provider: string;
  currentUsage: number;
  currentLimit: number;
  adjustable: boolean;
  source: QuotaSource;
}

export interface DeployStrategy {
  /** Deploy pattern — see deploy-strategy.md for the three patterns.
   *  "oryx-auto": Oryx handles build + run (Pattern A — default for most apps).
   *  "startup-install": native module compilation at startup (Pattern B).
   *  "container-only": Dockerfile-based deploy via ACR (Pattern C).
   *  Omit when Oryx auto-build is sufficient and no special startup is needed. */
  codeDeployPattern?: "oryx-auto" | "startup-install" | "container-only";
  /** Startup command for native module compilation (goes into appCommandLine) */
  startupCommand?: string;
  /** Required app settings for the deploy strategy (e.g., SCM_DO_BUILD_DURING_DEPLOYMENT) */
  requiredAppSettings?: Record<string, string>;
  /** Human-readable reason for choosing this strategy */
  reason: string;
}

export interface InstrumentationConfig {
  appInsightsEnabled: boolean;
  reason: string;
}

export interface DeploymentVariables {
  /** MUST equal naming.resourcePrefix (e.g., "myapp-dev-a1d5"), NOT the env label ("dev") */
  environmentName: string;
  location: string;
  sessionId: string;
  deployedBy: string;
  /** Variable names that could not be resolved at prepare time — deploy reads, not asks */
  deferred?: string[];
}

export interface OfferRestriction {
  /** Azure provider namespace (e.g., "Microsoft.DBforPostgreSQL") */
  provider: string;
  /** Region checked */
  region: string;
  /** Whether the offer is restricted in this region */
  restricted: boolean;
  /** Reason string from capabilities API, if any */
  reason?: string;
}

export interface QuotaValidation {
  /** True when all planned services had quota confirmed */
  verified: boolean;
  /** How quota was verified — persists in session artifact, survives context compaction */
  method?: "cli" | "what-if" | "unverifiable";
  /** The specific region that passed validation */
  verifiedRegion?: string;
  /** The specific SKU that was validated (e.g., "B1", "F1") */
  verifiedSku?: string;
  /** Regions checked during validation */
  checkedRegions?: string[];
  /** Resources that failed quota checks */
  failedResources?: string[];
  /** Reason when verified is false (e.g., "quota CLI unavailable", "all regions zero") */
  reason?: string;
  /** Offer restriction results for database services (PostgreSQL, MySQL).
   *  Populated by prepare Step 5 when database services are in the plan.
   *  `LocationIsOfferRestricted` is NOT caught by what-if — this is the only pre-deploy check. */
  offerRestrictions?: readonly OfferRestriction[];
  /** Derived from offerRestrictions[]: true when every database service in services[]
   *  has at least one entry in offerRestrictions[]. Set this based on the array contents,
   *  not independently. Deploy gate halts if false/missing when services include PostgreSQL/MySQL. */
  offerRestrictionsVerified?: boolean;
}

export interface PreparePlan {
  services: PlannedService[];
  costEstimate: CostEstimate;
  rejectedAlternatives: RejectedAlternative[];
  naming: NamingConfig;
  quotas: readonly QuotaCheck[];
  assumptions: string[];
  /** IaC format for scaffold — "bicep" (default) or "terraform" */
  iacFormat: "bicep" | "terraform";
  /** Application database name the app expects to exist (from compose env such as
   *  MYSQL_DATABASE / MYSQLDB_DATABASE / POSTGRES_DB, a connection string, or ORM config).
   *  Scaffold emits a `flexibleServers/databases` child resource for this so the schema DB
   *  exists in IaC before the container starts; the conformance gate's DB-NAME-PRESENT check
   *  asserts it. Omit only when no managed database is in the plan. */
  appDbName?: string;
  postDeployRecommendations?: PostDeployRecommendation[];
  /** Instrumentation decision — object with boolean + reason, NOT a bare boolean */
  instrumentation?: InstrumentationConfig;
  /** Deployment variables resolved at prepare time — scaffold/deploy read, not re-ask */
  deploymentVariables?: DeploymentVariables;
  /** Quota validation result from proactive capacity check */
  quotaValidation?: QuotaValidation;
  /** Code deploy strategy for native module apps — see deploy-strategy.md.
   *  Only populated when Pattern B (startup-install) is needed. */
  deployStrategy?: DeployStrategy;
  healingAttempts?: readonly PrepareHealingAttempt[];
}
