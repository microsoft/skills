# Telemetry tracking hook for Azure Copilot Skills
# Reads JSON input from stdin, tracks relevant events, and publishes via MCP
#
# === Client Format Reference ===
#
# Copilot CLI:
#   - Field names:    camelCase (toolName, sessionId, toolArgs)
#   - Tool names:     lowercase (skill, view)
#   - MCP prefix:     azure-<command>  (e.g., azure-documentation)
#   - Skill prefix:   none (skill name as-is)
#   - Detection:      COPILOT_CLI env var is "1" (>=0.0.421); fallback: "toolArgs" without "hook_event_name" (<0.0.421)
#
# Claude Code:
#   - Field names:    snake_case (tool_name, session_id, tool_input, hook_event_name)
#   - Tool names:     PascalCase (Skill, Read, Edit)
#   - MCP prefix:     mcp__plugin_azure_azure__<command>  (double underscores)
#   - Skill prefix:   azure:<skill-name>  (e.g., azure:azure-prepare)
#   - Detection:      has "hook_event_name", tool_use_id does NOT contain "__vscode"
#
# Cursor:
#   - Field names:    snake_case (tool_name, session_id, tool_input, hook_event_name)
#   - Tool names:     PascalCase for file reads (Read); raw MCP tool name from afterMCPExecution
#   - Skill paths:    .cursor/plugins/cache/<catalog>/azure/<revision>/skills/<name>/SKILL.md
#   - Detection:      has "hook_event_name" and "cursor_version"
#   - MCP detection:  afterMCPExecution event with mcp_server_name "azure"
#
# VS Code:
#   - Field names:    snake_case (tool_name, session_id, tool_input, hook_event_name)
#   - Tool names:     snake_case (read_file, replace_string_in_file)
#   - MCP prefix:     mcp_azure_mcp_<command>  (e.g., mcp_azure_mcp_documentation)
#   - Skill paths:    .vscode/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/azure-skills/skills/<name>/SKILL.md          (VS Code)
#                     .vscode-insiders/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/azure-skills/skills/<name>/SKILL.md (VS Code Insiders)
#                     .agents/skills/<name>/SKILL.md
#   - Detection:      has "hook_event_name", tool_use_id contains "__vscode"
#                     or transcript_path contains "Code"
#   - Client name:    "Visual Studio Code" (stable) or "Visual Studio Code - Insiders"
#                     derived from transcript_path (e.g., .../Code - Insiders/User/...)
#   - Note:           Skills under .agents/skills/ are tracked as "Visual Studio Code" but
#                     transcript_path may be absent, so stable vs Insiders can only be
#                     distinguished when skills are called from agent-plugins (which
#                     includes transcript_path)
#
# === Event Types ===
#
# 1. skill_invocation
#    - Triggered when: the "skill"/"Skill" tool is called with a skill name,
#      OR a SKILL.md file is read from a recognized azure-skills path
#    - Tracked fields: --skill-name <name>, --skill-version <version>
#
# 2. tool_invocation
#    - Triggered when: a tool matching an Azure MCP prefix is called
#      (azure-*, mcp__plugin_azure_azure__*, mcp_azure_mcp_*), or when Cursor
#      sends afterMCPExecution with mcp_server_name "azure"
#    - Tracked field: --tool-name <toolName>
#
# 3. reference_file_read
#    - Triggered when: a file read tool (view/Read/read_file) targets a file
#      inside a recognized azure-skills path that is NOT a SKILL.md
#    - These are the reference/instruction files that skills bundle alongside
#      SKILL.md (e.g., recipes, templates, requirement docs)
#    - Tracked fields: --file-reference <relative-path-after-skills/>,
#      --skill-version <version>
#
# === Skill Version ===
#
# The skill version is read from the SKILL.md frontmatter (metadata.version),
# which the build stamps at package time. It is resolved as follows:
#   - skill/Skill tool call: locate SKILL.md relative to this script's plugin
#     root ("<plugin-root>/skills/<name>/SKILL.md")
#   - SKILL.md read:          read the version from the SKILL.md being read
#   - reference_file_read:    read the version from the sibling SKILL.md at the
#                             root of the skill folder the reference lives in
#    - Example: azure-validate/references/recipes/azd/README.md
#
# === Reference File Detection ===
#
# When a file read tool is invoked (Copilot CLI: "view", Claude Code/Cursor:
# "Read", VS Code: "read_file"), the script extracts the file path from the tool input
# and checks if it falls within a recognized azure-skills folder:
#
#   Path field lookup order:
#     - toolArgs.path / toolArgs.filePath       (Copilot CLI)
#     - tool_input.filePath / tool_input.file_path / tool_input.path  (Claude Code / VS Code)
#
#   Recognized install paths (one set per plugin, see $pathPatterns below):
#     azure-skills:
#     - .copilot/installed-plugins/<catalog-name>/azure/skills/...
#       (<catalog-name> is the marketplace/catalog folder the plugin was
#       installed under, e.g. "awesome-copilot" — it does not necessarily
#       match the plugin's own name, "azure")
#     - .claude/plugins/cache/azure-skills/azure/<version>/skills/...
#     - .claude/plugins/cache/claude-plugins-official/azure/<version>/skills/...
#     - .cursor/plugins/cache/<catalog-name>/azure/<revision>/skills/...
#     - .vscode/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/azure-skills/skills/...
#     azure-kusto-graph-skills:
#     - .copilot/installed-plugins/<catalog-name>/azure-kusto-graph-skills/skills/...
#     - .claude/plugins/cache/azure-skills/azure-kusto-graph-skills/<version>/skills/...
#     - .cursor/plugins/cache/<catalog-name>/azure-kusto-graph-skills/<revision>/skills/...
#     - .vscode/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/azure-kusto-graph-skills/skills/...
#     shared:
#     - .agents/skills/...
#
#   If the path matches AND is not a SKILL.md file, the relative path after
#   "skills/" is extracted and emitted as a reference_file_read event.
#   SKILL.md reads are tracked as skill_invocation instead (not double-counted).
#
# === Debugging ===
#
# If the AZURE_SKILLS_TELEMETRY_LOG_DIR env var is set, the script will create
# a "raw-input" subdirectory and write each raw JSON input to a timestamped file
# for debugging. It will also append a "telemetry.log" file with MCP args for
# each tracked event.
#
# When using `--plugin-dir` to load a local plugin the AZURE_SKILLS_PLUGIN_ROOT
# env var should be set so that the script can detect local skill paths for
# reference_file_read events.

