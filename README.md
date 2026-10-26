# YouTubeShortsAgent

**YouTubeShortsAgent** is an AI-native creator studio that turns long-form YouTube videos and podcast recordings into ready-to-publish **9:16 vertical YouTube Shorts** (or **1:1 square Shorts**).

Designed with a warm, tactile **Hallmark "Hum" aesthetic** for everyday content creators, the app hides complex video-editing timelines behind a 4-step creator flow (**Drop a Video → Pick a Moment → Snip the Fluff → Make it Shine**) and a conversational **Chat with Your YouTubeShortsAgent** assistant that can drive the entire workflow via natural language.

---

## Repository Structure

```text
/
├── server.ts                              # Express + Vite full-stack server; mounts /api/trends/* & /api/agents/* routes and warms the Cloud Export sandbox on boot
├── firebase-applet-config.json            # Google / Firebase OAuth client configuration (used for YouTube Data API v3 direct upload)
├── metadata.json                          # AI Studio applet metadata & capabilities
├── package.json                           # Scripts (dev, build, start) & dependencies (@google/genai, @remotion/player, express, lucide-react)
└── src/
    ├── App.tsx                            # Root state machine: manages 4-pass pipeline, Test/Reset demo state, sessionStorage persistence, and chat action dispatcher
    ├── main.tsx                           # React 19 entry point
    ├── tokens.css / base.css / index.css  # Hallmark "Hum" warm design tokens (Warm Alabaster #FAF7F2, Oatmeal #F3EDE2, Coral #E05A47, Meadow #2D8A61)
    ├── types/
    │   └── edl.ts                         # Complete TypeScript Edit Decision List (EDL) schema, 9:16 FramingKeyframe types, YouTube metadata & Agent Chat action types
    ├── data/
    │   └── hackathonTestRun.ts            # Pre-populated full run for https://www.youtube.com/watch?v=lggpuoaP_C8 (4 Moments, word-level transcripts, 9:16 framing, YouTube metadata)
    ├── services/
    │   ├── shortsAgents.ts                # ALL 7 AI Agents: prompts, tools, JSON response schemas, warm antigravity-preview-09-2026 sandbox manager, and ffmpeg MP4 renderer
    │   └── clientApi.ts                   # Frontend API client for /api/trends/radar and /api/agents/* with safe JSON parsing & automatic fast-export fallback
    ├── utils/
    │   ├── edlCompiler.ts                 # Deterministic EDL compiler: filler/pause detection, ±35ms audio zero-crossing padding, 9:16 crop presets, QA self-healing
    │   └── edlCompiler.test.ts            # 9-suite Node unit test runner (`npx tsx --test src/utils/edlCompiler.test.ts`)
    ├── remotion/
    │   └── ShortComposition.tsx           # Frame-accurate 30fps Remotion composition for 9:16 / 1:1 preview (Single Speaker, 50/50 Top-Bottom Split, 70/30 Screen+Face, Hook Sticker, Karaoke Captions)
    ├── components/
    │   ├── ConsoleHeaderAndTelemetry.tsx  # Sticky top navigation bar with 4 step pills, always-visible Reset & Test buttons, and active moment selector
    │   ├── AgentChatPanel.tsx             # Conversational Studio Agent UI (Hero mode on /drop + floating drawer across /moments, /snip, /shine)
    │   ├── RealVideoPlayer.tsx            # Click-to-play 9:16 reframed video player (dual-synchronized YouTube IFrame & HTML5 <video> with playsInline + muted compliance)
    │   └── UltravioletTooltip.tsx         # Tactile creator helper tooltips
    └── pages/
        ├── DropPage.tsx                   # Step 1 (/drop): Reset & Test demo bar, Weekly YouTube Trend Radar, Hero Chat Assistant, YouTube URL / MP4 dropzone
        ├── ScoutPage.tsx                  # Step 2 (/moments): Scrollable vertical feed of all reframed 9:16 Shorts + 1-tap Story Flow pills (Setup → Skipped Tangent → Payoff)
        ├── SplitPage.tsx                  # Step 3 (/snip): Clean filler & pause summary ("12 filler words • 13 pauses"), 1-tap bulk toggles, and optional word-by-word drawer
        └── StagePage.tsx                  # Step 4 (/shine): 9:16 Remotion preview, camera mode switcher, editable Hook Sticker, YouTube Title/Description/Hashtags, Download MP4, and Upload to YouTube OAuth modal
```

---

## Hybrid Agent Architecture (7 Agents Total)

All 7 agents are implemented in **[`src/services/shortsAgents.ts`](src/services/shortsAgents.ts)** and exposed via Express routes in **[`server.ts`](server.ts)**.

### Table of Agents — Files, Prompts, Tools & Configurations

