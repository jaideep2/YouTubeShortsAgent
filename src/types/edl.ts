export type NarrativeStructure = 'CONTINUOUS_TAKE' | 'COLLAGE_STITCH';

export type VocalEventTag =
  | '[LAUGHTER]'
  | '[SIGH]'
  | '[EMPHASIS]'
  | '[PAUSE]'
  | '[GASP]';

export type WordAction = 'KEEP' | 'CUT';

export type FillerType = 'NONE' | 'SIMPLE_FILLER' | 'COMPOUND_FILLER';

export type VerticalLayoutMode =
  | 'SINGLE_SPEAKER'
  | 'SPLIT_TOP_BOTTOM'
  | 'CONTENT_ZOOM_PIP';

export interface CoarseSegment {
  id: string;
  label: 'HOOK' | 'SETUP' | 'CORE_INSIGHT' | 'TANGENT_SKIP' | 'PAYOFF';
  startSec: number;
  endSec: number;
  summary: string;
  included: boolean;
}

export interface EnhancedWord {
  id: string;
  word: string;
  speaker: string;
  startMs: number;
  endMs: number;
  action: WordAction;
  fillerType: FillerType;
  compoundGroupId?: string;
  compoundPhraseText?: string;
  cutReason?: string;
  vocalTag?: VocalEventTag;
  protectedAuthenticity?: boolean;
}

export interface TranscriptStats {
  totalWords: number;
  keptWords: number;
  cutWords: number;
  cutSimpleFillers: number;
  cutCompoundWords: number;
  protectedVocalEvents: number;
  rawSpeechDurationSec: number;
  netCompiledDurationSec: number;
  timeSavedSec: number;
}

export interface EnhancedTranscript {
  candidateId: string;
  generatedAt: string;
  words: EnhancedWord[];
  detectedSpeakers: string[];
  stats: TranscriptStats;
}

