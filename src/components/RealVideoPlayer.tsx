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

function loadYouTubeIframeApi(): Promise<any> {
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
  const containerId = `yt-real-player-${rawId}`;
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const ternaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const skipRangesRef = useRef<SkipRangeSec[]>(skipRanges);
  skipRangesRef.current = skipRanges;

  // Never autoplay on load: isPlaying always starts false and only plays when clicked
  const [currentSec, setCurrentSec] = useState<number>(startSec);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
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
  }, [startSec, reframedCandidate?.id, youtubeId, previewObjectUrl]);

  // Resolve active 9:16 framing keyframe at the current playback second
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
      currentSec,
      forcedMode
    );
  }, [reframedCandidate, currentSec, forcedMode]);

  const primaryCropStyle = useMemo(
    () => computeCropViewportStyle(activeFraming.primaryCropBox),
    [activeFraming]
  );
  const secondaryCropStyle = useMemo(
    () =>
      computeCropViewportStyle(
        activeFraming.secondaryCropBox || {
          x: 0.52,
          y: 0.05,
          width: 0.4,
          height: 0.5,
        }
      ),
    [activeFraming]
  );

  // Sync secondary/ternary HTML5 video elements for real-time 9:16 split/crop panes
  const syncCompanionVideos = (targetTime: number, playState?: boolean) => {
    [secondaryVideoRef.current, ternaryVideoRef.current].forEach((vid) => {
      if (!vid) return;
      if (Math.abs(vid.currentTime - targetTime) > 0.35) {
        vid.currentTime = targetTime;
      }
      if (playState === true && vid.paused) {
        vid.play().catch(() => {});
      } else if (playState === false && !vid.paused) {
        vid.pause();
      }
    });
  };

  // Trigger skip check on any time update
  const checkAndApplySkips = (sec: number, seekFn: (targetSec: number) => void) => {
    if (endSec && sec >= endSec + 0.25) {
      seekFn(startSec);
      return startSec;
    }
    for (const r of skipRangesRef.current) {
      if (
        r.endSec > r.startSec + 0.08 &&
        sec >= r.startSec &&
        sec < r.endSec - 0.05
      ) {
        seekFn(r.endSec);
        const saved = (r.endSec - r.startSec).toFixed(1);
        setSkippedToast(r.label || `Skipped ${saved}s`);
        setTimeout(() => setSkippedToast(null), 1500);
        return r.endSec;
      }
    }
    return sec;
  };

  // Hidden YouTube IFrame API controller for synchronized audio & timecode (never autoplays on load!)
  useEffect(() => {
    if (!youtubeId || previewObjectUrl) return;
    let isMounted = true;
    let pollTimer: number | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (!isMounted || !YT || !YT.Player) return;
      const el = document.getElementById(containerId);
      if (!el) return;

      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }

      ytPlayerRef.current = new YT.Player(containerId, {
        videoId: youtubeId,
        playerVars: {
          start: Math.max(0, Math.floor(startSec)),
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            if (mutedByDefault && event.target?.mute) {
              event.target.mute();
            }
          },
          onStateChange: (event: any) => {
            if (!isMounted) return;
            const playing = event.data === 1;
            setIsPlaying(playing);
          },
        },
      });

      pollTimer = window.setInterval(() => {
        const p = ytPlayerRef.current;
        if (p && typeof p.getCurrentTime === 'function' && typeof p.getPlayerState === 'function') {
          if (p.getPlayerState() !== 1) return;
          const t = Number(p.getCurrentTime() || 0);
          if (t > 0) {
            const nextT = checkAndApplySkips(t, (target) => {
              p.seekTo(target, true);
            });
            setCurrentSec(nextT);
            onTimeUpdateSec?.(nextT);
          }
        }
      }, 150);
    });

    return () => {
      isMounted = false;
      if (pollTimer) window.clearInterval(pollTimer);
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [youtubeId, previewObjectUrl, containerId]);

  // Respond to external seek requests (when user clicks a specific timestamp)
  useEffect(() => {
    if (seekRequestSec === null || seekRequestSec === undefined) return;
    handleSeekToSec(seekRequestSec);
  }, [seekRequestSec]);

  const handleSeekToSec = (targetSec: number) => {
    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = targetSec;
      htmlVideoRef.current.play().catch(() => {});
      syncCompanionVideos(targetSec, true);
      setIsPlaying(true);
      setCurrentSec(targetSec);
      onTimeUpdateSec?.(targetSec);
      return;
    }
    const p = ytPlayerRef.current;
    if (p && typeof p.seekTo === 'function') {
      p.seekTo(targetSec, true);
      if (typeof p.playVideo === 'function') p.playVideo();
      setIsPlaying(true);
      setCurrentSec(targetSec);
      onTimeUpdateSec?.(targetSec);
    } else {
      setCurrentSec(targetSec);
      setIsPlaying(true);
    }
  };

  const handleTogglePlay = () => {
    if (htmlVideoRef.current) {
      if (htmlVideoRef.current.paused) {
        htmlVideoRef.current.play().catch(() => {});
        syncCompanionVideos(htmlVideoRef.current.currentTime, true);
        setIsPlaying(true);
      } else {
        htmlVideoRef.current.pause();
        syncCompanionVideos(htmlVideoRef.current.currentTime, false);
        setIsPlaying(false);
      }
      return;
    }
    const p = ytPlayerRef.current;
    if (p) {
      if (isPlaying && typeof p.pauseVideo === 'function') {
        p.pauseVideo();
        setIsPlaying(false);
      } else if (typeof p.playVideo === 'function') {
        if (currentSec <= startSec + 0.5 && typeof p.seekTo === 'function') {
          p.seekTo(startSec, true);
        }
        p.playVideo();
        setIsPlaying(true);
      } else {
        setIsPlaying((v) => !v);
      }
    } else {
      setIsPlaying((v) => !v);
    }
  };

  const handleRestartMoment = () => {
    handleSeekToSec(startSec);
  };

  const handleToggleMute = () => {
    if (htmlVideoRef.current) {
      htmlVideoRef.current.muted = !htmlVideoRef.current.muted;
      setIsMuted(htmlVideoRef.current.muted);
      return;
    }
    const p = ytPlayerRef.current;
    if (p) {
      if (isMuted && typeof p.unMute === 'function') {
        p.unMute();
        setIsMuted(false);
      } else if (typeof p.mute === 'function') {
        p.mute();
        setIsMuted(true);
      } else {
        setIsMuted((v) => !v);
      }
    } else {
      setIsMuted((v) => !v);
    }
  };

  const handleChooseFramingMode = (mode: VerticalLayoutMode | null) => {
    setForcedMode(mode);
    onSelectFramingMode?.(mode);
  };

  // Render a cropped 9:16 pane from either uploaded video or YouTube video
  const renderCroppedPane = (
    cropStyle: ReturnType<typeof computeCropViewportStyle>,
    paneKey: string,
    videoRef?: React.RefObject<HTMLVideoElement | null>
  ) => {
    if (previewObjectUrl) {
      return (
        <video
          ref={videoRef}
          src={previewObjectUrl}
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: cropStyle.objectPosition,
            transform: `scale(${cropStyle.scale})`,
            transition:
              'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), object-position 380ms ease',
          }}
        />
      );
    }

    if (youtubeId) {
      const embedStart = Math.max(0, Math.floor(currentSec || startSec));
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
              alt="9:16 Reframed Short"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: cropStyle.objectPosition,
                transform: `scale(${cropStyle.scale})`,
                transition:
                  'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), object-position 380ms ease',
                filter: 'contrast(1.05) saturate(1.08)',
              }}
            />
          )}
          {isPlaying && (
            <iframe
              key={`${youtubeId}-${paneKey}-${Math.floor(embedStart / 12)}`}
              title={`Reframed 9:16 Pane ${paneKey}`}
              src={`https://www.youtube.com/embed/${youtubeId}?start=${embedStart}&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
              style={{
                position: 'relative',
                zIndex: 2,
                width: `${cropStyle.iframeWidthPercent}%`,
                height: '100%',
                marginLeft: `${cropStyle.iframeMarginLeftPercent}%`,
                border: 'none',
                pointerEvents: 'none',
                transition:
                  'margin-left 380ms cubic-bezier(0.22, 1, 0.36, 1), width 380ms ease',
              }}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            />
          )}
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#FAF7F2]/80">
        <p className="text-xs font-medium">
          Drop an MP4 video or paste a YouTube link to preview your 9:16 Short
        </p>
      </div>
    );
  };

  const layoutMode = activeFraming.layout;
  const modeMeta = FRAMING_MODE_META[layoutMode];
  const hasMedia = Boolean(previewObjectUrl || youtubeId);

  return (
    <div className="space-y-3">
      {/* Hidden audio/timecode master controller (never shown visually) */}
      {previewObjectUrl ? (
        <video
          ref={htmlVideoRef}
          src={previewObjectUrl}
          playsInline
          muted={isMuted}
          onPlay={(e) => {
            setIsPlaying(true);
            syncCompanionVideos(e.currentTarget.currentTime, true);
          }}
          onPause={(e) => {
            setIsPlaying(false);
            syncCompanionVideos(e.currentTarget.currentTime, false);
          }}
          onLoadedMetadata={(e) => {
            if (startSec > 0) {
              e.currentTarget.currentTime = startSec;
              syncCompanionVideos(startSec, false);
            }
          }}
          onTimeUpdate={(e) => {
            const sec = e.currentTarget.currentTime;
            const nextSec = checkAndApplySkips(sec, (target) => {
              e.currentTarget.currentTime = target;
            });
            syncCompanionVideos(nextSec);
            setCurrentSec(nextSec);
            onTimeUpdateSec?.(nextSec);
          }}
          className="w-px h-px opacity-0 pointer-events-none absolute -z-10"
        />
      ) : youtubeId ? (
        <div className="w-px h-px opacity-0 pointer-events-none overflow-hidden absolute -z-10">
          <div id={containerId} />
        </div>
      ) : null}

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

      {/* ONLY the 9:16 Reframed Vertical Output (Click to Play) */}
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
          className="w-full max-w-[260px] aspect-[9/16] rounded-3xl overflow-hidden border-4 border-[#1F1C18] shadow-[0_18px_38px_-12px_rgba(31,28,24,0.35)] bg-[#1F1C18] relative cursor-pointer group"
        >
          {layoutMode === 'SINGLE_SPEAKER' && (
            <div className="w-full h-full relative overflow-hidden">
              {renderCroppedPane(
                primaryCropStyle,
                'reframed-single',
                secondaryVideoRef
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E05A47] text-white text-[10px] font-bold">
                  🎯 {activeFraming.activeSpeaker || 'Speaker 1'}
                </span>
              </div>
            </div>
          )}

          {layoutMode === 'SPLIT_TOP_BOTTOM' && (
            <div className="w-full h-full flex flex-col">
              <div className="h-1/2 relative border-b-2 border-[#FAF7F2] overflow-hidden">
                {renderCroppedPane(
                  primaryCropStyle,
                  'reframed-top',
                  secondaryVideoRef
                )}
                <div className="pointer-events-none absolute top-2 left-2 z-10">
                  <span className="px-2 py-0.5 rounded-full bg-[#E05A47] text-white text-[10px] font-bold shadow">
                    {activeFraming.activeSpeaker || 'Speaker 1'}
                  </span>
                </div>
              </div>
              <div className="h-1/2 relative overflow-hidden">
                {renderCroppedPane(
                  secondaryCropStyle,
                  'reframed-bottom',
                  ternaryVideoRef
                )}
                <div className="pointer-events-none absolute bottom-2 left-2 z-10">
                  <span className="px-2 py-0.5 rounded-full bg-[#2D8A61] text-white text-[10px] font-bold shadow">
                    {activeFraming.secondarySpeaker || 'Speaker 2'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {layoutMode === 'CONTENT_ZOOM_PIP' && (
            <div className="w-full h-full flex flex-col">
              <div className="h-[70%] relative border-b-2 border-[#F59E0B] overflow-hidden">
                {renderCroppedPane(
                  primaryCropStyle,
                  'reframed-content',
                  secondaryVideoRef
                )}
                <div className="pointer-events-none absolute top-2 left-2 z-10">
                  <span className="px-2 py-0.5 rounded-full bg-[#F59E0B] text-[#1F1C18] text-[10px] font-bold shadow">
                    🔍 {activeFraming.screenContentTitle || 'Content Zoom'}
                  </span>
                </div>
              </div>
              <div className="h-[30%] relative overflow-hidden">
                {renderCroppedPane(
                  secondaryCropStyle,
                  'reframed-pip',
                  ternaryVideoRef
                )}
                <div className="pointer-events-none absolute bottom-1.5 left-2 z-10">
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2]/95 text-[#1F1C18] text-[10px] font-bold shadow">
                    {activeFraming.activeSpeaker || 'Speaker Face'}
                  </span>
                </div>
              </div>
            </div>
          )}

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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#E8E0D2] text-[#1F1C18] font-medium hover:bg-[#E8E0D2] transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-[#E05A47]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#2D8A61]" />
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
