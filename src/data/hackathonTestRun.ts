import type {
  CoarseSegment,
  EnhancedWord,
  ShortEDL,
  TrendRadarResult,
} from '../types/edl';
import {
  AUDIO_PADDING_MS,
  annotateSurgicalFillers,
  buildDynamicCaptions,
  buildSmartAutoFramingKeyframes,
  buildVisualTrack,
  buildYouTubePublishMetadata,
  compileFineTimeline,
  recalculateEDLFromWords,
  runDeterministicQASelfHeal,
} from '../utils/edlCompiler';

export const HACKATHON_TEST_YOUTUBE_URL =
  'https://www.youtube.com/watch?v=lggpuoaP_C8';

export const HACKATHON_TEST_NICHE =
  'Tech Podcasts, Indie Founders & Creator Storytelling';

export const HACKATHON_TEST_TREND_RADAR: TrendRadarResult = {
  nicheQuery: HACKATHON_TEST_NICHE,
  scannedAt: new Date().toISOString(),
  weeklyPulseSummary:
    'This week on YouTube Shorts: Economics & tech podcast clips that open with a bold contrarian number in the first 3 seconds and stitch the host setup directly into a two-speaker reaction payoff are driving 78%+ completion rates.',
  trendingTopics: [
    {
      id: 'trend-1',
      hookFormula: "CANADA'S NEW WEALTH TAX IS BACKFIRING 🇨🇦💸",
      topicAngle:
        'Stitching Norway capital-flight numbers directly into the founder brain-drain takeaway',
      whyTrendingNow:
        'Viewers stay for the real dollar math and unscripted co-host debate.',
      recommendedStructure: 'COLLAGE_STITCH',
      targetEmotion: '[EMPHASIS] + Sudden Insight',
    },
    {
      id: 'trend-2',
      hookFormula: 'WHY SMART FOUNDERS FAKE ROADBLOCKS FOR VCs 😂📈',
      topicAngle:
        'Unfiltered startup fundraising confession with shared laughter',
      whyTrendingNow:
        'High-trust founder honesty in a single smooth take outperforms scripted advice.',
      recommendedStructure: 'CONTINUOUS_TAKE',
      targetEmotion: '[LAUGHTER] + Founder Confession',
    },
    {
      id: 'trend-3',
      hookFormula: "BIG TECH'S $3 TRILLION HIDDEN AI DEBT BOMB 💣📉",
      topicAngle:
        '9:16 Top & Bottom split breaking down the WSJ AI infrastructure report',
      whyTrendingNow:
        'Contrarian AI bubble math triggers high comment velocity and shares.',
      recommendedStructure: 'COLLAGE_STITCH',
      targetEmotion: '[EMPHASIS] + Contrarian Breakdown',
    },
  ],
  sources: [
    {
      title: 'YouTube Creators — Shorts Retention Playbook',
      url: 'https://www.youtube.com/creators/shorts/',
    },
    {
      title: 'Wasted Wanderers Podcast Episode',
      url: HACKATHON_TEST_YOUTUBE_URL,
    },
  ],
};

interface RawSeedMoment {
  id: string;
  title: string;
  structure: 'CONTINUOUS_TAKE' | 'COLLAGE_STITCH';
  rawSourceStartSec: number;
  rawSourceEndSec: number;
  rawSourceDurationSec: number;
  estimatedNetDurationSec: number;
  viralityScore: number;
  authenticityScore: number;
  hookText: string;
  hookSubtext: string;
  whyItWorks: string;
  authenticityMoment: string;
  coarseSegments: CoarseSegment[];
  spokenScriptTokens: Array<{
    speaker: string;
    tokens: string[];
  }>;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeHashtags: string[];
}

