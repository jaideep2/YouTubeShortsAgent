# YouTubeShortsAgent

**YouTubeShortsAgent** is an AI-native creator studio that turns long-form YouTube videos and podcast recordings into ready-to-publish **9:16 vertical YouTube Shorts** (or **1:1 square Shorts**).

Designed with a warm, tactile **Hallmark "Hum" aesthetic** for everyday content creators, the app hides complex video-editing timelines behind a 4-step creator flow (**Drop a Video → Pick a Moment → Snip the Fluff → Make it Shine**) and a conversational **Chat with Your YouTubeShortsAgent** assistant that can drive the entire workflow via natural language.

---

## Hybrid Agent Architecture (7 Agents Total)

Under the hood, **YouTubeShortsAgent** uses a **Hybrid Agent Architecture** powered by `@google/genai` (`models/gemini-4-argon` across the pipeline):
- **6 Fast Pipeline Agents (`ai.models.generateContent`)** for real-time interactive discovery, transcript cleanup, 9:16 auto-framing, quality checks, and conversational control.
- **1 Cloud Sandbox Managed Agent (`ai.agents.create` + `ai.interactions.create` with `base_agent: "antigravity-preview-09-2026"`, `environment: "remote"`)** that spins up an isolated cloud Linux VM to run `ffmpeg` and render the final downloadable MP4 binary.

### Summary Table of Agents

| # | Agent Name | Function / Endpoint | SDK Pattern & Model | Thinking / Grounding | What It Does |
|---|---|---|---|---|---|
| **1** | **Weekly Trend Radar Agent** | `runTrendRadarAgent`<br>`POST /api/trends/radar` | `ai.models.generateContent`<br>`gemini-4-argon` | `thinkingLevel: "LOW"` + `tools: [{ googleSearch: {} }]` | Scans live YouTube Shorts trends in the creator's niche and surfaces 3 trending hook formulas and story formats. |
| **2** | **Moment Finder & Story Stitcher Agent (Pass 1)** | `runTrendAndScoutAgent`<br>`POST /api/agents/scout` | `ai.models.generateContent`<br>`gemini-4-argon` | Multimodal `fileData` (YouTube URI or uploaded MP4) + `thinkingLevel: "HIGH"` | Watches the full source video, finds the top 3 viral story moments (`30s–60s`), stitches non-contiguous setups & payoffs while skipping boring middle tangents, and generates initial 9:16 framing + YouTube metadata. |
| **3** | **Fluff & Pause Snipper Agent (Pass 2)** | `runEnhancedSurgicalCutAgent`<br>`POST /api/agents/surgical-cut` | `ai.models.generateContent`<br>`gemini-4-argon` | Multimodal `fileData` + `thinkingLevel: "LOW"` + deterministic compiler | Extracts word-by-word speaker diarization with millisecond timestamps, flags simple fillers (*"umm"*, *"uh"*) and rambling compound phrases (*"and the thing is"*), tightens dead-air pauses, and pads audio cuts by `±35ms` for smooth transitions. |
| **4** | **9:16 Smart Auto-Framing & Packaging Agent (Pass 3)** | `runAutoFramingAndPackagingAgent`<br>`POST /api/agents/auto-frame` | `ai.models.generateContent`<br>`gemini-4-argon` | `thinkingLevel: "LOW"` + strict JSON schema | Generates dynamic 9:16 camera crop keyframes (`SINGLE_SPEAKER`, `SPLIT_TOP_BOTTOM` 50/50 for 2 speakers, `CONTENT_ZOOM_PIP` 70/30 for screen share + face), 3-second opening hook stickers, karaoke caption groups, and YouTube Shorts Title/Description/Hashtags. |
| **5** | **Quality Polish & Self-Healing Critic Agent (Pass 4)** | `runQACriticAndSelfHealAgent`<br>`POST /api/agents/qa-critic` | `ai.models.generateContent`<br>`gemini-4-argon` | `thinkingLevel: "LOW"` + deterministic self-heal | Audits net duration (`28s–58s`), heals jarring micro-cuts (`<450ms`), verifies audio zero-crossing padding, and ensures natural pacing. |
| **6** | **Conversational Studio Chat Agent** | `runCreatorStudioChatAgent`<br>`POST /api/agent/chat` | `ai.models.generateContent`<br>`gemini-4-argon` | `thinkingLevel: "LOW"` + structured action schema | Front-and-center chat assistant that translates natural language requests (*"Find Shorts from this link"*, *"Switch camera to Top & Bottom split"*, *"Remove filler words"*, *"Rewrite title"*) into live studio actions (`LOAD_YOUTUBE_URL`, `SET_CAMERA_MODE`, `TOGGLE_FILLERS`, `TOGGLE_PAUSES`, `UPDATE_METADATA`, `NAVIGATE_STEP`). |
| **7** | **Cloud Sandbox MP4 Export Agent (Managed Agent)** | `runCloudVideoExportAgent`<br>`POST /api/agents/export-short` | `ai.agents.create` + `ai.interactions.create`<br>`base_agent: "antigravity-preview-09-2026"` | `environment: "remote"` (Cloud Linux VM + `ffmpeg`) | Provisions a remote Linux container, executes `ffmpeg` to stitch kept story beats, crop to `1080x1920` (9:16), burn in the 3-second hook banner, and return the base64-encoded MP4 binary for download or direct upload to YouTube. |

