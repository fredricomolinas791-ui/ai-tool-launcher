#!/usr/bin/env node
/**
 * One-shot tool migration script.
 * Replaces the legacy "stream.output + inline div + copy button" pattern
 * with <AIToolPanel stream={...} toolId={N} toolName={T.title} prompt={...} />.
 *
 * Idempotent — running it twice is a no-op.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/components/text/TextTools.tsx',
  'src/components/text/CodeTools.tsx',
  'src/components/life/LifeTools.tsx',
  'src/components/media/ImageTools.tsx',
  'src/components/media/AudioTools.tsx',
  'src/components/media/VideoTools.tsx',
  'src/components/productivity/ExcelFormulaTool.tsx',
  'src/components/productivity/PPTOutlineTool.tsx',
  'src/components/productivity/MindMapTool.tsx',
  'src/components/productivity/CalendarTool.tsx',
  'src/components/productivity/BookkeepingTool.tsx',
  'src/components/productivity/TripPlannerTool.tsx',
  'src/components/productivity/DataAnalysisTool.tsx',
  'src/components/productivity/PomodoroTool.tsx',
];

let totalChanged = 0;
let totalEdits = 0;
for (const rel of files) {
  const full = path.resolve(rel);
  if (!fs.existsSync(full)) { console.log(`[skip] ${rel} (not found)`); continue; }
  let src = fs.readFileSync(full, 'utf8');
  const before = src;
  let edits = 0;

  // 1. Add AIToolPanel import if not present.
  if (!/from\s+['"]\.\.\/ui\/AIToolPanel['"]/.test(src) && /export function \w+Tool\(/.test(src)) {
    // Find a sibling import line containing '..//ui/Button' or '..//ui/AIOutputTabs'
    const m = src.match(/import\s+\{[^}]+\}\s+from\s+['"](?:\.\.\/)+ui\/(?:Button|AIOutputTabs)['"];?/);
    if (m) {
      const insertLine = m[0];
      src = src.replace(insertLine, `${insertLine}\nimport { AIToolPanel } from '${insertLine.includes('AIOutputTabs') ? '../ui/AIToolPanel' : '../ui/AIToolPanel'}';`);
      edits += 1;
    }
  }

  // 2. liveOutput → hasOutput, only inside Tool functions that use useAIStream.
  //    Only swap lines that look like:
  //      const liveOutput = stream.output;
  //    (avoid double-swap if already swapped)
  src = src.replace(/^(\s*)const liveOutput = stream\.output;$/gm,
                    '$1const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;');

  // 3. !liveOutput → !hasOutput (only in JSX conditionals)
  src = src.replace(/\{!liveOutput && !stream\.streaming/g, '{!hasOutput && !stream.streaming');

  // 4. Replace the streaming output div with <AIToolPanel>. The pattern
  //    is: an inline ` <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' ...> </div> )}`
  //    containing a <pre>/<p> that reads `{liveOutput}` plus a streaming cursor span
  //    plus an error <p> and a copy <Button>.
  //    Tools are slightly different so we use a fairly broad regex that
  //    captures the common case.
  //
  // Approach: find each occurrence of the JSX block starting with
  //   <div className="rounded-xl p-N" style={{ background: 'var(--color-bg-card)'...
  // and ending with the matching </div> )}. We then check: is the
  // contents {liveOutput} or stream.output? If so, replace.
  //
  // To stay safe: we only replace if the next-line {liveOutput} is the
  // main text content. If the block contains "liveOutput.split" (Title
  // generator) or other special handling, we skip — those need manual
  // migration.

  const blockRe = /(\s+)<div className="rounded-xl p-\d+" style=\{\{ background: 'var\(--color-bg-card\)'[^}]*?\}\}>([\s\S]*?)\s*<\/div>\s*\)\}/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const indent = m[1];
    const inner = m[2];
    // Safety: skip if the block has a "liveOutput.split" or other structured parsing
    if (inner.includes('liveOutput.split') || inner.includes('JSON.parse')) {
      continue;
    }
    // Skip if already migrated (contains AIToolPanel)
    if (inner.includes('AIToolPanel')) continue;
    // Verify this is the streaming block by checking for liveOutput reference
    if (!/\{liveOutput\}/.test(inner) && !/\{liveOutput\}/.test(src.slice(Math.max(0, m.index - 200), m.index + 50))) {
      continue;
    }
    // Extract prompt source by looking at the function's `userPrompt:` call
    // in the preceding ~2000 chars. Best-effort: pick the first variable
    // that looks like a text input.
    const preceding = src.slice(Math.max(0, m.index - 2500), m.index);
    const promptVar = (preceding.match(/userPrompt:\s*([a-zA-Z_][\w.\[\]]*)/)?.[1]) || 'text';
    // Tool id: extract from the function name → "SmartWriterTool" → 9
    // Look for the function definition preceding this block.
    const fnMatch = preceding.match(/export function (\w+)Tool\b/);
    const toolId = fnNameToId(fnMatch?.[1]) ?? 0;
    const replacement = `${indent}<AIToolPanel stream={stream} toolId={${toolId}} toolName={T.title} prompt={${promptVar}.slice(0, 200)} />`;
    src = src.slice(0, m.index) + replacement + src.slice(blockRe.lastIndex);
    blockRe.lastIndex = m.index + replacement.length;
    edits += 1;
  }

  // 5. Drop unused `Copy` and `Button` imports — but only if no longer
  //    referenced. Conservative: do nothing. Editor / build will warn.

  if (src !== before) {
    fs.writeFileSync(full, src, 'utf8');
    totalChanged += 1;
    totalEdits += edits;
    console.log(`[ok] ${rel}  (${edits} edits)`);
  } else {
    console.log(`[skip] ${rel}  (no change)`);
  }
}

function fnNameToId(name) {
  if (!name) return null;
  // Mirror src/data/tools.ts ordering for toolIds 9-18 (text) and
  // 43-50 (code). For others, just hash.
  const m = {
    SmartWriter: 9, Summarizer: 10, Grammar: 11, OCR: 12, Translator: 13,
    ChatBot: 14, WeeklyReport: 15, TitleGenerator: 16, Resume: 17, MindMap: 18,
    CodeCompletion: 43, CodeExplainer: 44, BugFix: 45, SQLGenerator: 46,
    ShellGen: 47, UnitTest: 50,
    HealthyEating: 59, Workout: 60, Counseling: 61, Medication: 62,
    Name: 63, Dream: 64,
    AIPainter: 19, ImageRestore: 20, RemoveBackground: 21, StyleTransfer: 22,
    ImageUpscale: 23, PosterMaker: 24, QrArt: 25, VirtualTryOn: 26,
    TTS: 27, ASR: 28, SongComposer: 29, VoiceClone: 30, NoiseReduce: 31,
    SfxMaker: 32, Audiobook: 33, VoiceTranslate: 34,
    TextToVideo: 35, SmartEditor: 36, SubtitleGenerator: 37, DigitalHuman: 38,
    VideoTranslate: 39, VideoMusic: 40, Vfx: 41, VlogEditor: 42,
    ExcelFormula: 51, PPTOutline: 52, MindMapP: 53, Calendar: 54,
    Pomodoro: 55, Bookkeeping: 56, TripPlanner: 57, DataAnalysis: 58,
  };
  return m[name] ?? null;
}

console.log(`\n${totalChanged} files, ${totalEdits} edits`);
