import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  FastForward,
  Flame,
  Loader2,
  Play,
  Scissors,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { ShortEDL, TrendRadarResult } from '../types/edl';
import {
  computeCompressionBreakdown,
  formatSecondsToMMSS,
} from '../utils/edlCompiler';
import { RealVideoPlayer, type SkipRangeSec } from '../components/RealVideoPlayer';

interface ScoutPageProps {
  candidates: ShortEDL[];
  selectedCandidate: ShortEDL | null;
  previewObjectUrl?: string;
  trendRadar?: TrendRadarResult | null;
  onSelectCandidate: (id: string) => void;
  onRunCandidateDeepPass: (candidate: ShortEDL) => Promise<void>;
  isPipelineRunning: boolean;
}

const SIMPLE_BEAT_LABELS: Record<string, string> = {
  HOOK: 'Opening Hook',
  SETUP: 'Setup',
  CORE_INSIGHT: 'Key Moment',
  TANGENT_SKIP: 'Skipped Tangent',
  PAYOFF: 'Payoff',
};

function formatHumanDuration(sec: number): string {
  const rounded = Math.max(1, Math.round(sec));
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function cleanTags(text: string): string {
  return text
    .replace(/\[LAUGHTER\]/gi, '')
    .replace(/\[SIGH\]/gi, '')
    .replace(/\[EMPHASIS\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ScoutPage: React.FC<ScoutPageProps> = ({
  candidates,
  selectedCandidate,
  previewObjectUrl,
  trendRadar,
  onSelectCandidate,
  onRunCandidateDeepPass,
  isPipelineRunning,
}) => {
  const navigate = useNavigate();
  // Map of candidateId -> requested seek timestamp when a user clicks a beat pill
  const [seekByCandidate, setSeekByCandidate] = useState<Record<string, number | null>>(
    {}
  );

  if (candidates.length === 0) {
    return (
      <div className="max-w-[1380px] mx-auto px-4 lg:px-8 py-16 text-center">
        <div className="hum-card-warm p-10 max-w-xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EDE2] text-xs font-semibold text-[#E05A47]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 2 · Pick a Moment</span>
          </div>
          <h1 className="text-3xl text-[#1F1C18]">
            Let&apos;s drop a video first!
          </h1>
          <p className="text-sm text-[#4A433B]">
            Paste a YouTube link or drop an MP4 recording on Step 1 so we can watch it and
            find your best stories.
          </p>
          <button
            type="button"
            onClick={() => navigate('/drop')}
            className="btn btn--primary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Drop a Video</span>
          </button>
        </div>
      </div>
    );
  }

  const handleGoToSnip = async (clip: ShortEDL) => {
    onSelectCandidate(clip.id);
    if (!clip.enhancedTranscript && !isPipelineRunning) {
      await onRunCandidateDeepPass(clip);
    }
    navigate('/snip');
  };

  const handleGoToShine = async (clip: ShortEDL) => {
    onSelectCandidate(clip.id);
    if (!clip.enhancedTranscript && !isPipelineRunning) {
      await onRunCandidateDeepPass(clip);
    }
    navigate('/shine');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="max-w-[1260px] mx-auto px-4 lg:px-8 py-8 space-y-8"
    >
      {/* Top Weekly Trends Strip */}
      {trendRadar && trendRadar.trendingTopics.length > 0 && (
        <div className="hum-card-oat px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1F1C18]">
            <Flame className="w-4 h-4 text-[#E05A47]" />
            <span>Trending on YouTube This Week:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {trendRadar.trendingTopics.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#E8E0D2] text-xs font-semibold text-[#1F1C18]"
              >
                &ldquo;{t.hookFormula}&rdquo;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Simple Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E8E0D2]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F3EDE2] border border-[#E8E0D2] text-xs font-semibold text-[#E05A47]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 2 · Pick a Moment ({candidates.length} Shorts Ready)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-[#1F1C18]">
            Scroll through your reframed 9:16 Shorts.
          </h1>
          <p className="text-base text-[#4A433B] max-w-2xl">
            Click any 9:16 video below to play it. When you find the one you love, jump
            straight to <strong>Snip the Fluff</strong> or <strong>Make it Shine</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/drop')}
          className="btn btn--secondary self-start lg:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Try Another Video</span>
        </button>
      </div>

      {/* Vertical Scroll Feed of ALL Discovered Moments */}
      <div className="space-y-8">
        {candidates.map((clip, idx) => {
          const isSelected = selectedCandidate?.id === clip.id;
          const breakdown = computeCompressionBreakdown(clip);
          const isStitched = clip.structure === 'COLLAGE_STITCH';
          const displayRawSec = Math.max(
            breakdown.rawSpanSec,
            Math.round(breakdown.netDurationSec + 18)
          );

          const tangentSkipRanges: SkipRangeSec[] = clip.coarseSegments
            .filter((seg) => !seg.included || seg.label === 'TANGENT_SKIP')
            .map((seg) => ({
              startSec: seg.startSec,
              endSec: seg.endSec,
              label: `Skipped ${Math.round(seg.endSec - seg.startSec)}s tangent`,
            }));

          return (
            <motion.section
              key={clip.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectCandidate(clip.id)}
              className={`hum-card-warm p-6 lg:p-8 transition-all border-2 ${
                isSelected
                  ? 'border-[#E05A47] shadow-[0_18px_38px_-14px_rgba(224,90,71,0.22)]'
                  : 'border-[#E8E0D2]'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left 5 Cols: 9:16 Reframed Output ONLY (Click to Play, Never Autoplays) */}
                <div className="lg:col-span-5">
                  <RealVideoPlayer
                    youtubeUrl={
                      clip.sourceVideoUri.includes('youtube.com') ||
                      clip.sourceVideoUri.includes('youtu.be')
                        ? clip.sourceVideoUri
                        : undefined
                    }
                    previewObjectUrl={previewObjectUrl}
                    startSec={clip.rawSourceStartSec}
                    endSec={clip.rawSourceEndSec}
                    skipRanges={tangentSkipRanges}
                    seekRequestSec={seekByCandidate[clip.id] ?? null}
                    reframedCandidate={clip}
                    badgeText={`Moment #${idx + 1}`}
                  />
                </div>

                {/* Right 7 Cols: Simple, Creator-Friendly Story Summary & Actions */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#E05A47] text-white text-xs font-bold">
                      Moment #{idx + 1}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[#2D8A61] text-white text-xs font-bold">
                      {breakdown.netDurationSec.toFixed(0)}s Short (from{' '}
                      {formatHumanDuration(displayRawSec)})
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        isStitched
                          ? 'bg-[#F59E0B]/20 text-[#9A5B00] border-[#F59E0B]/40'
                          : 'bg-[#F3EDE2] text-[#4A433B] border-[#E8E0D2]'
                      }`}
                    >
                      {isStitched ? 'Stitched Story' : 'One Smooth Take'}
                    </span>
                  </div>

                  {/* Title & 3-Second Opening Hook */}
                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl text-[#1F1C18] leading-snug">
                      {clip.title}
                    </h2>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-xs font-bold text-[#1F1C18]">
                      <Sparkles className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                      <span>Opening Hook: &ldquo;{clip.hookText}&rdquo;</span>
                    </div>
                  </div>

                  {/* Short 1-Sentence Reason Why It Works */}
                  <p className="text-sm text-[#4A433B] leading-relaxed">
                    {cleanTags(clip.whyItWorks)}
                  </p>

                  {/* Ultra-Simple Story Flow Pills (Click to Jump Video) */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#786F63]">
                      Story Flow (tap any part to preview):
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {clip.coarseSegments.map((seg) => {
                        const dur = Math.max(1, Math.round(seg.endSec - seg.startSec));
                        const isSkipped =
                          !seg.included || seg.label === 'TANGENT_SKIP';
                        const label = SIMPLE_BEAT_LABELS[seg.label] || 'Clip';

                        return (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCandidate(clip.id);
                              setSeekByCandidate((prev) => ({
                                ...prev,
                                [clip.id]: seg.startSec,
                              }));
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                              isSkipped
                                ? 'bg-[#E05A47]/10 border-[#E05A47]/35 text-[#9E2B1C] line-through'
                                : 'bg-[#FAF7F2] border-[#E8E0D2] text-[#1F1C18] hover:border-[#2D8A61]'
                            }`}
                          >
                            {isSkipped ? (
                              <>
                                <FastForward className="w-3 h-3 text-[#E05A47]" />
                                <span>Skipped {dur}s tangent</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-[#2D8A61]" />
                                <span>
                                  {label} ({formatSecondsToMMSS(seg.startSec)})
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="pt-3 border-t border-[#E8E0D2] flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isPipelineRunning}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleGoToSnip(clip);
                      }}
                      className="btn btn--primary"
                    >
                      {isPipelineRunning && isSelected ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Preparing...</span>
                        </>
                      ) : (
                        <>
                          <Scissors className="w-4 h-4" />
                          <span>Snip the Fluff</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isPipelineRunning}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleGoToShine(clip);
                      }}
                      className="btn btn--secondary"
                    >
                      <Wand2 className="w-4 h-4 text-[#F59E0B]" />
                      <span>Preview &amp; Upload Short</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          );
        })}
      </div>
    </motion.div>
  );
};
