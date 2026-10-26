import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Film,
  Loader2,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import type {
  PipelinePassId,
  PipelineStatus,
  ShortEDL,
} from '../types/edl';
import { formatSecondsToMMSS } from '../utils/edlCompiler';

interface ConsoleHeaderAndTelemetryProps {
  pipelineStatus: PipelineStatus;
  candidates: ShortEDL[];
  selectedCandidate: ShortEDL | null;
  onSelectCandidate: (id: string) => void;
  onRetryFailedPass: () => void;
  onRunPass: (passId: PipelinePassId) => void;
  onResetStudio: () => void;
  onLoadTestRun: () => void;
  isTestMode: boolean;
}

const PASS_ORDER: PipelinePassId[] = [
  'PASS_1_SCOUT',
  'PASS_2_SURGICAL_CUT',
  'PASS_3_AUTO_FRAMING',
  'PASS_4_QA_CRITIC',
];

const WIZARD_STEPS = [
  {
    to: '/drop',
    title: 'Drop a Video',
    subtitle: 'Paste link or MP4',
    icon: Upload,
  },
  {
    to: '/moments',
    title: 'Pick a Moment',
    subtitle: 'Best stories found',
    icon: Sparkles,
  },
  {
    to: '/snip',
    title: 'Snip the Fluff',
    subtitle: 'Fillers & pauses',
    icon: Scissors,
  },
  {
    to: '/shine',
    title: 'Make it Shine',
    subtitle: '9:16 & upload',
    icon: Wand2,
  },
];

const AGENT_FRIENDLY_COPY: Record<
  PipelinePassId,
  { badge: string; headline: string }
> = {
  PASS_1_SCOUT: {
    badge: 'Finding Magic Moments',
    headline:
      'Watching your video & checking this week’s YouTube trends to spot the best stories...',
  },
  PASS_2_SURGICAL_CUT: {
    badge: 'Snipping Out the Fluff',
    headline:
      'Removing filler words ("umms" & "aahs") and tightening awkward pauses...',
  },
  PASS_3_AUTO_FRAMING: {
    badge: 'Framing for 9:16 Vertical',
    headline:
      'Setting up your 3-second opening hook sticker, karaoke captions, and 9:16 speaker framing...',
  },
  PASS_4_QA_CRITIC: {
    badge: 'Final Polish',
    headline:
      'Smoothing out audio transitions so your Short feels natural and punchy...',
  },
};