$ErrorActionPreference = "SilentlyContinue"

# Dumps raw input to a file in the AZURE_SKILLS_TELEMETRY_LOG_DIR/raw-input/
# directory for debugging if the env var is set.
function Write-RawInputToFile {
    param([string]$RawInput)
    if ($env:AZURE_SKILLS_TELEMETRY_LOG_DIR) {
        $logDir = $env:AZURE_SKILLS_TELEMETRY_LOG_DIR
        $rawInputDir = Join-Path $logDir 'raw-input'
        if (-not (Test-Path -LiteralPath $rawInputDir)) {
            New-Item -ItemType Directory -Path $rawInputDir -Force | Out-Null
        }
        $timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
        $rawInputFile = Join-Path $rawInputDir "$timestamp.json"
        try {
            $RawInput | Out-File -FilePath $rawInputFile -Encoding utf8 -Force
        } catch { }
    }
}

# Writes a debug log entry to the AZURE_SKILLS_TELEMETRY_LOG_DIR/telemetry.log file
# if the env var is set.
function Write-TelemetryDebugLog {
    param([string]$Content)

    if ($env:AZURE_SKILLS_TELEMETRY_LOG_DIR) {
        $logDir = $env:AZURE_SKILLS_TELEMETRY_LOG_DIR
        $logFile = Join-Path $logDir 'telemetry.log'
        $logEntry = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') | $Content"
        try {
            Add-Content -Path $logFile -Value $logEntry -ErrorAction SilentlyContinue
        } catch { }
    }
}

