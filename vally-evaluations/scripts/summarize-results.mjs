import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const NANO_AIU_PER_CREDIT = 1_000_000_000
const USAGE_START_MARKER = '<!-- vally-usage:start -->'
const USAGE_END_MARKER = '<!-- vally-usage:end -->'
const SEARCH_IGNORED_DIRECTORIES = new Set([
  '.git',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'workspaces',
])

async function findFiles(directory, filename) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory() && !SEARCH_IGNORED_DIRECTORIES.has(entry.name)) {
      files.push(...await findFiles(entryPath, filename))
    } else if (entry.isFile() && entry.name === filename) {
      files.push(entryPath)
    }
  }

  return files
}

async function pathExists(candidate) {
  if (!candidate) return false

  try {
    await stat(candidate)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function relativePersistedPath(resultsDirectory, candidate) {
  if (!candidate) return null

  const relativePath = path.relative(resultsDirectory, path.resolve(candidate))
  if (
    relativePath === ''
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    return null
  }

  return relativePath
}

async function loadSessionMetadata(runDirectory) {
  const metadataByTrajectory = new Map()
  const metadataFiles = await findFiles(runDirectory, 'metadata.json')

  for (const metadataFile of metadataFiles) {
    let metadata
    try {
      metadata = JSON.parse(await readFile(metadataFile, 'utf8'))
    } catch (error) {
      throw new Error(`Invalid JSON in ${metadataFile}: ${error.message}`)
    }

    if (metadata.trajectoryId) {
      metadataByTrajectory.set(metadata.trajectoryId, { metadata, metadataFile })
    }
  }

  return metadataByTrajectory
}

function readNanoAiu(record, metrics) {
  const cost = metrics?.tokenUsage?.cost
  if (
    cost?.provider === 'github-copilot'
    && cost?.unit === 'nano-aiu'
    && Number.isSafeInteger(cost.amount)
    && cost.amount >= 0
  ) {
    return cost.amount
  }

  const legacyValues = [
    metrics?.tokenUsage?.totalNanoAiu,
    metrics?.copilotUsage?.totalNanoAiu,
    metrics?.totalNanoAiu,
    record?.totalNanoAiu,
  ]

  return legacyValues.find((value) => Number.isSafeInteger(value) && value >= 0) ?? null
}

export async function loadTrials(resultsDirectory) {
  const resultFiles = await findFiles(resultsDirectory, 'results.jsonl')
  const trials = []

  for (const resultFile of resultFiles) {
    const runDirectory = path.dirname(resultFile)
    const sessionMetadata = await loadSessionMetadata(runDirectory)
    const lines = (await readFile(resultFile, 'utf8')).split(/\r?\n/).filter(Boolean)
    for (const [lineIndex, line] of lines.entries()) {
      let record
      try {
        record = JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid JSON in ${resultFile}:${lineIndex + 1}: ${error.message}`)
      }

      if (record.type !== 'trial-result') continue

      const metrics = record.trajectory?.metrics ?? {}
      const tokenUsage = metrics.tokenUsage ?? {}
      const nanoAiu = readNanoAiu(record, metrics)
      const trajectoryId = record.trajectory?.id
      const session = sessionMetadata.get(trajectoryId)
      const sessionDirectory = session ? path.dirname(session.metadataFile) : null
      const inferredArtifactsDirectory = sessionDirectory
        ? path.join(sessionDirectory, 'artifacts')
        : null
      const artifactsDirectory = record.trajectory?.artifactDir ?? inferredArtifactsDirectory
      const workspace = relativePersistedPath(resultsDirectory, record.trajectory?.workDir)
      const generatedArtifacts = relativePersistedPath(resultsDirectory, artifactsDirectory)
      const sessionStateDirectory = relativePersistedPath(resultsDirectory, sessionDirectory)
      const metadataPath = relativePersistedPath(resultsDirectory, session?.metadataFile)
      const eventsPath = relativePersistedPath(
        resultsDirectory,
        sessionDirectory ? path.join(sessionDirectory, 'events.jsonl') : null,
      )
      const evalReportPath = path.join(runDirectory, 'eval-results.md')
      const otelSpansPath = path.join(runDirectory, 'otel-spans.jsonl')
      trials.push({
        itemId: record.itemId ?? null,
        evaluation: record.evalName ?? record.eval ?? 'unknown',
        stimulus: typeof record.stimulus === 'string'
          ? record.stimulus
          : record.trajectory?.stimulus?.name ?? 'unknown',
        model: record.model ?? record.trajectory?.metadata?.model ?? 'unknown',
        passed: Boolean(record.gradeResult?.passed),
        score: Number.isFinite(record.gradeResult?.score) ? record.gradeResult.score : null,
        inputTokens: tokenUsage.inputTokens ?? 0,
        outputTokens: tokenUsage.outputTokens ?? 0,
        totalTokens: tokenUsage.totalTokens ?? 0,
        cacheReadTokens: tokenUsage.cacheReadTokens ?? 0,
        cacheWriteTokens: tokenUsage.cacheWriteTokens ?? 0,
        toolCalls: metrics.toolCallCount ?? 0,
        toolBreakdown: metrics.toolCallBreakdown ?? {},
        agentWallTimeMs: metrics.wallTimeMs ?? 0,
        evaluationDurationMs: record.durationMs ?? 0,
        turnCount: metrics.turnCount ?? 0,
        errorCount: metrics.errorCount ?? 0,
        nanoAiu,
        aiCredits: nanoAiu === null ? null : nanoAiu / NANO_AIU_PER_CREDIT,
        graderOutcomes: (record.gradeResult?.details ?? []).map((detail) => ({
          name: detail.name ?? 'Unnamed grader',
          passed: Boolean(detail.passed),
          score: Number.isFinite(detail.score) ? detail.score : null,
          evidence: detail.evidence ?? null,
        })),
        source: path.relative(resultsDirectory, resultFile),
        capturedData: {
          vally: {
            results: path.relative(resultsDirectory, resultFile),
            report: await pathExists(evalReportPath)
              ? path.relative(resultsDirectory, evalReportPath)
              : null,
            otelSpans: await pathExists(otelSpansPath)
              ? path.relative(resultsDirectory, otelSpansPath)
              : null,
          },
          workspace: workspace && await pathExists(path.resolve(resultsDirectory, workspace))
            ? workspace
            : null,
          generatedArtifacts:
            generatedArtifacts
            && await pathExists(path.resolve(resultsDirectory, generatedArtifacts))
              ? generatedArtifacts
              : null,
          copilotSessionState: sessionStateDirectory
            ? {
                directory: sessionStateDirectory,
                events: eventsPath && await pathExists(path.resolve(resultsDirectory, eventsPath))
                  ? eventsPath
                  : null,
                metadata: metadataPath,
                sessionId: session.metadata.executorSessionId ?? null,
              }
            : null,
        },
      })
    }
  }

  return trials
}

function createAggregate(name, model = null) {
  return {
    name,
    model,
    trials: 0,
    passed: 0,
    scores: [],
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 0,
    toolBreakdown: {},
    agentWallTimeMs: 0,
    evaluationDurationMs: 0,
    knownNanoAiu: 0,
    creditTrials: 0,
  }
}

function addTrial(aggregate, trial) {
  aggregate.trials += 1
  aggregate.passed += trial.passed ? 1 : 0
  if (trial.score !== null) aggregate.scores.push(trial.score)
  aggregate.inputTokens += trial.inputTokens
  aggregate.outputTokens += trial.outputTokens
  aggregate.totalTokens += trial.totalTokens
  aggregate.cacheReadTokens += trial.cacheReadTokens
  aggregate.cacheWriteTokens += trial.cacheWriteTokens
  aggregate.toolCalls += trial.toolCalls
  aggregate.agentWallTimeMs += trial.agentWallTimeMs
  aggregate.evaluationDurationMs += trial.evaluationDurationMs

  for (const [tool, count] of Object.entries(trial.toolBreakdown)) {
    aggregate.toolBreakdown[tool] = (aggregate.toolBreakdown[tool] ?? 0) + count
  }

  if (trial.nanoAiu !== null) {
    aggregate.knownNanoAiu += trial.nanoAiu
    aggregate.creditTrials += 1
  }
}

function finalizeAggregate(aggregate) {
  const allCreditsKnown = aggregate.trials > 0 && aggregate.creditTrials === aggregate.trials
  return {
    name: aggregate.name,
    model: aggregate.model,
    trials: aggregate.trials,
    passed: aggregate.passed,
    passRate: aggregate.trials ? aggregate.passed / aggregate.trials : 0,
    averageScore: aggregate.scores.length
      ? aggregate.scores.reduce((sum, score) => sum + score, 0) / aggregate.scores.length
      : null,
    tokens: {
      input: aggregate.inputTokens,
      output: aggregate.outputTokens,
      total: aggregate.totalTokens,
      cacheRead: aggregate.cacheReadTokens,
      cacheWrite: aggregate.cacheWriteTokens,
    },
    tools: {
      total: aggregate.toolCalls,
      breakdown: aggregate.toolBreakdown,
    },
    time: {
      agentWallTimeMs: aggregate.agentWallTimeMs,
      evaluationDurationMs: aggregate.evaluationDurationMs,
    },
    cost: {
      provider: 'github-copilot',
      sourceUnit: 'nano-aiu',
      knownNanoAiu: aggregate.knownNanoAiu,
      knownAiCredits: aggregate.knownNanoAiu / NANO_AIU_PER_CREDIT,
      completeAiCredits: allCreditsKnown
        ? aggregate.knownNanoAiu / NANO_AIU_PER_CREDIT
        : null,
      coveredTrials: aggregate.creditTrials,
      totalTrials: aggregate.trials,
      complete: allCreditsKnown,
    },
  }
}

export function summarize(trials) {
  const overall = createAggregate('All evaluations')
  const byEvaluationAndModel = new Map()

  for (const trial of trials) {
    const model = trial.model ?? 'unknown'
    const key = `${trial.evaluation}\0${model}`
    const evaluation = byEvaluationAndModel.get(key)
      ?? createAggregate(trial.evaluation, model)
    byEvaluationAndModel.set(key, evaluation)
    addTrial(evaluation, trial)
    addTrial(overall, trial)
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    creditAccounting: {
      nanoAiuPerAiCredit: NANO_AIU_PER_CREDIT,
      scope: 'Evaluated GitHub Copilot agent only; excludes LLM judges and graders.',
    },
    overall: finalizeAggregate(overall),
    evaluations: [...byEvaluationAndModel.values()]
      .map(finalizeAggregate)
      .sort((left, right) => (
        left.name.localeCompare(right.name) || left.model.localeCompare(right.model)
      )),
    trials,
  }
}

function formatInteger(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

export function formatDuration(milliseconds) {
  const totalSeconds = milliseconds / 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds - (hours * 3600) - (minutes * 60)
  return `${hours}h ${minutes}m ${seconds.toFixed(1)}s`
}

function quoteMarkdown(value) {
  return String(value)
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

function inlineCode(value) {
  return `\`${String(value).replaceAll('`', '\\`')}\``
}

function displayPath(candidate, workspaceDirectory) {
  if (!candidate) return null

  const value = String(candidate)
  if (!workspaceDirectory || !path.isAbsolute(value)) return value.replaceAll('\\', '/')

  const relativePath = path.relative(workspaceDirectory, value)
  if (relativePath === '') return '.'
  if (
    relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  ) {
    return relativePath.replaceAll('\\', '/')
  }

  return path.basename(value)
}

function editedFiles(argumentsValue) {
  const patch = typeof argumentsValue === 'string'
    ? argumentsValue
    : argumentsValue?.patch ?? ''
  return [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)]
    .map((match) => match[1].trim().replaceAll('\\', '/'))
}

function describeToolAction(eventData, intention, workspaceDirectory) {
  const toolName = eventData.toolName ?? 'unknown'
  const args = eventData.arguments ?? {}

  if (toolName === 'view') {
    const target = displayPath(args.path, workspaceDirectory)
    return target ? `Viewed ${inlineCode(target)}.` : 'Viewed a source file.'
  }

  if (toolName === 'rg') {
    const target = displayPath(args.paths, workspaceDirectory)
    const location = target ? ` under ${inlineCode(target)}` : ''
    return `Searched${location} for ${inlineCode(args.pattern ?? 'a code pattern')}.`
  }

  if (toolName === 'glob') {
    const target = displayPath(args.paths, workspaceDirectory)
    const location = target ? ` under ${inlineCode(target)}` : ''
    return `Listed files matching ${inlineCode(args.pattern ?? '*')}${location}.`
  }

  if (toolName === 'apply_patch') {
    const files = editedFiles(args)
    return files.length
      ? `Applied source changes to ${files.map(inlineCode).join(', ')}.`
      : 'Applied a source patch.'
  }

  if (toolName === 'powershell') {
    return args.description
      ? `${String(args.description).replace(/[.!]?\s*$/, '')}.`
      : 'Ran a PowerShell command.'
  }

  if (toolName === 'skill') {
    return args.skill
      ? `Loaded the ${inlineCode(args.skill)} skill.`
      : 'Loaded a skill.'
  }

  if (intention && intention !== toolName) {
    return `${String(intention).replace(/[.!]?\s*$/, '')}.`
  }

  return `Invoked ${inlineCode(toolName)}.`
}

function narrativeText(value, workspaceDirectory) {
  let text = String(value).replace(/\s+/g, ' ').trim()
  if (workspaceDirectory) {
    text = text
      .replaceAll(workspaceDirectory, '.')
      .replaceAll(workspaceDirectory.replaceAll('\\', '/'), '.')
  }
  return text
}

function describeToolOutcome(completion, workspaceDirectory) {
  if (!completion) return 'No completion event was recorded.'
  if (!completion.success) {
    const message = completion.error?.message ?? 'The tool reported a failure.'
    return `Failed: ${narrativeText(message, workspaceDirectory)}`
  }

  const metrics = completion.toolTelemetry?.metrics ?? {}
  if (Number.isFinite(metrics.file_count)) {
    return `Succeeded; ${metrics.file_count} file(s) were reported.`
  }

  return 'Succeeded.'
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function renderTrajectoryNarrative(events, trial) {
  const sessionStart = events.find((event) => event.type === 'session.start')
  const workspaceDirectory = sessionStart?.data?.context?.cwd ?? null
  const stimulus = events.find((event) => event.type === 'user.message')?.data?.content
    ?? events.find((event) => event.type === 'hook.start'
      && event.data?.hookType === 'userPromptSubmitted')?.data?.input?.prompt
    ?? 'Stimulus text was not captured.'
  const toolIntentions = new Map()
  const toolCompletions = new Map()
  const turns = new Map()

  function getTurn(turnId) {
    const key = String(turnId ?? 'unknown')
    const turn = turns.get(key) ?? {
      id: key,
      startedAt: null,
      endedAt: null,
      messages: [],
      actions: [],
    }
    turns.set(key, turn)
    return turn
  }

  for (const event of events) {
    if (event.type === 'assistant.message') {
      for (const request of event.data?.toolRequests ?? []) {
        toolIntentions.set(request.toolCallId, request.intentionSummary ?? null)
      }
    } else if (event.type === 'tool.execution_complete') {
      toolCompletions.set(event.data?.toolCallId, event.data)
    }
  }

  for (const event of events) {
    const turnId = event.data?.turnId
    if (event.type === 'assistant.turn_start') {
      getTurn(turnId).startedAt = event.timestamp ?? null
    } else if (event.type === 'assistant.turn_end') {
      getTurn(turnId).endedAt = event.timestamp ?? null
    } else if (event.type === 'assistant.message') {
      const content = event.data?.content?.trim()
      if (content) getTurn(turnId).messages.push(content)
    } else if (event.type === 'tool.execution_start') {
      getTurn(turnId).actions.push({
        name: event.data?.toolName ?? 'unknown',
        description: describeToolAction(
          event.data ?? {},
          toolIntentions.get(event.data?.toolCallId),
          workspaceDirectory,
        ),
        outcome: describeToolOutcome(
          toolCompletions.get(event.data?.toolCallId),
          workspaceDirectory,
        ),
      })
    }
  }

  const result = trial.passed ? 'PASS' : 'FAIL'
  const score = trial.score === null ? 'N/A' : `${(trial.score * 100).toFixed(1)}%`
  const lines = [
    '# Evaluation trajectory narrative',
    '',
    `- **Evaluation:** ${trial.evaluation}`,
    `- **Stimulus:** ${trial.stimulus}`,
    `- **Model:** ${trial.model}`,
    `- **Result:** ${result}`,
    `- **Score:** ${score}`,
    `- **Agent wall time:** ${formatDuration(trial.agentWallTimeMs)}`,
    `- **End-to-end duration:** ${formatDuration(trial.evaluationDurationMs)}`,
    `- **Recorded turns:** ${turns.size}`,
    '',
    '## Initial stimulus',
    '',
    quoteMarkdown(stimulus),
    '',
    '## Turn-by-turn narrative',
    '',
  ]

  const orderedTurns = [...turns.values()].sort((left, right) => {
    const leftNumber = Number(left.id)
    const rightNumber = Number(right.id)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber
    return left.id.localeCompare(right.id)
  })

  if (!orderedTurns.length) {
    lines.push('No assistant turn events were captured.', '')
  }

  for (const [index, turn] of orderedTurns.entries()) {
    const startedAt = parseTimestamp(turn.startedAt)
    const endedAt = parseTimestamp(turn.endedAt)
    const duration = startedAt !== null && endedAt !== null && endedAt >= startedAt
      ? ` - ${formatDuration(endedAt - startedAt)}`
      : ''
    lines.push(`### Turn ${index + 1} (ID ${turn.id}${duration})`, '')

    for (const message of turn.messages) {
      lines.push('**Assistant message**', '', quoteMarkdown(message), '')
    }

    if (turn.actions.length) {
      lines.push('**Actions**', '')
      for (const [actionIndex, action] of turn.actions.entries()) {
        lines.push(
          `${actionIndex + 1}. ${inlineCode(action.name)} - ${action.description} **Outcome:** ${action.outcome}`,
        )
      }
      lines.push('')
    } else {
      lines.push('No tool actions were recorded for this turn.', '')
    }
  }

  lines.push('## Grading outcome', '')
  if (trial.graderOutcomes?.length) {
    for (const grader of trial.graderOutcomes) {
      const graderResult = grader.passed ? 'PASS' : 'FAIL'
      const graderScore = grader.score === null ? 'N/A' : grader.score.toFixed(3)
      const evidence = grader.evidence
        ? ` - ${String(grader.evidence).replace(/\s+/g, ' ').trim()}`
        : ''
      lines.push(`- **${grader.name}:** ${graderResult} (${graderScore})${evidence}`)
    }
  } else {
    lines.push('No grader outcomes were captured.')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

async function readEvents(eventsPath) {
  const lines = (await readFile(eventsPath, 'utf8')).split(/\r?\n/).filter(Boolean)
  return lines.map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Invalid JSON in ${eventsPath}:${index + 1}: ${error.message}`)
    }
  })
}

export async function generateNarratives(resultsDirectory, trials) {
  const generated = []

  for (const trial of trials) {
    const eventsStoredPath = trial.capturedData?.copilotSessionState?.events
    if (!eventsStoredPath) continue

    const eventsPath = path.resolve(resultsDirectory, eventsStoredPath)
    const narrativePath = path.join(path.dirname(eventsPath), 'narrative.md')
    const events = await readEvents(eventsPath)
    await writeFile(narrativePath, renderTrajectoryNarrative(events, trial))
    trial.capturedData.narrative = path.relative(resultsDirectory, narrativePath)
    generated.push(narrativePath)
  }

  return generated
}

function formatCredits(cost) {
  const value = cost.knownAiCredits.toFixed(6)
  return cost.complete ? value : `${value} known (${cost.coveredTrials}/${cost.totalTrials})`
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function resultLabel(aggregate) {
  return aggregate.trials > 0 && aggregate.passed === aggregate.trials ? 'PASS' : 'FAIL'
}

function renderEvaluationSummaryTable(summary) {
  const lines = [
    '| Evaluation | Model | Result | Pass | Score | Tokens | Tools | Agent time | Eval duration | AI Credits |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]

  for (const evaluation of summary.evaluations) {
    lines.push(
      `| ${escapeCell(evaluation.name)} `
      + `| ${escapeCell(evaluation.model)} `
      + `| ${resultLabel(evaluation)} `
      + `| ${evaluation.passed}/${evaluation.trials} `
      + `| ${evaluation.averageScore === null ? 'N/A' : evaluation.averageScore.toFixed(3)} `
      + `| ${formatInteger(evaluation.tokens.total)} `
      + `| ${formatInteger(evaluation.tools.total)} `
      + `| ${formatDuration(evaluation.time.agentWallTimeMs)} `
      + `| ${formatDuration(evaluation.time.evaluationDurationMs)} `
      + `| ${formatCredits(evaluation.cost)} |`,
    )
  }

  const overall = summary.overall
  lines.push(
    `| **Total** | **All** | **${resultLabel(overall)}** `
    + `| **${overall.passed}/${overall.trials}** `
    + `| **${overall.averageScore === null ? 'N/A' : overall.averageScore.toFixed(3)}** `
    + `| **${formatInteger(overall.tokens.total)}** `
    + `| **${formatInteger(overall.tools.total)}** `
    + `| **${formatDuration(overall.time.agentWallTimeMs)}** `
    + `| **${formatDuration(overall.time.evaluationDurationMs)}** `
    + `| **${formatCredits(overall.cost)}** |`,
  )

  return lines
}

export function renderConsolidatedSummary(summary) {
  return [
    'Consolidated evaluation report',
    '',
    ...renderEvaluationSummaryTable(summary),
  ].join('\n')
}

export function renderMarkdown(summary, resultsDirectory = '.') {
  const overall = summary.overall
  const lines = [
    '# Vally evaluation report',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    ...renderEvaluationSummaryTable(summary),
  ]

  lines.push(
    '',
    '## Token totals',
    '',
    `- Input: ${formatInteger(overall.tokens.input)}`,
    `- Output: ${formatInteger(overall.tokens.output)}`,
    `- Cache read: ${formatInteger(overall.tokens.cacheRead)}`,
    `- Cache write: ${formatInteger(overall.tokens.cacheWrite)}`,
    `- Total: ${formatInteger(overall.tokens.total)}`,
    '',
    '## Tool usage',
    '',
  )

  const tools = Object.entries(overall.tools.breakdown).sort((left, right) => right[1] - left[1])
  if (tools.length) {
    for (const [tool, count] of tools) {
      lines.push(`- \`${tool}\`: ${formatInteger(count)}`)
    }
  } else {
    lines.push('- No tool calls were reported.')
  }

  lines.push(
    '',
    '## AI Credit accounting',
    '',
    `Known usage: ${formatInteger(overall.cost.knownNanoAiu)} nano-AIU (${overall.cost.knownAiCredits.toFixed(6)} AI Credits).`,
    `Coverage: ${overall.cost.coveredTrials}/${overall.cost.totalTrials} trials.`,
    '',
    '> AI Credit usage covers the evaluated GitHub Copilot agent only. Vally does not include LLM judge or grader usage in trajectory cost. A partial-coverage value is a known subtotal, not a complete total.',
    '',
  )

  lines.push(
    ...renderCapturedData(summary.trials, resultsDirectory, resultsDirectory),
    '',
  )

  return lines.join('\n')
}

export function createArtifactsManifest(trials) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    operations: trials.map((trial) => ({
      evaluation: trial.evaluation,
      stimulus: trial.stimulus,
      model: trial.model,
      capturedData: trial.capturedData,
    })),
  }
}

function capturedDataLink(label, storedPath, resultsDirectory, reportDirectory) {
  if (!storedPath) return 'Unavailable'

  const target = path.resolve(resultsDirectory, storedPath)
  const relativeTarget = path.relative(reportDirectory, target).replaceAll(path.sep, '/')
  return `[${label}](<${relativeTarget}>)`
}

function renderCapturedData(trials, resultsDirectory, reportDirectory) {
  const lines = [
    '## Captured operation data',
    '',
    '| Operation | Model | Narrative | Generated artifacts | Final workspace | Copilot session state | Vally data |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]

  for (const [index, trial] of trials.entries()) {
    const captured = trial.capturedData ?? {}
    const sessionState = captured.copilotSessionState
    const sessionLinks = sessionState
      ? [
          capturedDataLink('events', sessionState.events, resultsDirectory, reportDirectory),
          capturedDataLink('metadata', sessionState.metadata, resultsDirectory, reportDirectory),
        ].join(' · ')
      : 'Unavailable'
    const vallyLinks = [
      capturedDataLink('results', captured.vally?.results, resultsDirectory, reportDirectory),
      capturedDataLink('report', captured.vally?.report, resultsDirectory, reportDirectory),
      capturedDataLink('OTel spans', captured.vally?.otelSpans, resultsDirectory, reportDirectory),
    ].join(' · ')

    lines.push(
      `| ${escapeCell(`${trial.stimulus} #${index + 1}`)} `
      + `| ${escapeCell(trial.model)} `
      + `| ${capturedDataLink('narrative', captured.narrative, resultsDirectory, reportDirectory)} `
      + `| ${capturedDataLink('artifacts', captured.generatedArtifacts, resultsDirectory, reportDirectory)} `
      + `| ${capturedDataLink('workspace', captured.workspace, resultsDirectory, reportDirectory)} `
      + `| ${sessionLinks} `
      + `| ${vallyLinks} |`,
    )
  }

  return lines
}

function renderUsageAccounting(summary, trials, resultsDirectory, reportDirectory) {
  const overall = summary.overall
  const models = [...new Set(trials.map((trial) => trial.model))].sort().join(', ')

  return [
    USAGE_START_MARKER,
    '## Usage accounting',
    '',
    '| Agent model | Trials | Tokens | Tool calls | Agent wall time | End-to-end duration | AI Credits |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${escapeCell(models)} | ${overall.trials} | ${formatInteger(overall.tokens.total)} | ${formatInteger(overall.tools.total)} | ${formatDuration(overall.time.agentWallTimeMs)} | ${formatDuration(overall.time.evaluationDurationMs)} | ${formatCredits(overall.cost)} |`,
    '',
    '> AI Credits are converted from the evaluated agent\'s GitHub Copilot nano-AIU cost. Judge and other grader usage is not included.',
    '',
    ...renderCapturedData(trials, resultsDirectory, reportDirectory),
    USAGE_END_MARKER,
  ].join('\n')
}

export async function appendUsageToEvalResults(resultsDirectory, trials) {
  const trialsByResultDirectory = new Map()

  for (const trial of trials) {
    const resultDirectory = path.dirname(path.resolve(resultsDirectory, trial.source))
    const groupedTrials = trialsByResultDirectory.get(resultDirectory) ?? []
    groupedTrials.push(trial)
    trialsByResultDirectory.set(resultDirectory, groupedTrials)
  }

  const updatedReports = []
  for (const [resultDirectory, groupedTrials] of trialsByResultDirectory) {
    const reportPath = path.join(resultDirectory, 'eval-results.md')
    let markdown = await readFile(reportPath, 'utf8')
    const existingUsage = new RegExp(
      `\\n*${USAGE_START_MARKER}[\\s\\S]*?${USAGE_END_MARKER}\\n*`,
    )
    markdown = markdown.replace(existingUsage, '').trimEnd()
    const usage = renderUsageAccounting(
      summarize(groupedTrials),
      groupedTrials,
      resultsDirectory,
      resultDirectory,
    )
    await writeFile(reportPath, `${markdown}\n\n${usage}\n`)
    updatedReports.push(reportPath)
  }

  return updatedReports
}

async function main() {
  const resultsDirectory = path.resolve(process.argv[2] ?? 'results')
  const trials = await loadTrials(resultsDirectory)
  if (!trials.length) {
    throw new Error(`No trial-result records were found under ${resultsDirectory}.`)
  }

  const summary = summarize(trials)
  const narratives = await generateNarratives(resultsDirectory, trials)
  const updatedReports = await appendUsageToEvalResults(resultsDirectory, trials)
  const jsonPath = path.join(resultsDirectory, 'summary.json')
  const artifactsManifestPath = path.join(resultsDirectory, 'artifacts-manifest.json')
  const markdownPath = path.join(resultsDirectory, 'report.md')
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`)
  await writeFile(
    artifactsManifestPath,
    `${JSON.stringify(createArtifactsManifest(trials), null, 2)}\n`,
  )
  await writeFile(markdownPath, renderMarkdown(summary, resultsDirectory))

  console.log('')
  console.log(renderConsolidatedSummary(summary))
  console.log('')
  for (const updatedReport of updatedReports) {
    console.log(`Updated: ${updatedReport}`)
  }
  console.log(`Narratives: ${narratives.length}`)
  console.log(`Artifacts: ${artifactsManifestPath}`)
  console.log(`Report: ${markdownPath}`)
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
