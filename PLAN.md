# PLAN.md — ShortsDirector AI Architecture & Multi-Agent Pipeline

## 1. Grounding Principles
- **Authenticity:** Highlight genuine laughs (`[LAUGHTER]`), vocal tone shifts (`[SIGH]`, `[EMPHASIS]`), and human moments. Never cut authentic emotional reactions when trimming conversational filler.
- **Taste:** Support both `CONTINUOUS_TAKE` and `COLLAGE_STITCH` (combining setup + payoff from different parts of the video, skipping mid-story tangents).
- **Virality:** Ground in live YouTube trends (Google Search), strip filler words, add a 3s Hook Banner, dynamic word-by-word captions, and smart 9:16 auto-framing (`SINGLE_SPEAKER`, `SPLIT_TOP_BOTTOM` 50%/50%, `CONTENT_ZOOM_PIP` 70%/30%).

## 2. Shared Data Contract (`ShortEDL` JSON)
- Single source of truth (`edl.json`) connecting all agents, the `/split` surgical console, and the `/stage` `@remotion/player` 9:16 video composition:
  - `coarseSegments`: Setup, Core Insight, Skipped Tangents, Payoff windows (`30s` to `300s+` unconstrained raw source span).
  - `enhancedTranscript`: Speaker-labeled millisecond words (`startMs`, `endMs`), vocal event tags (`[LAUGHTER]`), and filler classifications (`SIMPLE_FILLER`, `COMPOUND_FILLER`).
  - `fineTimeline`: Compiled kept word groups with `±35ms` audio padding (`paddingMs: 35`).
  - `visualTrack`: Synchronized 9:16 layout keyframes (`SINGLE_SPEAKER`, `SPLIT_TOP_BOTTOM`, `CONTENT_ZOOM_PIP`), B-roll overlays, and 3-second hook banner track.
  - `packaging`: Hook banner spec, framing keyframes, B-roll cues, word-synced dynamic captions, and thumbnail spec.
  - `qaReport`: Broadcast validation (`>=450ms` minimum cut duration, `25–60s` net duration, `100%` `[LAUGHTER]` preservation) and self-healing audit trail.

## 3. Multi-Agent Pipeline (`@google/genai` — `gemini-4-argon` via Interactions API)
- **Pass 1 (Trend & Scout Agent):** Watches full video natively (YouTube URL or uploaded MPEG/MP4 via Files API) + Google Search for niche trends. Picks 3–5 candidates with unconstrained raw source spans (`30s` to `300s+`) and `30–60s` Estimated Net Duration.
- **Pass 2 (Enhanced Transcript & Surgical Cut Agent):** Generates an Enhanced Transcript on candidate windows with Speaker Labels, Per-Word Millisecond Timestamps (`startMs`, `endMs`), and Vocal Event Tags (`[LAUGHTER]`, `[SIGH]`, `[EMPHASIS]`). Strips simple fillers (`"umm"`, `"uh"`) AND compound filler phrases (`"and the thing is"`, `"so this is what I think"`) while protecting `[LAUGHTER]`. Compiles kept words into `fineTimeline` with `35ms` audio padding.
- **Pass 3 (9:16 Auto-Framing & Packaging Agent):** Assigns 9:16 layouts (`SINGLE_SPEAKER` centered focus, `SPLIT_TOP_BOTTOM` 50%/50% for 2 speakers, `CONTENT_ZOOM_PIP` Top 70% content / Bottom 30% speaker PiP for screen-share), B-roll cues, 3s Hook Banner, and highlighted word-synced captions into `visualTrack` and `packaging`.
- **Pass 4 (QA Critic Agent & Remotion 9:16 Stage):** Validates cuts (`>=450ms`, `25–60s` total duration, `100%` `[LAUGHTER]` preserved) with self-healing retry, and renders inside a real `@remotion/player` 9:16 composition on `/stage`.