export const ConsoleHeaderAndTelemetry: React.FC<ConsoleHeaderAndTelemetryProps> = ({
  pipelineStatus,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  onRetryFailedPass,
  onResetStudio,
  onLoadTestRun,
  isTestMode,
}) => {
  const activePass = pipelineStatus.currentPass;
  const isAnyRunning = Boolean(activePass);

  const completedCount = PASS_ORDER.filter(
    (id) => pipelineStatus.steps[id].state === 'COMPLETED'
  ).length;
  const runningIndex = activePass ? PASS_ORDER.indexOf(activePass) : -1;
  const progressPercent = isAnyRunning
    ? Math.min(95, Math.round(((runningIndex + 0.5) / PASS_ORDER.length) * 100))
    : Math.round((completedCount / PASS_ORDER.length) * 100);

  const activeCopy = activePass ? AGENT_FRIENDLY_COPY[activePass] : null;

  return (
    <header className="sticky top-0 z-[300] bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8E0D2]">
      <div className="max-w-[1380px] mx-auto px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity: YouTubeShortsAgent */}
        <NavLink to="/drop" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-[#E05A47] text-white flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(224,90,71,0.5)] group-hover:scale-105 transition-transform">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="hum-display text-xl text-[#1F1C18] tracking-tight">
                YouTubeShortsAgent
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#9A5B00] border border-[#F59E0B]/35">
                Creator Studio
              </span>
            </div>
            <p className="text-xs text-[#786F63] hidden sm:block">
              Turn weekly long videos into daily YouTube Shorts
            </p>
          </div>
        </NavLink>

        {/* 4 Bouncy Wizard Step Pills */}
        <nav
          aria-label="Creator Wizard Steps"
          className="flex items-center gap-1.5 bg-[#F3EDE2] p-1.5 rounded-full border border-[#E8E0D2] overflow-x-auto max-w-full"
        >
          {WIZARD_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <NavLink
                key={step.to}
                to={step.to}
                className={({ isActive }) =>
                  `relative px-3.5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 shrink-0 ${
                    isActive
                      ? 'bg-[#1F1C18] text-[#FAF7F2] shadow-sm'
                      : 'text-[#4A433B] hover:text-[#1F1C18] hover:bg-[#FAF7F2]/70'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        isActive
                          ? 'bg-[#E05A47] text-white'
                          : 'bg-[#E8E0D2] text-[#4A433B]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Icon className="w-3.5 h-3.5 hidden sm:inline" />
                    <span>{step.title}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Always-Visible Reset & Test Buttons + Active Story Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResetStudio}
            disabled={isAnyRunning}
            title="Reset video and generated Shorts to start a clean run"
            className="px-3.5 py-1.5 rounded-full bg-[#FAF7F2] border-2 border-[#1F1C18] text-xs font-bold text-[#1F1C18] hover:bg-[#E05A47] hover:text-white hover:border-[#E05A47] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onLoadTestRun}
            disabled={isAnyRunning}
            title="Pre-populate https://www.youtube.com/watch?v=lggpuoaP_C8 and all 4 Shorts for a <1 min demo"
            className={`px-3.5 py-1.5 rounded-full border-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              isTestMode && candidates.length > 0
                ? 'bg-[#2D8A61] border-[#1F1C18] text-white'
                : 'bg-[#F59E0B] border-[#1F1C18] text-[#1F1C18] hover:bg-[#D97706] hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Test</span>
          </button>

          {candidates.length > 0 && selectedCandidate && (
            <div className="flex items-center gap-2 bg-[#F3EDE2] border border-[#E8E0D2] rounded-full px-3 py-1.5">
              <select
                aria-label="Picked Story Moment"
                value={selectedCandidate.id}
                onChange={(e) => onSelectCandidate(e.target.value)}
                className="bg-transparent text-xs text-[#1F1C18] font-semibold focus:outline-none cursor-pointer max-w-[155px] truncate"
              >
                {candidates.map((c, idx) => (
                  <option key={c.id} value={c.id} className="bg-[#FAF7F2] text-[#1F1C18]">
                    Moment #{idx + 1}: {c.title}
                  </option>
                ))}
              </select>

              <span className="px-2 py-0.5 rounded-full bg-[#2D8A61] text-white text-xs font-bold mono-code">
                {(selectedCandidate.estimatedNetDurationSec ?? 40).toFixed(0)}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Warm Activity Banner when AI is working */}
      {activeCopy && (
        <div className="bg-[#F3EDE2] border-t border-[#E8E0D2]">
          <div className="w-full h-1.5 bg-[#E8E0D2] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#E05A47] via-[#F59E0B] to-[#2D8A61]"
            />
          </div>
          <div className="max-w-[1380px] mx-auto px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#E05A47]/15 text-[#E05A47] flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E05A47] text-white">
                  {activeCopy.badge}
                </span>
                <span className="text-xs sm:text-sm font-medium text-[#1F1C18]">
                  {activeCopy.headline}
                </span>
              </div>
            </div>
            <span className="mono-code text-xs font-bold text-[#2D8A61]">
              {progressPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Friendly Error & Try Again Bar */}
      {pipelineStatus.error && (
        <div className="bg-[#E05A47]/12 border-t border-[#E05A47]/35 px-4 lg:px-8 py-2.5">
          <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#9E2B1C]">
              <AlertTriangle className="w-4 h-4 text-[#E05A47] shrink-0" />
              <span>{pipelineStatus.error.message}</span>
            </div>
            <button
              type="button"
              onClick={onRetryFailedPass}
              className="px-3.5 py-1 rounded-full bg-[#E05A47] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#D44D3A] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
