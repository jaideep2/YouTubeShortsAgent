import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Player } from '@remotion/player';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  Hash,
  Image as ImageIcon,
  Loader2,
  LogIn,
  Sparkles,
  Terminal,
  Upload,
  Wand2,
  X,
  Youtube,
} from 'lucide-react';
import type {
  CloudExportResult,
  FramingKeyframe,
  ShortEDL,
  ShortsAspectRatio,
  VerticalLayoutMode,
} from '../types/edl';
import {
  applyFramingLayoutPreset,
  buildCoarseAutoFramingKeyframes,
  buildVisualTrack,
  buildYouTubePublishMetadata,
  formatSecondsToMMSS,
} from '../utils/edlCompiler';
import { ShortComposition } from '../remotion/ShortComposition';
import { UltravioletTooltip } from '../components/UltravioletTooltip';
import { requestCloudVideoExport } from '../services/clientApi';

interface StagePageProps {
  candidate: ShortEDL | null;
  previewObjectUrl?: string;
  onUpdateCandidate: (updated: ShortEDL) => void;
  onRunAutoFramePass: () => Promise<void>;
  onRunQACriticPass: () => Promise<void>;
  isPipelineRunning: boolean;
}

const CAMERA_MODES: Array<{
  mode: VerticalLayoutMode;
  label: string;
  sub: string;
}> = [
  {
    mode: 'SINGLE_SPEAKER',
    label: 'Just 1 Speaker',
    sub: 'Centered 9:16 face',
  },
  {
    mode: 'SPLIT_TOP_BOTTOM',
    label: 'Top & Bottom Split',
    sub: '2 speakers stacked',
  },
  {
    mode: 'CONTENT_ZOOM_PIP',
    label: 'Screen Share + Face',
    sub: 'Top content + bottom face',
  },
];

const EXPORT_FRIENDLY_STEPS = [
  'Spinning up your private cloud video studio...',
  'Stitching your kept story beats & tightening pauses...',
  'Burning in your 3-second Hook Sticker & bouncy captions...',
  'Wrapping up your 9:16 vertical MP4 Short...',
];

declare global {
  interface Window {
    google?: any;
  }
}