const RAW_SEED_MOMENTS: RawSeedMoment[] = [
  {
    id: 'cand-1',
    title: 'Why Billionaire Exit Taxes Always Backfire',
    structure: 'COLLAGE_STITCH',
    rawSourceStartSec: 158,
    rawSourceEndSec: 1215,
    rawSourceDurationSec: 1057,
    estimatedNetDurationSec: 44,
    viralityScore: 96,
    authenticityScore: 98,
    hookText: "CANADA'S NEW WEALTH TAX IS BACKFIRING 🇨🇦💸",
    hookSubtext: 'Story Stitch • 16m Tangent Skipped',
    whyItWorks:
      'Compresses a 17.6-minute policy debate into a punchy 44-second Short by skipping 992s of tax-bracket tangents and stitching JD’s Norway wealth-tax data directly to Abhi’s founder brain-drain payoff.',
    authenticityMoment:
      'Preserves JD and Abhi’s spontaneous reaction when comparing Norway’s $54B billionaire exodus to Canadian tech founders.',
    coarseSegments: [
      {
        id: 'cand-1-seg-1',
        label: 'HOOK',
        startSec: 158,
        endSec: 176,
        summary: 'JD breaks down Canada’s capital gains hike & Norway’s wealth tax experiment',
        included: true,
      },
      {
        id: 'cand-1-seg-2',
        label: 'TANGENT_SKIP',
        startSec: 176,
        endSec: 1168,
        summary: 'Skipped 992s tangent on municipal tax brackets and historical treaties',
        included: false,
      },
      {
        id: 'cand-1-seg-3',
        label: 'PAYOFF',
        startSec: 1168,
        endSec: 1215,
        summary: 'Abhi’s payoff on why mobile founders leave and tax revenue actually drops',
        included: true,
      },
    ],
    spokenScriptTokens: [
      {
        speaker: 'Speaker 1 (JD)',
        tokens: [
          'Canada', 'just', 'hiked', 'capital', 'gains', 'taxes', 'thinking', 'it', 'would', 'bring',
          'in', 'billions,', 'umm', 'and', 'the', 'thing', 'is', 'Norway', 'tried', 'this',
          'exact', 'wealth', 'tax', 'play', 'last', 'year', '[EMPHASIS]', 'and', 'it', 'completely',
          'backfired.', 'Over', 'fifty', 'billion', 'dollars', 'in', 'founder', 'net', 'worth', 'uh',
          'literally', 'walked', 'out', 'the', 'door', 'to', 'Switzerland.',
        ],
      },
      {
        speaker: 'Speaker 2 (Abhi)',
        tokens: [
          '[LAUGHTER]', 'Right,', 'so', 'this', 'is', 'what', 'I', 'think', 'politicians', 'always',
          'miss', 'about', 'tech', 'founders.', 'Capital', 'and', 'ambitious', 'builders', 'are', 'umm',
          'more', 'mobile', 'than', 'ever,', 'so', 'you', 'end', 'up', 'collecting', 'less',
          'tax', 'revenue', '[EMPHASIS]', 'while', 'losing', 'every', 'future', 'startup', 'job.',
        ],
      },
    ],
    youtubeTitle: "Why Canada's New Wealth Tax Is Backfiring 🇨🇦💸 #Shorts",
    youtubeDescription:
      "When Norway hiked its wealth tax, a record wave of founders and $54B in capital left the country—resulting in a net loss in tax revenue.\n\nIn this clip from Wasted Wanderers, JD and Abhi connect Norway's experiment to Canada's capital gains tax hike and explain why taxing mobile startup builders backfires.\n\n#Shorts #YouTubeShorts #TechPodcast #Economics #StartupFounders #CanadaTax #WealthTax",
    youtubeHashtags: [
      '#Shorts',
      '#YouTubeShorts',
      '#TechPodcast',
      '#Economics',
      '#StartupFounders',
      '#CanadaTax',
      '#WealthTax',
    ],
  },
  {
    id: 'cand-2',
    title: 'Why Smart Founders Fake Roadblocks for Impatient VCs',
    structure: 'CONTINUOUS_TAKE',
    rawSourceStartSec: 1959,
    rawSourceEndSec: 2150,
    rawSourceDurationSec: 191,
    estimatedNetDurationSec: 41,
    viralityScore: 94,
    authenticityScore: 97,
    hookText: 'WHY SMART FOUNDERS FAKE ROADBLOCKS FOR VCs 😂📈',
    hookSubtext: 'One Smooth Take • Unfiltered Founder Story',
    whyItWorks:
      'Turns a 3-minute candid fundraising story into a tight 41-second continuous Short by stripping 11 filler words and dead air while protecting the co-hosts’ real laughter.',
    authenticityMoment:
      'Keeps the unscripted shared laughter when Abhi explains why delivering a 10x engineering fix too early makes investors suspicious.',
    coarseSegments: [
      {
        id: 'cand-2-seg-1',
        label: 'SETUP',
        startSec: 1959,
        endSec: 1982,
        summary: 'Why solving a hard technical problem in 48 hours scares impatient VCs',
        included: true,
      },
      {
        id: 'cand-2-seg-2',
        label: 'TANGENT_SKIP',
        startSec: 1982,
        endSec: 2128,
        summary: 'Skipped 146s side story on enterprise procurement paperwork',
        included: false,
      },
      {
        id: 'cand-2-seg-3',
        label: 'PAYOFF',
        startSec: 2128,
        endSec: 2150,
        summary: 'How veteran founders stage milestone updates so VCs feel the Sweat Equity',
        included: true,
      },
    ],
    spokenScriptTokens: [
      {
        speaker: 'Speaker 2 (Abhi)',
        tokens: [
          'If', 'you', 'solve', 'a', 'massive', 'engineering', 'problem', 'in', 'two', 'days,',
          'umm', 'and', 'the', 'thing', 'is', 'your', 'investors', 'assume', 'it', 'was',
          'easy', 'all', 'along.', '[LAUGHTER]', 'They', 'literally', 'do', 'not', 'value', 'it',
          'unless', 'they', 'see', 'you', 'sweat', 'for', 'two', 'weeks.',
        ],
      },
      {
        speaker: 'Speaker 1 (JD)',
        tokens: [
          '[LAUGHTER]', 'That', 'is', 'so', 'true,', 'uh', 'so', 'this', 'is', 'what',
          'I', 'think', 'every', 'second-time', 'founder', 'learns:', 'you', 'ship', 'the', 'fix',
          'on', 'Tuesday,', 'umm', 'and', 'you', 'present', 'the', 'miracle', 'breakthrough', 'at',
          'next', 'Friday’s', 'board', 'meeting', '[EMPHASIS]', 'like', 'you', 'barely', 'survived.',
        ],
      },
    ],
    youtubeTitle: 'Why Smart Founders Stage Roadblocks for Impatient VCs 😂📈 #Shorts',
    youtubeDescription:
      "Solve a brutal engineering bottleneck in 48 hours and investors think it was trivial. Pace the milestone update over two weeks and you're a hero.\n\nAbhi and JD share an unfiltered truth about startup board meetings and founder psychology.\n\n#Shorts #YouTubeShorts #StartupLife #VentureCapital #IndieFounders #TechPodcast",
    youtubeHashtags: [
      '#Shorts',
      '#YouTubeShorts',
      '#StartupLife',
      '#VentureCapital',
      '#IndieFounders',
      '#TechPodcast',
    ],
  },
  {
    id: 'cand-3',
    title: "Big Tech's Hidden $3T AI Debt Bomb",
    structure: 'COLLAGE_STITCH',
    rawSourceStartSec: 1468,
    rawSourceEndSec: 1857,
    rawSourceDurationSec: 389,
    estimatedNetDurationSec: 48,
    viralityScore: 95,
    authenticityScore: 94,
    hookText: "BIG TECH'S $3 TRILLION HIDDEN AI DEBT BOMB 💣📉",
    hookSubtext: 'Story Stitch • WSJ Report Breakdown',
    whyItWorks:
      'Distills a 6.5-minute deep dive on Wall Street Journal’s AI infrastructure report into a 48-second financial breakdown, skipping 328s of municipal bond analogies.',
    authenticityMoment:
      'Captures JD’s sharp emphasis on off-balance-sheet GPU leases paired with Abhi’s cash-flow reality check.',
    coarseSegments: [
      {
        id: 'cand-3-seg-1',
        label: 'SETUP',
        startSec: 1468,
        endSec: 1495,
        summary: 'JD unpacks the WSJ report on $3T in AI data-center debt',
        included: true,
      },
      {
        id: 'cand-3-seg-2',
        label: 'TANGENT_SKIP',
        startSec: 1495,
        endSec: 1823,
        summary: 'Skipped 328s tangent on 1990s telecom fiber leases',
        included: false,
      },
      {
        id: 'cand-3-seg-3',
        label: 'PAYOFF',
        startSec: 1823,
        endSec: 1857,
        summary: 'Abhi reveals how hyperscaler free cash flow is turning negative',
        included: true,
      },
    ],
    spokenScriptTokens: [
      {
        speaker: 'Speaker 1 (JD)',
        tokens: [
          'Everyone', 'thinks', 'Big', 'Tech', 'is', 'funding', 'AI', 'data', 'centers', 'purely',
          'with', 'cash,', 'umm', 'and', 'the', 'thing', 'is', 'the', 'Wall', 'Street',
          'Journal', 'just', 'exposed', 'nearly', 'three', 'trillion', 'dollars', '[EMPHASIS]', 'in', 'hidden',
          'infrastructure', 'debt', 'and', 'private', 'credit', 'leases.',
        ],
      },
      {
        speaker: 'Speaker 2 (Abhi)',
        tokens: [
          'And', 'uh', 'so', 'this', 'is', 'what', 'I', 'think', 'scares', 'Wall',
          'Street', 'most:', 'free', 'cash', 'flow', 'at', 'major', 'hyperscalers', 'is', 'umm',
          'actually', 'turning', 'negative', '[EMPHASIS]', 'before', 'enterprise', 'AI', 'software', 'revenue', 'even',
          'shows', 'up', 'on', 'the', 'balance', 'sheet.',
        ],
      },
    ],
    youtubeTitle: "Big Tech's Hidden $3 Trillion AI Debt Bomb 💣📉 #Shorts",
    youtubeDescription:
      "Is the AI data-center boom really funded by cash reserves, or by $3 trillion in structured debt and private credit leases?\n\nJD and Abhi break down the Wall Street Journal's AI infrastructure report in under 50 seconds.\n\n#Shorts #YouTubeShorts #AIBubble #BigTech #WallStreet #TechNews #PodcastClips",
    youtubeHashtags: [
      '#Shorts',
      '#YouTubeShorts',
      '#AIBubble',
      '#BigTech',
      '#WallStreet',
      '#TechNews',
      '#PodcastClips',
    ],
  },
  {
    id: 'cand-4',
    title: "Transferred 25 Times in 21 Years: Mumbai's Viral Food Inspector",
    structure: 'COLLAGE_STITCH',
    rawSourceStartSec: 2345,
    rawSourceEndSec: 2753,
    rawSourceDurationSec: 408,
    estimatedNetDurationSec: 46,
    viralityScore: 97,
    authenticityScore: 99,
    hookText: 'TRANSFERRED 25 TIMES FOR DOING HIS JOB?! 🇮🇳🔥',
    hookSubtext: 'Story Stitch • 2 Tangents Skipped',
    whyItWorks:
      'Extracts a high-retention 46-second character story from a 6.8-minute segment about IAS officer Tukaram Mundhe’s viral Mumbai restaurant kitchen raids and 25 transfers in 21 years.',
    authenticityMoment:
      'Preserves both hosts’ genuine admiration and laughter as they recount how citizens cheered his surprise inspections.',
    coarseSegments: [
      {
        id: 'cand-4-seg-1',
        label: 'SETUP',
        startSec: 2345,
        endSec: 2366,
        summary: 'IAS officer Tukaram Mundhe’s surprise raids on luxury Mumbai kitchens',
        included: true,
      },
      {
        id: 'cand-4-seg-2',
        label: 'TANGENT_SKIP',
        startSec: 2366,
        endSec: 2487,
        summary: 'Skipped 121s tangent on municipal licensing paperwork',
        included: false,
      },
      {
        id: 'cand-4-seg-3',
        label: 'CORE_INSIGHT',
        startSec: 2487,
        endSec: 2505,
        summary: 'Why corrupt lobbies transferred him 25 times in 21 years',
        included: true,
      },
      {
        id: 'cand-4-seg-4',
        label: 'TANGENT_SKIP',
        startSec: 2505,
        endSec: 2731,
        summary: 'Skipped 226s tangent on regional zoning boards',
        included: false,
      },
      {
        id: 'cand-4-seg-5',
        label: 'PAYOFF',
        startSec: 2731,
        endSec: 2753,
        summary: 'How the public turned him into a folk hero across India',
        included: true,
      },
    ],
    spokenScriptTokens: [
      {
        speaker: 'Speaker 2 (Abhi)',
        tokens: [
          'This', 'Indian', 'civil', 'servant', 'Tukaram', 'Mundhe', 'walked', 'straight', 'into', 'five-star',
          'Mumbai', 'restaurant', 'kitchens', 'unannounced,', 'umm', 'and', 'the', 'thing', 'is', 'he',
          'shut', 'down', 'violators', 'on', 'the', 'spot', '[EMPHASIS]', 'no', 'matter', 'who', 'owned',
          'them.',
        ],
      },
      {
        speaker: 'Speaker 1 (JD)',
        tokens: [
          '[LAUGHTER]', 'And', 'because', 'he', 'refused', 'to', 'back', 'down,', 'uh', 'so',
          'this', 'is', 'what', 'I', 'think', 'is', 'wild:', 'politicians', 'transferred', 'him',
          'twenty-five', 'times', 'in', 'twenty-one', 'years,', 'umm', 'yet', 'every', 'city', 'he',
          'lands', 'in', 'treats', 'him', 'like', 'a', 'superhero', '[EMPHASIS].',
        ],
      },
    ],
    youtubeTitle: 'Transferred 25 Times in 21 Years for Doing His Job?! 🇮🇳🔥 #Shorts',
    youtubeDescription:
      "IAS officer Tukaram Mundhe became a viral hero across India for conducting unannounced food-safety raids on powerful restaurant chains—getting transferred 25 times in 21 years for refusing to compromise.\n\nWatch JD and Abhi break down his wild story on Wasted Wanderers.\n\n#Shorts #YouTubeShorts #IndiaStories #TukaramMundhe #FoodSafety #PodcastHighlights",
    youtubeHashtags: [
      '#Shorts',
      '#YouTubeShorts',
      '#IndiaStories',
      '#TukaramMundhe',
      '#FoodSafety',
      '#PodcastHighlights',
    ],
  },
];

