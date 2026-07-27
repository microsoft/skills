#!/usr/bin/env node
/**
 * compare-experiment.mjs
 *
 * Produces a detailed A/B comparison for a Vally experiment directory.
 * An experiment directory contains one sub-folder per variant, each with
 * results.jsonl and run-summary.jsonl.
 *
 * Usage:
 *   node compare-experiment.mjs <experiment-dir> [--baseline <variant>] [--skill <variant>]
 *
 * Examples:
 *   node compare-experiment.mjs Q:\src\skills\vally-experiment-results\2026-06-23T20-24-42-839Z
 *   node compare-experiment.mjs . --baseline sonnet_baseline --skill sonnet_skill
 *
 * If --baseline / --skill are omitted the script auto-selects:
 *   - baseline: first variant alphabetically (or variant containing "baseline")
 *   - skill:    second variant (or variant containing "skill")
 *
 * Exit codes: 0 = success, 1 = usage/parse error.
 */

import fs from 'fs';
import path from 'path';

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: node compare-experiment.mjs <experiment-dir> [--baseline <variant>] [--skill <variant>]');
  process.exit(0);
}

const experimentDir = path.resolve(args[0]);

let baselineVariant = null;
let skillVariant    = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--baseline' && args[i + 1]) baselineVariant = args[++i];
  if (args[i] === '--skill'    && args[i + 1]) skillVariant    = args[++i];
}

// ── Discover run directories ─────────────────────────────────────────────────
if (!fs.existsSync(experimentDir)) {
  console.error(`Error: directory not found: ${experimentDir}`);
  process.exit(1);
}

const runDirs = fs.readdirSync(experimentDir)
  .filter(name => {
    const full = path.join(experimentDir, name);
    return fs.statSync(full).isDirectory() &&
           fs.existsSync(path.join(full, 'results.jsonl')) &&
           fs.existsSync(path.join(full, 'run-summary.jsonl'));
  });

if (runDirs.length < 2) {
  console.error(`Error: need at least 2 run directories with results.jsonl in ${experimentDir}`);
  console.error(`Found: ${runDirs.join(', ') || '(none)'}`);
  process.exit(1);
}

// Auto-select if not specified
if (!baselineVariant || !skillVariant) {
  const hasBL = runDirs.find(d => d.toLowerCase().includes('baseline'));
  const hasSK = runDirs.find(d => d.toLowerCase().includes('skill'));
  baselineVariant = baselineVariant ?? (hasBL || runDirs[0]);
  skillVariant    = skillVariant    ?? (hasSK || runDirs.find(d => d !== baselineVariant) || runDirs[1]);
}

for (const v of [baselineVariant, skillVariant]) {
  if (!runDirs.includes(v)) {
    console.error(`Error: variant "${v}" not found. Available: ${runDirs.join(', ')}`);
    process.exit(1);
  }
}

// ── Load results ─────────────────────────────────────────────────────────────
function loadResults(variantName) {
  const dir  = path.join(experimentDir, variantName);
  // results.jsonl may be multi-line (one record per stimulus); aggregate only trial-result rows
  const rows = fs.readFileSync(path.join(dir, 'results.jsonl'), 'utf8')
    .split('\n').filter(l => l.trim())
    .map(l => JSON.parse(l))
    .filter(r => r.type === 'trial-result');
  // run-summary.jsonl is JSON Lines; take the last non-empty record
  const summaryLines = fs.readFileSync(path.join(dir, 'run-summary.jsonl'), 'utf8')
    .split('\n').filter(l => l.trim());
  const summary = JSON.parse(summaryLines[summaryLines.length - 1]);
  return { rows, summary, variantName };
}

const bData = loadResults(baselineVariant);
const sData = loadResults(skillVariant);