export const StagePage: React.FC<StagePageProps> = ({
  candidate,
  previewObjectUrl,
  onUpdateCandidate,
  onRunAutoFramePass,
  isPipelineRunning,
}) => {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<
    'ALL' | 'TITLE' | 'DESCRIPTION' | 'HASHTAGS' | null
  >(null);
  const [forcedCameraMode, setForcedCameraMode] =
    useState<VerticalLayoutMode | null>(null);
  const [newHashtagInput, setNewHashtagInput] = useState('');

  // Cloud Sandbox Managed Agent Export State
  const [isExportingCloud, setIsExportingCloud] = useState(false);
  const [exportStepIdx, setExportStepIdx] = useState(0);
  const [cloudExportResult, setCloudExportResult] =
    useState<CloudExportResult | null>(null);
  const [cloudExportError, setCloudExportError] = useState<string | null>(null);
  const [showNerdyDetails, setShowNerdyDetails] = useState(false);

  // YouTube Direct Upload Modal & OAuth State
  const [showYoutubeUploadModal, setShowYoutubeUploadModal] = useState(false);
  const [ytAccessToken, setYtAccessToken] = useState<string | null>(() =>
    sessionStorage.getItem('yt_oauth_access_token')
  );
  const [ytChannelName, setYtChannelName] = useState<string | null>(() =>
    sessionStorage.getItem('yt_oauth_channel_name')
  );
  const [ytPrivacyStatus, setYtPrivacyStatus] = useState<
    'private' | 'unlisted' | 'public'
  >('unlisted');
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false);
  const [isUploadingToYoutube, setIsUploadingToYoutube] = useState(false);
  const [youtubeUploadStep, setYoutubeUploadStep] = useState<string>('');
  const [uploadedYoutubeUrl, setUploadedYoutubeUrl] = useState<string | null>(
    null
  );
  const [youtubeUploadError, setYoutubeUploadError] = useState<string | null>(
    null
  );

  if (!candidate) {
    return (
      <div className="max-w-[1380px] mx-auto px-4 lg:px-8 py-16 text-center">
        <div className="hum-card-warm p-10 max-w-xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EDE2] text-xs font-semibold text-[#E05A47]">
            <Wand2 className="w-3.5 h-3.5" />
            <span>Step 4 · Make it Shine</span>
          </div>
          <h1 className="text-3xl text-[#1F1C18]">
            Let&apos;s pick a story moment first!
          </h1>
          <p className="text-sm text-[#4A433B]">
            Drop a video on Step 1 so you can watch and upload your 9:16 Short here.
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

  const fps = 30;
  const durationInFrames = Math.max(
    90,
    Math.round(Math.max(10, candidate.estimatedNetDurationSec) * fps)
  );

  const effectiveKeyframes: FramingKeyframe[] =
    candidate.packaging.framingKeyframes &&
    candidate.packaging.framingKeyframes.length > 0
      ? candidate.packaging.framingKeyframes
      : buildCoarseAutoFramingKeyframes(
          candidate.coarseSegments,
          candidate.title
        );

  const youtubeMeta = buildYouTubePublishMetadata(
    candidate,
    candidate.packaging.youtubeMetadata
  );
  const activeAspectRatio: ShortsAspectRatio =
    youtubeMeta.formatSpec.aspectRatio ||
    candidate.visualTrack?.aspectRatio ||
    '9:16';

  const triggerCopyFeedback = (
    field: 'ALL' | 'TITLE' | 'DESCRIPTION' | 'HASHTAGS',
    text: string
  ) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 2200);
  };

  const handleSelectCameraMode = (newLayout: VerticalLayoutMode | null) => {
    setForcedCameraMode(newLayout);
    if (!newLayout) return;

    const updatedKeyframes = effectiveKeyframes.map((kf) =>
      applyFramingLayoutPreset(kf, newLayout)
    );

    onUpdateCandidate({
      ...candidate,
      visualTrack: {
        ...candidate.visualTrack,
        framingKeyframes: updatedKeyframes,
      },
      packaging: {
        ...candidate.packaging,
        framingKeyframes: updatedKeyframes,
      },
    });
  };

  const handleUpdateSingleKeyframeLayout = (
    keyframeId: string,
    newLayout: VerticalLayoutMode
  ) => {
    setForcedCameraMode(null);
    const updatedKeyframes = effectiveKeyframes.map((kf) =>
      kf.id === keyframeId ? applyFramingLayoutPreset(kf, newLayout) : kf
    );
    onUpdateCandidate({
      ...candidate,
      visualTrack: {
        ...candidate.visualTrack,
        framingKeyframes: updatedKeyframes,
      },
      packaging: {
        ...candidate.packaging,
        framingKeyframes: updatedKeyframes,
      },
    });
  };

  const handleAspectRatioChange = (nextRatio: ShortsAspectRatio) => {
    const updatedVisualTrack = buildVisualTrack(
      effectiveKeyframes,
      candidate.packaging.bRollCues,
      candidate.packaging.dynamicCaptions,
      candidate.packaging.hookBanner.durationMs,
      nextRatio
    );
    const updatedMeta = buildYouTubePublishMetadata(
      {
        ...candidate,
        visualTrack: updatedVisualTrack,
      },
      {
        ...youtubeMeta,
        formatSpec: {
          ...youtubeMeta.formatSpec,
          aspectRatio: nextRatio,
          resolution: nextRatio === '1:1' ? '1080x1080' : '1080x1920',
          minResolution: nextRatio === '1:1' ? '720x720' : '720x1280',
        },
      }
    );

    onUpdateCandidate({
      ...candidate,
      visualTrack: updatedVisualTrack,
      packaging: {
        ...candidate.packaging,
        framingKeyframes: effectiveKeyframes,
        youtubeMetadata: updatedMeta,
      },
    });
  };

  const handleHookTextChange = (newHookText: string) => {
    onUpdateCandidate({
      ...candidate,
      hookText: newHookText,
      packaging: {
        ...candidate.packaging,
        hookBanner: {
          ...candidate.packaging.hookBanner,
          text: newHookText,
        },
      },
    });
  };

  const handleUpdateYoutubeMeta = (
    patch: Partial<{ title: string; description: string; hashtags: string[] }>
  ) => {
    const nextMeta = buildYouTubePublishMetadata(candidate, {
      ...youtubeMeta,
      ...patch,
    });
    onUpdateCandidate({
      ...candidate,
      packaging: {
        ...candidate.packaging,
        youtubeMetadata: nextMeta,
      },
    });
  };

  const handleAddHashtag = () => {
    const raw = newHashtagInput.trim().replace(/\s+/g, '');
    if (!raw) return;
    const formatted = raw.startsWith('#') ? raw : `#${raw}`;
    if (!youtubeMeta.hashtags.includes(formatted)) {
      handleUpdateYoutubeMeta({
        hashtags: [...youtubeMeta.hashtags, formatted],
      });
    }
    setNewHashtagInput('');
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    if (tagToRemove.toLowerCase() === '#shorts') return;
    handleUpdateYoutubeMeta({
      hashtags: youtubeMeta.hashtags.filter((t) => t !== tagToRemove),
    });
  };

  const handleCopyAllForYoutube = () => {
    const fullPost = `${youtubeMeta.title}\n\n${youtubeMeta.description}\n\n${youtubeMeta.hashtags.join(' ')}`;
    triggerCopyFeedback('ALL', fullPost);
  };

  const handleRunCloudExport = async (): Promise<CloudExportResult | null> => {
    if (isExportingCloud) return null;
    setIsExportingCloud(true);
    setCloudExportError(null);
    setExportStepIdx(0);

    const stepTimer = window.setInterval(() => {
      setExportStepIdx((prev) =>
        prev < EXPORT_FRIENDLY_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 3200);

    try {
      const result = await requestCloudVideoExport({ candidate });
      setCloudExportResult(result);

      if (result.mp4Base64) {
        const byteChars = atob(result.mp4Base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.outputFileName || `${candidate.id}-short.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
      return result;
    } catch (err: any) {
      setCloudExportError(
        err?.message || 'Could not export your Short in the cloud. Please try again.'
      );
      return null;
    } finally {
      window.clearInterval(stepTimer);
      setIsExportingCloud(false);
    }
  };

  const handleDownloadMp4Again = () => {
    if (!cloudExportResult?.mp4Base64) return;
    const byteChars = atob(cloudExportResult.mp4Base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cloudExportResult.outputFileName || `${candidate.id}-short.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Connect Google / YouTube Account via Google Identity Services OAuth Popup
  const handleConnectYoutubeAccount = async () => {
    setYoutubeUploadError(null);
    setIsConnectingYoutube(true);

    try {
      const clientId =
        (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
        (import.meta as any).env?.VITE_OAUTH_CLIENT_ID ||
        '';

      if (!clientId) {
        setYoutubeUploadError(
          'Google OAuth is being configured for this studio. Once you approve the YouTube OAuth setup card in AI Studio, click Sign In with Google again.'
        );
        setIsConnectingYoutube(false);
        return;
      }

      if (!window.google?.accounts?.oauth2) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error('Could not load Google Sign-In script.'));
          document.head.appendChild(script);
        });
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:
          'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error) {
            setYoutubeUploadError(
              tokenResponse.error_description || 'Google Sign-In was cancelled.'
            );
            setIsConnectingYoutube(false);
            return;
          }
          const accessToken = tokenResponse.access_token;
          setYtAccessToken(accessToken);
          sessionStorage.setItem('yt_oauth_access_token', accessToken);

          // Fetch YouTube channel name
          try {
            const chanRes = await fetch(
              'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            const chanData = await chanRes.json();
            const title =
              chanData?.items?.[0]?.snippet?.title || 'Connected YouTube Channel';
            setYtChannelName(title);
            sessionStorage.setItem('yt_oauth_channel_name', title);
          } catch {
            setYtChannelName('Connected YouTube Channel');
          }
          setIsConnectingYoutube(false);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      setYoutubeUploadError(
        err?.message || 'Could not start Google Sign-In for YouTube.'
      );
      setIsConnectingYoutube(false);
    }
  };

  // Direct Upload of Finished Short MP4 to YouTube Data API v3
  const handleConfirmUploadToYoutube = async () => {
    if (!ytAccessToken || isUploadingToYoutube) return;
    setIsUploadingToYoutube(true);
    setYoutubeUploadError(null);
    setUploadedYoutubeUrl(null);

    try {
      let mp4Base64 = cloudExportResult?.mp4Base64;
      if (!mp4Base64) {
        setYoutubeUploadStep(
          'Rendering your 9:16 vertical MP4 Short in the cloud...'
        );
        const exported = await requestCloudVideoExport({ candidate });
        setCloudExportResult(exported);
        mp4Base64 = exported.mp4Base64;
      }

      if (!mp4Base64) {
        throw new Error(
          'Could not assemble the MP4 binary for YouTube upload. Please try exporting first.'
        );
      }

      setYoutubeUploadStep('Uploading your Short to your YouTube channel...');

      const byteChars = atob(mp4Base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const videoBlob = new Blob([new Uint8Array(byteNumbers)], {
        type: 'video/mp4',
      });

      const metadata = {
        snippet: {
          title: youtubeMeta.title.slice(0, 100),
          description: `${youtubeMeta.description}\n\n${youtubeMeta.hashtags.join(' ')}`.trim(),
          tags: youtubeMeta.hashtags.map((t) => t.replace(/^#/, '')),
          categoryId: '22', // People & Blogs / Creator Shorts
        },
        status: {
          privacyStatus: ytPrivacyStatus,
          selfDeclaredMadeForKids: false,
        },
      };

      // Step 1: Initiate YouTube Resumable Upload Session
      const initRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ytAccessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': String(videoBlob.size),
            'X-Upload-Content-Type': 'video/mp4',
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initRes.ok) {
        const errBody = await initRes.json().catch(() => ({}));
        throw new Error(
          errBody?.error?.message ||
            `YouTube API rejected upload initialization (${initRes.status}).`
        );
      }

      const uploadUrl = initRes.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('YouTube did not return a resumable upload URL.');
      }

      // Step 2: Upload MP4 Video Bytes
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
        },
        body: videoBlob,
      });

      const uploadedVideo = await putRes.json();
      if (!putRes.ok || !uploadedVideo?.id) {
        throw new Error(
          uploadedVideo?.error?.message ||
            'Failed while transferring MP4 bytes to YouTube.'
        );
      }

      setUploadedYoutubeUrl(`https://www.youtube.com/shorts/${uploadedVideo.id}`);
    } catch (err: any) {
      setYoutubeUploadError(
        err?.message || 'Could not upload your Short to YouTube.'
      );
    } finally {
      setIsUploadingToYoutube(false);
      setYoutubeUploadStep('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="max-w-[1380px] mx-auto px-4 lg:px-8 py-8 space-y-8"
    >
      {/* Warm Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E8E0D2]">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F3EDE2] border border-[#E8E0D2] text-xs font-semibold text-[#E05A47]">
            <Wand2 className="w-3.5 h-3.5" />
            <span>Step 4 · Make it Shine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-[#1F1C18]">
            Watch your reframed Short, copy your title &amp; tags, or upload straight to YouTube.
          </h1>
          <p className="text-base text-[#4A433B]">
            Your Short is auto-framed for YouTube Shorts (1-speaker focus, 2-speaker
            top/bottom split, or content zoom + face) with a ready-to-copy Title,
            Description, and Hashtags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/snip')}
            className="btn btn--secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Snip Fluff</span>
          </button>

          <button
            type="button"
            disabled={isExportingCloud}
            onClick={() => void handleRunCloudExport()}
            className="btn btn--secondary"
          >
            {isExportingCloud ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting MP4...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download MP4</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowYoutubeUploadModal(true)}
            className="btn btn--primary px-6 py-3"
          >
            <Youtube className="w-4 h-4" />
            <span>Upload to YouTube</span>
          </button>
        </div>
      </div>

      {/* Upload to YouTube Confirmation & Sign-In Modal */}
      <AnimatePresence>
        {showYoutubeUploadModal && (
          <div className="fixed inset-0 z-[400] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-xl hum-card-warm p-6 sm:p-8 space-y-5 border-2 border-[#1F1C18] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#E8E0D2] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#E05A47] text-white flex items-center justify-center">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl text-[#1F1C18]">
                      Upload Short to YouTube
                    </h2>
                    <p className="text-xs text-[#786F63]">
                      Sign in with your YouTube account and confirm your Short details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowYoutubeUploadModal(false)}
                  className="p-1.5 rounded-full bg-[#F3EDE2] text-[#4A433B] hover:text-[#1F1C18] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: Google / YouTube Account Connection */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#1F1C18]">
                    {ytAccessToken
                      ? `Connected: ${ytChannelName || 'YouTube Creator Account'}`
                      : '1. Sign in with your Google / YouTube account'}
                  </div>
                  <div className="text-[11px] text-[#786F63]">
                    {ytAccessToken
                      ? 'Ready to post this Short directly to your channel'
                      : 'We only request permission to upload this Short on your behalf'}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isConnectingYoutube}
                  onClick={handleConnectYoutubeAccount}
                  className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    ytAccessToken
                      ? 'bg-[#2D8A61]/15 text-[#2D8A61] border border-[#2D8A61]/30'
                      : 'bg-[#1F1C18] text-[#FAF7F2] hover:bg-[#332E28]'
                  }`}
                >
                  {isConnectingYoutube ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : ytAccessToken ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Switch Account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step 2: Review Metadata & Privacy Before Publishing */}
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-1.5">
                  <div className="text-[11px] font-bold text-[#786F63]">
                    TITLE TO PUBLISH
                  </div>
                  <div className="font-bold text-[#1F1C18] text-sm">
                    {youtubeMeta.title}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-1.5">
                  <div className="text-[11px] font-bold text-[#786F63]">
                    HASHTAGS &amp; FORMAT
                  </div>
                  <div className="text-[#4A433B]">
                    {youtubeMeta.hashtags.join(' ')} &bull;{' '}
                    <strong>{youtubeMeta.formatSpec.resolution}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2]">
                  <span className="font-bold text-[#1F1C18]">
                    YouTube Visibility:
                  </span>
                  <div className="inline-flex items-center gap-1.5">
                    {(['unlisted', 'private', 'public'] as const).map((vis) => (
                      <button
                        key={vis}
                        type="button"
                        onClick={() => setYtPrivacyStatus(vis)}
                        className={`px-3 py-1 rounded-full text-xs font-bold capitalize cursor-pointer ${
                          ytPrivacyStatus === vis
                            ? 'bg-[#E05A47] text-white'
                            : 'bg-[#F3EDE2] text-[#4A433B]'
                        }`}
                      >
                        {vis}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {youtubeUploadError && (
                <div className="p-3.5 rounded-2xl bg-[#E05A47]/12 border border-[#E05A47]/35 text-xs font-medium text-[#9E2B1C]">
                  {youtubeUploadError}
                </div>
              )}

              {isUploadingToYoutube && (
                <div className="p-4 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2] flex items-center gap-3 text-xs font-semibold text-[#1F1C18]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#E05A47]" />
                  <span>{youtubeUploadStep || 'Uploading Short to YouTube...'}</span>
                </div>
              )}

              {uploadedYoutubeUrl && (
                <div className="p-4 rounded-2xl bg-[#2D8A61]/15 border border-[#2D8A61]/40 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#1E6345]">
                      ✓ Uploaded to YouTube Shorts!
                    </div>
                    <div className="text-[11px] text-[#4A433B]">
                      {uploadedYoutubeUrl}
                    </div>
                  </div>
                  <a
                    href={uploadedYoutubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn--meadow py-1.5 px-3.5 text-xs"
                  >
                    <span>Open on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E8E0D2]">
                <button
                  type="button"
                  onClick={() => setShowYoutubeUploadModal(false)}
                  className="btn btn--secondary py-2 px-4 text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!ytAccessToken || isUploadingToYoutube}
                  onClick={handleConfirmUploadToYoutube}
                  className="btn btn--primary py-2.5 px-6 text-xs"
                >
                  {isUploadingToYoutube ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Posting Short...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Confirm &amp; Post Short to YouTube</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Playful Cloud Export Progress / Result Card */}
      <AnimatePresence>
        {(isExportingCloud || cloudExportResult || cloudExportError) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="hum-card-warm p-6 space-y-4 border-2 border-[#E05A47]"
          >
            {isExportingCloud && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#E05A47]/15 text-[#E05A47] flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1F1C18]">
                        {EXPORT_FRIENDLY_STEPS[exportStepIdx]}
                      </div>
                      <div className="text-xs text-[#786F63]">
                        Our cloud studio is assembling your {activeAspectRatio} MP4 video
                        right now
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#F59E0B]/20 text-[#9A5B00]">
                    Step {exportStepIdx + 1} of {EXPORT_FRIENDLY_STEPS.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EXPORT_FRIENDLY_STEPS.map((label, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl text-xs font-semibold border ${
                        idx <= exportStepIdx
                          ? 'bg-[#2D8A61]/15 border-[#2D8A61]/40 text-[#1E6345]'
                          : 'bg-[#F3EDE2] border-[#E8E0D2] text-[#786F63]'
                      }`}
                    >
                      {idx < exportStepIdx ? '✓ ' : idx === exportStepIdx ? '✨ ' : ''}
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cloudExportError && (
              <div className="flex items-center justify-between gap-4 text-sm text-[#9E2B1C]">
                <span>{cloudExportError}</span>
                <button
                  type="button"
                  onClick={() => void handleRunCloudExport()}
                  className="btn btn--primary py-1.5 px-4 text-xs"
                >
                  Try Export Again
                </button>
              </div>
            )}

            {cloudExportResult && !isExportingCloud && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#2D8A61] text-white flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg text-[#1F1C18]">
                        Your YouTube Short MP4 is Ready!
                      </h3>
                      <p className="text-xs text-[#4A433B]">
                        {cloudExportResult.friendlySummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {cloudExportResult.mp4Base64 && (
                      <button
                        type="button"
                        onClick={handleDownloadMp4Again}
                        className="btn btn--meadow text-xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download MP4 ({cloudExportResult.outputFileName})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowNerdyDetails((v) => !v)}
                      className="px-3.5 py-2 rounded-full bg-[#F3EDE2] border border-[#E8E0D2] text-xs font-semibold text-[#4A433B] hover:text-[#1F1C18] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>
                        {showNerdyDetails ? 'Hide nerdy details' : 'Show nerdy details'}
                      </span>
                      {showNerdyDetails ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {showNerdyDetails && (
                  <div className="p-4 rounded-2xl bg-[#1F1C18] text-[#FAF7F2] space-y-3 text-xs mono-code">
                    <div className="flex items-center justify-between text-[#FDE68A]">
                      <span>Cloud Sandbox Agent: {cloudExportResult.agentId}</span>
                      <span>Interaction: {cloudExportResult.interactionId}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#2B2620] text-[#A7F3D0] overflow-x-auto">
                      $ {cloudExportResult.ffmpegCommandUsed}
                    </div>
                    {cloudExportResult.sandboxLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-[#2B2620]/70 space-y-1"
                      >
                        <div className="text-[10px] uppercase text-[#F59E0B]">
                          {log.title}
                        </div>
                        <pre className="whitespace-pre-wrap text-[11px] text-[#E8E0D2]">
                          {log.detail}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 12-Col Make It Shine Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: Reframed Remotion Player + Camera Mode Switcher + Official YouTube Shorts Format Selector */}
        <div className="lg:col-span-5 hum-card-warm p-6 flex flex-col items-center space-y-5 lg:sticky lg:top-24">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-[#E05A47]" />
              <span className="text-sm font-bold text-[#1F1C18]">
                {activeAspectRatio === '1:1'
                  ? '1:1 Square Short Preview'
                  : '9:16 Vertical Short Preview'}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#2D8A61]/15 text-[#2D8A61] text-xs font-bold mono-code">
              {candidate.estimatedNetDurationSec.toFixed(0)}s ·{' '}
              {youtubeMeta.formatSpec.resolution}
            </span>
          </div>

          {/* Official YouTube Shorts Aspect Ratio Toggle (9:16 Vertical vs 1:1 Square) */}
          <div className="w-full grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2]">
            <button
              type="button"
              onClick={() => handleAspectRatioChange('9:16')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAspectRatio === '9:16'
                  ? 'bg-[#1F1C18] text-[#FAF7F2] shadow-xs'
                  : 'text-[#4A433B] hover:text-[#1F1C18]'
              }`}
            >
              📱 9:16 Vertical (1080×1920)
            </button>
            <button
              type="button"
              onClick={() => handleAspectRatioChange('1:1')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeAspectRatio === '1:1'
                  ? 'bg-[#1F1C18] text-[#FAF7F2] shadow-xs'
                  : 'text-[#4A433B] hover:text-[#1F1C18]'
              }`}
            >
              ⬛ 1:1 Square (1080×1080)
            </button>
          </div>

          <div
            className={`w-full ${
              activeAspectRatio === '1:1'
                ? 'max-w-[350px] aspect-square'
                : 'max-w-[340px] aspect-[9/16]'
            } rounded-3xl overflow-hidden border-4 border-[#1F1C18] shadow-[0_22px_50px_-14px_rgba(31,28,24,0.35)] bg-[#1F1C18] transition-all`}
          >
            <Player
              acknowledgeRemotionLicense
              component={ShortComposition}
              inputProps={{
                candidate,
                previewObjectUrl,
                forcedCameraMode,
              }}
              durationInFrames={durationInFrames}
              compositionWidth={360}
              compositionHeight={activeAspectRatio === '1:1' ? 360 : 640}
              fps={fps}
              controls
              loop
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>

          {/* 4 Friendly Camera-Mode Switcher Pills (Auto-Switch + 3 Modes) */}
          <div className="w-full space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#4A433B]">
              <span>Switch 9:16 Camera Framing Mode</span>
              <button
                type="button"
                onClick={() => handleSelectCameraMode(null)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer ${
                  forcedCameraMode === null
                    ? 'bg-[#2D8A61] text-white'
                    : 'bg-[#F3EDE2] text-[#4A433B] hover:bg-[#E8E0D2]'
                }`}
              >
                ✨ Auto-Switch ({effectiveKeyframes.length} shots)
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CAMERA_MODES.map((item) => {
                const isActive = forcedCameraMode === item.mode;
                return (
                  <UltravioletTooltip
                    key={item.mode}
                    fullWidth
                    title={item.label}
                    badgeText="9:16 VIEW"
                    badgeTone="honey"
                    framingDiagram={item.mode}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCameraMode(item.mode)}
                      className={`w-full p-2.5 rounded-2xl text-center transition-all border-2 cursor-pointer ${
                        isActive
                          ? 'bg-[#1F1C18] text-[#FAF7F2] border-[#E05A47] shadow-sm'
                          : 'bg-[#F3EDE2] text-[#4A433B] border-[#E8E0D2] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">
                        {item.label}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {item.sub}
                      </div>
                    </button>
                  </UltravioletTooltip>
                );
              })}
            </div>
          </div>

          {/* Official YouTube Shorts Accepted Formats Spec Box */}
          <div className="w-full p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[#1F1C18]">
              <span>✅ YouTube Shorts Official Format Spec</span>
              <span className="px-2 py-0.5 rounded-full bg-[#2D8A61]/15 text-[#2D8A61] text-[10px]">
                100% Compliant
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#4A433B]">
              <div className="p-2 rounded-xl bg-[#F3EDE2]/70">
                <div className="text-[10px] text-[#786F63]">Accepted Aspect</div>
                <div className="font-bold text-[#1F1C18]">
                  9:16 Vertical or 1:1 Square
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F3EDE2]/70">
                <div className="text-[10px] text-[#786F63]">Resolution &amp; FPS</div>
                <div className="font-bold text-[#1F1C18]">
                  {youtubeMeta.formatSpec.resolution} @ 30fps
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F3EDE2]/70">
                <div className="text-[10px] text-[#786F63]">Video / Audio Codec</div>
                <div className="font-bold text-[#1F1C18]">
                  {youtubeMeta.formatSpec.container}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#F3EDE2]/70">
                <div className="text-[10px] text-[#786F63]">Length Limit</div>
                <div className="font-bold text-[#2D8A61]">
                  {candidate.estimatedNetDurationSec.toFixed(0)}s (Max 180s)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Ready-to-Copy YouTube Title/Description/Hashtags + Scene-by-Scene Auto-Framing + Hook Sticker */}
        <div className="lg:col-span-7 space-y-6">
          {/* Ready-to-Upload YouTube Title, Description & Hashtags Studio Card */}
          <div className="hum-card p-6 space-y-5 border-2 border-[#E05A47]/35">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E0D2] pb-4">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E05A47]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ready for YouTube Shorts</span>
                </div>
                <h2 className="text-xl text-[#1F1C18]">
                  Generated YouTube Title, Description &amp; Hashtags
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAllForYoutube}
                  className="btn btn--secondary py-2 px-4 text-xs"
                >
                  {copiedField === 'ALL' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#2D8A61]" />
                      <span>Copied All!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowYoutubeUploadModal(true)}
                  className="btn btn--primary py-2 px-4 text-xs"
                >
                  <Youtube className="w-3.5 h-3.5" />
                  <span>Upload to YouTube</span>
                </button>
              </div>
            </div>

            {/* 1. YouTube Shorts Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="yt-title-input"
                  className="text-xs font-bold text-[#1F1C18] flex items-center gap-2"
                >
                  <span>YouTube Shorts Title</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      youtubeMeta.title.length <= 65
                        ? 'bg-[#2D8A61]/15 text-[#2D8A61]'
                        : 'bg-[#F59E0B]/20 text-[#9A5B00]'
                    }`}
                  >
                    {youtubeMeta.title.length}/100 chars
                    {youtubeMeta.title.length <= 65 ? ' · Great for Mobile Feed' : ''}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => triggerCopyFeedback('TITLE', youtubeMeta.title)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F3EDE2] hover:bg-[#E8E0D2] text-xs font-bold text-[#1F1C18] cursor-pointer"
                >
                  {copiedField === 'TITLE' ? (
                    <>
                      <Check className="w-3 h-3 text-[#2D8A61]" />
                      <span className="text-[#2D8A61]">Copied Title!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[#E05A47]" />
                      <span>Copy Title</span>
                    </>
                  )}
                </button>
              </div>

              <input
                id="yt-title-input"
                type="text"
                maxLength={100}
                value={youtubeMeta.title}
                onChange={(e) =>
                  handleUpdateYoutubeMeta({ title: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF7F2] border-2 border-[#E8E0D2] text-sm font-bold text-[#1F1C18] focus:outline-none focus:border-[#E05A47]"
              />
            </div>

            {/* 2. YouTube Shorts Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="yt-desc-input"
                  className="text-xs font-bold text-[#1F1C18]"
                >
                  YouTube Shorts Description
                </label>

                <button
                  type="button"
                  onClick={() =>
                    triggerCopyFeedback('DESCRIPTION', youtubeMeta.description)
                  }
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F3EDE2] hover:bg-[#E8E0D2] text-xs font-bold text-[#1F1C18] cursor-pointer"
                >
                  {copiedField === 'DESCRIPTION' ? (
                    <>
                      <Check className="w-3 h-3 text-[#2D8A61]" />
                      <span className="text-[#2D8A61]">Copied Description!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[#E05A47]" />
                      <span>Copy Description</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                id="yt-desc-input"
                rows={4}
                value={youtubeMeta.description}
                onChange={(e) =>
                  handleUpdateYoutubeMeta({ description: e.target.value })
                }
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border-2 border-[#E8E0D2] text-xs font-medium text-[#1F1C18] leading-relaxed focus:outline-none focus:border-[#E05A47]"
              />
            </div>

            {/* 3. YouTube Shorts Hashtags */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#1F1C18] flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#2D8A61]" />
                  <span>YouTube Shorts Hashtags ({youtubeMeta.hashtags.length})</span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    triggerCopyFeedback(
                      'HASHTAGS',
                      youtubeMeta.hashtags.join(' ')
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F3EDE2] hover:bg-[#E8E0D2] text-xs font-bold text-[#1F1C18] cursor-pointer"
                >
                  {copiedField === 'HASHTAGS' ? (
                    <>
                      <Check className="w-3 h-3 text-[#2D8A61]" />
                      <span className="text-[#2D8A61]">Copied Hashtags!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[#E05A47]" />
                      <span>Copy Hashtags</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2]">
                {youtubeMeta.hashtags.map((tag) => {
                  const isRequiredShortsTag = tag.toLowerCase() === '#shorts';
                  return (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        isRequiredShortsTag
                          ? 'bg-[#E05A47] text-white'
                          : 'bg-[#F3EDE2] text-[#1F1C18] border border-[#E8E0D2]'
                      }`}
                    >
                      <span>{tag}</span>
                      {!isRequiredShortsTag && (
                        <button
                          type="button"
                          onClick={() => handleRemoveHashtag(tag)}
                          title={`Remove ${tag}`}
                          className="text-[#786F63] hover:text-[#E05A47] font-extrabold cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}

                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="+ Add tag"
                    value={newHashtagInput}
                    onChange={(e) => setNewHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHashtag();
                      }
                    }}
                    className="w-28 px-2.5 py-1 rounded-full bg-white border border-[#E8E0D2] text-xs text-[#1F1C18] focus:outline-none focus:border-[#E05A47]"
                  />
                  {newHashtagInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddHashtag}
                      className="px-2.5 py-1 rounded-full bg-[#2D8A61] text-white text-xs font-bold cursor-pointer"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scene-by-Scene Auto-Framing Timeline Card */}
          <div className="hum-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E0D2] pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#E05A47]" />
                <h2 className="text-xl text-[#1F1C18]">
                  Scene-by-Scene 9:16 Framing ({effectiveKeyframes.length})
                </h2>
              </div>
              <span className="text-xs font-semibold text-[#786F63]">
                Tap any scene&apos;s camera pill to customize its 9:16 framing
              </span>
            </div>

            <div className="space-y-2.5">
              {effectiveKeyframes.slice(0, 6).map((kf, idx) => {
                const startSec = Math.round(kf.startMs / 1000);
                const endSec = Math.max(startSec + 1, Math.round(kf.endMs / 1000));
                return (
                  <div
                    key={kf.id}
                    className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#1F1C18] text-[#FAF7F2] text-[11px] font-bold mono-code">
                          Shot #{idx + 1} · {formatSecondsToMMSS(startSec)}&ndash;
                          {formatSecondsToMMSS(endSec)}
                        </span>
                        <span className="text-xs font-bold text-[#1F1C18]">
                          {kf.activeSpeaker || 'Speaker 1'}
                          {kf.layout === 'SPLIT_TOP_BOTTOM' &&
                            ` + ${kf.secondarySpeaker || 'Speaker 2'}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(
                        [
                          { mode: 'SINGLE_SPEAKER', label: '🎯 1 Speaker' },
                          { mode: 'SPLIT_TOP_BOTTOM', label: '👥 Top/Bottom' },
                          { mode: 'CONTENT_ZOOM_PIP', label: '🔍 Screen + Face' },
                        ] as const
                      ).map((opt) => {
                        const isSelected =
                          (forcedCameraMode || kf.layout) === opt.mode;
                        return (
                          <button
                            key={opt.mode}
                            type="button"
                            onClick={() =>
                              handleUpdateSingleKeyframeLayout(kf.id, opt.mode)
                            }
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#E05A47] text-white border-[#E05A47]'
                                : 'bg-[#F3EDE2] text-[#4A433B] border-[#E8E0D2] hover:bg-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editable 3-Second Hook Sticker Card */}
          <div className="hum-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                <h2 className="text-xl text-[#1F1C18]">
                  3-Second Opening Hook Sticker
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#9A5B00]">
                Shown from 0:00 to 0:03
              </span>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="hook-sticker-input"
                className="block text-xs font-semibold text-[#4A433B]"
              >
                Type your opening headline (updates live on your 9:16 video!)
              </label>
              <input
                id="hook-sticker-input"
                type="text"
                value={candidate.packaging.hookBanner.text || candidate.hookText}
                onChange={(e) => handleHookTextChange(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#FAF7F2] border-2 border-[#F59E0B] text-base font-bold text-[#1F1C18] uppercase focus:outline-none focus:border-[#E05A47]"
              />
            </div>
          </div>

          {/* B-Roll Cutaway Ideas & Best Thumbnail Moment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="hum-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E0D2] pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2D8A61]" />
                  <h3 className="text-lg text-[#1F1C18]">Fun B-Roll Ideas</h3>
                </div>
                <button
                  type="button"
                  disabled={isPipelineRunning}
                  onClick={onRunAutoFramePass}
                  className="text-xs font-semibold text-[#E05A47] hover:underline cursor-pointer"
                >
                  Refresh Ideas &amp; Tags
                </button>
              </div>

              {candidate.packaging.bRollCues.length === 0 ? (
                <p className="text-xs text-[#786F63]">
                  Click &ldquo;Refresh Ideas &amp; Tags&rdquo; to get fresh cutaway suggestions.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {candidate.packaging.bRollCues.map((br) => (
                    <div
                      key={br.id}
                      className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#2D8A61]">
                        <span>✨ Visual Cutaway</span>
                        <span className="mono-code">
                          {Math.floor(br.startMs / 60000)}:
                          {String(Math.floor((br.startMs % 60000) / 1000)).padStart(
                            2,
                            '0'
                          )}{' '}
                          &ndash; {Math.floor(br.endMs / 60000)}:
                          {String(Math.floor((br.endMs % 60000) / 1000)).padStart(
                            2,
                            '0'
                          )}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#1F1C18]">
                        {br.visualPrompt}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hum-card p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E0D2] pb-2.5">
                <ImageIcon className="w-4 h-4 text-[#E05A47]" />
                <h3 className="text-lg text-[#1F1C18]">Best Thumbnail Frame</h3>
              </div>

              <div className="p-4 rounded-2xl bg-[#F3EDE2] border border-[#E8E0D2] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#E05A47]">
                  <span>📸 Snap Frame At</span>
                  <span className="mono-code">
                    @{candidate.packaging.thumbnailSpec.timestampSec}s
                  </span>
                </div>
                <div className="text-sm font-extrabold text-[#1F1C18] uppercase">
                  &ldquo;{candidate.packaging.thumbnailSpec.headlineText}&rdquo;
                </div>
                <p className="text-xs text-[#4A433B]">
                  {candidate.packaging.thumbnailSpec.visualDescription}
                </p>
              </div>
            </div>
          </div>

          {/* Creator Readiness Checklist */}
          <div className="hum-card-oat p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-[#1F1C18]">
                Why This Short Is Ready to Post
              </h3>
              <span className="px-3 py-1 rounded-full bg-[#2D8A61] text-white text-xs font-bold">
                ✓ All Good!
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2]">
                <div className="text-xs text-[#786F63]">Short Length</div>
                <div className="text-sm font-bold text-[#2D8A61] mt-0.5">
                  ✓ {candidate.estimatedNetDurationSec.toFixed(0)}s (Punchy!)
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2]">
                <div className="text-xs text-[#786F63]">9:16 Auto-Camera</div>
                <div className="text-sm font-bold text-[#2D8A61] mt-0.5">
                  ✓ Framed &amp; Ready
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E8E0D2]">
                <div className="text-xs text-[#786F63]">YouTube Copy &amp; Tags</div>
                <div className="text-sm font-bold text-[#2D8A61] mt-0.5">
                  ✓ Ready to Upload
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
