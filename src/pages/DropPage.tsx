import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ExternalLink,
  FileVideo,
  Flame,
  Loader2,
  Scissors,
  Sparkles,
  Upload,
  Wand2,
  Youtube,
  Zap,
} from 'lucide-react';
import type {
  AgentChatMessage,
  TrendRadarResult,
  VideoSourceInput,
} from '../types/edl';
import { UltravioletTooltip } from '../components/UltravioletTooltip';
import { RealVideoPlayer, extractYoutubeVideoId } from '../components/RealVideoPlayer';
import { AgentChatPanel } from '../components/AgentChatPanel';

interface DropPageProps {
  sourceInput: VideoSourceInput;
  onUpdateSourceInput: (next: Partial<VideoSourceInput>) => void;
  trendRadar: TrendRadarResult | null;
  isScanningTrends: boolean;
  trendError: string | null;
  onScanTrends: (niche: string) => Promise<void>;
  onStartFullPipeline: () => Promise<void>;
  isPipelineRunning: boolean;
  hasCandidates: boolean;
  chatMessages: AgentChatMessage[];
  suggestedPrompts: string[];
  isSendingChat: boolean;
  onSendChatMessage: (message: string) => Promise<void>;
}

const DEFAULT_TREND_BADGES = [
  {
    hook: 'WAIT TILL YOU HEAR THIS PART',
    angle: 'Jump straight into the turning point or plot twist in the first 3 seconds',
    tag: 'Stitched Story',
  },
  {
    hook: 'NOBODY TALKS ABOUT THIS MISTAKE',
    angle: 'Honest behind-the-scenes takeaway with zero intro fluff',
    tag: 'One Smooth Take',
  },
  {
    hook: 'HOW WE ACTUALLY SOLVED THIS',
    angle: 'Top & Bottom 2-speaker split or screen zoom for high retention',
    tag: '9:16 Split View',
  },
];

