// domainLists.js — loaded as a content script AND in popup context

// Keyed by domain string → { type, tier }
// tier 1 = highly reputable primary sources
// tier 2 = generally reliable secondary sources
const trustedDomains = {
  // ── Tier 1 · Academic ────────────────────────────────────────────────
  'arxiv.org':               { type: 'academic', tier: 1 },
  'pubmed.ncbi.nlm.nih.gov': { type: 'academic', tier: 1 },
  'scholar.google.com':      { type: 'academic', tier: 1 },
  'jstor.org':               { type: 'academic', tier: 1 },
  'researchgate.net':        { type: 'academic', tier: 1 },
  'semanticscholar.org':     { type: 'academic', tier: 1 },
  'ncbi.nlm.nih.gov':        { type: 'academic', tier: 1 },
  'plos.org':                { type: 'academic', tier: 1 },
  'nature.com':              { type: 'academic', tier: 1 },
  'science.org':             { type: 'academic', tier: 1 },
  'cell.com':                { type: 'academic', tier: 1 },
  'thelancet.com':           { type: 'academic', tier: 1 },
  'nejm.org':                { type: 'academic', tier: 1 },
  'bmj.com':                 { type: 'academic', tier: 1 },
  'jamanetwork.com':         { type: 'academic', tier: 1 },
  'apa.org':                 { type: 'academic', tier: 1 },
  'ieee.org':                { type: 'academic', tier: 1 },
  'acm.org':                 { type: 'academic', tier: 1 },
  'springer.com':            { type: 'academic', tier: 1 },
  'wiley.com':               { type: 'academic', tier: 1 },
  'tandfonline.com':         { type: 'academic', tier: 1 },
  'sagepub.com':             { type: 'academic', tier: 1 },
  'oxfordjournals.org':      { type: 'academic', tier: 1 },
  'cambridge.org':           { type: 'academic', tier: 1 },
  'mit.edu':                 { type: 'academic', tier: 1 },
  'stanford.edu':            { type: 'academic', tier: 1 },
  'harvard.edu':             { type: 'academic', tier: 1 },
  'yale.edu':                { type: 'academic', tier: 1 },
  'princeton.edu':           { type: 'academic', tier: 1 },
  'berkeley.edu':            { type: 'academic', tier: 1 },
  'ox.ac.uk':                { type: 'academic', tier: 1 },
  'cam.ac.uk':               { type: 'academic', tier: 1 },

  // ── Tier 1 · Government ──────────────────────────────────────────────
  'cdc.gov':           { type: 'government', tier: 1 },
  'nih.gov':           { type: 'government', tier: 1 },
  'who.int':           { type: 'government', tier: 1 },
  'fda.gov':           { type: 'government', tier: 1 },
  'nasa.gov':          { type: 'government', tier: 1 },
  'nsf.gov':           { type: 'government', tier: 1 },
  'congress.gov':      { type: 'government', tier: 1 },
  'supremecourt.gov':  { type: 'government', tier: 1 },
  'census.gov':        { type: 'government', tier: 1 },
  'bls.gov':           { type: 'government', tier: 1 },
  'federalreserve.gov':{ type: 'government', tier: 1 },
  'un.org':            { type: 'government', tier: 1 },
  'europa.eu':         { type: 'government', tier: 1 },
  'worldbank.org':     { type: 'government', tier: 1 },
  'imf.org':           { type: 'government', tier: 1 },

  // ── Tier 1 · Reference ───────────────────────────────────────────────
  'britannica.com': { type: 'encyclopedia', tier: 1 },
  'loc.gov':        { type: 'reference', tier: 1 },
  'archives.gov':   { type: 'reference', tier: 1 },
  'si.edu':         { type: 'reference', tier: 1 },

  // ── Tier 2 · News ────────────────────────────────────────────────────
  'reuters.com':           { type: 'news', tier: 2 },
  'apnews.com':            { type: 'news', tier: 2 },
  'bbc.com':               { type: 'news', tier: 2 },
  'bbc.co.uk':             { type: 'news', tier: 2 },
  'npr.org':               { type: 'news', tier: 2 },
  'pbs.org':               { type: 'news', tier: 2 },
  'theguardian.com':       { type: 'news', tier: 2 },
  'nytimes.com':           { type: 'news', tier: 2 },
  'washingtonpost.com':    { type: 'news', tier: 2 },
  'wsj.com':               { type: 'news', tier: 2 },
  'economist.com':         { type: 'news', tier: 2 },
  'ft.com':                { type: 'news', tier: 2 },
  'theatlantic.com':       { type: 'news', tier: 2 },
  'scientificamerican.com':{ type: 'news', tier: 2 },
  'newscientist.com':      { type: 'news', tier: 2 },
  'wired.com':             { type: 'news', tier: 2 },
  'technologyreview.com':  { type: 'news', tier: 2 },

  // ── Tier 2 · Reference (special case) ────────────────────────────────
  'wikipedia.org': { type: 'encyclopedia', tier: 2 },
};

// URL substrings — any href matching one of these is excluded from results
const blockedLinkPatterns = [
  // Social & engagement platforms
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'linkedin.com', 'youtube.com', 'reddit.com',
  'bsky.app', 'threads.net',
  // Navigation / utility paths
  '/login', '/signin', '/sign-in', '/register',
  '/subscribe', '/subscription', '/newsletter',
  '/rss', '/feed', '/sitemap',
  '/privacy', '/terms', '/cookie',
  '/about-us', '/contact', '/advertise', '/careers',
  'mailto:', 'tel:',
];

// 25+ known low-credibility / misinformation domains
const warnDomains = [
  'naturalnews.com', 'infowars.com', 'beforeitsnews.com',
  'worldnewsdailyreport.com', 'empirenews.net', 'nationalreport.net',
  'newspunch.com', 'yournewswire.com', 'neonnettle.com',
  'collective-evolution.com', 'healthimpactnews.com', 'activistpost.com',
  'veteranstoday.com', 'globalresearch.ca', 'zerohedge.com',
  'rt.com', 'sputniknews.com', 'thegatewaypundit.com',
  'ussanews.com', 'americasfreedomfighters.com',
  'theonion.com', 'clickhole.com',
  'breitbart.com', 'oann.com', 'newstarget.com',
];
