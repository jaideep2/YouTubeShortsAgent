import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type {
  AgentChatAction,
  AgentChatMessage,
  PipelinePassId,
  PipelineStatus,
  ShortEDL,
  TrendRadarResult,
  VideoSourceInput,
} from './types/edl';
import {
  applyFramingLayoutPreset,
  buildCoarseAutoFramingKeyframes,
  buildVisualTrack,
  buildYouTubePublishMetadata,
  setBulkFillerActionInEDL,
  toggleCompoundGroupInEDL,
  toggleWordInEDL,
} from './utils/edlCompiler';
import {
  requestAgentChat,
  requestAutoFraming,
  requestQACritic,
  requestScoutCandidates,
  requestSurgicalCut,
  requestTrendRadar,
} from './services/clientApi';
import { ConsoleHeaderAndTelemetry } from './components/ConsoleHeaderAndTelemetry';
import { AgentChatPanel } from './components/AgentChatPanel';
import { DropPage } from './pages/DropPage';
import { ScoutPage } from './pages/ScoutPage';
import { SplitPage } from './pages/SplitPage';
import { StagePage } from './pages/StagePage';
import {
  HACKATHON_TEST_CANDIDATES,
  HACKATHON_TEST_NICHE,
  HACKATHON_TEST_TREND_RADAR,
  HACKATHON_TEST_YOUTUBE_URL,
} from './data/hackathonTestRun';

const STORAGE_KEYS = {
  CANDIDATES: 'shortsdirector_candidates_v1',
  SELECTED_ID: 'shortsdirector_selected_id_v1',
  SOURCE_INPUT: 'shortsdirector_source_input_v1',
  TEST_MODE: 'shortsdirector_test_mode_v1',
};

function loadFromSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createInitialPipelineStatus(hasExistingCandidates = false): PipelineStatus {
  return {
    currentPass: null,
    error: null,
    steps: {
      PASS_1_SCOUT: {
        passId: 'PASS_1_SCOUT',
        stepNumber: 1,
        name: 'Pick a Moment',
        subtitle: 'We watched the whole thing and found the best stories',
        state: hasExistingCandidates ? 'COMPLETED' : 'IDLE',
      },
      PASS_2_SURGICAL_CUT: {
        passId: 'PASS_2_SURGICAL_CUT',
        stepNumber: 2,
        name: 'Snip the Fluff',
        subtitle: 'Removes filler words and tightens pauses automatically',
        state: hasExistingCandidates ? 'COMPLETED' : 'IDLE',
      },
      PASS_3_AUTO_FRAMING: {
        passId: 'PASS_3_AUTO_FRAMING',
        stepNumber: 3,
        name: 'Make it Shine',
        subtitle: 'Watch your 9:16 Short, tweak the hook, and upload to YouTube',
        state: hasExistingCandidates ? 'COMPLETED' : 'IDLE',
      },
      PASS_4_QA_CRITIC: {
        passId: 'PASS_4_QA_CRITIC',
        stepNumber: 4,
        name: 'Final Polish',
        subtitle: 'Smooths audio cuts and prepares your YouTube metadata',
        state: hasExistingCandidates ? 'COMPLETED' : 'IDLE',
      },
    },
  };
}

function StudioShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sourceInput, setSourceInput] = useState<VideoSourceInput>(() =>
    loadFromSession<VideoSourceInput>(STORAGE_KEYS.SOURCE_INPUT, {
      mode: 'YOUTUBE_URL',
      youtubeUrl: '',
      mimeType: 'video/mp4',
      nicheHint: 'Tech Podcasts, Indie Founders & Creator Storytelling',
    })
  );

  const [trendRadar, setTrendRadar] = useState<TrendRadarResult | null>(null);
  const [isScanningTrends, setIsScanningTrends] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<ShortEDL[]>(() =>
    loadFromSession<ShortEDL[]>(STORAGE_KEYS.CANDIDATES, [])
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() =>
    loadFromSession<string | null>(STORAGE_KEYS.SELECTED_ID, null)
  );
  const [isTestMode, setIsTestMode] = useState<boolean>(() =>
    loadFromSession<boolean>(STORAGE_KEYS.TEST_MODE, false)
  );
  const [pausesTightened, setPausesTightened] = useState<boolean>(true);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>(() =>
    createInitialPipelineStatus(
      loadFromSession<ShortEDL[]>(STORAGE_KEYS.CANDIDATES, []).length > 0
    )
  );

  // Conversational Studio Agent Chat State
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'Hi! Paste a YouTube link here or tell me how you want your Shorts framed, trimmed, and titled—I can run every step for you right from chat.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "What's trending on YouTube this week?",
    'Find Shorts from https://www.youtube.com/watch?v=lggpuoaP_C8',
    'Switch camera to Top & Bottom split',
  ]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEYS.CANDIDATES,
        JSON.stringify(candidates)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [candidates]);

  useEffect(() => {
    try {
      if (selectedCandidateId) {
        window.sessionStorage.setItem(
          STORAGE_KEYS.SELECTED_ID,
          JSON.stringify(selectedCandidateId)
        );
      } else {
        window.sessionStorage.removeItem(STORAGE_KEYS.SELECTED_ID);
      }
    } catch {
      // Ignore storage errors
    }
  }, [selectedCandidateId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEYS.TEST_MODE,
        JSON.stringify(isTestMode)
      );
    } catch {
      // Ignore storage errors
    }
  }, [isTestMode]);

  useEffect(() => {
    try {
      const lightweightSource: VideoSourceInput = {
        mode: sourceInput.mode,
        youtubeUrl: sourceInput.youtubeUrl,
        mimeType: sourceInput.mimeType,
        nicheHint: sourceInput.nicheHint,
      };
      window.sessionStorage.setItem(
        STORAGE_KEYS.SOURCE_INPUT,
        JSON.stringify(lightweightSource)
      );
    } catch {
      // Ignore storage errors
    }
  }, [sourceInput]);

  const selectedCandidate =
    candidates.find((c) => c.id === selectedCandidateId) ||
    candidates[0] ||
    null;

  const updateStepState = (
    passId: PipelinePassId,
    state: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR',
    summaryText?: string
  ) => {
    setPipelineStatus((prev) => ({
      ...prev,
      currentPass: state === 'RUNNING' ? passId : null,
      steps: {
        ...prev.steps,
        [passId]: {
          ...prev.steps[passId],
          state,
          summaryText: summaryText ?? prev.steps[passId].summaryText,
          completedAt:
            state === 'COMPLETED' ? new Date().toISOString() : undefined,
        },
      },
    }));
  };

  const replaceCandidate = (updated: ShortEDL) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleUpdateSourceInput = (next: Partial<VideoSourceInput>) => {
    setSourceInput((prev) => ({ ...prev, ...next }));
  };

  const handleScanTrends = async (niche: string) => {
    setIsScanningTrends(true);
    setTrendError(null);
    try {
      const result = await requestTrendRadar({ nicheHint: niche });
      setTrendRadar(result);
    } catch (err: any) {
      setTrendError(
        err?.message || 'Could not check weekly YouTube trends right now.'
      );
    } finally {
      setIsScanningTrends(false);
    }
  };

  const runPass1Scout = async (overrideUrl?: string, overrideNiche?: string): Promise<ShortEDL[]> => {
    setPipelineStatus((prev) => ({ ...prev, error: null }));
    updateStepState('PASS_1_SCOUT', 'RUNNING', 'Finding stories...');
    try {
      const targetUrl =
        overrideUrl ||
        (sourceInput.mode === 'YOUTUBE_URL' ? sourceInput.youtubeUrl : undefined);
      const scouted = await requestScoutCandidates({
        youtubeUrl: targetUrl,
        uploadedFileBase64:
          !overrideUrl && sourceInput.mode === 'FILE_UPLOAD'
            ? sourceInput.uploadedFileBase64
            : undefined,
        uploadedFileName: sourceInput.fileName,
        mimeType: sourceInput.mimeType,
        nicheHint: overrideNiche || sourceInput.nicheHint,
      });

      setCandidates(scouted);
      if (scouted.length > 0) {
        setSelectedCandidateId(scouted[0].id);
      }

      updateStepState(
        'PASS_1_SCOUT',
        'COMPLETED',
        `${scouted.length} stories found`
      );
      return scouted;
    } catch (err: any) {
      const msg = err?.message || 'Could not find moments in this video.';
      updateStepState('PASS_1_SCOUT', 'ERROR', 'Failed');
      setPipelineStatus((prev) => ({
        ...prev,
        currentPass: null,
        error: {
          passId: 'PASS_1_SCOUT',
          code: 'SCOUT_ERR',
          message: msg,
          timestamp: new Date().toISOString(),
          retryable: true,
        },
      }));
      throw err;
    }
  };

  const runPass2Surgical = async (target: ShortEDL): Promise<ShortEDL> => {
    setPipelineStatus((prev) => ({ ...prev, error: null }));
    updateStepState(
      'PASS_2_SURGICAL_CUT',
      'RUNNING',
      'Snipping fluff...'
    );
    try {
      const updated = await requestSurgicalCut({
        candidate: target,
        youtubeUrl:
          sourceInput.mode === 'YOUTUBE_URL' ? sourceInput.youtubeUrl : undefined,
        mimeType: sourceInput.mimeType,
      });
      replaceCandidate(updated);
      updateStepState(
        'PASS_2_SURGICAL_CUT',
        'COMPLETED',
        `-${updated.enhancedTranscript?.stats.timeSavedSec.toFixed(1) || 0}s snipped`
      );
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Could not clean up filler words.';
      updateStepState('PASS_2_SURGICAL_CUT', 'ERROR', 'Failed');
      setPipelineStatus((prev) => ({
        ...prev,
        currentPass: null,
        error: {
          passId: 'PASS_2_SURGICAL_CUT',
          code: 'SURGICAL_ERR',
          message: msg,
          timestamp: new Date().toISOString(),
          retryable: true,
        },
      }));
      throw err;
    }
  };

  const runPass3AutoFrame = async (target: ShortEDL): Promise<ShortEDL> => {
    setPipelineStatus((prev) => ({ ...prev, error: null }));
    updateStepState(
      'PASS_3_AUTO_FRAMING',
      'RUNNING',
      'Framing 9:16...'
    );
    try {
      const updated = await requestAutoFraming({ candidate: target });
      replaceCandidate(updated);
      updateStepState(
        'PASS_3_AUTO_FRAMING',
        'COMPLETED',
        '9:16 ready'
      );
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Could not frame 9:16 layout.';
      updateStepState('PASS_3_AUTO_FRAMING', 'ERROR', 'Failed');
      setPipelineStatus((prev) => ({
        ...prev,
        currentPass: null,
        error: {
          passId: 'PASS_3_AUTO_FRAMING',
          code: 'FRAME_ERR',
          message: msg,
          timestamp: new Date().toISOString(),
          retryable: true,
        },
      }));
      throw err;
    }
  };

  const runPass4QACritic = async (target: ShortEDL): Promise<ShortEDL> => {
    setPipelineStatus((prev) => ({ ...prev, error: null }));
    updateStepState(
      'PASS_4_QA_CRITIC',
      'RUNNING',
      'Polishing Short...'
    );
    try {
      const updated = await requestQACritic({ candidate: target });
      replaceCandidate(updated);
      updateStepState(
        'PASS_4_QA_CRITIC',
        'COMPLETED',
        'Ready to post'
      );
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Quality check encountered an issue.';
      updateStepState('PASS_4_QA_CRITIC', 'ERROR', 'Failed');
      setPipelineStatus((prev) => ({
        ...prev,
        currentPass: null,
        error: {
          passId: 'PASS_4_QA_CRITIC',
          code: 'QA_ERR',
          message: msg,
          timestamp: new Date().toISOString(),
          retryable: true,
        },
      }));
      throw err;
    }
  };

  const handleRunCandidateDeepPass = async (cand: ShortEDL) => {
    try {
      const pass2Out = await runPass2Surgical(cand);
      const pass3Out = await runPass3AutoFrame(pass2Out);
      await runPass4QACritic(pass3Out);
    } catch {
      // Error recorded in pipelineStatus
    }
  };

  const handleStartFullPipeline = async () => {
    setIsTestMode(false);
    const scouted = await runPass1Scout();
    if (scouted.length > 0) {
      void handleRunCandidateDeepPass(scouted[0]);
    }
  };

  // Reset Studio to a completely clean state on Step 1 (/drop)
  const handleResetStudio = () => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEYS.CANDIDATES);
      window.sessionStorage.removeItem(STORAGE_KEYS.SELECTED_ID);
      window.sessionStorage.removeItem(STORAGE_KEYS.SOURCE_INPUT);
      window.sessionStorage.removeItem(STORAGE_KEYS.TEST_MODE);
    } catch {
      // ignore
    }
    setIsTestMode(false);
    setCandidates([]);
    setSelectedCandidateId(null);
    setTrendRadar(null);
    setTrendError(null);
    setPausesTightened(true);
    setSourceInput({
      mode: 'YOUTUBE_URL',
      youtubeUrl: '',
      mimeType: 'video/mp4',
      nicheHint: HACKATHON_TEST_NICHE,
    });
    setPipelineStatus(createInitialPipelineStatus(false));
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'Studio reset! Paste a YouTube link or drop an MP4 recording for a fresh run, or click Test to load the pre-populated demo.',
        timestamp: new Date().toISOString(),
      },
    ]);
    navigate('/drop');
  };

  // Load the pre-populated Hackathon Demo Run (https://www.youtube.com/watch?v=lggpuoaP_C8) across all 4 tabs
  const handleLoadTestRun = () => {
    const clonedCandidates: ShortEDL[] = JSON.parse(
      JSON.stringify(HACKATHON_TEST_CANDIDATES)
    );
    setIsTestMode(true);
    setSourceInput({
      mode: 'YOUTUBE_URL',
      youtubeUrl: HACKATHON_TEST_YOUTUBE_URL,
      mimeType: 'video/mp4',
      nicheHint: HACKATHON_TEST_NICHE,
    });
    setTrendRadar(HACKATHON_TEST_TREND_RADAR);
    setTrendError(null);
    setPausesTightened(true);
    setCandidates(clonedCandidates);
    setSelectedCandidateId(clonedCandidates[0]?.id || null);
    setPipelineStatus({
      currentPass: null,
      error: null,
      steps: {
        PASS_1_SCOUT: {
          passId: 'PASS_1_SCOUT',
          stepNumber: 1,
          name: 'Pick a Moment',
          subtitle: 'We watched the whole thing and found the best stories',
          state: 'COMPLETED',
          summaryText: `${clonedCandidates.length} stories found`,
          completedAt: new Date().toISOString(),
        },
        PASS_2_SURGICAL_CUT: {
          passId: 'PASS_2_SURGICAL_CUT',
          stepNumber: 2,
          name: 'Snip the Fluff',
          subtitle: 'Removes filler words and tightens pauses automatically',
          state: 'COMPLETED',
          summaryText: 'Fillers & pauses snipped',
          completedAt: new Date().toISOString(),
        },
        PASS_3_AUTO_FRAMING: {
          passId: 'PASS_3_AUTO_FRAMING',
          stepNumber: 3,
          name: 'Make it Shine',
          subtitle: 'Watch your 9:16 Short, tweak the hook, and upload to YouTube',
          state: 'COMPLETED',
          summaryText: '9:16 ready',
          completedAt: new Date().toISOString(),
        },
        PASS_4_QA_CRITIC: {
          passId: 'PASS_4_QA_CRITIC',
          stepNumber: 4,
          name: 'Final Polish',
          subtitle: 'Smooths audio cuts and prepares your YouTube metadata',
          state: 'COMPLETED',
          summaryText: 'Ready to post',
          completedAt: new Date().toISOString(),
        },
      },
    });
    setChatMessages((prev) => [
      ...prev,
      {
        id: `test-loaded-${Date.now()}`,
        role: 'assistant',
        text: 'Loaded the Hackathon Test Run for https://www.youtube.com/watch?v=lggpuoaP_C8! All 4 Moments, Snip the Fluff, and Make it Shine are pre-populated and ready to demo.',
        timestamp: new Date().toISOString(),
        appliedActions: [
          'Test Mode Active',
          '4 Shorts Pre-Populated',
          'Instant MP4 Export Ready',
        ],
      },
    ]);
    // Pre-warm the cloud export sandbox in background
    fetch('/api/agents/warm-export', { method: 'POST' }).catch(() => {});
  };

  const handleRunSinglePass = async (passId: PipelinePassId) => {
    try {
      if (passId === 'PASS_1_SCOUT') {
        await runPass1Scout();
      } else if (passId === 'PASS_2_SURGICAL_CUT' && selectedCandidate) {
        await runPass2Surgical(selectedCandidate);
      } else if (passId === 'PASS_3_AUTO_FRAMING' && selectedCandidate) {
        await runPass3AutoFrame(selectedCandidate);
      } else if (passId === 'PASS_4_QA_CRITIC' && selectedCandidate) {
        await runPass4QACritic(selectedCandidate);
      }
    } catch {
      // Handled via header banner
    }
  };

  const handleRetryFailedPass = () => {
    if (!pipelineStatus.error) return;
    handleRunSinglePass(pipelineStatus.error.passId);
  };

  const handleToggleWord = (wordId: string) => {
    if (!selectedCandidate) return;
    const updated = toggleWordInEDL(selectedCandidate, wordId);
    replaceCandidate(updated);
  };

  const handleToggleCompoundGroup = (compoundGroupId: string) => {
    if (!selectedCandidate) return;
    const updated = toggleCompoundGroupInEDL(selectedCandidate, compoundGroupId);
    replaceCandidate(updated);
  };

  const handleToggleBulkFillers = (removeFillers: boolean) => {
    if (!selectedCandidate) return;
    const updated = setBulkFillerActionInEDL(selectedCandidate, removeFillers);
    replaceCandidate(updated);
  };

  // Apply structured actions returned by the Conversational Studio Agent
  const applyChatActions = async (actions: AgentChatAction[]): Promise<string[]> => {
    const appliedBadges: string[] = [];

    for (const act of actions) {
      if (act.type === 'LOAD_YOUTUBE_URL' && act.youtubeUrl) {
        const nextNiche = act.nicheHint || sourceInput.nicheHint;
        handleUpdateSourceInput({
          mode: 'YOUTUBE_URL',
          youtubeUrl: act.youtubeUrl,
          nicheHint: nextNiche,
        });
        appliedBadges.push('Loaded YouTube Video');
        void (async () => {
          try {
            const scouted = await runPass1Scout(act.youtubeUrl, nextNiche);
            navigate('/moments');
            if (scouted.length > 0) {
              void handleRunCandidateDeepPass(scouted[0]);
            }
          } catch {
            // handled in header
          }
        })();
      } else if (act.type === 'SCAN_TRENDS') {
        const targetNiche = act.nicheHint || sourceInput.nicheHint;
        if (act.nicheHint) {
          handleUpdateSourceInput({ nicheHint: act.nicheHint });
        }
        appliedBadges.push('Refreshed Weekly Trends');
        void handleScanTrends(targetNiche);
      } else if (act.type === 'SELECT_MOMENT' && act.momentIndex) {
        const idx = Math.max(0, Number(act.momentIndex) - 1);
        const target = candidates[idx];
        if (target) {
          setSelectedCandidateId(target.id);
          appliedBadges.push(`Selected Moment #${idx + 1}`);
        }
      } else if (act.type === 'SET_CAMERA_MODE' && selectedCandidate && act.cameraMode) {
        if (act.cameraMode !== 'AUTO') {
          const baseKfs =
            selectedCandidate.packaging.framingKeyframes?.length > 0
              ? selectedCandidate.packaging.framingKeyframes
              : buildCoarseAutoFramingKeyframes(
                  selectedCandidate.coarseSegments,
                  selectedCandidate.title
                );
          const updatedKfs = baseKfs.map((kf) =>
            applyFramingLayoutPreset(kf, act.cameraMode as any)
          );
          replaceCandidate({
            ...selectedCandidate,
            visualTrack: {
              ...selectedCandidate.visualTrack,
              framingKeyframes: updatedKfs,
            },
            packaging: {
              ...selectedCandidate.packaging,
              framingKeyframes: updatedKfs,
            },
          });
        }
        appliedBadges.push(`Camera: ${act.cameraMode}`);
      } else if (act.type === 'SET_ASPECT_RATIO' && selectedCandidate && act.aspectRatio) {
        const baseKfs =
          selectedCandidate.packaging.framingKeyframes?.length > 0
            ? selectedCandidate.packaging.framingKeyframes
            : buildCoarseAutoFramingKeyframes(
                selectedCandidate.coarseSegments,
                selectedCandidate.title
              );
        const updatedTrack = buildVisualTrack(
          baseKfs,
          selectedCandidate.packaging.bRollCues,
          selectedCandidate.packaging.dynamicCaptions,
          selectedCandidate.packaging.hookBanner.durationMs,
          act.aspectRatio
        );
        replaceCandidate({
          ...selectedCandidate,
          visualTrack: updatedTrack,
        });
        appliedBadges.push(`Format: ${act.aspectRatio}`);
      } else if (act.type === 'UPDATE_HOOK_TEXT' && selectedCandidate && act.hookText) {
        replaceCandidate({
          ...selectedCandidate,
          hookText: act.hookText,
          packaging: {
            ...selectedCandidate.packaging,
            hookBanner: {
              ...selectedCandidate.packaging.hookBanner,
              text: act.hookText,
            },
          },
        });
        appliedBadges.push(`Hook Updated`);
      } else if (
        act.type === 'TOGGLE_FILLERS' &&
        selectedCandidate &&
        typeof act.removeFillers === 'boolean'
      ) {
        handleToggleBulkFillers(act.removeFillers);
        appliedBadges.push(
          act.removeFillers ? 'Removed Filler Words' : 'Restored Filler Words'
        );
      } else if (
        act.type === 'TOGGLE_PAUSES' &&
        typeof act.tightenPauses === 'boolean'
      ) {
        setPausesTightened(act.tightenPauses);
        appliedBadges.push(
          act.tightenPauses ? 'Tightened Pauses' : 'Restored Pauses'
        );
      } else if (act.type === 'UPDATE_YOUTUBE_META' && selectedCandidate) {
        const currentMeta = buildYouTubePublishMetadata(
          selectedCandidate,
          selectedCandidate.packaging.youtubeMetadata
        );
        const nextMeta = buildYouTubePublishMetadata(selectedCandidate, {
          ...currentMeta,
          title: act.youtubeTitle || currentMeta.title,
          description: act.youtubeDescription || currentMeta.description,
          hashtags:
            act.youtubeHashtags && act.youtubeHashtags.length > 0
              ? act.youtubeHashtags
              : currentMeta.hashtags,
        });
        replaceCandidate({
          ...selectedCandidate,
          packaging: {
            ...selectedCandidate.packaging,
            youtubeMetadata: nextMeta,
          },
        });
        appliedBadges.push('Updated YouTube Title & Tags');
      } else if (act.type === 'NAVIGATE_STEP' && act.route) {
        navigate(act.route);
        appliedBadges.push(`Opened ${act.route}`);
      }
    }

    return appliedBadges;
  };

  const handleSendChatMessage = async (userText: string) => {
    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    try {
      const selectedIdx = selectedCandidate
        ? candidates.findIndex((c) => c.id === selectedCandidate.id)
        : undefined;

      const response = await requestAgentChat({
        userMessage: userText,
        currentRoute: location.pathname,
        youtubeUrl: sourceInput.youtubeUrl,
        nicheHint: sourceInput.nicheHint,
        candidatesSummary: candidates.map((c, index) => ({
          index,
          id: c.id,
          title: c.title,
          hookText: c.hookText,
          durationSec: c.estimatedNetDurationSec,
        })),
        selectedMomentIndex: selectedIdx !== -1 ? selectedIdx : undefined,
      });

      const appliedBadges = await applyChatActions(response.actions || []);

      const assistantMsg: AgentChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: response.reply,
        timestamp: new Date().toISOString(),
        appliedActions: appliedBadges,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      if (response.suggestedPrompts && response.suggestedPrompts.length > 0) {
        setSuggestedPrompts(response.suggestedPrompts);
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            err?.message ||
            'I ran into a quick hiccup. Try asking again or use the buttons on screen!',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const isPipelineRunning = Boolean(pipelineStatus.currentPass);
  const isDropRoute = location.pathname === '/drop' || location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1F1C18]">
      <ConsoleHeaderAndTelemetry
        pipelineStatus={pipelineStatus}
        candidates={candidates}
        selectedCandidate={selectedCandidate}
        onSelectCandidate={(id) => setSelectedCandidateId(id)}
        onRetryFailedPass={handleRetryFailedPass}
        onRunPass={handleRunSinglePass}
      />

      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<Navigate to="/drop" replace />} />
          <Route
            path="/drop"
            element={
              <DropPage
                sourceInput={sourceInput}
                onUpdateSourceInput={handleUpdateSourceInput}
                trendRadar={trendRadar}
                isScanningTrends={isScanningTrends}
                trendError={trendError}
                onScanTrends={handleScanTrends}
                onStartFullPipeline={handleStartFullPipeline}
                onResetStudio={handleResetStudio}
                onLoadTestRun={handleLoadTestRun}
                isTestMode={isTestMode}
                isPipelineRunning={isPipelineRunning}
                hasCandidates={candidates.length > 0}
                candidatesCount={candidates.length}
                chatMessages={chatMessages}
                suggestedPrompts={suggestedPrompts}
                isSendingChat={isSendingChat}
                onSendChatMessage={handleSendChatMessage}
              />
            }
          />
          <Route
            path="/moments"
            element={
              <ScoutPage
                candidates={candidates}
                selectedCandidate={selectedCandidate}
                previewObjectUrl={sourceInput.previewObjectUrl}
                trendRadar={trendRadar}
                onSelectCandidate={(id) => setSelectedCandidateId(id)}
                onRunCandidateDeepPass={handleRunCandidateDeepPass}
                isPipelineRunning={isPipelineRunning}
              />
            }
          />
          <Route path="/scout" element={<Navigate to="/moments" replace />} />
          <Route
            path="/snip"
            element={
              <SplitPage
                candidate={selectedCandidate}
                previewObjectUrl={sourceInput.previewObjectUrl}
                pausesTightened={pausesTightened}
                onToggleBulkFillers={handleToggleBulkFillers}
                onTogglePausesTightened={setPausesTightened}
                onToggleWord={handleToggleWord}
                onToggleCompoundGroup={handleToggleCompoundGroup}
                onRunSurgicalPass={async () => {
                  if (selectedCandidate) {
                    try {
                      await runPass2Surgical(selectedCandidate);
                    } catch {
                      // Handled in header
                    }
                  }
                }}
                isPipelineRunning={isPipelineRunning}
              />
            }
          />
          <Route path="/split" element={<Navigate to="/snip" replace />} />
          <Route
            path="/shine"
            element={
              <StagePage
                candidate={selectedCandidate}
                previewObjectUrl={sourceInput.previewObjectUrl}
                isTestMode={isTestMode}
                onUpdateCandidate={replaceCandidate}
                onRunAutoFramePass={async () => {
                  if (selectedCandidate) {
                    try {
                      await runPass3AutoFrame(selectedCandidate);
                    } catch {
                      // Handled in header
                    }
                  }
                }}
                onRunQACriticPass={async () => {
                  if (selectedCandidate) {
                    try {
                      await runPass4QACritic(selectedCandidate);
                    } catch {
                      // Handled in header
                    }
                  }
                }}
                isPipelineRunning={isPipelineRunning}
              />
            }
          />
          <Route path="/stage" element={<Navigate to="/shine" replace />} />
          <Route path="*" element={<Navigate to="/drop" replace />} />
        </Routes>
      </main>

      {/* Floating Agent Chat Drawer on /moments, /snip, and /shine */}
      {!isDropRoute && (
        <AgentChatPanel
          messages={chatMessages}
          suggestedPrompts={suggestedPrompts}
          isSending={isSendingChat}
          onSendMessage={handleSendChatMessage}
          variant="floating"
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StudioShell />
    </BrowserRouter>
  );
}
