import React, { useEffect, useId, useMemo, useRef } from 'react';
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
import {
  extractYoutubeVideoId,
  loadYouTubeIframeApi,
} from '../components/RealVideoPlayer';

export interface ShortCompositionProps {
  candidate: ShortEDL;
  previewObjectUrl?: string;
  forcedCameraMode?: VerticalLayoutMode | null;
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
  const rawId = useId().replace(/:/g, '');
  const primaryYtId = `remotion-yt-primary-${rawId}`;
  const secondaryYtId = `remotion-yt-secondary-${rawId}`;

  const primaryYtPlayerRef = useRef<any>(null);
  const secondaryYtPlayerRef = useRef<any>(null);
  const primaryReadyRef = useRef<boolean>(false);
  const secondaryReadyRef = useRef<boolean>(false);
  const lastSeekWallMsRef = useRef<number>(0);
  const prevFrameRef = useRef<number>(frame);
  const pauseTimerRef = useRef<number | null>(null);
  const hasPlayedOnceRef = useRef<boolean>(false);

  if (frame > 0) {
    hasPlayedOnceRef.current = true;
  }

  const timelineMs = Math.round((frame / fps) * 1000);
  const hookDurationMs = candidate.packaging?.hookBanner?.durationMs || 3000;
  const isHookActive = timelineMs <= hookDurationMs;

  const activeCut = getActiveCut(candidate.fineTimeline, timelineMs);
  const availableKeyframes =
    candidate.packaging?.framingKeyframes &&
    candidate.packaging.framingKeyframes.length > 0
      ? candidate.packaging.framingKeyframes
      : buildCoarseAutoFramingKeyframes(candidate.coarseSegments, candidate.title);

  // Bucket timelineMs to 2000ms intervals for smooth camera panning without rapid style updates
  const bucketedTimelineMs = Math.floor(timelineMs / 2000) * 2000;
  const rawKeyframe = getActiveFraming(availableKeyframes, bucketedTimelineMs);
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

  // In Auto mode (forcedCameraMode === null), keep a steady SINGLE_SPEAKER pane height while panning
  // across speakers so the YouTube iframe container never resizes mid-playback.
  const layout: VerticalLayoutMode =
    forcedCameraMode || 'SINGLE_SPEAKER';

  const primaryCropBox = activeKeyframe?.primaryCropBox || {
    x: 0.14,
    y: 0.06,
    width: 0.42,
    height: 0.88,
  };
  const secondaryCropBox = activeKeyframe?.secondaryCropBox || {
    x: 0.52,
    y: 0.05,
    width: 0.4,
    height: 0.5,
  };

  const primaryCropStyle = useMemo(
    () => computeCropViewportStyle(primaryCropBox),
    [
      primaryCropBox.x,
      primaryCropBox.y,
      primaryCropBox.width,
      primaryCropBox.height,
    ]
  );

  const secondaryCropStyle = useMemo(
    () => computeCropViewportStyle(secondaryCropBox),
    [
      secondaryCropBox.x,
      secondaryCropBox.y,
      secondaryCropBox.width,
      secondaryCropBox.height,
    ]
  );

  const primaryPanXPercent = useMemo(() => {
    const shift = (0.5 - primaryCropStyle.centerXPercent / 100) * 36;
    return Number((-50 + shift).toFixed(1));
  }, [primaryCropStyle.centerXPercent]);

  const secondaryPanXPercent = useMemo(() => {
    const shift = (0.5 - secondaryCropStyle.centerXPercent / 100) * 36;
    return Number((-50 + shift).toFixed(1));
  }, [secondaryCropStyle.centerXPercent]);

  const youtubeId = extractYoutubeVideoId(candidate.sourceVideoUri);
  const youtubePosterUrl = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : undefined;

  const continuousSourceSec = useMemo(() => {
    return Math.max(0, (candidate.rawSourceStartSec || 0) + timelineMs / 1000);
  }, [timelineMs, candidate.rawSourceStartSec]);

