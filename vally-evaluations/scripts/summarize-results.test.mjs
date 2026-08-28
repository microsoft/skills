import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  appendUsageToEvalResults,
  createArtifactsManifest,
  formatDuration,
  generateNarratives,
  loadTrials,
  renderTrajectoryNarrative,
  renderConsolidatedSummary,
  renderMarkdown,
  summarize,
} from './summarize-results.mjs'

function trialRecord({
  evaluation,
  model = 'test-model',
  inputTokens,
  outputTokens,
  toolCalls,
  wallTimeMs,
  durationMs,
  nanoAiu,
  workDir,
  artifactDir,
  trajectoryId = 'trajectory-1',
}) {
  return {
    type: 'trial-result',
    evalName: evaluation,
    stimulus: 'sample',
    durationMs,
    gradeResult: { passed: true, score: 0.9 },
    trajectory: {
      id: trajectoryId,
      workDir,
      artifactDir,
      metadata: { model },
      metrics: {
        tokenUsage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cacheReadTokens: 2,
          cacheWriteTokens: 1,
          ...(nanoAiu === null ? {} : {
            cost: {
              provider: 'github-copilot',
              unit: 'nano-aiu',
              amount: nanoAiu,
            },
          }),
        },
        toolCallCount: toolCalls,
        toolCallBreakdown: { view: toolCalls - 1, edit: 1 },
        wallTimeMs,
      },
      stimulus: { name: 'sample' },
    },
  }
}

test('aggregates tokens, tools, time, and complete AI Credit usage', () => {
  const summary = summarize([
    {
      evaluation: 'calendar',
      model: 'test-model',
      passed: true,
      score: 0.8,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      toolCalls: 3,
      toolBreakdown: { view: 2, edit: 1 },
      agentWallTimeMs: 2_000,
      evaluationDurationMs: 3_000,
      nanoAiu: 1_250_000_000,
      aiCredits: 1.25,
    },
  ])

  assert.equal(summary.overall.tokens.total, 150)
  assert.equal(summary.overall.tools.total, 3)
  assert.deepEqual(summary.overall.tools.breakdown, { view: 2, edit: 1 })
  assert.equal(summary.overall.time.agentWallTimeMs, 2_000)
  assert.equal(summary.overall.cost.completeAiCredits, 1.25)
  assert.equal(summary.overall.cost.complete, true)
  assert.match(
    renderConsolidatedSummary(summary),
    /calendar \| test-model \| PASS \| 1\/1 .*0h 0m 2\.0s.*1\.250000/,
  )
})

