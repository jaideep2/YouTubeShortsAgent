import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Columns,
  FastForward,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  FramingKeyframe,
  ShortEDL,
  VerticalLayoutMode,
} from '../types/edl';
import {
  computeCropViewportStyle,
  formatSecondsToMMSS,
  resolveActiveFramingAtSourceSec,
} from '../utils/edlCompiler';

export interface SkipRangeSec {
  startSec: number;
  endSec: number;
  label?: string;
}

interface RealVideoPlayerProps {
  youtubeUrl?: string;
  previewObjectUrl?: string;
  startSec?: number;
  endSec?: number;
  skipRanges?: SkipRangeSec[];
  seekRequestSec?: number | null;
  onTimeUpdateSec?: (currentSec: number) => void;
  aspectClassName?: string;
  badgeText?: string;
  compactControls?: boolean;
  mutedByDefault?: boolean;
  reframedCandidate?: ShortEDL;
  onSelectFramingMode?: (mode: VerticalLayoutMode | null) => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    _ytApiCallbacks?: Array<() => void>;
  }
}

export function extractYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function loadYouTubeIframeApi(): Promise<any> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    if (!window._ytApiCallbacks) {
      window._ytApiCallbacks = [];
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        window._ytApiCallbacks?.forEach((cb) => cb());
        window._ytApiCallbacks = [];
      };

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    window._ytApiCallbacks.push(() => resolve(window.YT));
  });
}

const DEFAULT_FALLBACK_FRAMING: FramingKeyframe = {
  id: 'default-916-framing',
  startMs: 0,
  endMs: 60000,
  layout: 'SINGLE_SPEAKER',
  activeSpeaker: 'Speaker 1',
  topRatioPercent: 100,
  bottomRatioPercent: 0,
  primaryCropBox: { x: 0.14, y: 0.06, width: 0.42, height: 0.88 },
  rationale: '9:16 vertical speaker framing',
};

const FRAMING_MODE_META: Record<
  VerticalLayoutMode,
  {
    shortLabel: string;
    badgeLabel: string;
    pillTone: string;
  }
> = {
  SINGLE_SPEAKER: {
    shortLabel: '1 Speaker',
    badgeLabel: '🎯 1 Speaker',
    pillTone: 'bg-[#E05A47] text-white',
  },
  SPLIT_TOP_BOTTOM: {
    shortLabel: 'Top & Bottom',
    badgeLabel: '👥 Top & Bottom',
    pillTone: 'bg-[#2D8A61] text-white',
  },
  CONTENT_ZOOM_PIP: {
    shortLabel: 'Screen + Face',
    badgeLabel: '🔍 Screen + Face',
    pillTone: 'bg-[#F59E0B] text-[#1F1C18]',
  },
};

