import React from 'react';
import {
  AbsoluteFill,
  Video,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  BRollCue,
  DynamicCaptionGroup,
  FineTimelineCut,
  FramingKeyframe,
  ShortEDL,
  VerticalLayoutMode,
} from '../types/edl';
import {
  applyFramingLayoutPreset,
  buildCoarseAutoFramingKeyframes,
  computeCropViewportStyle,
  formatSecondsToMMSS,
} from '../utils/edlCompiler';

export interface ShortCompositionProps {
  candidate: ShortEDL;
  previewObjectUrl?: string;
  forcedCameraMode?: VerticalLayoutMode | null;
}

function extractYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getActiveCut(
  fineTimeline: FineTimelineCut[],
  timelineMs: number
): FineTimelineCut | undefined {
  if (fineTimeline.length === 0) return undefined;
  return (
    fineTimeline.find(
      (c) => timelineMs >= c.timelineStartMs && timelineMs <= c.timelineEndMs
    ) || fineTimeline[fineTimeline.length - 1]
  );
}

function getActiveFraming(
  keyframes: FramingKeyframe[],
  timelineMs: number
): FramingKeyframe | undefined {
  if (keyframes.length === 0) return undefined;
  return (
    keyframes.find((k) => timelineMs >= k.startMs && timelineMs <= k.endMs) ||
    keyframes[keyframes.length - 1]
  );
}

function getActiveCaptionGroup(
  groups: DynamicCaptionGroup[],
  timelineMs: number
): DynamicCaptionGroup | undefined {
  return groups.find(
    (g) => timelineMs >= g.timelineStartMs && timelineMs <= g.timelineEndMs
  );
}

function getActiveBRoll(
  cues: BRollCue[],
  timelineMs: number
): BRollCue | undefined {
  return cues.find((b) => timelineMs >= b.startMs && timelineMs <= b.endMs);
}