test('reports evaluation results and captured data separately for each model', () => {
  const baseTrial = {
    evaluation: 'calendar',
    stimulus: 'sample',
    passed: true,
    score: 1,
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 1,
    toolBreakdown: {},
    agentWallTimeMs: 10,
    evaluationDurationMs: 20,
    nanoAiu: 500_000_000,
    aiCredits: 0.5,
    capturedData: {},
  }
  const summary = summarize([
    { ...baseTrial, model: 'gpt-5.6-sol' },
    { ...baseTrial, model: 'gpt-5.6-terra', passed: false },
  ])
  const report = renderMarkdown(summary)

  assert.deepEqual(
    summary.evaluations.map(({ name, model, passed, trials }) => ({
      name,
      model,
      passed,
      trials,
    })),
    [
      { name: 'calendar', model: 'gpt-5.6-sol', passed: 1, trials: 1 },
      { name: 'calendar', model: 'gpt-5.6-terra', passed: 0, trials: 1 },
    ],
  )
  assert.match(report, /\| Evaluation \| Model \| Result \|/)
  assert.match(report, /\| calendar \| gpt-5\.6-sol \| PASS \| 1\/1 \|/)
  assert.match(report, /\| calendar \| gpt-5\.6-terra \| FAIL \| 0\/1 \|/)
  assert.match(report, /\| Operation \| Model \| Narrative \|/)
  assert.match(report, /\| sample #1 \| gpt-5\.6-sol \|/)
  assert.match(report, /\| sample #2 \| gpt-5\.6-terra \|/)
})

test('formats durations in hours, minutes, and seconds', () => {
  assert.equal(formatDuration(3_723_400), '1h 2m 3.4s')
  assert.equal(formatDuration(2_000), '0h 0m 2.0s')
})

test('renders every recorded action in its assistant turn', () => {
  const events = [
    {
      type: 'session.start',
      data: { context: { cwd: 'C:\\temp\\workspace' } },
      timestamp: '2026-08-27T20:00:00.000Z',
    },
    {
      type: 'user.message',
      data: { content: 'Add appointment conflict detection.' },
      timestamp: '2026-08-27T20:00:01.000Z',
    },
    {
      type: 'assistant.turn_start',
      data: { turnId: '0' },
      timestamp: '2026-08-27T20:00:02.000Z',
    },
    {
      type: 'assistant.message',
      data: {
        turnId: '0',
        content: 'I will inspect the calendar helper.',
        toolRequests: [{
          toolCallId: 'call-1',
          name: 'view',
          intentionSummary: 'Inspect calendar helper',
        }],
      },
      timestamp: '2026-08-27T20:00:03.000Z',
    },
    {
      type: 'tool.execution_start',
      data: {
        turnId: '0',
        toolCallId: 'call-1',
        toolName: 'view',
        arguments: { path: 'C:\\temp\\workspace\\src\\calendar.ts' },
      },
      timestamp: '2026-08-27T20:00:04.000Z',
    },
    {
      type: 'tool.execution_complete',
      data: { turnId: '0', toolCallId: 'call-1', success: true },
      timestamp: '2026-08-27T20:00:05.000Z',
    },
    {
      type: 'assistant.turn_end',
      data: { turnId: '0' },
      timestamp: '2026-08-27T20:00:06.000Z',
    },
  ]
  const narrative = renderTrajectoryNarrative(events, {
    evaluation: 'calendar',
    stimulus: 'conflicts',
    model: 'test-model',
    passed: true,
    score: 1,
    agentWallTimeMs: 4_000,
    evaluationDurationMs: 5_000,
    graderOutcomes: [],
  })

  assert.match(narrative, /## Initial stimulus/)
  assert.match(narrative, /### Turn 1 \(ID 0 - 0h 0m 4\.0s\)/)
  assert.match(narrative, /I will inspect the calendar helper/)
  assert.match(narrative, /`view` - Viewed `src\/calendar\.ts`/)
  assert.match(narrative, /\*\*Outcome:\*\* Succeeded\./)
})

test('marks AI Credit totals incomplete when any trial lacks cost', () => {
  const completeTrial = {
    evaluation: 'calendar',
    passed: true,
    score: 1,
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 1,
    toolBreakdown: {},
    agentWallTimeMs: 10,
    evaluationDurationMs: 20,
    nanoAiu: 500_000_000,
    aiCredits: 0.5,
  }
  const summary = summarize([
    completeTrial,
    { ...completeTrial, nanoAiu: null, aiCredits: null },
  ])

  assert.equal(summary.overall.cost.completeAiCredits, null)
  assert.equal(summary.overall.cost.knownAiCredits, 0.5)
  assert.equal(summary.overall.cost.coveredTrials, 1)
  assert.match(renderMarkdown(summary), /0\.500000 known \(1\/2\)/)
})

test('loads nested Vally JSONL output and ignores non-trial records', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vally-report-'))
  const runDirectory = path.join(root, 'calendar', 'run-1')
  const sessionDirectory = path.join(runDirectory, 'calendar', 'sample', 'test-model', '0')
  const artifactsDirectory = path.join(sessionDirectory, 'artifacts')
  const workspaceDirectory = path.join(runDirectory, 'workspaces', 'main', 'sample')
  await mkdir(runDirectory, { recursive: true })
  await mkdir(artifactsDirectory, { recursive: true })
  await mkdir(workspaceDirectory, { recursive: true })
  await writeFile(path.join(sessionDirectory, 'events.jsonl'), '{"type":"session.start"}\n')
  await writeFile(
    path.join(sessionDirectory, 'metadata.json'),
    `${JSON.stringify({
      trajectoryId: 'trajectory-1',
      executorSessionId: 'session-1',
    })}\n`,
  )
  await writeFile(path.join(artifactsDirectory, 'generated.ts'), 'export {}\n')
  await writeFile(path.join(runDirectory, 'eval-results.md'), '## Eval Results\n')
  await writeFile(path.join(runDirectory, 'otel-spans.jsonl'), '{}\n')
  const records = [
    trialRecord({
      evaluation: 'calendar',
      inputTokens: 80,
      outputTokens: 20,
      toolCalls: 4,
      wallTimeMs: 5_000,
      durationMs: 7_000,
      nanoAiu: 2_000_000_000,
      workDir: workspaceDirectory,
      artifactDir: artifactsDirectory,
    }),
    { type: 'run-summary', passed: true },
  ]
  await writeFile(
    path.join(runDirectory, 'results.jsonl'),
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
  )

  try {
    const trials = await loadTrials(root)
    assert.equal(trials.length, 1)
    assert.equal(trials[0].totalTokens, 100)
    assert.equal(trials[0].aiCredits, 2)
    assert.equal(trials[0].source, path.join('calendar', 'run-1', 'results.jsonl'))
    assert.equal(
      trials[0].capturedData.generatedArtifacts,
      path.join('calendar', 'run-1', 'calendar', 'sample', 'test-model', '0', 'artifacts'),
    )
    assert.equal(
      trials[0].capturedData.workspace,
      path.join('calendar', 'run-1', 'workspaces', 'main', 'sample'),
    )
    assert.equal(trials[0].capturedData.copilotSessionState.sessionId, 'session-1')
    const narratives = await generateNarratives(root, trials)
    assert.equal(narratives.length, 1)
    assert.equal(
      trials[0].capturedData.narrative,
      path.join('calendar', 'run-1', 'calendar', 'sample', 'test-model', '0', 'narrative.md'),
    )
    assert.match(await readFile(narratives[0], 'utf8'), /No assistant turn events were captured/)
    assert.equal(createArtifactsManifest(trials).operations.length, 1)
    assert.match(await readFile(path.join(runDirectory, 'results.jsonl'), 'utf8'), /run-summary/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('appends explicit usage accounting to each Vally Markdown report', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vally-report-'))
  const runDirectory = path.join(root, 'calendar', 'run-1')
  const reportPath = path.join(runDirectory, 'eval-results.md')
  await mkdir(runDirectory, { recursive: true })
  await writeFile(reportPath, '## Eval Results\n')

  const trial = {
    evaluation: 'calendar',
    model: 'gpt-5.6-terra',
    passed: true,
    score: 1,
    inputTokens: 1_000,
    outputTokens: 250,
    totalTokens: 1_250,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 3,
    toolBreakdown: {},
    agentWallTimeMs: 2_000,
    evaluationDurationMs: 3_000,
    nanoAiu: 1_500_000_000,
    aiCredits: 1.5,
    source: path.join('calendar', 'run-1', 'results.jsonl'),
  }

  try {
    await appendUsageToEvalResults(root, [trial])
    await appendUsageToEvalResults(root, [trial])

    const markdown = await readFile(reportPath, 'utf8')
    assert.match(markdown, /Agent model.*Agent wall time.*AI Credits/)
    assert.match(markdown, /gpt-5\.6-terra.*0h 0m 2\.0s.*0h 0m 3\.0s.*1\.500000/)
    assert.match(markdown, /Captured operation data/)
    assert.equal(markdown.match(/## Usage accounting/g)?.length, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
