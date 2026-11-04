/**
 * Prereq-phase TypeScript interfaces for prereq-output.json.
 *
 * Standalone schema for azure-app-onboard-prereq — this skill can run independently.
 *
 * Shared types used across phases (AppOnboardComponent, PostDeployRecommendation,
 * DetectedService, AppOnboardContext) are defined in:
 *   session-schemas.ts (local copy in this skill's references/)
 *
 * Context schema (AppOnboardContext, AppOnboardIntent) is defined in:
 *   session-schemas.ts (local copy in this skill's references/)
 */

// ─── prereq-output.json ──────────────────────────────────────────────────────

export interface BuildRequirements {
  hasNativeModules: boolean;
  hasDockerfile: boolean;
  /** True when the app can deploy on App Service F1 (Free) SKU */
  f1Viable: boolean;
  /** True when Dockerfile uses BuildKit-only syntax (--mount, # syntax=docker/dockerfile:1) */
  hasBuildKitSyntax?: boolean;
  /** Port from EXPOSE directive — used for Container Apps targetPort */
  exposedPort?: number;
  /** Estimated native module compilation time in seconds (typically 30–300s;
   *  larger compiled dependencies like scipy may take 600+s).
   *  Used by deploy phase to set WEBSITES_CONTAINER_START_TIME_LIMIT. */
  estimatedInstallTime?: number;
  /** Why F1 is not viable — set when f1Viable is false.
   *  Examples: "native modules (node-gyp)", "large dependency tree (27 pinned deps)",
   *  "build-time compilation (TypeScript tsc)", "major migration (Flask 0.12→2.3)" */
  f1BlockReason?: string;
}

/** Structured warning from prereq evaluation */
export interface PrereqWarning {
  id: string;
  component: string;
  axis: "build" | "completeness" | "deployability";
  summary: string;
  detail: string;
  /** What to do about this warning — actionable fix instruction.
   *  Examples: "Set PGSSLMODE=require env var in IaC", "Add trust proxy setting to Express app" */
  fix: string;
  /** When the fix should be applied in the pipeline.
   *  "prereq" = prereq can fix this NOW with user approval (code/config changes that prevent deploy failures).
   *  "scaffold" = applied at the scaffold gate: generated IaC (env var override, probe config) and, only if the user chooses it there, a fix to their own files (approval-gates.md § Fix offer). Prereq never edits for it.
   *  "deploy-gate" = surface at deploy approval gate for user awareness. No code changes.
   *  "post-deploy" = informational — add to postDeployRecommendations[], no action during pipeline. */
  fixPhase: "prereq" | "scaffold" | "deploy-gate" | "post-deploy";
}

export interface PrereqOutput {
  // AppOnboardComponent[] — see session-schemas.ts
  components: any[];
  /** Structured warnings — see prereq-artifacts.md for write rules */
  warnings: PrereqWarning[];
  detectedStack: string;
  /** Prereq-only: auto-approves readiness gate + simplifies prepare alt analysis.
   *  Does NOT skip any phase, gate, reference read, or validation. */
  fastTrackEligible: boolean;
  overallHealth?: "ready" | "readyWithCaveats" | "blocked";
  /** Build-time requirements detected from manifests and lockfiles */
  buildRequirements?: BuildRequirements;
  /** Detected health endpoint path (e.g., "/health", "/api/v1/health/").
   *  Used by scaffold for Azure health probe config and deploy for curl health check.
   *  null if no health endpoint found (triggers W-HEALTH warning). */
  healthEndpoint?: string | null;
  /** Application entry point detected from manifest (e.g., "index.js", "main.py", "cmd/main.go").
   *  Used by prepare/deploy-strategy.md for startupCommand generation. */
  entryPoint?: string;
  /** Structured recommendations derived from WARN findings.
   *  Merged into prepare-plan.json.postDeployRecommendations[] by the prepare phase.
   *  PostDeployRecommendation type — see session-schemas.ts */
  postDeployRecommendations?: any[];
  /** First-run init commands (DB migrations, seed data) detected from
   *  framework signals + migrations/ dir. Prepare prepends required entries
   *  to deployStrategy.startupCommand. See dependency-compatibility.md § First-Run. */
  initCommands?: { type: string; framework: string; command: string; required: boolean }[];
}
