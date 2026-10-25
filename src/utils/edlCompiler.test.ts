import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_PADDING_MS,
  annotateSurgicalFillers,
  buildCoarseAutoFramingKeyframes,
  buildDynamicCaptions,
  buildSmartAutoFramingKeyframes,
  buildVisualTrack,
  buildYouTubePublishMetadata,
  compileFineTimeline,
  computeCompressionBreakdown,
  computeCropViewportStyle,
  computeFluffAndPauseSummary,
  recalculateEDLFromWords,
  resolveActiveFramingAtSourceSec,
  runDeterministicQASelfHeal,
  setBulkFillerActionInEDL,
  toggleCompoundGroupInEDL,
  toggleWordInEDL,
} from './edlCompiler.ts';
import type { EnhancedWord, ShortEDL } from '../types/edl.ts';

const mockWordsInput: EnhancedWord[] = [
  {
    id: 'w1',
    word: 'Wait',
    speaker: 'Speaker 1 (Host)',
    startMs: 10000,
    endMs: 10400,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w2',
    word: 'umm',
    speaker: 'Speaker 1 (Host)',
    startMs: 10450,
    endMs: 10850,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w3',
    word: 'and',
    speaker: 'Speaker 1 (Host)',
    startMs: 10900,
    endMs: 11100,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w4',
    word: 'the',
    speaker: 'Speaker 1 (Host)',
    startMs: 11100,
    endMs: 11300,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w5',
    word: 'thing',
    speaker: 'Speaker 1 (Host)',
    startMs: 11300,
    endMs: 11550,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w6',
    word: 'is',
    speaker: 'Speaker 1 (Host)',
    startMs: 11550,
    endMs: 11800,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w7',
    word: '[LAUGHTER]',
    speaker: 'Speaker 2 (Guest)',
    startMs: 11900,
    endMs: 12700,
    action: 'CUT', // Should be overridden to KEEP by authenticity guardrail
    fillerType: 'SIMPLE_FILLER',
    vocalTag: '[LAUGHTER]',
  },
  {
    id: 'w8',
    word: 'that',
    speaker: 'Speaker 2 (Guest)',
    startMs: 12750,
    endMs: 13100,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w9',
    word: 'benchmark',
    speaker: 'Speaker 2 (Guest)',
    startMs: 13100,
    endMs: 13650,
    action: 'KEEP',
    fillerType: 'NONE',
  },
  {
    id: 'w10',
    word: 'shipped!',
    speaker: 'Speaker 2 (Guest)',
    startMs: 13650,
    endMs: 14250,
    action: 'KEEP',
    fillerType: 'NONE',
    vocalTag: '[EMPHASIS]',
  },
];

const mockCandidateBase: ShortEDL = {
  id: 'cand-test-1',
  title: 'Test Viral Clip',
  structure: 'COLLAGE_STITCH',
  sourceVideoUri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  sourceMimeType: 'video/mp4',
  rawSourceStartSec: 10,
  rawSourceEndSec: 185,
  rawSourceDurationSec: 175,
  estimatedNetDurationSec: 36,
  viralityScore: 94,
  authenticityScore: 96,
  hookText: 'WHY 90% OF AGENTS FAIL IN PROD',
  whyItWorks: 'Combines setup and payoff while skipping a 2-minute tangent.',
  authenticityMoment: 'Spontaneous shared laugh at 0:11.9',
  trendContext: {
    nicheQuery: 'AI engineering agents production postmortem shorts',
    trendInsight: 'High retention on postmortem failure stories with real laughter.',
    viralFormatPattern: 'Setup + Tangent Skip + Payoff Stitch',
    sources: [{ title: 'YouTube Creator Trends', url: 'https://youtube.com' }],
  },
  coarseSegments: [
    {
      id: 'seg-1',
      label: 'SETUP',
      startSec: 10,
      endSec: 28,
      summary: 'Initial failure story setup',
      included: true,
    },
    {
      id: 'seg-2',
      label: 'TANGENT_SKIP',
      startSec: 28,
      endSec: 158,
      summary: 'Skipped 130s tangent on cloud IAM config',
      included: false,
    },
    {
      id: 'seg-3',
      label: 'PAYOFF',
      startSec: 158,
      endSec: 185,
      summary: 'Final payoff and laughter',
      included: true,
    },
  ],
  fineTimeline: [],
  visualTrack: buildVisualTrack([], [], [], 3000),
  packaging: {
    hookBanner: {
      text: 'WHY 90% OF AGENTS FAIL IN PROD',
      subtext: 'Production Postmortem',
      durationMs: 3000,
    },
    framingKeyframes: [],
    bRollCues: [],
    dynamicCaptions: [],
    thumbnailSpec: {
      timestampSec: 12.1,
      headlineText: '42 CLUSTERS AT 2 AM?!',
      visualDescription: 'Split-screen reaction of both hosts laughing at cloud billing spike',
      facialExpressionCue: 'Authentic laughter + disbelief',
    },
    captionStyle: {
      wordsPerGroup: 4,
      highlightActiveWord: true,
      emphasizeVocalTags: true,
    },
  },
  qaReport: {
    passed: true,
    netDurationValid: true,
    minCutDurationValid: true,
    authenticityPreserved: true,
    shortCutViolations: 0,
    autoHealedCount: 0,
    selfHealingActions: [],
    notes: [],
  },
};