function buildCompleteSeedCandidate(seed: RawSeedMoment): ShortEDL {
  let cursorMs = seed.rawSourceStartSec * 1000;
  let wordIndex = 1;
  const rawWords: EnhancedWord[] = [];

  for (const turn of seed.spokenScriptTokens) {
    // Add a natural 420ms inter-speaker pause so the Pause Tightener has real pauses to count & tighten
    cursorMs += 420;
    for (let i = 0; i < turn.tokens.length; i++) {
      const token = turn.tokens[i];
      const isTag =
        token === '[LAUGHTER]' || token === '[EMPHASIS]' || token === '[SIGH]';
      const durMs = isTag ? 480 : 520;
      // Add an occasional 380ms mid-sentence pause every 7 words
      if (i > 0 && i % 7 === 0) {
        cursorMs += 380;
      }
      const startMs = cursorMs;
      const endMs = startMs + durMs;
      cursorMs = endMs + 45;

      rawWords.push({
        id: `${seed.id}-w-${wordIndex++}`,
        word: token,
        speaker: turn.speaker,
        startMs,
        endMs,
        action: 'KEEP',
        fillerType: 'NONE',
        vocalTag: isTag
          ? (token as '[LAUGHTER]' | '[EMPHASIS]' | '[SIGH]')
          : undefined,
      });
    }
  }

  const annotatedWords = annotateSurgicalFillers(rawWords);
  const fineTimeline = compileFineTimeline(annotatedWords, AUDIO_PADDING_MS);
  const framingKeyframes = buildSmartAutoFramingKeyframes(
    annotatedWords,
    fineTimeline
  );
  const dynamicCaptions = buildDynamicCaptions(annotatedWords, fineTimeline, 4);

  const bRollCues = [
    {
      id: `${seed.id}-broll-1`,
      startMs: 4000,
      endMs: 9000,
      visualPrompt: `High-contrast headline cutout & chart overlay for "${seed.title}"`,
      overlayStyle: 'TOP_HALF_INSERT' as const,
    },
    {
      id: `${seed.id}-broll-2`,
      startMs: 16000,
      endMs: 22000,
      visualPrompt: 'Split-screen reaction zoom with key metric callout card',
      overlayStyle: 'FLOATING_CARD' as const,
    },
  ];

  const visualTrack = buildVisualTrack(
    framingKeyframes,
    bRollCues,
    dynamicCaptions,
    3000,
    '9:16'
  );

  const baseCandidate: ShortEDL = {
    id: seed.id,
    title: seed.title,
    structure: seed.structure,
    sourceVideoUri: HACKATHON_TEST_YOUTUBE_URL,
    sourceMimeType: 'video/mp4',
    rawSourceStartSec: seed.rawSourceStartSec,
    rawSourceEndSec: seed.rawSourceEndSec,
    rawSourceDurationSec: seed.rawSourceDurationSec,
    estimatedNetDurationSec: seed.estimatedNetDurationSec,
    viralityScore: seed.viralityScore,
    authenticityScore: seed.authenticityScore,
    hookText: seed.hookText,
    whyItWorks: seed.whyItWorks,
    authenticityMoment: seed.authenticityMoment,
    trendContext: {
      nicheQuery: HACKATHON_TEST_NICHE,
      trendInsight:
        'Grounded in this week’s top YouTube Shorts retention pattern: 3s contrarian hook + tangent skip + two-speaker payoff.',
      viralFormatPattern:
        seed.structure === 'COLLAGE_STITCH'
          ? 'Setup + Tangent Skip + Payoff Stitch'
          : 'Single Uncut Highlight',
      sources: HACKATHON_TEST_TREND_RADAR.sources,
    },
    coarseSegments: seed.coarseSegments,
    fineTimeline,
    visualTrack,
    packaging: {
      hookBanner: {
        text: seed.hookText,
        subtext: seed.hookSubtext,
        durationMs: 3000,
      },
      framingKeyframes,
      bRollCues,
      dynamicCaptions,
      thumbnailSpec: {
        timestampSec: seed.rawSourceStartSec + 8,
        headlineText: seed.hookText.slice(0, 38),
        visualDescription: '9:16 vertical speaker reaction frame with bold hook banner',
        facialExpressionCue: 'Animated mid-sentence insight',
      },
      captionStyle: {
        wordsPerGroup: 4,
        highlightActiveWord: true,
        emphasizeVocalTags: true,
      },
      youtubeMetadata: buildYouTubePublishMetadata(
        {
          title: seed.title,
          hookText: seed.hookText,
          whyItWorks: seed.whyItWorks,
          authenticityMoment: seed.authenticityMoment,
          estimatedNetDurationSec: seed.estimatedNetDurationSec,
          coarseSegments: seed.coarseSegments,
          visualTrack,
        },
        {
          title: seed.youtubeTitle,
          description: seed.youtubeDescription,
          hashtags: seed.youtubeHashtags,
        }
      ),
    },
    qaReport: {
      passed: true,
      netDurationValid: true,
      minCutDurationValid: true,
      authenticityPreserved: true,
      shortCutViolations: 0,
      autoHealedCount: 0,
      selfHealingActions: [],
      notes: [
        `Compressed ${seed.rawSourceDurationSec}s of podcast footage into a ${seed.estimatedNetDurationSec}s 9:16 YouTube Short.`,
        '3-second opening Hook Sticker and bouncy karaoke captions verified for mobile retention.',
      ],
    },
  };

  const withTranscript = recalculateEDLFromWords(baseCandidate, annotatedWords);
  return runDeterministicQASelfHeal(withTranscript);
}

export const HACKATHON_TEST_CANDIDATES: ShortEDL[] = RAW_SEED_MOMENTS.map(
  buildCompleteSeedCandidate
);