export const DropPage: React.FC<DropPageProps> = ({
  sourceInput,
  onUpdateSourceInput,
  trendRadar,
  isScanningTrends,
  trendError,
  onScanTrends,
  onStartFullPipeline,
  isPipelineRunning,
  hasCandidates,
  chatMessages,
  suggestedPrompts,
  isSendingChat,
  onSendChatMessage,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setUploadError(null);
    if (!file.type.includes('video') && !file.name.match(/\.(mp4|mpeg|mpg|mov)$/i)) {
      setUploadError('Please drop an .mp4 or .mpeg video file.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      onUpdateSourceInput({
        mode: 'FILE_UPLOAD',
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || 'video/mp4',
        uploadedFileBase64: base64,
        previewObjectUrl: previewUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const youtubeId = extractYoutubeVideoId(sourceInput.youtubeUrl);
  const hasRealVideoToPlay =
    (sourceInput.mode === 'YOUTUBE_URL' && Boolean(youtubeId)) ||
    (sourceInput.mode === 'FILE_UPLOAD' && Boolean(sourceInput.previewObjectUrl));

  const canRunPipeline =
    (sourceInput.mode === 'YOUTUBE_URL' &&
      Boolean(sourceInput.youtubeUrl && sourceInput.youtubeUrl.trim().length > 5)) ||
    (sourceInput.mode === 'FILE_UPLOAD' && Boolean(sourceInput.uploadedFileBase64));

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRunPipeline || isPipelineRunning) return;
    try {
      await onStartFullPipeline();
      navigate('/moments');
    } catch {
      // Friendly error banner is shown in header
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="max-w-[1380px] mx-auto px-4 lg:px-8 py-6 space-y-6"
    >
      {/* 1. TOP BANNER: What's Trending on YouTube This Week */}
      <div className="hum-card-oat p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#E05A47]" />
            <h2 className="text-lg sm:text-xl text-[#1F1C18]">
              What&apos;s Trending on YouTube This Week
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E8E0D2] text-[#4A433B]">
              {sourceInput.nicheHint || 'Creator Storytelling'}
            </span>
          </div>
          <button
            type="button"
            disabled={isScanningTrends}
            onClick={() => onScanTrends(sourceInput.nicheHint)}
            className="px-3.5 py-1.5 rounded-full bg-[#FAF7F2] border border-[#D8CEBE] text-xs font-semibold text-[#1F1C18] hover:bg-[#E8E0D2] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isScanningTrends ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E05A47]" />
                <span>Checking Trends...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Refresh Weekly Trends</span>
              </>
            )}
          </button>
        </div>

        {trendError && (
          <div className="p-3 rounded-2xl bg-[#E05A47]/15 border border-[#E05A47]/35 text-xs font-medium text-[#9E2B1C]">
            {trendError}
          </div>
        )}

        {trendRadar ? (
          <div className="space-y-3">
            <p className="text-xs text-[#4A433B] leading-relaxed bg-[#FAF7F2] p-3 rounded-2xl border border-[#E8E0D2]">
              {trendRadar.weeklyPulseSummary}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {trendRadar.trendingTopics.slice(0, 3).map((topic) => (
                <div
                  key={topic.id}
                  className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1F1C18]">
                      &ldquo;{topic.hookFormula}&rdquo;
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#9A5B00] shrink-0">
                      {topic.recommendedStructure === 'CONTINUOUS_TAKE'
                        ? 'One Smooth Take'
                        : 'Stitched Story'}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A433B]">{topic.topicAngle}</p>
                </div>
              ))}
            </div>
            {trendRadar.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {trendRadar.sources.slice(0, 3).map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#E8E0D2] text-[11px] font-medium text-[#4A433B] hover:border-[#E05A47]"
                  >
                    <span className="truncate max-w-[150px]">{src.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DEFAULT_TREND_BADGES.map((b, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1F1C18]">
                    &ldquo;{b.hook}&rdquo;
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#9A5B00] shrink-0">
                    {b.tag}
                  </span>
                </div>
                <p className="text-xs text-[#4A433B]">{b.angle}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. FRONT & CENTER: Agent Chat Panel */}
      <AgentChatPanel
        messages={chatMessages}
        suggestedPrompts={suggestedPrompts}
        isSending={isSendingChat}
        onSendMessage={onSendChatMessage}
        variant="hero"
      />

      {/* 3. Warm Hero Header + Optional Step-by-Step Studio */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2 pb-4 border-b border-[#E8E0D2]">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F3EDE2] border border-[#E8E0D2] text-xs font-semibold text-[#E05A47]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 1 · Drop a Video</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl text-[#1F1C18]">
            Paste a YouTube link or drop your recording—we&apos;ll find the magic.
          </h1>
          <p className="text-sm sm:text-base text-[#4A433B] leading-relaxed">
            We watch your whole episode, spot the best stories, snip out filler words and
            awkward pauses, and auto-frame your 9:16 vertical Short ready for YouTube.
          </p>
        </div>

        {hasCandidates && (
          <button
            type="button"
            onClick={() => navigate('/moments')}
            className="btn btn--secondary self-start lg:self-auto"
          >
            <span>See Picked Moments</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main 12-Col Cozy Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Cols: Inviting Dropzone & Channel Topic */}
        <form
          onSubmit={handleLaunch}
          className="lg:col-span-7 hum-card-warm p-6 sm:p-8 space-y-6"
        >
          {/* Source Mode Bouncy Pill Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl text-[#1F1C18]">Where is your video?</h2>
              <p className="text-xs text-[#786F63] mt-0.5">
                Use a public YouTube link or drop an MP4 / MPEG file from your computer
              </p>
            </div>

            <div className="inline-flex items-center gap-1 bg-[#F3EDE2] p-1 rounded-full border border-[#E8E0D2]">
              <button
                type="button"
                onClick={() => onUpdateSourceInput({ mode: 'YOUTUBE_URL' })}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sourceInput.mode === 'YOUTUBE_URL'
                    ? 'bg-[#E05A47] text-white shadow-sm'
                    : 'text-[#4A433B] hover:text-[#1F1C18]'
                }`}
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>YouTube Link</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSourceInput({ mode: 'FILE_UPLOAD' })}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sourceInput.mode === 'FILE_UPLOAD'
                    ? 'bg-[#E05A47] text-white shadow-sm'
                    : 'text-[#4A433B] hover:text-[#1F1C18]'
                }`}
              >
                <FileVideo className="w-3.5 h-3.5" />
                <span>Drop a Recording</span>
              </button>
            </div>
          </div>

          {/* YouTube Link or Big Inviting Dropzone */}
          {sourceInput.mode === 'YOUTUBE_URL' ? (
            <div className="space-y-3">
              <label
                htmlFor="youtube-url-input"
                className="block text-xs font-semibold text-[#4A433B]"
              >
                Paste your YouTube link
              </label>
              <div className="relative">
                <Youtube className="w-5 h-5 text-[#E05A47] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="youtube-url-input"
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={sourceInput.youtubeUrl || ''}
                  onChange={(e) => onUpdateSourceInput({ youtubeUrl: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#FAF7F2] border-2 border-[#E8E0D2] text-sm font-medium text-[#1F1C18] placeholder-[#786F63]/60 focus:outline-none focus:border-[#E05A47] transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragging
                    ? 'border-[#E05A47] bg-[#E05A47]/10 scale-[1.01]'
                    : sourceInput.fileName
                    ? 'border-[#2D8A61] bg-[#2D8A61]/10'
                    : 'border-[#D8CEBE] bg-[#FAF7F2] hover:border-[#E05A47] hover:bg-[#F3EDE2]/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/mpeg,.mp4,.mpeg,.mpg,.mov"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-[#E05A47]/15 text-[#E05A47] flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                {sourceInput.fileName ? (
                  <div>
                    <div className="text-base font-bold text-[#1F1C18]">
                      {sourceInput.fileName}
                    </div>
                    <div className="text-xs font-semibold text-[#2D8A61] mt-1">
                      Loaded &amp; ready in 9:16 preview ·{' '}
                      {((sourceInput.fileSizeBytes || 0) / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-base font-semibold text-[#1F1C18]">
                      Drop your MP4 or MPEG recording right here, or click to pick a file
                    </div>
                    <p className="text-xs text-[#786F63] mt-1">
                      Works great with podcasts, interviews, vlogs, and screen recordings
                    </p>
                  </div>
                )}
              </div>
              {uploadError && (
                <p className="text-xs font-semibold text-[#E05A47]">{uploadError}</p>
              )}
            </div>
          )}

          {/* Friendly Channel Topic Input */}
          <div className="space-y-2">
            <label
              htmlFor="creator-niche-input"
              className="block text-xs font-semibold text-[#4A433B]"
            >
              What do you usually talk about on your channel?
            </label>
            <input
              id="creator-niche-input"
              type="text"
              placeholder="e.g. Tech Podcasts, Indie Founders, Fitness Vlogs, Cooking Tips"
              value={sourceInput.nicheHint}
              onChange={(e) => onUpdateSourceInput({ nicheHint: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border-2 border-[#E8E0D2] text-sm font-medium text-[#1F1C18] placeholder-[#786F63]/60 focus:outline-none focus:border-[#E05A47]"
            />
          </div>

          {/* 3 Warm Creator Feature Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <UltravioletTooltip
              title="Tightens Filler Words & Pauses"
              badgeText="CLEAN AUDIO"
              badgeTone="meadow"
              subtitle="Automatically snips out filler words ('umm', 'uh') and tightens awkward pauses."
            >
              <div className="w-full p-3.5 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2] flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#2D8A61]/15 text-[#2D8A61] flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1F1C18]">Tightens Pacing</div>
                  <div className="text-[11px] text-[#786F63]">No umms or pauses</div>
                </div>
              </div>
            </UltravioletTooltip>

            <UltravioletTooltip
              title="Skips Boring Middle Tangents"
              badgeText="STITCHED"
              badgeTone="coral"
              subtitle="Connects a great setup from minute 1 with the payoff at minute 4, hopping right over rambling in between."
            >
              <div className="w-full p-3.5 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2] flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E05A47]/15 text-[#E05A47] flex items-center justify-center shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1F1C18]">Skips Tangents</div>
                  <div className="text-[11px] text-[#786F63]">Setup → Payoff</div>
                </div>
              </div>
            </UltravioletTooltip>

            <UltravioletTooltip
              title="Smart 9:16 Vertical Framing"
              badgeText="9:16 READY"
              badgeTone="honey"
              subtitle="Automatically frames 1 speaker, stacks 2 speakers top & bottom, or zooms into screen shares."
            >
              <div className="w-full p-3.5 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2] flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/20 text-[#B45309] flex items-center justify-center shrink-0">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1F1C18]">9:16 Auto-Camera</div>
                  <div className="text-[11px] text-[#786F63]">Hook + captions</div>
                </div>
              </div>
            </UltravioletTooltip>
          </div>

          {/* Submit CTA */}
          <div className="pt-4 border-t border-[#E8E0D2] flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs font-medium text-[#786F63]">
              Takes ~20 seconds to watch your video and build your Shorts
            </span>
            <button
              type="submit"
              disabled={!canRunPipeline || isPipelineRunning}
              className="btn btn--primary px-7 py-3.5 text-sm"
            >
              {isPipelineRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Finding the Magic Moments...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Find My Best Moments</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right 5 Cols: 9:16 Reframed Preview (Click to Play) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="hum-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2D8A61]" />
                <h2 className="text-lg text-[#1F1C18]">9:16 Reframed Preview</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F3EDE2] text-[#4A433B]">
                {hasRealVideoToPlay ? 'Click to Play' : 'Waiting for Video'}
              </span>
            </div>

            <RealVideoPlayer
              youtubeUrl={
                sourceInput.mode === 'YOUTUBE_URL' ? sourceInput.youtubeUrl : undefined
              }
              previewObjectUrl={
                sourceInput.mode === 'FILE_UPLOAD'
                  ? sourceInput.previewObjectUrl
                  : undefined
              }
              badgeText={
                sourceInput.mode === 'FILE_UPLOAD' && sourceInput.fileName
                  ? sourceInput.fileName
                  : youtubeId
                  ? '9:16 Short Preview'
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