// ── Aggregate across stimuli ─────────────────────────────────────────────────
function aggregate(data) {
  const { rows, summary, variantName } = data;
  let totalScore = 0, passCount = 0, errorCount = 0, skillActivations = 0;
  let turns = 0, toolCalls = 0, wallTimeMs = 0, durationMs = 0, llmCalls = 0;
  let inputTokens = 0, outputTokens = 0, totalTokens = 0;
  let cacheReadTokens = 0, cacheWriteTokens = 0;

  const graderMap = {};   // name -> {bScores, sScores} — built later per-side

  for (const row of rows) {
    const m   = row.trajectory?.metrics ?? {};
    const tok = m.tokenUsage ?? {};
    const gr  = row.gradeResult ?? {};

    totalScore      += gr.score    ?? 0;
    passCount       += gr.passed   ? 1 : 0;
    errorCount      += m.errorCount ?? 0;
    skillActivations += m.skillActivationCount ?? 0;
    turns           += m.turnCount  ?? 0;
    toolCalls       += m.toolCallCount ?? 0;
    wallTimeMs      += m.wallTimeMs ?? 0;
    durationMs      += row.durationMs ?? 0;
    llmCalls        += tok.callCount  ?? 0;
    inputTokens     += tok.inputTokens  ?? 0;
    outputTokens    += tok.outputTokens ?? 0;
    totalTokens     += tok.totalTokens  ?? 0;
    cacheReadTokens  += tok.cacheReadTokens  ?? 0;
    cacheWriteTokens += tok.cacheWriteTokens ?? 0;

    // Collect per-grader details (top-level detail list only)
    for (const g of (gr.details ?? [])) {
      if (!graderMap[g.name]) graderMap[g.name] = { scores: [], passes: [] };
      graderMap[g.name].scores.push(g.score ?? null);
      graderMap[g.name].passes.push(g.passed ?? null);
    }
  }

  const n = rows.length || 1;
  return {
    variantName,
    stimulusCount: rows.length,
    experiment: summary.experiment,
    evalFile: summary.evalFile,
    model: summary.resolvedDefaults?.model ?? '?',
    skills: summary.resolvedEnvironment?.skills ?? [],
    // quality
    avgScore: totalScore / n,
    passRate: passCount  / n,
    errorCount,
    skillActivations,
    // efficiency
    turns, llmCalls, toolCalls,
    wallTimeSec:  (wallTimeMs  / 1000),
    durationSec:  (durationMs  / 1000),
    // tokens
    inputTokens, outputTokens, totalTokens,
    cacheReadTokens, cacheWriteTokens,
    netNewInputTokens: inputTokens - cacheReadTokens,
    cacheReadRate: inputTokens > 0 ? (cacheReadTokens / inputTokens) : 0,
    cacheShareOfTotal: totalTokens > 0 ? (cacheReadTokens / totalTokens) : 0,
    cacheWriteRate: inputTokens > 0 ? (cacheWriteTokens / inputTokens) : 0,
    cacheWriteShareOfTotal: totalTokens > 0 ? (cacheWriteTokens / totalTokens) : 0,
    readToWriteEfficiency: cacheWriteTokens > 0 ? (cacheReadTokens / cacheWriteTokens) : null,
    // graders
    graderMap,
  };
}

const bS = aggregate(bData);
const sS = aggregate(sData);

// ── Helpers ───────────────────────────────────────────────────────────────────
const W = 44;  // label column width

function fmt(v, decimals = 0) {
  if (v == null || v === '') return 'N/A';
  if (typeof v === 'boolean')  return v ? 'true' : 'false';
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return decimals > 0 ? n.toFixed(decimals) : n.toLocaleString();
}