export const ShortComposition: React.FC<ShortCompositionProps> = ({
  candidate,
  previewObjectUrl,
  forcedCameraMode,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const timelineMs = Math.round((frame / fps) * 1000);
  const hookDurationMs = candidate.packaging?.hookBanner?.durationMs || 3000;
  const isHookActive = timelineMs <= hookDurationMs;

  const activeCut = getActiveCut(candidate.fineTimeline, timelineMs);
  const availableKeyframes =
    candidate.packaging?.framingKeyframes &&
    candidate.packaging.framingKeyframes.length > 0
      ? candidate.packaging.framingKeyframes
      : buildCoarseAutoFramingKeyframes(candidate.coarseSegments, candidate.title);

  const rawKeyframe = getActiveFraming(availableKeyframes, timelineMs);
  const activeKeyframe =
    rawKeyframe && forcedCameraMode
      ? applyFramingLayoutPreset(rawKeyframe, forcedCameraMode)
      : rawKeyframe;

  const activeCaptionGroup = getActiveCaptionGroup(
    candidate.packaging?.dynamicCaptions || [],
    timelineMs
  );
  const activeBRoll = getActiveBRoll(
    candidate.packaging?.bRollCues || [],
    timelineMs
  );

  const layout: VerticalLayoutMode =
    forcedCameraMode || activeKeyframe?.layout || 'SINGLE_SPEAKER';

  const primaryCropStyle = computeCropViewportStyle(
    activeKeyframe?.primaryCropBox
  );
  const secondaryCropStyle = computeCropViewportStyle(
    activeKeyframe?.secondaryCropBox || {
      x: 0.52,
      y: 0.05,
      width: 0.4,
      height: 0.5,
    }
  );

  const youtubeId = extractYoutubeVideoId(candidate.sourceVideoUri);
  const youtubePosterUrl = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : undefined;
  const youtubeStartSec = Math.max(
    0,
    Math.floor(
      (activeCut?.sourceStartMs ?? candidate.rawSourceStartSec * 1000) / 1000
    )
  );

  const hookEntrance = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 180,
      mass: 0.75,
    },
  });

  const hookExitOpacity = interpolate(
    timelineMs,
    [hookDurationMs - 350, hookDurationMs],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const cutStartFrame =
    activeCut && Number.isFinite(activeCut.timelineStartMs)
      ? Math.floor((activeCut.timelineStartMs / 1000) * fps)
      : 0;
  const localCutFrame = Number.isFinite(frame - cutStartFrame)
    ? Math.max(0, frame - cutStartFrame)
    : 0;
  const cameraTransition = spring({
    frame: localCutFrame,
    fps,
    config: {
      damping: 18,
      stiffness: 120,
    },
  });

  const zoomScale = interpolate(cameraTransition, [0, 1], [1.03, 1.0]);

  const renderRealVideoFeed = (
    cropStyle: ReturnType<typeof computeCropViewportStyle>,
    keySuffix: string,
    muteFeed = false
  ) => {
    if (previewObjectUrl) {
      return (
        <Video
          key={keySuffix}
          src={previewObjectUrl}
          muted={muteFeed}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: cropStyle.objectPosition,
            transform: `scale(${cropStyle.scale})`,
          }}
        />
      );
    }
    if (youtubeId) {
      return (
        <div className="w-full h-full relative overflow-hidden bg-[#1F1C18]">
          {youtubePosterUrl && (
            <img
              src={`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`}
              onError={(e) => {
                if (e.currentTarget.src !== youtubePosterUrl) {
                  e.currentTarget.src = youtubePosterUrl;
                }
              }}
              alt="YouTube Frame"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: cropStyle.objectPosition,
                transform: `scale(${cropStyle.scale})`,
                filter: 'contrast(1.04) saturate(1.06)',
              }}
            />
          )}
          {frame > 0 && !muteFeed && (
            <iframe
              key={`${youtubeId}-${keySuffix}-${youtubeStartSec}`}
              title={`YouTube 9:16 Feed ${keySuffix}`}
              src={`https://www.youtube.com/embed/${youtubeId}?start=${youtubeStartSec}&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
              style={{
                position: 'relative',
                zIndex: 2,
                width: `${cropStyle.iframeWidthPercent}%`,
                height: '100%',
                marginLeft: `${cropStyle.iframeMarginLeftPercent}%`,
                border: 'none',
                pointerEvents: 'none',
              }}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            />
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1F1C18',
        color: '#FAF7F2',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 9:16 Smart Auto-Framing Stage */}
      <AbsoluteFill
        style={{
          transform: `scale(${zoomScale})`,
        }}
      >
        {layout === 'SINGLE_SPEAKER' && (
          <div className="w-full h-full relative overflow-hidden bg-[#1F1C18]">
            <div className="absolute inset-0">
              {renderRealVideoFeed(primaryCropStyle, 'single-main')}
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                background:
                  'linear-gradient(180deg, rgba(31,28,24,0.45) 0%, transparent 28%, transparent 68%, rgba(31,28,24,0.82) 100%)',
              }}
            />
            {!isHookActive && (
              <div className="relative z-10 p-4 flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-xs font-bold shadow">
                  🎯 1 Speaker Focus
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#1F1C18]/85 text-[#FAF7F2] text-xs font-semibold">
                  {activeKeyframe?.activeSpeaker || activeCut?.speaker || 'Host'}
                </span>
              </div>
            )}
          </div>
        )}

        {layout === 'SPLIT_TOP_BOTTOM' && (
          <div className="w-full h-full flex flex-col bg-[#1F1C18]">
            {/* Top 50%: Speaker 1 */}
            <div className="h-1/2 relative border-b-4 border-[#FAF7F2] overflow-hidden">
              <div className="absolute inset-0">
                {renderRealVideoFeed(primaryCropStyle, 'split-top')}
              </div>
              {!isHookActive && (
                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E05A47] text-white text-[11px] font-bold shadow">
                    {activeKeyframe?.activeSpeaker || 'Speaker 1'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[10px] font-bold">
                    👥 Top &amp; Bottom Split
                  </span>
                </div>
              )}
            </div>

            {/* Bottom 50%: Speaker 2 synced */}
            <div className="h-1/2 relative overflow-hidden">
              <div className="absolute inset-0">
                {renderRealVideoFeed(secondaryCropStyle, 'split-bottom', true)}
              </div>
              <div className="relative z-10 p-3 flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-[#2D8A61] text-white text-[11px] font-bold shadow">
                  {activeKeyframe?.secondarySpeaker || 'Speaker 2'}
                </span>
              </div>
            </div>
          </div>
        )}

        {layout === 'CONTENT_ZOOM_PIP' && (
          <div className="w-full h-full flex flex-col bg-[#1F1C18]">
            {/* Top 70%: Zoomed Screen Share */}
            <div className="h-[70%] relative border-b-4 border-[#F59E0B] overflow-hidden">
              <div className="absolute inset-0">
                {renderRealVideoFeed(primaryCropStyle, 'pip-screen')}
              </div>
              {!isHookActive && (
                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-[#F59E0B] text-[#1F1C18] text-[11px] font-bold shadow">
                    🔍 {activeKeyframe?.screenContentTitle || 'Screen Share Zoom'}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom 30%: Speaker Face Cam */}
            <div className="h-[30%] relative overflow-hidden bg-[#2B2620]">
              <div className="absolute inset-0">
                {renderRealVideoFeed(secondaryCropStyle, 'pip-face', true)}
              </div>
              <div className="relative z-10 p-3 flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[11px] font-bold shadow">
                  {activeKeyframe?.activeSpeaker || activeCut?.speaker || 'Speaker Face'}
                </span>
              </div>
            </div>
          </div>
        )}
      </AbsoluteFill>

      {/* Optional Visual Cutaway Idea Pill */}
      {activeBRoll && !isHookActive && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 16,
            right: 16,
            zIndex: 30,
          }}
          className="rounded-2xl bg-[#FAF7F2]/95 text-[#1F1C18] border-2 border-[#2D8A61] px-3.5 py-2.5 shadow-lg"
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-[#2D8A61] mb-0.5">
            <span>✨ B-Roll Cutaway Idea</span>
            <span className="mono-code">
              {formatSecondsToMMSS(activeBRoll.startMs / 1000)}
            </span>
          </div>
          <div className="text-xs font-semibold text-[#1F1C18]">
            {activeBRoll.visualPrompt}
          </div>
        </div>
      )}

      {/* 3-Second Warm Hook Sticker at Top (0ms - 3000ms) */}
      {isHookActive && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 16,
            right: 16,
            zIndex: 40,
            opacity: hookExitOpacity,
            transform: `translateY(${interpolate(hookEntrance, [0, 1], [-24, 0])}px) scale(${interpolate(
              hookEntrance,
              [0, 1],
              [0.9, 1]
            )}) rotate(-1deg)`,
          }}
          className="rounded-2xl bg-[#F59E0B] text-[#1F1C18] p-3.5 shadow-[0_14px_30px_rgba(31,28,24,0.45)] border-2 border-[#FAF7F2]"
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#1F1C18]/80 mb-0.5">
            <span>🔥 3-Second Opening Hook</span>
            <span className="mono-code">
              {((hookDurationMs - timelineMs) / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="text-base font-extrabold tracking-tight text-[#1F1C18] uppercase leading-tight">
            {candidate.packaging?.hookBanner?.text || candidate.hookText}
          </div>
        </div>
      )}

      {/* Bouncy Word-by-Word Karaoke Captions */}
      {activeCaptionGroup && (
        <div
          style={{
            position: 'absolute',
            bottom: 42,
            left: 14,
            right: 14,
            zIndex: 45,
          }}
          className="rounded-2xl bg-[#1F1C18]/90 backdrop-blur-md border-2 border-[#FAF7F2]/30 px-3.5 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
            {activeCaptionGroup.words.map((w) => {
              const isCurrentWord =
                timelineMs >= w.timelineStartMs && timelineMs <= w.timelineEndMs;

              const wordStartFrame = Math.floor((w.timelineStartMs / 1000) * fps);
              const popProgress = isCurrentWord
                ? spring({
                    frame: Math.max(0, frame - wordStartFrame),
                    fps,
                    config: { damping: 10, stiffness: 240 },
                  })
                : 0;

              const wordScale = isCurrentWord
                ? interpolate(popProgress, [0, 1], [1.0, 1.16])
                : 1.0;

              const displayWord = w.word
                .replace(/\[LAUGHTER\]/gi, '')
                .replace(/\[SIGH\]/gi, '')
                .replace(/\[EMPHASIS\]/gi, '')
                .trim();

              if (!displayWord) return null;

              return (
                <span
                  key={w.wordId}
                  style={{
                    transform: `scale(${wordScale})`,
                    display: 'inline-block',
                  }}
                  className={`px-2 py-0.5 rounded-xl font-bold text-base transition-colors ${
                    isCurrentWord
                      ? 'bg-[#F59E0B] text-[#1F1C18] shadow-sm'
                      : 'text-[#FAF7F2]'
                  }`}
                >
                  {displayWord}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