test('annotateSurgicalFillers flags simple fillers, compound filler phrases, and protects [LAUGHTER]', () => {
  const annotated = annotateSurgicalFillers(mockWordsInput);

  const ummWord = annotated.find((w) => w.id === 'w2')!;
  assert.equal(ummWord.action, 'CUT');
  assert.equal(ummWord.fillerType, 'SIMPLE_FILLER');

  const compoundWords = annotated.filter((w) => ['w3', 'w4', 'w5', 'w6'].includes(w.id));
  assert.equal(compoundWords.length, 4);
  for (const cw of compoundWords) {
    assert.equal(cw.action, 'CUT');
    assert.equal(cw.fillerType, 'COMPOUND_FILLER');
    assert.equal(cw.compoundGroupId, 'compound-w3');
  }

  const laughWord = annotated.find((w) => w.id === 'w7')!;
  assert.equal(laughWord.action, 'KEEP');
  assert.equal(laughWord.protectedAuthenticity, true);
});

test('compileFineTimeline applies 35ms audio padding and splits on CUT words', () => {
  const annotated = annotateSurgicalFillers(mockWordsInput);
  const timeline = compileFineTimeline(annotated, AUDIO_PADDING_MS);

  assert.equal(timeline.length, 2);

  assert.equal(timeline[0].sourceStartMs, 10000 - 35);
  assert.equal(timeline[0].sourceEndMs, 10400 + 35);
  assert.equal(timeline[0].durationMs, 470);

  assert.equal(timeline[1].sourceStartMs, 11900 - 35);
  assert.equal(timeline[1].sourceEndMs, 14250 + 35);
  assert.equal(timeline[1].durationMs, 2420);
  assert.ok(timeline[1].hasVocalEvents.includes('[LAUGHTER]'));
});

test('Pass 3 helpers generate 9:16 framing keyframes (50/50 split & 70/30 PiP) and word-synced dynamic captions', () => {
  const annotated = annotateSurgicalFillers(mockWordsInput);
  const timeline = compileFineTimeline(annotated, AUDIO_PADDING_MS);
  const keyframes = buildSmartAutoFramingKeyframes(annotated, timeline);
  const captions = buildDynamicCaptions(annotated, timeline, 3);

  assert.equal(keyframes.length, 2);
  assert.equal(keyframes[0].layout, 'SINGLE_SPEAKER');
  assert.equal(keyframes[0].topRatioPercent, 100);
  assert.equal(keyframes[1].layout, 'SPLIT_TOP_BOTTOM');
  assert.equal(keyframes[1].topRatioPercent, 50);
  assert.equal(keyframes[1].bottomRatioPercent, 50);
  assert.ok(keyframes[1].secondaryCropBox);

  assert.ok(captions.length >= 2);
  assert.equal(captions[0].words[0].word, 'Wait');
});

test('computeCompressionBreakdown calculates skipped tangent seconds vs filler cut seconds', () => {
  const annotated = annotateSurgicalFillers(mockWordsInput);
  const compiled = recalculateEDLFromWords(mockCandidateBase, annotated);
  const breakdown = computeCompressionBreakdown(compiled);

  assert.equal(breakdown.tangentSkippedSec, 130);
  assert.ok(breakdown.fillerCutSec > 0);
  assert.ok(breakdown.compressionRatioPercent > 50);
});

test('Pass 4 runDeterministicQASelfHeal heals cut [LAUGHTER] and expands micro-cuts < 450ms', () => {
  const brokenWords: EnhancedWord[] = [
    {
      id: 'bw1',
      word: 'Hi',
      speaker: 'Speaker 1 (Host)',
      startMs: 5000,
      endMs: 5150,
      action: 'KEEP',
      fillerType: 'NONE',
    },
    {
      id: 'bw2',
      word: 'umm',
      speaker: 'Speaker 1 (Host)',
      startMs: 5200,
      endMs: 5500,
      action: 'CUT',
      fillerType: 'SIMPLE_FILLER',
    },
    {
      id: 'bw3',
      word: '[LAUGHTER]',
      speaker: 'Speaker 2 (Guest)',
      startMs: 5600,
      endMs: 6500,
      action: 'CUT',
      fillerType: 'NONE',
      vocalTag: '[LAUGHTER]',
    },
  ];

  const unhealed = recalculateEDLFromWords(mockCandidateBase, brokenWords);
  assert.equal(unhealed.qaReport.minCutDurationValid, false);
  assert.equal(unhealed.qaReport.authenticityPreserved, false);

  const healed = runDeterministicQASelfHeal(unhealed);
  assert.equal(healed.qaReport.minCutDurationValid, true);
  assert.equal(healed.qaReport.authenticityPreserved, true);
  assert.ok(healed.qaReport.autoHealedCount >= 2);
  assert.ok(healed.fineTimeline[0].durationMs >= 450);
  assert.equal(healed.visualTrack.aspectRatio, '9:16');
});