function pct(a, b) {
  if (!b) return '    N/A';
  const d = (a - b) / b * 100;
  const s = (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  return s.padStart(8);
}

function row(label, bv, sv, lowerBetter, decimals = 0) {
  const bvN = parseFloat(bv);
  const svN = parseFloat(sv);
  let deltaStr = '        ';
  let winnerStr = '';
  if (!isNaN(bvN) && !isNaN(svN)) {
    deltaStr = pct(svN, bvN);
    if (lowerBetter !== null && bvN !== svN) {
      winnerStr = lowerBetter
        ? (svN < bvN ? '  ← skill' : '  ← baseline')
        : (svN > bvN ? '  ← skill' : '  ← baseline');
    }
  }
  console.log(
    label.slice(0, W).padEnd(W),
    fmt(bv, decimals).padStart(14),
    fmt(sv, decimals).padStart(14),
    deltaStr + winnerStr
  );
}

function divider(title = '') {
  if (title) {
    console.log('\n' + title);
    console.log('─'.repeat(W + 42));
  } else {
    console.log('─'.repeat(W + 42));
  }
}

// ── Header ────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(W + 42));
console.log('EXPERIMENT COMPARISON');
console.log('═'.repeat(W + 42));
console.log(`Experiment : ${bS.experiment}`);
console.log(`Eval file  : ${bS.evalFile}`);
console.log(`Model      : ${bS.model}`);
console.log(`Directory  : ${experimentDir}`);
console.log(`Stimuli    : ${bS.stimulusCount}`);
console.log(`Baseline   : ${bS.variantName}  (skills: ${bS.skills.length === 0 ? 'none' : bS.skills.map(s => path.basename(s)).join(', ')})`);
console.log(`Skill      : ${sS.variantName}  (skills: ${sS.skills.length === 0 ? 'none' : sS.skills.map(s => path.basename(s)).join(', ')})`);
console.log('');
console.log('Metric'.padEnd(W), 'Baseline'.padStart(14), 'Skill'.padStart(14), '   Delta');
divider();

// ── Quality ───────────────────────────────────────────────────────────────────
row('Overall score (0-1)',      bS.avgScore,    sS.avgScore,    false, 4);
row('Pass rate (≥threshold)',   bS.passRate,    sS.passRate,    false, 4);
row('Error count',              bS.errorCount,  sS.errorCount,  true);
row('Skill activations',        bS.skillActivations, sS.skillActivations, false);

// ── Efficiency ────────────────────────────────────────────────────────────────
divider('EFFICIENCY  (lower is better)');
row('Turns (LLM turns)',        bS.turns,       sS.turns,       true);
row('LLM API calls',           bS.llmCalls,    sS.llmCalls,    true);
row('Tool calls total',         bS.toolCalls,   sS.toolCalls,   true);
row('Wall time (sec)',          bS.wallTimeSec, sS.wallTimeSec, true, 1);
row('Total duration (sec)',     bS.durationSec, sS.durationSec, true, 1);

// ── Token cost ────────────────────────────────────────────────────────────────
divider('TOKEN COST  (lower is better)');
row('Total tokens',             bS.totalTokens,        sS.totalTokens,        true);
row('Input tokens',             bS.inputTokens,        sS.inputTokens,        true);
row('Output tokens',            bS.outputTokens,       sS.outputTokens,       true);
row('Cache read tokens (info)', bS.cacheReadTokens,    sS.cacheReadTokens,    null);
row('Cache write tokens (info)',bS.cacheWriteTokens,   sS.cacheWriteTokens,   null);
row('Net new input tokens',     bS.netNewInputTokens,  sS.netNewInputTokens,  true);
row('Cache utilization rate',   bS.cacheReadRate,      sS.cacheReadRate,      false, 4);
row('Cache share of total',     bS.cacheShareOfTotal,  sS.cacheShareOfTotal,  false, 4);
row('Cache write rate',         bS.cacheWriteRate,     sS.cacheWriteRate,     true, 4);
row('Cache write share total',  bS.cacheWriteShareOfTotal, sS.cacheWriteShareOfTotal, true, 4);
row('Read/write efficiency',    bS.readToWriteEfficiency, sS.readToWriteEfficiency, false, 4);

// ── Per-grader ────────────────────────────────────────────────────────────────
divider('PER-GRADER SCORES');
console.log('Grader'.padEnd(W), 'Baseline'.padStart(14), 'Skill'.padStart(14), '   Delta');
divider();

const allNames = [...new Set([...Object.keys(bS.graderMap), ...Object.keys(sS.graderMap)])];
for (const name of allNames) {
  const bg = bS.graderMap[name];
  const sg = sS.graderMap[name];
  const bScore = bg ? bg.scores.reduce((a, v) => a + (v ?? 0), 0) / bg.scores.length : null;
  const sScore = sg ? sg.scores.reduce((a, v) => a + (v ?? 0), 0) / sg.scores.length : null;
  const bPass  = bg ? (bg.passes.every(p => p) ? 'PASS' : 'FAIL') : '----';
  const sPass  = sg ? (sg.passes.every(p => p) ? 'PASS' : 'FAIL') : '----';

  const bvN = bScore ?? NaN;
  const svN = sScore ?? NaN;
  let deltaStr = '        ', winnerStr = '';
  if (!isNaN(bvN) && !isNaN(svN)) {
    const d = svN - bvN;
    deltaStr = ((d >= 0 ? '+' : '') + d.toFixed(3)).padStart(8);
    winnerStr = d > 0 ? '  ← skill↑' : d < 0 ? '  ← baseline↑' : '  tie';
  }

  const bCell = `(${bPass}) ${bScore != null ? bScore.toFixed(3) : 'N/A'}`;
  const sCell = `(${sPass}) ${sScore != null ? sScore.toFixed(3) : 'N/A'}`;
  console.log(name.slice(0, W - 1).padEnd(W), bCell.padStart(14), sCell.padStart(14), deltaStr + winnerStr);
}

// ── Verdict ───────────────────────────────────────────────────────────────────
divider();
const tokenDelta = pct(sS.totalTokens,   bS.totalTokens).trim();
const timeDelta  = pct(sS.wallTimeSec,   bS.wallTimeSec).trim();
const scoreDelta = pct(sS.avgScore,      bS.avgScore).trim();
const bothPass   = !!(bData.summary.passed) && !!(sData.summary.passed);

console.log('\nVERDICT');
console.log(`Both runs passed threshold : ${bothPass}`);
console.log(`Score delta                : ${scoreDelta}`);
console.log(`Token delta                : ${tokenDelta}`);
console.log(`Wall-time delta            : ${timeDelta}`);
if (bothPass) {
  const skillBetter = sS.totalTokens < bS.totalTokens && sS.wallTimeSec < bS.wallTimeSec && sS.avgScore >= bS.avgScore;
  const msg = skillBetter
    ? `✅  Skill variant passes with ${tokenDelta} fewer tokens and ${timeDelta} less wall time → SKILL IS BETTER`
    : `⚠️  Skill variant does not uniformly reduce both tokens and time — review per-metric deltas above.`;
  console.log(msg);
}
console.log('');