# Skip telemetry if opted out
if ($env:AZURE_MCP_COLLECT_TELEMETRY -eq "false") {
    Write-Output '{"continue":true}'
    exit 0
}

# Return success and exit
function Write-Success {
    Write-Output '{"continue":true}'
    exit 0
}

# Resolve this script's directory so we can locate bundled skills. In the
# installed plugin, hooks/ and skills/ are siblings under the plugin root, so
# <plugin-root>/skills/<name>/SKILL.md is the skill definition.
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$skillsDir = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'skills'

# Return true only when a target belongs to this hook's plugin. Since this hook
# is copied into every plugin, comparing through the skills directory prevents
# each installed copy from reporting the same skill or reference event.
function Test-OwnedSkillPath {
    # targetPath is either path to the SKILL.md or to a reference file
    param([string]$TargetPath)
    if ([string]::IsNullOrWhiteSpace($TargetPath)) { return $false }
    $skillsRootNorm = (($skillsDir -replace '\\', '/') -replace '/+', '/').TrimEnd('/')
    $targetPathNorm = ($TargetPath -replace '\\', '/') -replace '/+', '/'
    return $targetPathNorm.StartsWith("$skillsRootNorm/", [System.StringComparison]::OrdinalIgnoreCase)
}

# Extract the skill version from a SKILL.md frontmatter (metadata.version).
# Returns $null if the file or version cannot be read.
function Get-SkillVersion {
    param([string]$SkillMdPath)
    if (-not $SkillMdPath) { return $null }
    $SkillMdPath = $SkillMdPath -replace '\\', '/'
    if (-not (Test-Path -LiteralPath $SkillMdPath)) { return $null }
    try {
        $lines = Get-Content -LiteralPath $SkillMdPath -ErrorAction SilentlyContinue
    } catch { return $null }
    $inFrontmatter = $false
    foreach ($line in $lines) {
        if ($line -match '^---\s*$') {
            if (-not $inFrontmatter) { $inFrontmatter = $true; continue }
            else { break }
        }
        if ($inFrontmatter -and $line -match '^\s*version:\s*(.+?)\s*$') {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

# Extract the plugin version from the top-level .plugin/plugin.json manifest.
# Returns $null if the file or expected JSON value cannot be read.
function Get-PluginVersion {
    $pluginManifestPath = Join-Path (Split-Path -Parent $skillsDir) '.plugin/plugin.json'
    if (-not (Test-Path -LiteralPath $pluginManifestPath)) { return $null }
    try {
        $manifest = Get-Content -LiteralPath $pluginManifestPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ($manifest.version -is [string] -and -not [string]::IsNullOrWhiteSpace($manifest.version)) {
            return $manifest.version
        }
    } catch { }
    return $null
}

# === Main Processing ===

# Read entire stdin at once - hooks send one complete JSON per invocation
try {
    $rawInput = [Console]::In.ReadToEnd()
} catch {
    Write-Success
}

# Return success and exit if no input
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    Write-Success
}

Write-RawInputToFile -RawInput $rawInput

# === STEP 1: Read and parse input ===

# Parse JSON input
try {
    $inputData = $rawInput | ConvertFrom-Json
} catch {
    Write-Success
}

# Extract fields from hook data
# Support Copilot CLI (camelCase), Claude Code (snake_case), and VS Code (snake_case) formats
$toolName = $inputData.toolName
if (-not $toolName) {
    $toolName = $inputData.tool_name
}

$sessionId = $inputData.sessionId
if (-not $sessionId) {
    $sessionId = $inputData.session_id
}
$hookEventName = $inputData.hook_event_name
$mcpServerName = $inputData.mcp_server_name

# Get tool arguments (Copilot CLI: toolArgs, Claude Code / VS Code: tool_input)
$toolInput = $inputData.toolArgs
if (-not $toolInput) {
    $toolInput = $inputData.tool_input
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Detect client name based on input format
# Copilot CLI (>=0.0.421): COPILOT_CLI env var is "1" — primary signal, checked first
# Copilot CLI (<0.0.421):  has "toolArgs" field without "hook_event_name" — backward compat fallback
# Cursor: has hook_event_name AND a "cursor_version" field
# VS Code: has hook_event_name AND tool_use_id contains "__vscode" or transcript_path contains "Code"
# Claude Code: has hook_event_name, tool_use_id does NOT contain "__vscode"
$hasHookEventName = $inputData.PSObject.Properties.Name -contains "hook_event_name"
$hasToolArgs = $inputData.PSObject.Properties.Name -contains "toolArgs"
$toolUseId = $inputData.tool_use_id
$transcriptPath = $inputData.transcript_path
$cursorVersion = $inputData.cursor_version
$isVscodeToolUseId = $toolUseId -and ($toolUseId -match '__vscode')
# Match path separators around "Code" or "Code - Insiders" to avoid matching "Claude Code"
$isVscodeTranscript = $transcriptPath -and ($transcriptPath -match '[/\\]Code( - Insiders)?[/\\]')

# Copilot CLI check first — env var available since v0.0.421
if ($env:COPILOT_CLI -eq "1") {
    $clientName = "copilot-cli"
} elseif ($hasHookEventName -and $cursorVersion) {
    $clientName = "cursor"
} elseif ($hasHookEventName -and ($isVscodeToolUseId -or $isVscodeTranscript)) {
    # Detect VS Code variant from transcript_path
    # Insiders: ...AppData\Roaming\Code - Insiders\User\...
    # Stable:   ...AppData\Roaming\Code\User\...
    if ($transcriptPath -match '[/\\]Code - Insiders[/\\]') {
        $clientName = "Visual Studio Code - Insiders"
    } else {
        $clientName = "Visual Studio Code"
    }
} elseif ($hasHookEventName) {
    $clientName = "claude-code"
} elseif ($hasToolArgs) {
    # Backward compat: old Copilot CLI (<0.0.421) sent toolArgs without hook_event_name
    # Claude Code never sends toolArgs, so this is unambiguous
    $clientName = "copilot-cli"
} else {
    $clientName = "unknown"
}

# Skip if no tool name found in any format
if (-not $toolName) {
    Write-Success
}

# Helper to extract path from tool input (handles 'path', 'filePath', 'file_path')
function Get-ToolInputPath {
    if ($toolInput.path) { return $toolInput.path }
    if ($toolInput.filePath) { return $toolInput.filePath }
    if ($toolInput.file_path) { return $toolInput.file_path }
    return $null
}

# === STEP 2: Determine what to track for azmcp ===

# Path patterns per client, one block per plugin (used for SKILL.md and
# file-reference matching). When onboarding another plugin, add a new block by
# swapping both the catalog/plugin segments (e.g. "azure" and "azure-skills")
# for the new plugin's name.

# --- azure-skills plugin ---
# The Copilot CLI pattern wildcards the catalog/marketplace folder name
# (e.g. "awesome-copilot") since it does not necessarily match the plugin's
# own name ("azure").
$pathPatternCopilot = '\.copilot/installed-plugins/[^/]+/azure/skills/'
$pathPatternClaude = '\.claude/plugins/cache/(azure-skills|claude-plugins-official)/azure/[0-9.]+/skills/'
$pathPatternCursor = '\.cursor/plugins/cache/[^/]+/azure/[^/]+/skills/'
$pathPatternVscodeAgentPlugins = 'agent-plugins/github\.com/microsoft/azure-skills/\.github/plugins/azure-skills/skills/'

# --- azure-kusto-graph-skills plugin ---
$pathPatternCopilotKustoGraph = '\.copilot/installed-plugins/[^/]+/azure-kusto-graph-skills/skills/'
$pathPatternClaudeKustoGraph = '\.claude/plugins/cache/azure-skills/azure-kusto-graph-skills/[0-9.]+/skills/'
$pathPatternCursorKustoGraph = '\.cursor/plugins/cache/[^/]+/azure-kusto-graph-skills/[^/]+/skills/'
$pathPatternVscodeAgentPluginsKustoGraph = 'agent-plugins/github\.com/microsoft/azure-skills/\.github/plugins/azure-kusto-graph-skills/skills/'

# --- shared across all plugins ---
$pathPatternAgentsSkills = '\.agents/skills/'

# Put the path patterns into an array for easier iteration
$pathPatterns = @(
    $pathPatternCopilot, $pathPatternClaude, $pathPatternCursor, $pathPatternVscodeAgentPlugins,
    $pathPatternCopilotKustoGraph, $pathPatternClaudeKustoGraph, $pathPatternCursorKustoGraph, $pathPatternVscodeAgentPluginsKustoGraph,
    $pathPatternAgentsSkills
)

# If $env:AZURE_SKILLS_PLUGIN_ROOT is set, add it to the path patterns for local skill development
if ($env:AZURE_SKILLS_PLUGIN_ROOT) {
    $localSkillsPath = [regex]::Escape($env:AZURE_SKILLS_PLUGIN_ROOT) + '/skills/'
    $localSkillsPath = $localSkillsPath -replace '\\', '/' -replace '/+', '/'
    $pathPatterns += $localSkillsPath
}

$shouldTrack = $false
$eventType = $null
$skillName = $null
$skillVersion = $null
$azureToolName = $null
$filePath = $null

# Check for skill invocation via 'skill'/'Skill' tool
if ($toolName -eq "skill" -or $toolName -eq "Skill") {
    $skillName = $toolInput.skill
    # Claude Code prefixes skill names with "azure:" (e.g., "azure:azure-prepare")
    # Strip it to get the actual skill name for the allowlist
    if ($skillName -and $skillName.StartsWith("azure:")) {
        $skillName = $skillName.Substring(6)
    }
    $skillMdPath = Join-Path $skillsDir (Join-Path $skillName 'SKILL.md')
    if ($skillName -and (Test-Path -LiteralPath $skillMdPath) -and (Test-OwnedSkillPath $skillMdPath)) {
        $eventType = "skill_invocation"
        $shouldTrack = $true
        $skillVersion = Get-SkillVersion $skillMdPath
    }
}

# Check for skill invocation (reading SKILL.md files)
# Copilot CLI: "view", Claude Code: "Read", VS Code: "read_file"
if ($toolName -eq "view" -or $toolName -eq "Read" -or $toolName -eq "read_file") {
    $pathToCheck = Get-ToolInputPath
    if ($pathToCheck) {
        # Normalize path: convert to lowercase, replace backslashes, and squeeze consecutive slashes
        $pathLower = $pathToCheck.ToLower() -replace '\\', '/' -replace '/+', '/'

        # Check for SKILL.md pattern — only match azure-skills paths (see pathPatterns above)
        $isAzureSkillMd = $false
        foreach ($pattern in $pathPatterns) {
            if ($pathLower -match "${pattern}[^/]+/skill\.md") {
                $isAzureSkillMd = $true
                break
            }
        }

        if ($isAzureSkillMd -and (Test-OwnedSkillPath $pathToCheck)) {
            $pathNormalized = $pathToCheck -replace '\\', '/' -replace '/+', '/'
            if ($pathNormalized -match '/skills/([^/]+)/SKILL\.md$') {
                $skillName = $Matches[1]
                $eventType = "skill_invocation"
                $shouldTrack = $true
                $skillVersion = Get-SkillVersion $pathToCheck
            }
        }
    }
}

# Check for Azure MCP tool invocation
# Copilot CLI:  "azure-*" prefix (e.g., azure-documentation)
# Claude Code:  "mcp__plugin_azure_azure__*" prefix (e.g., mcp__plugin_azure_azure__documentation)
# Cursor:       afterMCPExecution with mcp_server_name "azure"; normalize the
#               raw tool name to the postToolUse form (e.g., MCP:get_azure_bestpractices)
# VS Code:      "mcp_azure_mcp_*" prefix (e.g., mcp_azure_mcp_documentation)
if ($toolName) {
    if ($clientName -eq "cursor" -and $hookEventName -eq "afterMCPExecution" -and $mcpServerName -eq "azure") {
        $azureToolName = $toolName
        if (-not $azureToolName.StartsWith("MCP:")) {
            $azureToolName = "MCP:$azureToolName"
        }
        $eventType = "tool_invocation"
        $shouldTrack = $true
    } elseif ($toolName.StartsWith("azure-") -or $toolName.StartsWith("mcp__plugin_azure_azure__") -or $toolName.StartsWith("mcp_azure_mcp_")) {
        $azureToolName = $toolName
        $eventType = "tool_invocation"
        $shouldTrack = $true
    }
}

# Capture file path from any tool input (only track files in azure skills folder)
# Skip if already matched as SKILL.md skill_invocation — SKILL.md is not a valid file-reference
if (-not $filePath -and -not $skillName) {
    $pathToCheck = Get-ToolInputPath
    if ($pathToCheck) {
        # Normalize path for matching: replace backslashes and squeeze consecutive slashes
        $pathLower = $pathToCheck.ToLower() -replace '\\', '/' -replace '/+', '/'

        $matchesPattern = $false
        foreach ($pattern in $pathPatterns) {
            if ($pathLower -match $pattern) {
                $matchesPattern = $true
                break
            }
        }
        if ($matchesPattern -and (Test-OwnedSkillPath $pathToCheck)) {
            # Extract relative path after 'skills/'
            $pathNormalized = $pathToCheck -replace '\\', '/' -replace '/+', '/'

            if ($pathNormalized -match '.*/skills/(.+)$') {
                $filePath = $Matches[1]

                if (-not $shouldTrack) {
                    $shouldTrack = $true
                    $eventType = "reference_file_read"
                    # Resolve the version from the sibling SKILL.md at the root
                    # of the skill folder this reference lives in.
                    $skillNameSeg = ($filePath -split '/')[0]
                    $skillRootAbs = $pathNormalized.Substring(0, $pathNormalized.Length - $filePath.Length)
                    $skillVersion = Get-SkillVersion ("$skillRootAbs$skillNameSeg/SKILL.md")
                }
            }
        }
    }
}

# === STEP 3: Publish event ===

if ($shouldTrack) {
    $pluginVersion = Get-PluginVersion

    # Build MCP command arguments
    $mcpArgs = @(
        "server", "plugin-telemetry",
        "--timestamp", $timestamp,
        "--client-name", $clientName
    )

    if ($eventType) { $mcpArgs += "--event-type"; $mcpArgs += $eventType }
    if ($sessionId) { $mcpArgs += "--session-id"; $mcpArgs += $sessionId }
    if ($skillName) { $mcpArgs += "--skill-name"; $mcpArgs += $skillName }
    if ($skillVersion) { $mcpArgs += "--skill-version"; $mcpArgs += $skillVersion }
    if ($pluginVersion) { $mcpArgs += "--plugin-version"; $mcpArgs += $pluginVersion }
    if ($azureToolName) { $mcpArgs += "--tool-name"; $mcpArgs += $azureToolName }
    # Convert forward slashes to backslashes for azmcp allowlist compatibility
    if ($filePath) { $mcpArgs += "--file-reference"; $mcpArgs += ($filePath -replace '/', '\') }

    # Publish telemetry via npx
    try {
        & npx -y @azure/mcp@latest @mcpArgs 2>&1 | Out-Null
    } catch { }

    # If AZURE_SKILLS_TELEMETRY_LOG_DIR env var is set, append the args to the telemetry.log file in that directory (for debugging)
    Write-TelemetryDebugLog -Content "MCP Args: $($mcpArgs -join ' ')"
}

# Output success to stdout (required by hooks)
Write-Success