| # | Agent Name | Source File & Function | Express Route | Model & SDK Method | Tools & Response Schema | Prompt Location & Purpose |
|---|---|---|---|---|---|---|
| **1** | **Weekly Trend Radar Agent** | `src/services/shortsAgents.ts`<br>`runTrendRadarAgent()`<br>*(lines 277–356)* | `POST /api/trends/radar`<br>(`server.ts` line 29) | `gemini-4-argon`<br>`ai.interactions.create`<br>`thinking_level: "low"` | **Tools:** `[{ type: "google_search" }]`<br>**Output:** Structured JSON (`weeklyPulseSummary`, `trendingTopics[]`, `sources[]`) | **Prompt:** `shortsAgents.ts` lines 284–308.<br>Researches live YouTube Shorts hooks, pacing formats, and retention triggers trending this week in the creator's niche. |
| **2** | **Moment Finder & Story Stitcher Agent (Pass 1)** | `src/services/shortsAgents.ts`<br>`runTrendAndScoutAgent()`<br>*(lines 363–655)* | `POST /api/agents/scout`<br>(`server.ts` line 42) | `gemini-4-argon`<br>`ai.interactions.create`<br>`thinking_level: "high"` | **Input:** Multimodal `video` (`fileUri` / YouTube URL)<br>**Tools:** `[{ type: "google_search" }, { type: "url_context" }]`<br>**Schema:** `scoutResponseSchema` *(lines 408–503)* | **Prompt:** `shortsAgents.ts` lines 373–406.<br>Watches the full episode, selects 3–4 high-retention story arcs (`30s–60s`), stitches non-contiguous setups & payoffs (`COLLAGE_STITCH`) to skip middle tangents, and generates initial 9:16 framing + YouTube metadata. |
| **3** | **Fluff & Pause Snipper Agent (Pass 2)** | `src/services/shortsAgents.ts`<br>`runEnhancedSurgicalCutAgent()`<br>*(lines 661–843)* + `src/utils/edlCompiler.ts` | `POST /api/agents/surgical-cut`<br>(`server.ts` line 64) | `gemini-4-argon`<br>`ai.interactions.create`<br>`thinking_level: "low"` | **Input:** Multimodal `video` + kept `coarseSegments`<br>**Schema:** `surgicalResponseSchema` *(lines 697–736)*<br>**Compiler:** `annotateSurgicalFillers()` & `compileFineTimeline()` | **Prompt:** `shortsAgents.ts` lines 673–695.<br>Extracts word-level speaker diarization (`Speaker 1`, `Speaker 2`), flags simple fillers (*"umm"*, *"uh"*) and rambling compound phrases (*"and the thing is"*), counts pauses (`>= 260ms`), and pads cuts by `±35ms` (`AUDIO_PADDING_MS = 35`). |
| **4** | **9:16 Smart Auto-Framing & Packaging Agent (Pass 3)** | `src/services/shortsAgents.ts`<br>`runAutoFramingAndPackagingAgent()`<br>*(lines 849–979)* | `POST /api/agents/auto-frame`<br>(`server.ts` line 83) | `gemini-4-argon`<br>`ai.interactions.create`<br>`thinking_level: "low"` | **Schema:** `framingResponseSchema` *(lines 873–932)*<br>**Compiler:** `buildSmartAutoFramingKeyframes()` & `buildYouTubePublishMetadata()` | **Prompt:** `shortsAgents.ts` lines 854–871.<br>Generates scene-by-scene 9:16 vertical camera layouts (`SINGLE_SPEAKER`, `SPLIT_TOP_BOTTOM` 50/50, `CONTENT_ZOOM_PIP` 70/30), 3-second opening Hook Sticker, B-roll ideas, and YouTube Shorts Title/Description/Hashtags. |
| **5** | **Quality Polish & Self-Healing Critic Agent (Pass 4)** | `src/services/shortsAgents.ts`<br>`runQACriticAndSelfHealAgent()`<br>*(lines 985–1031)* | `POST /api/agents/qa-critic`<br>(`server.ts` line 99) | `gemini-4-argon`<br>`ai.interactions.create`<br>`thinking_level: "low"` | **Compiler Tool:** `runDeterministicQASelfHeal()` in `src/utils/edlCompiler.ts` *(lines 506–605)* | **Prompt:** `shortsAgents.ts` lines 996–1005.<br>Audits net duration (`28s–58s`), heals jarring micro-cuts (`<450ms`), verifies audio zero-crossing padding, and produces creator-friendly quality notes. |
| **6** | **Conversational Studio Chat Agent** | `src/services/shortsAgents.ts`<br>`runCreatorStudioChatAgent()`<br>*(lines 1447–1575)* | `POST /api/agents/chat`<br>(`server.ts` line 139) | `gemini-4-argon`<br>`ai.interactions.create`<br>`thinking_level: "low"` | **Schema:** `chatResponseSchema` *(lines 1495–1536)*<br>**Action Dispatcher:** `applyChatActions()` in `src/App.tsx` *(lines 601–723)* | **Prompt:** `shortsAgents.ts` lines 1463–1493.<br>Translates natural language chat commands into structured studio actions (`LOAD_YOUTUBE_URL`, `RUN_PIPELINE`, `SELECT_MOMENT`, `SET_CAMERA_MODE`, `SET_ASPECT_RATIO`, `TOGGLE_FILLERS`, `TOGGLE_PAUSES`, `UPDATE_HOOK_TEXT`, `UPDATE_METADATA`, `NAVIGATE_STEP`). |
| **7** | **Cloud Sandbox MP4 Export Agent (Managed Agent)** | `src/services/shortsAgents.ts`<br>`warmUpCloudExportSandbox()` & `runCloudVideoExportAgent()`<br>*(lines 1033–1419)* | `POST /api/agents/warm-export`<br>`POST /api/agents/export-short`<br>(`server.ts` lines 115–137) | `agent: "antigravity-preview-09-2026"`<br>`environment: "remote"` (reuses warm `environmentId` + `previous_interaction_id`)<br>`model: "gemini-3.5-flash-lite"` | **Tools:** `[{ type: "code_execution" }]` (`max_total_tokens: "15000"`) + `/usr/bin/ffmpeg` (`renderRealShortMp4Binary()`, lines 1093–1215) | **Prompts:**<br>• Warm-up (`line 1057`): `Run ffmpeg -version \| head -n 1 in bash to warm up the video export sandbox`<br>• Export (`lines 1295–1297`): Executes `ffmpeg` (`libx264 -preset ultrafast`, `aac`, `720x1280` 9:16 crop + burned-in 3s Amber Hook Sticker) to produce the downloadable `.mp4`. |

