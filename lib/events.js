// Event catalogue. Four series run every year; each yearly edition gets its own Meta account,
// campaign-name prefix and ref-code dictionary. Fill in a new edition here before its ads start.

export const SERIES = [
  { key: "alpha-skill", name: "Alpha Skill" },
  { key: "tss-isan", name: "THE SECRET SAUCE ISAN" },
  { key: "tss-summit", name: "THE SECRET SAUCE Summit" },
  { key: "economic", name: "Economic Forum" },
];

// metaAccount  — Meta ad account (act_…) the campaigns run in
// prefix       — every campaign of this edition contains it (e.g. TSD2615)
// start / end  — flight window to pull ad data for
// adRefPrefixes — ref codes starting with these are clicks on our own ad links (Ref Ad)
// adRefCodes   — other codes that count as ad evidence on their own (e.g. a QR printed on a video ad)
// refCreative  — ref code (prefix match) → creative name, so ref-coded tickets land on the right card
// adWindows    — [from, to] "YYYY-MM-DD HH" hour ranges the ads were delivering (simple rule fallback)
export const EDITIONS = [
  {
    slug: "economic-2026",
    series: "economic",
    year: 2026,
    metaAccount: "act_108197036372162",
    prefix: "TSD2615",
    // Cost per Ticket includes every platform carrying this project ID. Meta Pixel
    // remains the only source for row-level purchase attribution.
    spendSources: [
      { platform: "Google Ads", dsId: "AW", account: "8696760644", fields: ["Date", "Campaignname", "Cost"], campaignField: "Campaignname", dateField: "Date", costField: "Cost",
        youtubeCreativeNames: { "xiKeuPPFxxU": "YouTube Teaser (QR)" } },
      { platform: "TikTok Ads", dsId: "TIK", account: "7370989181407051793", fields: ["date", "campaign_name", "cost"], campaignField: "campaign_name", dateField: "date", costField: "cost", settings: { report_type: 8 } },
    ],
    start: "2026-09-21",
    end: "2026-11-06",
    // hours Meta ads had impressions (Supermetrics, 22 Oct 2026 21:00) — used when the live API isn't connected
    adWindows: [["2026-09-26 22", "2026-10-14 23"], ["2026-10-15 15", "2026-10-22 21"]],
    adRefPrefixes: ["ad-"],
    adRefCodes: { "QR-SPOT-VDO": "YouTube Teaser (QR)" },
    refCreative: {
      "ad-fb-BLIND-TICKET-210926": "Blind Ticket",
      "ad-fb-BLIND-Last-Call-7D": "Blind Ticket Last 7 Days",
      "ad-fb-BLIND-Last-Call-100Left": "Blind Ticket Last 100",
      "ad-fb-Speaker-Posters-Batch1": "Speaker Batch1",
      "ad-fb-Speaker-Posters-Batch2": "Speaker Batch 2",
      "ad-fb-Speaker-Posters-Sustain": "Speaker Sustain Energy",
      "ad-fb-Highlight-Agenda-MainStage": "Mainstage",
      "ad-gg-pmax-speakersustain": "Speaker Sustain Energy",
      "ad-gg-pmax-speakerposter-target2025": "Google PMAX — Target 2025",
      "ad-gg-": "Google PMAX — อื่นๆ",
      "BLIND-TICKET-210926": "Blind Ticket",
      "BLIND-Last-Call-7D": "Blind Ticket Last 7 Days",
      "BLIND-Last-Call-100Left": "Blind Ticket Last 100",
      "Speaker-Posters-Batch1": "Speaker Batch1",
      "Speaker-Posters-Batch2": "Speaker Batch 2",
      "Speaker-Posters-Sustain": "Speaker Sustain Energy",
      "Highlight-Agenda-MainStage": "Mainstage",
      "Photoalbum-Profile-MainStage": "Mainstage",
      "Photo-Key-Topic-Neolix": "Neolix",
      "Photo-Poster-Early-Bird": "Early Bird and Corp Ticket",
    },
  },
];

export const seriesName = key => SERIES.find(s => s.key === key)?.name ?? key;
export const editionTitle = e => `${seriesName(e.series)} ${e.year}`;
export const findEdition = slug => EDITIONS.find(e => e.slug === slug);
