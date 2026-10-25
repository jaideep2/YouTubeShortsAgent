import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Scissors,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import type { ShortEDL } from '../types/edl';
import { computeFluffAndPauseSummary } from '../utils/edlCompiler';
import { RealVideoPlayer, type SkipRangeSec } from '../components/RealVideoPlayer';

interface SplitPageProps {
  candidate: ShortEDL | null;
  previewObjectUrl?: string;
  pausesTightened: boolean;
  onToggleBulkFillers: (removeFillers: boolean) => void;
  onTogglePausesTightened: (tighten: boolean) => void;
  onToggleWord: (wordId: string) => void;
  onToggleCompoundGroup: (compoundGroupId: string) => void;
  onRunSurgicalPass: () => Promise<void>;
  isPipelineRunning: boolean;
}

export const SplitPage: React.FC<SplitPageProps> = ({
  candidate,
  previewObjectUrl,
  pausesTightened,
  onToggleBulkFillers,
  onTogglePausesTightened,
  onToggleWord,
  onRunSurgicalPass,
  isPipelineRunning,
}) => {
  const navigate = useNavigate();
  const [showWordDrawer, setShowWordDrawer] = useState(false);

  const words = candidate?.enhancedTranscript?.words || [];

  // Build real-time skipRanges from crossed-out words + excluded tangents so the 9:16 video hops over them automatically!
  const fluffSkipRanges = useMemo<SkipRangeSec[]>(() => {
    if (!candidate) return [];
    const ranges: SkipRangeSec[] = [];

    for (const seg of candidate.coarseSegments) {
      if (!seg.included || seg.label === 'TANGENT_SKIP') {
        ranges.push({
          startSec: seg.startSec,
          endSec: seg.endSec,
          label: `Skipped ${Math.round(seg.endSec - seg.startSec)}s tangent`,
        });
      }
    }

    let i = 0;
    while (i < words.length) {
      if (words[i].action === 'CUT') {
        const startMs = words[i].startMs;
        let endMs = words[i].endMs;
        i++;
        while (i < words.length && words[i].action === 'CUT') {
          endMs = words[i].endMs;
          i++;
        }
        ranges.push({
          startSec: startMs / 1000,
          endSec: endMs / 1000,
          label: 'Skipped filler',
        });
      } else {
        i++;
      }
    }

    return ranges;
  }, [candidate, words]);

  if (!candidate) {
    return (
      <div className="max-w-[1380px] mx-auto px-4 lg:px-8 py-16 text-center">
        <div className="hum-card-warm p-10 max-w-xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EDE2] text-xs font-semibold text-[#E05A47]">
            <Scissors className="w-3.5 h-3.5" />
            <span>Step 3 · Snip the Fluff</span>
          </div>
          <h1 className="text-3xl text-[#1F1C18]">Pick a story moment first!</h1>
          <p className="text-sm text-[#4A433B]">
            Drop a video or pick one of your stories on Step 2 to clean up filler words and
            pauses.
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

  const summary = computeFluffAndPauseSummary(candidate, pausesTightened);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="max-w-[1260px] mx-auto px-4 lg:px-8 py-8 space-y-8"
    >
      {/* Simple Inviting Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E8E0D2]">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F3EDE2] border border-[#E8E0D2] text-xs font-semibold text-[#E05A47]">
            <Scissors className="w-3.5 h-3.5" />
            <span>Step 3 · Snip the Fluff</span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-[#1F1C18]">
            We cleaned up your filler words and pauses automatically.
          </h1>
          <p className="text-base text-[#4A433B]">
            Your 9:16 Short hops right over filler words and dead air so viewers stay
            hooked from start to finish.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/moments')}
            className="btn btn--secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Moments</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/shine')}
            className="btn btn--primary"
          >
            <Wand2 className="w-4 h-4" />
            <span>Next: Make it Shine</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 12-Col Workspace: 9:16 Reframed Video (Left) + Simple Filler & Pause Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: 9:16 Reframed Output ONLY (Click to Play) */}
        <div className="lg:col-span-5">
          <div className="hum-card p-5 space-y-3">
            <RealVideoPlayer
              youtubeUrl={
                candidate.sourceVideoUri.includes('youtube.com') ||
                candidate.sourceVideoUri.includes('youtu.be')
                  ? candidate.sourceVideoUri
                  : undefined
              }
              previewObjectUrl={previewObjectUrl}
              startSec={candidate.rawSourceStartSec}
              endSec={candidate.rawSourceEndSec}
              skipRanges={fluffSkipRanges}
              reframedCandidate={candidate}
              badgeText={`${summary.fillerWordsCount} fillers · ${summary.pausesCount} pauses`}
            />
          </div>
        </div>

        {/* Right 7 Cols: Simple Summary Card ("12 filler words, 13 pauses") */}
        <div className="lg:col-span-7 space-y-6">
          <div className="hum-card-warm p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E0D2] pb-4">
              <div>
                <span className="text-xs font-bold text-[#E05A47]">
                  Automatic Pacing Cleanup
                </span>
                <h2 className="text-2xl text-[#1F1C18] mt-0.5">
                  {summary.fillerWordsCount} filler words &bull; {summary.pausesCount}{' '}
                  pauses
                </h2>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2D8A61] text-white text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Saved {summary.totalTimeSavedSec}s &rarr;{' '}
                  {summary.netDurationSec.toFixed(0)}s Short
                </span>
              </div>
            </div>

            {/* 2 Clean Toggle Cards: Filler Words + Pauses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Filler Words */}
              <div className="p-5 rounded-3xl bg-[#FAF7F2] border-2 border-[#E8E0D2] flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E05A47]">
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Filler Words</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E05A47]/15 text-[#E05A47] text-xs font-bold">
                      {summary.fillerWordsCount} filler words
                    </span>
                  </div>
                  <div className="fig text-3xl text-[#1F1C18]">
                    {summary.fillerWordsCount} filler words
                  </div>
                  <p className="text-xs text-[#4A433B]">
                    Removes &ldquo;umm&rdquo;, &ldquo;uh&rdquo;, and repetitive false starts.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleBulkFillers(!summary.fillerWordsActive)}
                  className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    summary.fillerWordsActive
                      ? 'bg-[#2D8A61] text-white border-[#2D8A61]'
                      : 'bg-[#F3EDE2] text-[#4A433B] border-[#D8CEBE]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {summary.fillerWordsActive
                      ? `${summary.fillerWordsCount} Filler Words Removed`
                      : 'Tap to Remove Filler Words'}
                  </span>
                </button>
              </div>

              {/* Card 2: Pauses */}
              <div className="p-5 rounded-3xl bg-[#FAF7F2] border-2 border-[#E8E0D2] flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D8A61]">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Awkward Pauses</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#2D8A61]/15 text-[#2D8A61] text-xs font-bold">
                      {summary.pausesCount} pauses
                    </span>
                  </div>
                  <div className="fig text-3xl text-[#1F1C18]">
                    {summary.pausesCount} pauses
                  </div>
                  <p className="text-xs text-[#4A433B]">
                    Tightens dead air between sentences for snappy Shorts pacing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onTogglePausesTightened(!summary.pausesTightened)}
                  className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    summary.pausesTightened
                      ? 'bg-[#2D8A61] text-white border-[#2D8A61]'
                      : 'bg-[#F3EDE2] text-[#4A433B] border-[#D8CEBE]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {summary.pausesTightened
                      ? `${summary.pausesCount} Pauses Tightened`
                      : 'Tap to Tighten Pauses'}
                  </span>
                </button>
              </div>
            </div>

            {/* Optional Expandable Transcript Drawer (Hidden by default) */}
            <div className="pt-2 border-t border-[#E8E0D2]">
              {words.length === 0 ? (
                <button
                  type="button"
                  disabled={isPipelineRunning}
                  onClick={onRunSurgicalPass}
                  className="text-xs font-semibold text-[#E05A47] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isPipelineRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing word-by-word transcript...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Want to inspect individual words? Click to load transcript</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowWordDrawer((v) => !v)}
                    className="text-xs font-semibold text-[#4A433B] hover:text-[#1F1C18] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>
                      {showWordDrawer
                        ? 'Hide word-by-word transcript'
                        : 'Fine-tune individual words (optional)'}
                    </span>
                    {showWordDrawer ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showWordDrawer && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] flex flex-wrap gap-1.5 max-h-[240px] overflow-y-auto"
                      >
                        {words.map((w) => {
                          const isCut = w.action === 'CUT';
                          const clean = w.word
                            .replace(/\[LAUGHTER\]/gi, '')
                            .replace(/\[SIGH\]/gi, '')
                            .replace(/\[EMPHASIS\]/gi, '')
                            .trim();
                          if (!clean) return null;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => onToggleWord(w.id)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                isCut
                                  ? 'bg-[#E05A47]/12 border-[#E05A47]/50 text-[#B93827] line-through'
                                  : 'bg-[#F3EDE2] border-[#E8E0D2] text-[#1F1C18] hover:border-[#E05A47]'
                              }`}
                            >
                              {clean}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Continue CTA */}
            <div className="pt-2 flex justify-start">
              <button
                type="button"
                onClick={() => navigate('/shine')}
                className="btn btn--primary px-6 py-3"
              >
                <Wand2 className="w-4 h-4" />
                <span>Continue to Make it Shine</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