test('toggleWordInEDL and toggleCompoundGroupInEDL recalculate net duration and fineTimeline live', () => {
  const annotated = annotateSurgicalFillers(mockWordsInput);
  const initialEdl = recalculateEDLFromWords(mockCandidateBase, annotated);

  const initialNetSec = initialEdl.estimatedNetDurationSec;
  assert.equal(initialEdl.fineTimeline.length, 2);

  const afterToggleWord = toggleWordInEDL(initialEdl, 'w2');
  const w2Now = afterToggleWord.enhancedTranscript?.words.find((w) => w.id === 'w2')!;
  assert.equal(w2Now.action, 'KEEP');
  assert.ok(afterToggleWord.estimatedNetDurationSec > initialNetSec);

  const afterToggleCompound = toggleCompoundGroupInEDL(afterToggleWord, 'compound-w3');
  assert.equal(afterToggleCompound.enhancedTranscript?.stats.keptWords, 10);
  assert.equal(afterToggleCompound.fineTimeline.length, 1);
});

test('buildCoarseAutoFramingKeyframes and resolveActiveFramingAtSourceSec reframe 1 speaker, 2 speakers top/bottom, and content zoom', () => {
  const coarseKeyframes = buildCoarseAutoFramingKeyframes(
    mockCandidateBase.coarseSegments,
    mockCandidateBase.title
  );

  assert.equal(coarseKeyframes.length, 2);
  assert.equal(coarseKeyframes[0].layout, 'SINGLE_SPEAKER');
  assert.equal(coarseKeyframes[1].layout, 'SPLIT_TOP_BOTTOM');

  const framingAtSetup = resolveActiveFramingAtSourceSec(mockCandidateBase, 14);
  assert.equal(framingAtSetup.layout, 'SINGLE_SPEAKER');
  const styleSingle = computeCropViewportStyle(framingAtSetup.primaryCropBox);
  assert.ok(styleSingle.scale >= 1.0);
  assert.ok(styleSingle.boxWidthPercent > 0);

  const framingAtPayoff = resolveActiveFramingAtSourceSec(mockCandidateBase, 165);
  assert.equal(framingAtPayoff.layout, 'SPLIT_TOP_BOTTOM');
  assert.equal(framingAtPayoff.topRatioPercent, 50);
  assert.equal(framingAtPayoff.bottomRatioPercent, 50);

  const forcedContentZoom = resolveActiveFramingAtSourceSec(
    mockCandidateBase,
    14,
    'CONTENT_ZOOM_PIP'
  );
  assert.equal(forcedContentZoom.layout, 'CONTENT_ZOOM_PIP');
  assert.equal(forcedContentZoom.topRatioPercent, 70);
  assert.equal(forcedContentZoom.bottomRatioPercent, 30);
});

test('buildYouTubePublishMetadata generates compliant title, description, hashtags (#Shorts), and 9:16 / 1:1 format specs', () => {
  const meta = buildYouTubePublishMetadata(mockCandidateBase);

  assert.ok(meta.title.length > 0 && meta.title.length <= 100);
  assert.ok(meta.title.includes('#Shorts'));
  assert.ok(meta.description.includes(mockCandidateBase.hookText));
  assert.ok(meta.hashtags.includes('#Shorts'));
  assert.equal(meta.formatSpec.aspectRatio, '9:16');
  assert.equal(meta.formatSpec.resolution, '1080x1920');
  assert.equal(meta.formatSpec.container, 'MP4 (H.264 + AAC)');
  assert.equal(meta.formatSpec.maxAllowedDurationSec, 180);

  const squareMeta = buildYouTubePublishMetadata(mockCandidateBase, {
    formatSpec: {
      ...meta.formatSpec,
      aspectRatio: '1:1',
    },
  });
  assert.equal(squareMeta.formatSpec.aspectRatio, '1:1');
  assert.equal(squareMeta.formatSpec.resolution, '1080x1080');
});

test('computeFluffAndPauseSummary and setBulkFillerActionInEDL summarize and toggle filler words and pauses', () => {
  const annotated = annotateSurgicalFillers(mockWordsInput);
  const initialEdl = recalculateEDLFromWords(mockCandidateBase, annotated);

  const summary = computeFluffAndPauseSummary(initialEdl, true);
  assert.ok(summary.fillerWordsCount >= 5);
  assert.ok(summary.pausesCount >= 1);
  assert.equal(summary.fillerWordsActive, true);
  assert.equal(summary.pausesTightened, true);

  const restoredEdl = setBulkFillerActionInEDL(initialEdl, false);
  const restoredSummary = computeFluffAndPauseSummary(restoredEdl, false);
  assert.equal(restoredSummary.fillerWordsActive, false);
  assert.equal(restoredSummary.pausesTightened, false);
});