  // Mount persistent YT.Player instances once per YouTube ID so the video never reloads or flickers!
  useEffect(() => {
    if (!youtubeId || previewObjectUrl) return;
    let isMounted = true;
    primaryReadyRef.current = false;
    secondaryReadyRef.current = false;
    hasPlayedOnceRef.current = false;
    const initialStart = Math.max(0, Math.floor(candidate.rawSourceStartSec || 0));

    loadYouTubeIframeApi().then((YT) => {
      if (!isMounted || !YT || !YT.Player) return;

      const primaryEl = document.getElementById(primaryYtId);
      if (primaryEl) {
        if (primaryYtPlayerRef.current?.destroy) {
          try {
            primaryYtPlayerRef.current.destroy();
          } catch {
            // ignore
          }
        }
        primaryYtPlayerRef.current = new YT.Player(primaryYtId, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: initialStart,
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              primaryReadyRef.current = true;
              try {
                event.target.unMute?.();
                event.target.setVolume?.(100);
              } catch {
                // ignore
              }
            },
          },
        });
      }

      const secondaryEl = document.getElementById(secondaryYtId);
      if (secondaryEl) {
        if (secondaryYtPlayerRef.current?.destroy) {
          try {
            secondaryYtPlayerRef.current.destroy();
          } catch {
            // ignore
          }
        }
        secondaryYtPlayerRef.current = new YT.Player(secondaryYtId, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: initialStart,
            autoplay: 0,
            mute: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              secondaryReadyRef.current = true;
              try {
                event.target.mute?.();
              } catch {
                // ignore
              }
            },
          },
        });
      }
    });

    return () => {
      isMounted = false;
      if (pauseTimerRef.current) window.clearTimeout(pauseTimerRef.current);
      if (primaryYtPlayerRef.current?.destroy) {
        try {
          primaryYtPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }
      if (secondaryYtPlayerRef.current?.destroy) {
        try {
          secondaryYtPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [youtubeId, previewObjectUrl, primaryYtId, secondaryYtId, candidate.rawSourceStartSec]);

  // Synchronize YT.Player play/pause with Remotion frame progression without periodic seek thrashing
  useEffect(() => {
    if (!youtubeId || previewObjectUrl) return;
    const p = primaryYtPlayerRef.current;
    const s = secondaryYtPlayerRef.current;

    const frameDelta = frame - prevFrameRef.current;
    const frameChanged = frameDelta !== 0;
    const didUserScrubOrLoop =
      Math.abs(frameDelta) > 20 || (frameDelta < 0 && frame <= 5);
    prevFrameRef.current = frame;

    if (frameChanged && frame > 0) {
      if (p && primaryReadyRef.current) {
        try {
          const state = p.getPlayerState?.();
          if (state !== 1 && state !== 3) {
            p.unMute?.();
            p.setVolume?.(100);
            p.playVideo?.();
          }
          const now = Date.now();
          if (didUserScrubOrLoop && now - lastSeekWallMsRef.current > 1800) {
            lastSeekWallMsRef.current = now;
            p.seekTo?.(continuousSourceSec, true);
            if (s && secondaryReadyRef.current && layout !== 'SINGLE_SPEAKER') {
              s.seekTo?.(continuousSourceSec, true);
            }
          }
        } catch {
          // ignore
        }
      }
      if (s && secondaryReadyRef.current) {
        try {
          if (layout !== 'SINGLE_SPEAKER') {
            const secState = s.getPlayerState?.();
            if (secState !== 1 && secState !== 3) {
              s.mute?.();
              s.playVideo?.();
            }
          } else {
            s.pauseVideo?.();
          }
        } catch {
          // ignore
        }
      }

      if (pauseTimerRef.current) window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = window.setTimeout(() => {
        try {
          primaryYtPlayerRef.current?.pauseVideo?.();
          secondaryYtPlayerRef.current?.pauseVideo?.();
        } catch {
          // ignore
        }
      }, 950);
    } else if (frame === 0 && !hasPlayedOnceRef.current) {
      try {
        primaryYtPlayerRef.current?.pauseVideo?.();
        secondaryYtPlayerRef.current?.pauseVideo?.();
      } catch {
        // ignore
      }
    }
  }, [frame, youtubeId, previewObjectUrl, continuousSourceSec, layout]);

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

  // Persistent flex pane heights without CSS transitions so YouTube iframes never fire resize events
  const topPaneHeight =
    layout === 'SINGLE_SPEAKER'
      ? '100%'
      : layout === 'SPLIT_TOP_BOTTOM'
        ? '50%'
        : '70%';
  const bottomPaneHeight =
    layout === 'SINGLE_SPEAKER'
      ? '0%'
      : layout === 'SPLIT_TOP_BOTTOM'
        ? '50%'
        : '30%';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1F1C18',
        color: '#FAF7F2',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 9:16 Smart Auto-Framing Stage (Persistent 2-Pane Flex Container) */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* TOP / PRIMARY PANE (Always Mounted, Constant-Dimension YouTube Container) */}
        <div
          style={{
            height: topPaneHeight,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            borderBottom:
              layout === 'SPLIT_TOP_BOTTOM'
                ? '4px solid #FAF7F2'
                : layout === 'CONTENT_ZOOM_PIP'
                  ? '4px solid #F59E0B'
                  : 'none',
          }}
        >
          <video
            ref={(el) => {
              if (el) {
                el.muted = true;
                el.defaultMuted = true;
                el.playsInline = true;
                el.setAttribute('muted', '');
                el.setAttribute('playsinline', '');
              }
            }}
            playsInline
            muted
            className="hidden"
          />
          {previewObjectUrl ? (
            <Video
              src={previewObjectUrl}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: primaryCropStyle.objectPosition,
                transform: `scale(${primaryCropStyle.scale})`,
              }}
            />
          ) : youtubeId ? (
            <div className="w-full h-full relative overflow-hidden bg-[#1F1C18]">
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  zIndex: 2,
                  width: '230%',
                  height: '640px',
                  transform: `translate3d(${primaryPanXPercent}%, -50%, 0) scale(${primaryCropStyle.scale})`,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                  willChange: 'transform',
                }}
              >
                <div id={primaryYtId} className="w-full h-full" />
              </div>

              {!hasPlayedOnceRef.current && frame === 0 && youtubePosterUrl && (
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
                    zIndex: 3,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: primaryCropStyle.objectPosition,
                    transform: `scale(${primaryCropStyle.scale})`,
                    filter: 'contrast(1.04) saturate(1.06)',
                  }}
                />
              )}
            </div>
          ) : null}

          {!isHookActive && layout === 'SINGLE_SPEAKER' && (
            <div className="relative z-10 p-4 flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-xs font-bold shadow">
                🎯 1 Speaker Focus
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#1F1C18]/85 text-[#FAF7F2] text-xs font-semibold">
                {activeKeyframe?.activeSpeaker || activeCut?.speaker || 'Host'}
              </span>
            </div>
          )}

          {!isHookActive && layout === 'SPLIT_TOP_BOTTOM' && (
            <div className="relative z-10 p-3 flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-[#E05A47] text-white text-[11px] font-bold shadow">
                {activeKeyframe?.activeSpeaker || 'Speaker 1'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[10px] font-bold">
                👥 Top &amp; Bottom Split
              </span>
            </div>
          )}

          {!isHookActive && layout === 'CONTENT_ZOOM_PIP' && (
            <div className="relative z-10 p-3 flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-[#F59E0B] text-[#1F1C18] text-[11px] font-bold shadow">
                🔍 {activeKeyframe?.screenContentTitle || 'Screen Share Zoom'}
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM / SECONDARY PANE (Always Mounted, Constant-Dimension YouTube Container) */}
        <div
          style={{
            height: bottomPaneHeight,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            opacity: layout === 'SINGLE_SPEAKER' ? 0 : 1,
            pointerEvents: 'none',
          }}
        >
          {previewObjectUrl ? (
            <Video
              src={previewObjectUrl}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: secondaryCropStyle.objectPosition,
                transform: `scale(${secondaryCropStyle.scale})`,
              }}
            />
          ) : youtubeId ? (
            <div className="w-full h-full relative overflow-hidden bg-[#1F1C18]">
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  zIndex: 2,
                  width: '230%',
                  height: '640px',
                  transform: `translate3d(${secondaryPanXPercent}%, -50%, 0) scale(${secondaryCropStyle.scale})`,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                  willChange: 'transform',
                }}
              >
                <div id={secondaryYtId} className="w-full h-full" />
              </div>

              {!hasPlayedOnceRef.current && frame === 0 && youtubePosterUrl && (
                <img
                  src={`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`}
                  onError={(e) => {
                    if (e.currentTarget.src !== youtubePosterUrl) {
                      e.currentTarget.src = youtubePosterUrl;
                    }
                  }}
                  alt="YouTube Secondary Frame"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 3,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: secondaryCropStyle.objectPosition,
                    transform: `scale(${secondaryCropStyle.scale})`,
                    filter: 'contrast(1.04) saturate(1.06)',
                  }}
                />
              )}
            </div>
          ) : null}

          {layout === 'SPLIT_TOP_BOTTOM' && (
            <div className="relative z-10 p-3 flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-[#2D8A61] text-white text-[11px] font-bold shadow">
                {activeKeyframe?.secondarySpeaker || 'Speaker 2'}
              </span>
            </div>
          )}

          {layout === 'CONTENT_ZOOM_PIP' && (
            <div className="relative z-10 p-3 flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[11px] font-bold shadow">
                {activeKeyframe?.activeSpeaker || activeCut?.speaker || 'Speaker Face'}
              </span>
            </div>
          )}
        </div>
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