---

## How Each Agent Works in the 4-Step Creator Flow

### Step 1: Drop a Video (`/drop`)
- **Weekly Trend Radar Agent (`runTrendRadarAgent`)** runs at the top of the screen using Google Search grounding (`tools: [{ googleSearch: {} }]`) with `thinkingLevel: "LOW"` for fast turnaround, showing 3 actionable YouTube Shorts hook formulas trending this week.
- **Conversational Studio Chat Agent (`runCreatorStudioChatAgent`)** sits front and center so creators can paste a YouTube URL or ask the agent to frame, trim, or title their Short directly in chat.
- Creators can also paste any YouTube URL or drag-and-drop an `.mp4` / `.mpeg` recording into the dropzone.

### Step 2: Pick a Moment (`/moments`)
- **Moment Finder & Story Stitcher Agent (`runTrendAndScoutAgent`)** ingests the full video via `fileData: { fileUri, mimeType: "video/mp4" }` with `thinkingLevel: "HIGH"` so the model deeply reasons over narrative arcs.
- It identifies 3 candidate Shorts, choosing between:
  - **One Smooth Take (`CONTINUOUS_TAKE`)**: A single uninterrupted highlight.
  - **Stitched Story (`COLLAGE_STITCH`)**: Combines a setup (`[02:10–02:28]`) and payoff (`[04:48–05:15]`) while automatically skipping a boring middle tangent (`[02:28–04:48]`).
- Every moment is displayed in a scrollable vertical feed showing **only the 9:16 Reframed Output** (paused on load, playing with real sound when clicked) and simple 1-tap **Story Flow** pills.

### Step 3: Snip the Fluff (`/snip`)
- **Fluff & Pause Snipper Agent (`runEnhancedSurgicalCutAgent`)** analyzes the selected story's audio/video segment (`thinkingLevel: "LOW"`) and pairs with our deterministic EDL compiler (`src/utils/edlCompiler.ts`) to:
  - Detect simple filler words (*"umm"*, *"uh"*, *"erm"*) and multi-word rambling phrases (*"and the thing is"*, *"you know what I mean"*).
  - Count natural speech pauses (`>= 260ms` gaps) and tighten dead air.
  - Apply `±35ms` audio zero-crossing padding (`AUDIO_PADDING_MS = 35`) around every cut so words never sound clipped.
- Instead of overwhelming the creator with a wall of crossed-out text, the UI presents a clean summary card (**e.g., `12 filler words • 13 pauses`**) with two 1-tap toggle buttons (**Filler Words Removed** and **Pauses Tightened**), plus an optional collapsible word-by-word drawer.

### Step 4: Make it Shine & Upload to YouTube (`/shine`)
- **9:16 Smart Auto-Framing & Packaging Agent (`runAutoFramingAndPackagingAgent`)** and **Quality Polish Agent (`runQACriticAndSelfHealAgent`)** configure the final vertical Short inside the live **Remotion `<Player />`**:
  - **1 Speaker (`SINGLE_SPEAKER`)**: Centers the active speaker in 9:16.
  - **Top & Bottom Split (`SPLIT_TOP_BOTTOM`)**: Stacks Speaker 1 (top 50%) and Speaker 2 (bottom 50%) when two people are conversing.
  - **Screen Share + Face (`CONTENT_ZOOM_PIP`)**: Zooms into shared content on the top 70% while keeping the speaker's face on the bottom 30%.
- Generates copy-ready **YouTube Shorts Title** (`<= 100 chars` with `#Shorts`), **Description**, and **Hashtags**.
- **Cloud Sandbox MP4 Export Agent (`runCloudVideoExportAgent`)** & **Direct YouTube Upload**:
  - Clicking **Download MP4** or **Upload to YouTube** invokes the **Sandbox Managed Agent** (`antigravity-preview-09-2026` in `remote` mode) to assemble the 9:16 MP4 binary via `ffmpeg`.
  - Clicking **Upload to YouTube** opens the OAuth confirmation modal (`youtube.upload` and `youtube.readonly` scopes) so creators can sign in with Google, choose visibility (*Unlisted*, *Private*, or *Public*), and publish directly to their YouTube channel via the YouTube Data API v3 resumable upload protocol.

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