export interface FineTimelineCut {
  id: string;
  sourceStartMs: number;
  sourceEndMs: number;
  unpaddedStartMs: number;
  unpaddedEndMs: number;
  paddingMs: number;
  durationMs: number;
  timelineStartMs: number;
  timelineEndMs: number;
  speaker: string;
  textPreview: string;
  wordIds: string[];
  hasVocalEvents: VocalEventTag[];
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FramingKeyframe {
  id: string;
  startMs: number;
  endMs: number;
  layout: VerticalLayoutMode;
  activeSpeaker?: string;
  secondarySpeaker?: string;
  screenContentTitle?: string;
  topRatioPercent: number;
  bottomRatioPercent: number;
  primaryCropBox: CropBox;
  secondaryCropBox?: CropBox;
  rationale: string;
}

export interface BRollCue {
  id: string;
  startMs: number;
  endMs: number;
  visualPrompt: string;
  overlayStyle: 'FULL_CUTAWAY' | 'TOP_HALF_INSERT' | 'FLOATING_CARD';
}

export interface DynamicCaptionWord {
  wordId: string;
  word: string;
  speaker: string;
  sourceStartMs: number;
  sourceEndMs: number;
  timelineStartMs: number;
  timelineEndMs: number;
  vocalTag?: VocalEventTag;
}

export interface DynamicCaptionGroup {
  id: string;
  cutId: string;
  speaker: string;
  timelineStartMs: number;
  timelineEndMs: number;
  words: DynamicCaptionWord[];
}

export interface ThumbnailSpec {
  timestampSec: number;
  headlineText: string;
  visualDescription: string;
  facialExpressionCue: string;
}

export interface TrendSource {
  title: string;
  url: string;
}

export interface TrendContext {
  nicheQuery: string;
  trendInsight: string;
  viralFormatPattern: string;
  sources: TrendSource[];
}

export interface TrendTopicItem {
  id: string;
  hookFormula: string;
  topicAngle: string;
  whyTrendingNow: string;
  recommendedStructure: NarrativeStructure;
  targetEmotion: string;
}

export interface TrendRadarResult {
  nicheQuery: string;
  scannedAt: string;
  weeklyPulseSummary: string;
  trendingTopics: TrendTopicItem[];
  sources: TrendSource[];
}

export type ShortsAspectRatio = '9:16' | '1:1';

export interface YouTubeShortsFormatSpec {
  aspectRatio: ShortsAspectRatio;
  resolution: '1080x1920' | '1080x1080';
  minResolution: '720x1280' | '720x720';
  container: 'MP4 (H.264 + AAC)';
  fps: 30 | 60;
  maxAllowedDurationSec: 180;
  recommendedSweetSpotSec: '30–60s';
}

export interface YouTubePublishMetadata {
  title: string;
  description: string;
  hashtags: string[];
  formatSpec: YouTubeShortsFormatSpec;
}

export interface VisualTrack {
  aspectRatio: ShortsAspectRatio;
  fps: number;
  width: number;
  height: number;
  hookBannerDurationMs: number;
  framingKeyframes: FramingKeyframe[];
  bRollCues: BRollCue[];
  dynamicCaptions: DynamicCaptionGroup[];
}

export interface QACriticReport {
  passed: boolean;
  netDurationValid: boolean;
  minCutDurationValid: boolean;
  authenticityPreserved: boolean;
  shortCutViolations: number;
  autoHealedCount: number;
  selfHealingActions: string[];
  notes: string[];
}

export interface ShortEDL {
  id: string;
  title: string;
  structure: NarrativeStructure;
  sourceVideoUri: string;
  sourceMimeType: string;
  rawSourceStartSec: number;
  rawSourceEndSec: number;
  rawSourceDurationSec: number;
  estimatedNetDurationSec: number;
  viralityScore: number;
  authenticityScore: number;
  hookText: string;
  whyItWorks: string;
  authenticityMoment: string;
  trendContext: TrendContext;
  coarseSegments: CoarseSegment[];
  enhancedTranscript?: EnhancedTranscript;
  fineTimeline: FineTimelineCut[];
  visualTrack: VisualTrack;
  packaging: {
    hookBanner: {
      text: string;
      subtext: string;
      durationMs: number;
    };
    framingKeyframes: FramingKeyframe[];
    bRollCues: BRollCue[];
    dynamicCaptions: DynamicCaptionGroup[];
    thumbnailSpec: ThumbnailSpec;
    captionStyle: {
      wordsPerGroup: number;
      highlightActiveWord: boolean;
      emphasizeVocalTags: boolean;
    };
    youtubeMetadata?: YouTubePublishMetadata;
  };
  qaReport: QACriticReport;
}

export type PipelinePassId =
  | 'PASS_1_SCOUT'
  | 'PASS_2_SURGICAL_CUT'
  | 'PASS_3_AUTO_FRAMING'
  | 'PASS_4_QA_CRITIC';

export type StepState = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR';

export interface AgentError {
  passId: PipelinePassId;
  code: string;
  message: string;
  details?: string;
  timestamp: string;
  retryable: boolean;
}

export interface PipelineStepStatus {
  passId: PipelinePassId;
  stepNumber: number;
  name: string;
  subtitle: string;
  state: StepState;
  startedAt?: string;
  completedAt?: string;
  summaryText?: string;
}

export interface PipelineStatus {
  currentPass: PipelinePassId | null;
  steps: Record<PipelinePassId, PipelineStepStatus>;
  error: AgentError | null;
}

export interface VideoSourceInput {
  mode: 'YOUTUBE_URL' | 'FILE_UPLOAD';
  youtubeUrl?: string;
  fileName?: string;
  uploadedFileBase64?: string;
  previewObjectUrl?: string;
  mimeType: string;
  fileSizeBytes?: number;
  nicheHint: string;
}

export interface CloudExportSandboxLog {
  id: string;
  type: 'thought' | 'command' | 'output' | 'summary';
  title: string;
  detail: string;
}

export interface CloudExportResult {
  agentId: string;
  interactionId: string;
  exportedAt: string;
  friendlySummary: string;
  outputFileName: string;
  durationSec: number;
  resolution: string;
  mp4Base64?: string;
  ffmpegCommandUsed: string;
  sandboxLogs: CloudExportSandboxLog[];
}

export type AgentChatActionType =
  | 'LOAD_YOUTUBE_URL'
  | 'SCAN_TRENDS'
  | 'SELECT_MOMENT'
  | 'SET_CAMERA_MODE'
  | 'SET_ASPECT_RATIO'
  | 'UPDATE_HOOK_TEXT'
  | 'TOGGLE_FILLERS'
  | 'TOGGLE_PAUSES'
  | 'UPDATE_YOUTUBE_META'
  | 'NAVIGATE_STEP';

export interface AgentChatAction {
  type: AgentChatActionType;
  youtubeUrl?: string;
  nicheHint?: string;
  momentIndex?: number;
  cameraMode?: 'AUTO' | VerticalLayoutMode;
  aspectRatio?: ShortsAspectRatio;
  hookText?: string;
  removeFillers?: boolean;
  tightenPauses?: boolean;
  youtubeTitle?: string;
  youtubeDescription?: string;
  youtubeHashtags?: string[];
  route?: '/drop' | '/moments' | '/snip' | '/shine';
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  appliedActions?: string[];
}

export interface AgentChatResponse {
  reply: string;
  actions: AgentChatAction[];
  suggestedPrompts: string[];
}