export const RealVideoPlayer: React.FC<RealVideoPlayerProps> = ({
  youtubeUrl,
  previewObjectUrl,
  startSec = 0,
  endSec,
  skipRanges = [],
  seekRequestSec = null,
  onTimeUpdateSec,
  badgeText,
  compactControls = false,
  mutedByDefault = false,
  reframedCandidate,
  onSelectFramingMode,
}) => {
  const rawId = useId().replace(/:/g, '');
  const primaryYtContainerId = `yt-primary-pane-${rawId}`;
  const secondaryYtContainerId = `yt-secondary-pane-${rawId}`;

  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const primaryYtPlayerRef = useRef<any>(null);
  const secondaryYtPlayerRef = useRef<any>(null);
  const primaryYtReadyRef = useRef<boolean>(false);
  const secondaryYtReadyRef = useRef<boolean>(false);
  const pendingPlayRef = useRef<boolean>(false);

  const skipRangesRef = useRef<SkipRangeSec[]>(skipRanges);
  skipRangesRef.current = skipRanges;

  // Prevent infinite seek loops across skip ranges
  const jumpedRangesRef = useRef<Set<string>>(new Set());
  const lastSeekTimestampMsRef = useRef<number>(0);

  // Never autoplay on load: isPlaying always starts false and only plays when clicked
  const [currentSec, setCurrentSec] = useState<number>(startSec);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasStartedOnce, setHasStartedOnce] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(mutedByDefault);
  const [skippedToast, setSkippedToast] = useState<string | null>(null);
  const [forcedMode, setForcedMode] = useState<VerticalLayoutMode | null>(null);

  const youtubeId = extractYoutubeVideoId(
    youtubeUrl || reframedCandidate?.sourceVideoUri
  );
  const youtubePosterUrl = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : undefined;

  useEffect(() => {
    setCurrentSec(startSec);
    setIsPlaying(false);
    setHasStartedOnce(false);
    jumpedRangesRef.current.clear();
  }, [startSec, reframedCandidate?.id, youtubeId, previewObjectUrl]);

  // Bucket currentSec to integer seconds for framing lookup so we don't recalculate styles every 150ms
  const framingLookupSec = Math.floor(currentSec);

  const activeFraming: FramingKeyframe = useMemo(() => {
    if (!reframedCandidate) {
      if (forcedMode === 'SPLIT_TOP_BOTTOM') {
        return {
          ...DEFAULT_FALLBACK_FRAMING,
          layout: 'SPLIT_TOP_BOTTOM',
          activeSpeaker: 'Speaker 1',
          secondarySpeaker: 'Speaker 2',
          topRatioPercent: 50,
          bottomRatioPercent: 50,
          primaryCropBox: { x: 0.08, y: 0.05, width: 0.4, height: 0.5 },
          secondaryCropBox: { x: 0.52, y: 0.05, width: 0.4, height: 0.5 },
        };
      }
      if (forcedMode === 'CONTENT_ZOOM_PIP') {
        return {
          ...DEFAULT_FALLBACK_FRAMING,
          layout: 'CONTENT_ZOOM_PIP',
          activeSpeaker: 'Speaker 1',
          screenContentTitle: 'Shared Screen',
          topRatioPercent: 70,
          bottomRatioPercent: 30,
          primaryCropBox: { x: 0.06, y: 0.04, width: 0.88, height: 0.7 },
          secondaryCropBox: { x: 0.58, y: 0.68, width: 0.34, height: 0.3 },
        };
      }
      return DEFAULT_FALLBACK_FRAMING;
    }
    return resolveActiveFramingAtSourceSec(
      reframedCandidate,
      framingLookupSec,
      forcedMode
    );
  }, [reframedCandidate, framingLookupSec, forcedMode]);

  const primaryCropBox = activeFraming.primaryCropBox;
  const secondaryCropBox = activeFraming.secondaryCropBox || {
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

  // Sync secondary HTML5 video element for 2-pane split layouts
  const syncSecondaryHtmlVideo = (targetTime: number, playState?: boolean) => {
    const vid = secondaryVideoRef.current;
    if (!vid) return;
    if (Math.abs(vid.currentTime - targetTime) > 0.3) {
      vid.currentTime = targetTime;
    }
    if (playState === true && vid.paused) {
      vid.play().catch(() => {});
    } else if (playState === false && !vid.paused) {
      vid.pause();
    }
  };

  // Sync secondary YouTube player for 2-pane split layouts
  const syncSecondaryYtPlayer = (targetTime: number, playState?: boolean) => {
    const secPlayer = secondaryYtPlayerRef.current;
    if (!secPlayer || !secondaryYtReadyRef.current) return;
    try {
      if (typeof secPlayer.getCurrentTime === 'function') {
        const cur = Number(secPlayer.getCurrentTime() || 0);
        if (Math.abs(cur - targetTime) > 1.2) {
          secPlayer.seekTo?.(targetTime, true);
        }
      }
      if (playState === true) {
        secPlayer.playVideo?.();
      } else if (playState === false) {
        secPlayer.pauseVideo?.();
      }
    } catch {
      // ignore transient YT iframe readiness errors
    }
  };

  // Check and apply skip ranges with cooldown and visited-set so it NEVER loops or flickers
  const checkAndApplySkips = (
    sec: number,
    isYouTubeSource: boolean,
    seekFn: (targetSec: number) => void
  ): number => {
    const now = Date.now();
    // Cooldown after any seek so the player has time to settle on the new frame
    if (now - lastSeekTimestampMsRef.current < 1100) {
      return sec;
    }

    if (endSec && sec >= endSec + 0.35) {
      lastSeekTimestampMsRef.current = now;
      jumpedRangesRef.current.clear();
      seekFn(startSec);
      return startSec;
    }

    // For YouTube embeds, keyframe seeks are ~1.2s granular; only auto-jump ranges >= 1.2s
    // so short 0.2s micro-cuts don't cause YouTube iframe re-buffering loops.
    const minSkipDuration = isYouTubeSource ? 1.2 : 0.15;

    for (const r of skipRangesRef.current) {
      const duration = r.endSec - r.startSec;
      const rangeKey = `${r.startSec.toFixed(2)}-${r.endSec.toFixed(2)}`;
      if (
        duration >= minSkipDuration &&
        !jumpedRangesRef.current.has(rangeKey) &&
        sec >= r.startSec &&
        sec < r.endSec - 0.1
      ) {
        jumpedRangesRef.current.add(rangeKey);
        lastSeekTimestampMsRef.current = now;
        seekFn(r.endSec);
        const saved = duration.toFixed(1);
        setSkippedToast(r.label || `Skipped ${saved}s`);
        setTimeout(() => setSkippedToast(null), 1400);
        return r.endSec;
      }
    }
    return sec;
  };

  // Initialize persistent YouTube IFrame API players directly inside the visible 9:16 panes
  useEffect(() => {
    if (!youtubeId || previewObjectUrl) return;
    let isMounted = true;
    let pollTimer: number | null = null;
    primaryYtReadyRef.current = false;
    secondaryYtReadyRef.current = false;

    const initialStart = Math.max(0, Math.floor(startSec));

    loadYouTubeIframeApi().then((YT) => {
      if (!isMounted || !YT || !YT.Player) return;

      const primaryEl = document.getElementById(primaryYtContainerId);
      if (primaryEl) {
        if (primaryYtPlayerRef.current?.destroy) {
          try {
            primaryYtPlayerRef.current.destroy();
          } catch {
            // ignore
          }
        }

        primaryYtPlayerRef.current = new YT.Player(primaryYtContainerId, {
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
              primaryYtReadyRef.current = true;
              try {
                if (mutedByDefault) {
                  event.target.mute?.();
                } else {
                  event.target.unMute?.();
                  event.target.setVolume?.(100);
                }
                if (pendingPlayRef.current) {
                  pendingPlayRef.current = false;
                  if (!mutedByDefault) {
                    event.target.unMute?.();
                    event.target.setVolume?.(100);
                  }
                  event.target.playVideo?.();
                }
              } catch {
                // ignore
              }
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // YT.PlayerState.PLAYING === 1, PAUSED === 2, ENDED === 0
              if (event.data === 1) {
                setIsPlaying(true);
                setHasStartedOnce(true);
                const cur = Number(event.target?.getCurrentTime?.() || startSec);
                syncSecondaryYtPlayer(cur, true);
              } else if (event.data === 2 || event.data === 0) {
                setIsPlaying(false);
                syncSecondaryYtPlayer(
                  Number(event.target?.getCurrentTime?.() || startSec),
                  false
                );
              }
            },
          },
        });
      }

      const secondaryEl = document.getElementById(secondaryYtContainerId);
      if (secondaryEl) {
        if (secondaryYtPlayerRef.current?.destroy) {
          try {
            secondaryYtPlayerRef.current.destroy();
          } catch {
            // ignore
          }
        }

        secondaryYtPlayerRef.current = new YT.Player(secondaryYtContainerId, {
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
              secondaryYtReadyRef.current = true;
              try {
                event.target.mute?.();
              } catch {
                // ignore
              }
            },
          },
        });
      }

      pollTimer = window.setInterval(() => {
        const p = primaryYtPlayerRef.current;
        if (
          p &&
          primaryYtReadyRef.current &&
          typeof p.getCurrentTime === 'function' &&
          typeof p.getPlayerState === 'function'
        ) {
          if (p.getPlayerState() !== 1) return;
          const t = Number(p.getCurrentTime() || 0);
          if (t > 0) {
            const nextT = checkAndApplySkips(t, true, (target) => {
              p.seekTo?.(target, true);
              syncSecondaryYtPlayer(target, true);
            });
            setCurrentSec(nextT);
            onTimeUpdateSec?.(nextT);
          }
        }
      }, 250);
    });

    return () => {
      isMounted = false;
      if (pollTimer) window.clearInterval(pollTimer);
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
  }, [youtubeId, previewObjectUrl, primaryYtContainerId, secondaryYtContainerId]);

  // Respond to external seek requests (when user clicks a Story Beat pill)
  useEffect(() => {
    if (seekRequestSec === null || seekRequestSec === undefined) return;
    handleSeekToSec(seekRequestSec);
  }, [seekRequestSec]);

  const handleSeekToSec = (targetSec: number) => {
    jumpedRangesRef.current.clear();
    lastSeekTimestampMsRef.current = Date.now();
    setHasStartedOnce(true);

    if (primaryVideoRef.current) {
      primaryVideoRef.current.currentTime = targetSec;
      primaryVideoRef.current.muted = isMuted;
      primaryVideoRef.current.play().catch(() => {});
      syncSecondaryHtmlVideo(targetSec, true);
      setIsPlaying(true);
      setCurrentSec(targetSec);
      onTimeUpdateSec?.(targetSec);
      return;
    }

    const p = primaryYtPlayerRef.current;
    if (p && primaryYtReadyRef.current && typeof p.seekTo === 'function') {
      if (!isMuted) {
        p.unMute?.();
        p.setVolume?.(100);
      }
      p.seekTo(targetSec, true);
      p.playVideo?.();
      syncSecondaryYtPlayer(targetSec, true);
      setIsPlaying(true);
      setCurrentSec(targetSec);
      onTimeUpdateSec?.(targetSec);
    } else {
      pendingPlayRef.current = true;
      setCurrentSec(targetSec);
      setIsPlaying(true);
    }
  };

  const handleTogglePlay = () => {
    if (primaryVideoRef.current) {
      if (primaryVideoRef.current.paused) {
        primaryVideoRef.current.muted = isMuted;
        primaryVideoRef.current.play().catch(() => {});
        syncSecondaryHtmlVideo(primaryVideoRef.current.currentTime, true);
        setIsPlaying(true);
        setHasStartedOnce(true);
      } else {
        primaryVideoRef.current.pause();
        syncSecondaryHtmlVideo(primaryVideoRef.current.currentTime, false);
        setIsPlaying(false);
      }
      return;
    }

    const p = primaryYtPlayerRef.current;
    if (p && primaryYtReadyRef.current) {
      if (isPlaying && typeof p.pauseVideo === 'function') {
        p.pauseVideo();
        syncSecondaryYtPlayer(currentSec, false);
        setIsPlaying(false);
      } else if (typeof p.playVideo === 'function') {
        if (!isMuted) {
          p.unMute?.();
          p.setVolume?.(100);
        }
        if (!hasStartedOnce && startSec > 0 && typeof p.seekTo === 'function') {
          lastSeekTimestampMsRef.current = Date.now();
          p.seekTo(startSec, true);
          syncSecondaryYtPlayer(startSec, true);
        } else {
          syncSecondaryYtPlayer(currentSec, true);
        }
        p.playVideo();
        setHasStartedOnce(true);
        setIsPlaying(true);
      }
    } else {
      pendingPlayRef.current = true;
      setHasStartedOnce(true);
      setIsPlaying(true);
    }
  };

  const handleRestartMoment = () => {
    jumpedRangesRef.current.clear();
    handleSeekToSec(startSec);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (primaryVideoRef.current) {
      primaryVideoRef.current.muted = nextMuted;
      return;
    }

    const p = primaryYtPlayerRef.current;
    if (p && primaryYtReadyRef.current) {
      if (nextMuted) {
        p.mute?.();
      } else {
        p.unMute?.();
        p.setVolume?.(100);
      }
    }
  };

  const handleChooseFramingMode = (mode: VerticalLayoutMode | null) => {
    setForcedMode(mode);
    onSelectFramingMode?.(mode);
  };

  const layoutMode = activeFraming.layout;
  const modeMeta = FRAMING_MODE_META[layoutMode];
  const hasMedia = Boolean(previewObjectUrl || youtubeId);

  // Compute persistent pane heights so the video/iframe DOM nodes NEVER unmount when switching modes!
  const topPaneHeightClass =
    layoutMode === 'SINGLE_SPEAKER'
      ? 'h-full'
      : layoutMode === 'SPLIT_TOP_BOTTOM'
        ? 'h-1/2 border-b-2 border-[#FAF7F2]'
        : 'h-[70%] border-b-2 border-[#F59E0B]';

  const bottomPaneHeightClass =
    layoutMode === 'SINGLE_SPEAKER'
      ? 'h-0 opacity-0 pointer-events-none overflow-hidden'
      : layoutMode === 'SPLIT_TOP_BOTTOM'
        ? 'h-1/2 opacity-100'
        : 'h-[30%] opacity-100';

  return (
    <div className="space-y-3">
      {/* Compact 9:16 Camera Framing Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2]">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-[#E05A47]" />
          <span className="text-xs font-bold text-[#1F1C18]">9:16 Reframed</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${modeMeta.pillTone}`}
          >
            {modeMeta.badgeLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => handleChooseFramingMode(null)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              forcedMode === null
                ? 'bg-[#1F1C18] text-[#FAF7F2] border-[#1F1C18]'
                : 'bg-[#FAF7F2] text-[#4A433B] border-[#E8E0D2] hover:border-[#1F1C18]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#F59E0B]" />
            <span>Auto</span>
          </button>

          <button
            type="button"
            onClick={() => handleChooseFramingMode('SINGLE_SPEAKER')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              forcedMode === 'SINGLE_SPEAKER'
                ? 'bg-[#E05A47] text-white border-[#E05A47]'
                : 'bg-[#FAF7F2] text-[#4A433B] border-[#E8E0D2] hover:border-[#E05A47]'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>1 Speaker</span>
          </button>

          <button
            type="button"
            onClick={() => handleChooseFramingMode('SPLIT_TOP_BOTTOM')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              forcedMode === 'SPLIT_TOP_BOTTOM'
                ? 'bg-[#2D8A61] text-white border-[#2D8A61]'
                : 'bg-[#FAF7F2] text-[#4A433B] border-[#E8E0D2] hover:border-[#2D8A61]'
            }`}
          >
            <Columns className="w-3 h-3" />
            <span>Top/Bottom</span>
          </button>

          <button
            type="button"
            onClick={() => handleChooseFramingMode('CONTENT_ZOOM_PIP')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              forcedMode === 'CONTENT_ZOOM_PIP'
                ? 'bg-[#F59E0B] text-[#1F1C18] border-[#F59E0B]'
                : 'bg-[#FAF7F2] text-[#4A433B] border-[#E8E0D2] hover:border-[#F59E0B]'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span>Screen + Face</span>
          </button>
        </div>
      </div>

      {/* ONLY the 9:16 Reframed Vertical Output (Persistent DOM — Zero Flicker, Real Sound) */}
      <div className="flex flex-col items-center bg-[#FAF7F2] p-4 rounded-3xl border-2 border-[#E8E0D2]">
        <div
          onClick={() => {
            if (hasMedia) handleTogglePlay();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && hasMedia) {
              e.preventDefault();
              handleTogglePlay();
            }
          }}
          aria-label={isPlaying ? 'Pause 9:16 Short' : 'Play 9:16 Short'}
          className="w-full max-w-[260px] aspect-[9/16] rounded-3xl overflow-hidden border-4 border-[#1F1C18] shadow-[0_18px_38px_-12px_rgba(31,28,24,0.35)] bg-[#1F1C18] relative cursor-pointer group flex flex-col"
        >
          {/* TOP / PRIMARY PANE (Always Mounted so Video/Audio Never Resets or Flickers) */}
          <div
            className={`w-full relative overflow-hidden transition-all duration-300 ${topPaneHeightClass}`}
          >
            {previewObjectUrl ? (
              <video
                ref={primaryVideoRef}
                src={previewObjectUrl}
                playsInline
                muted={isMuted}
                onPlay={(e) => {
                  setIsPlaying(true);
                  setHasStartedOnce(true);
                  syncSecondaryHtmlVideo(e.currentTarget.currentTime, true);
                }}
                onPause={(e) => {
                  setIsPlaying(false);
                  syncSecondaryHtmlVideo(e.currentTarget.currentTime, false);
                }}
                onLoadedMetadata={(e) => {
                  if (startSec > 0) {
                    e.currentTarget.currentTime = startSec;
                    syncSecondaryHtmlVideo(startSec, false);
                  }
                }}
                onTimeUpdate={(e) => {
                  const sec = e.currentTarget.currentTime;
                  const nextSec = checkAndApplySkips(sec, false, (target) => {
                    e.currentTarget.currentTime = target;
                  });
                  syncSecondaryHtmlVideo(nextSec);
                  setCurrentSec(nextSec);
                  onTimeUpdateSec?.(nextSec);
                }}
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
                {/* Persistent YouTube Player (Unmuted Master Audio + Video) */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: `${primaryCropStyle.iframeWidthPercent}%`,
                    height: '100%',
                    marginLeft: `${primaryCropStyle.iframeMarginLeftPercent}%`,
                    pointerEvents: 'none',
                  }}
                >
                  <div id={primaryYtContainerId} className="w-full h-full" />
                </div>

                {/* High-res poster shown only before playback starts */}
                {!hasStartedOnce && youtubePosterUrl && (
                  <img
                    src={`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`}
                    onError={(e) => {
                      if (e.currentTarget.src !== youtubePosterUrl) {
                        e.currentTarget.src = youtubePosterUrl;
                      }
                    }}
                    alt="9:16 Reframed Short"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 3,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: primaryCropStyle.objectPosition,
                      transform: `scale(${primaryCropStyle.scale})`,
                      filter: 'contrast(1.05) saturate(1.08)',
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#FAF7F2]/80">
                <p className="text-xs font-medium">
                  Drop an MP4 video or paste a YouTube link to preview your 9:16 Short
                </p>
              </div>
            )}

            {/* Top / Primary Badge Overlay */}
            {layoutMode === 'SINGLE_SPEAKER' && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E05A47] text-white text-[10px] font-bold">
                  🎯 {activeFraming.activeSpeaker || 'Speaker 1'}
                </span>
              </div>
            )}

            {layoutMode === 'SPLIT_TOP_BOTTOM' && (
              <div className="pointer-events-none absolute top-2 left-2 z-10">
                <span className="px-2 py-0.5 rounded-full bg-[#E05A47] text-white text-[10px] font-bold shadow">
                  {activeFraming.activeSpeaker || 'Speaker 1'}
                </span>
              </div>
            )}

            {layoutMode === 'CONTENT_ZOOM_PIP' && (
              <div className="pointer-events-none absolute top-2 left-2 z-10">
                <span className="px-2 py-0.5 rounded-full bg-[#F59E0B] text-[#1F1C18] text-[10px] font-bold shadow">
                  🔍 {activeFraming.screenContentTitle || 'Content Zoom'}
                </span>
              </div>
            )}
          </div>

          {/* BOTTOM / SECONDARY PANE (Always Mounted for Instant Zero-Flicker Split View) */}
          <div
            className={`w-full relative overflow-hidden transition-all duration-300 ${bottomPaneHeightClass}`}
          >
            {previewObjectUrl ? (
              <video
                ref={secondaryVideoRef}
                src={previewObjectUrl}
                muted
                playsInline
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
                    position: 'relative',
                    zIndex: 2,
                    width: `${secondaryCropStyle.iframeWidthPercent}%`,
                    height: '100%',
                    marginLeft: `${secondaryCropStyle.iframeMarginLeftPercent}%`,
                    pointerEvents: 'none',
                  }}
                >
                  <div id={secondaryYtContainerId} className="w-full h-full" />
                </div>

                {!hasStartedOnce && youtubePosterUrl && (
                  <img
                    src={`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`}
                    onError={(e) => {
                      if (e.currentTarget.src !== youtubePosterUrl) {
                        e.currentTarget.src = youtubePosterUrl;
                      }
                    }}
                    alt="9:16 Secondary Pane"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 3,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: secondaryCropStyle.objectPosition,
                      transform: `scale(${secondaryCropStyle.scale})`,
                      filter: 'contrast(1.05) saturate(1.08)',
                    }}
                  />
                )}
              </div>
            ) : null}

            {layoutMode === 'SPLIT_TOP_BOTTOM' && (
              <div className="pointer-events-none absolute bottom-2 left-2 z-10">
                <span className="px-2 py-0.5 rounded-full bg-[#2D8A61] text-white text-[10px] font-bold shadow">
                  {activeFraming.secondarySpeaker || 'Speaker 2'}
                </span>
              </div>
            )}

            {layoutMode === 'CONTENT_ZOOM_PIP' && (
              <div className="pointer-events-none absolute bottom-1.5 left-2 z-10">
                <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[10px] font-bold shadow">
                  {activeFraming.activeSpeaker || 'Speaker Face'}
                </span>
              </div>
            )}
          </div>

          {/* Click-to-Play Overlay when paused (Never autoplays on load!) */}
          {hasMedia && !isPlaying && (
            <div className="absolute inset-0 z-20 bg-black/35 flex flex-col items-center justify-center p-4 text-center transition-opacity group-hover:bg-black/45">
              <div className="w-14 h-14 rounded-full bg-[#E05A47] text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
              <span className="mt-2.5 px-3 py-1 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-xs font-bold shadow">
                Click to Play 9:16 Short
              </span>
            </div>
          )}

          {badgeText && isPlaying && (
            <div className="pointer-events-none absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[10px] font-bold shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D8A61] animate-pulse" />
              <span>{badgeText}</span>
            </div>
          )}

          {skippedToast && (
            <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E05A47] text-white text-[11px] font-semibold shadow-lg whitespace-nowrap">
              <FastForward className="w-3 h-3" />
              <span>{skippedToast}</span>
            </div>
          )}
        </div>
      </div>

      {/* Simple Play / Restart / Mute Bar */}
      {!compactControls && hasMedia && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-full bg-[#F3EDE2] border border-[#E8E0D2] text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E05A47] text-white font-semibold hover:bg-[#D44D3A] transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Short</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleRestartMoment}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#E8E0D2] text-[#1F1C18] font-medium hover:bg-[#E8E0D2] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restart</span>
            </button>
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#E8E0D2] text-[#1F1C18] font-medium hover:bg-[#E8E0D2] transition-colors cursor-pointer"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#E05A47]" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#2D8A61]" />
                  <span>Sound On</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[#4A433B] font-medium">
            <span className="mono-code text-xs bg-[#FAF7F2] px-2.5 py-0.5 rounded-full border border-[#E8E0D2] text-[#1F1C18]">
              {formatSecondsToMMSS(currentSec)}
              {endSec ? ` / ${formatSecondsToMMSS(endSec)}` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