---

## Detailed Breakdown of Agent Prompts, Schemas & Tools

### 1. Where are the Agent Prompts?
Every agent prompt is co-located with its agent runner in **`src/services/shortsAgents.ts`**:
- **Trend Radar Prompt (`lines 284–308`)**: Instructs `gemini-4-argon` to search live YouTube Shorts hooks in the user's niche and output 3 concrete hook formulas (`COLLAGE_STITCH` vs `CONTINUOUS_TAKE`).
- **Moment Finder & Story Stitcher Prompt (`lines 373–406`)**: Instructs `gemini-4-argon` (`thinking_level: "high"`) to act as an expert podcast/video editor, find 3–4 story moments (`30s–60s`), stitch setups and payoffs while marking middle tangents as `action: "SKIP"`, and assign 9:16 layout modes (`SINGLE_SPEAKER`, `SPLIT_TOP_BOTTOM`, `CONTENT_ZOOM_PIP`).
- **Surgical Cut Prompt (`lines 673–695`)**: Instructs `gemini-4-argon` (`thinking_level: "low"`) to produce word-accurate diarized transcripts, tag `SIMPLE_FILLER` (*"umm"*, *"uh"*) and `COMPOUND_FLUFF` (*"and the thing is"*), and preserve `[LAUGHTER]` reactions.
- **Auto-Framing & Packaging Prompt (`lines 854–871`)**: Instructs `gemini-4-argon` to generate 9:16 camera keyframes with normalized crop boxes (`[ymin, xmin, ymax, xmax]` in `0..1000`), a 3-second hook banner, B-roll cues, and YouTube Shorts Title/Description/Hashtags.
- **Conversational Studio Chat Prompt (`lines 1463–1493`)**: Gives the assistant awareness of the current route, loaded YouTube URL, candidate list, and active moment so it can emit structured UI actions alongside its natural-language reply.
- **Cloud Sandbox Export Prompt (`lines 1057` & `1295–1297`)**: Drives the `antigravity-preview-09-2026` remote Linux sandbox to run `ffmpeg` without streaming 150KB of base64 text through LLM tokens.

### 2. Where are the Deterministic Editing Tools (`src/utils/edlCompiler.ts`)?
To guarantee frame-accurate playback and zero-flicker audio/video transitions, the LLM agents pair with deterministic TypeScript compilers in **`src/utils/edlCompiler.ts`**:
- **`annotateSurgicalFillers()` (`lines 67–156`)**: Enforces word-level filler and compound-phrase tagging and computes `AUDIO_PADDING_MS = 35` (`±35ms` audio zero-crossing padding).
- **`compileFineTimeline()` (`lines 162–216`)**: Merges adjacent kept words across natural conversational breaths (`<= 650ms`) so the video player never stutters on micro-cuts.
- **`buildSmartAutoFramingKeyframes()` (`lines 285–379`)**: Computes 9:16 crop coordinates (`primaryCropBox` and `secondaryCropBox`) for 1-Speaker, 2-Speaker 50/50 Top/Bottom Split, and 70/30 Screen Share + Face layouts.
- **`runDeterministicQASelfHeal()` (`lines 506–605`)**: Automatically heals sub-450ms visual cuts and enforces YouTube Shorts duration bounds (`28s–58s`).

---

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run the full-stack Express + Vite development server on port 3000
npm run dev

# Run the deterministic EDL compiler unit test suite (9 test suites)
npx tsx --test src/utils/edlCompiler.test.ts

# Type-check and build for production
npm run build
```
