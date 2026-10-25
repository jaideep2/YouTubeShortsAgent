# CONTEXT.md — Why & How We Are Building YouTubeShortsAgent

## 1. CORE PRODUCT CONTEXT (Enforced Everywhere)
- **App Name:** **YouTubeShortsAgent**
- **Target Audience:** Non-technical, small-time YouTube creators posting 1–2 long-form videos/week (podcasts, vlogs, tutorials) who need automated, daily 30–60s YouTube Shorts to drive traffic to their main channel.
- **Input Sources:** YouTube URL OR raw video file upload (`.mpeg` / `.mp4`).
- **Grounding Principle 1 — Authenticity:** Highlight genuine human moments (real laughter, vocal tone shifts, introspection, sudden insight). NEVER cut `[LAUGHTER]` (`😂 Laugh`) or emotional beats when removing filler.
- **Grounding Principle 2 — Editorial Taste:** Support both **One Smooth Take** (`CONTINUOUS_TAKE` — single uncut span) and **Stitched Story** (`COLLAGE_STITCH` — stitching a setup from one timestamp with a payoff minutes later, skipping boring mid-story tangents).
- **Grounding Principle 3 — Virality:** Ground clip selection in live weekly YouTube trends via Google Search, strip all conversational fat so no viewer time is wasted, open with a 3-second Hook Sticker, burn in dynamic word-synced karaoke captions, and apply smart 9:16 auto-framing:
  - 1 speaker -> **Just 1 Speaker** (`SINGLE_SPEAKER` — centered 9:16 focus).
  - 2 speakers conversing/reacting -> **Top & Bottom Split** (`SPLIT_TOP_BOTTOM` — Speaker A top 50%, Speaker B bottom 50%).
  - Screen share / demo -> **Screen Share + Face** (`CONTENT_ZOOM_PIP` — Top 70% zoomed into relevant content, Bottom 30% speaker PiP).
- **Unconstrained Source Window Rule:** A great 40s Short might come from a 3-to-5-minute raw source segment full of rambling or tangents. Step 1 can select 30s to 300s+ of raw source video as long as the **Final Short Length** after cuts is 30–60s.

---

## 2. HALLMARK "HUM" THEME & CREATOR-FRIENDLY VIBE (`https://www.usehallmark.com/`)
- **Palette & Material (Driftsong / Mixtape / Bubble Style):**
  - Warm sunlit paper & oat cream surfaces: `#FAF7F2`, `#F3EDE2`, `#E8E0D2`
  - Warm espresso ink: `#1F1C18` (with warm secondary text `#5C5346`)
  - Playful coral-terracotta: `#E05A47` for primary buttons and snipped filler words
  - Sunny honey-gold: `#F59E0B` for highlights and 3-second hook stickers
  - Meadow green: `#2D8A61` for kept laughs (`😂 Laugh`) and authentic moments
- **Zero Tech Jargon:** Never show developer terms (`ShortEDL`, `fileData.fileUri`, `±35ms zero-crossing`, `JSON schema`, `Pass 1/2/3/4`) in the UI.
- **Anti-AI-Slop Rules:** No dark cyberpunk neon, no `01. / 02.` robotic headers, no fake code/JSON boxes on screen. Use soft tactile cards, bouncy pill toggles, and friendly plain-English tooltips.

---

## 3. 4-STEP MULTI-PAGE WIZARD (`react-router-dom`) WITH REAL VIDEO ON EVERY PAGE
1. **Step 1 (`/drop` — "Drop a Video"):** *"Paste a YouTube link or drop your recording—we'll find the magic."* Big inviting dropzone for MP4/MPEG files or a YouTube link, immediate real video playback in a cozy frame, and friendly topic badges showing what's trending on YouTube this week.
2. **Step 2 (`/moments` — "Pick a Moment"):** *"We watched the whole thing and found the best stories."* Playful story cards (*"One Smooth Take"* or *"Stitched Story"*), showing *"From a 3m 40s chat → trimmed to a punchy 40s Short"*, playing the REAL video across those moments and automatically skipping boring middle tangents.
3. **Step 3 (`/snip` — "Snip the Fluff"):** *"Tap any 'umm' or rambling phrase to bring it back or snip it out."* Real playing video alongside large, bouncy, read-along word bubbles grouped by speaker. Simple fillers (*"umm"*, *"uh"*) and rambling phrases (*"and the thing is"*, *"so this is what I think"*) are crossed out in coral (`#E05A47`) with a scissors icon; real laughs (`😂 Laugh`) have a protective meadow-green (`#2D8A61`) sparkle badge. Real video automatically hops over crossed-out words as it plays.
4. **Step 4 (`/shine` — "Make it Shine"):** *"Watch your 9:16 Short, tweak the hook, and grab your video."* Full-size 9:16 vertical Remotion `<Player />` (`1080x1920`, 30fps) with friendly camera-mode switcher pills (**"Just 1 Speaker"**, **"Top & Bottom Split"**, **"Screen Share + Face"**), editable 3-second Hook Sticker, bouncy word-by-word karaoke captions, and cloud `ffmpeg` Sandbox Managed Agent export.

---

## 4. HYBRID AGENTS UNDER THE HOOD (100% REAL `@google/genai`, ZERO MOCK DATA)
- **Pipeline Agents (`gemini-4-argon`):** Fast multimodal and Google Search grounded Interactions API calls for Trend Discovery, Moment Scouting, Word-Level Fluff Snipping, 9:16 Auto-Framing, and Quality Check.
- **Cloud Video Exporter Managed Agent (`ai.agents.create` + `ai.interactions.create` with `base_agent: "antigravity-preview-09-2026"`, `environment: "remote"`):** Runs `ffmpeg` inside Google's cloud Linux VM when the creator clicks **"Export Final Short"** on `/shine`, presenting a playful step bar by default and keeping raw Linux sandbox logs tucked behind an optional *"Show nerdy details"* toggle.
