// scorer.js — depends on domainLists.js (trustedDomains, warnDomains)

// Walk parent domain segments to support subdomains (e.g. web.mit.edu → mit.edu)
function lookupTrustedDomain(domain) {
  if (trustedDomains[domain]) return trustedDomains[domain];
  const parts = domain.split('.');
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(i).join('.');
    if (trustedDomains[parent]) return trustedDomains[parent];
  }
  return null;
}

function isInWarnDomains(domain) {
  return warnDomains.some(w => domain === w || domain.endsWith('.' + w));
}

function isOlderThanYears(dateText, years) {
  if (!dateText) return false;
  try {
    const d = new Date(dateText);
    if (isNaN(d.getTime())) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return d < cutoff;
  } catch { return false; }
}

const SOCIAL_DOMAINS = [
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'reddit.com', 'linkedin.com', 'youtube.com',
  'bsky.app', 'threads.net',
];

function isSocialDomain(domain) {
  return SOCIAL_DOMAINS.some(s => domain === s || domain.endsWith('.' + s));
}

// Shared scoring engine used by both scoreSource and scorePage
function computeScore(domain, hasAuthor, hasDate, dateText) {
  const tld       = domain.split('.').pop();
  const trusted   = lookupTrustedDomain(domain);
  const isWarn    = isInWarnDomains(domain);
  const isSocial  = isSocialDomain(domain);
  const isWiki    = domain === 'wikipedia.org' || domain.endsWith('.wikipedia.org');

  let score = 100;
  const flags = [];

  // Social media: force D immediately
  if (isSocial) {
    return { score: 0, flags: ['Social media — not a citable source'], forcedGrade: 'D' };
  }

  // Wikipedia: cap + flag
  if (isWiki) {
    score = Math.min(score, 70);
    flags.push('Useful background — not for direct citation');
  }

  // Domain trust deductions
  if (isWarn) {
    score -= 50;
    flags.push('Known low-credibility domain');
  } else if (trusted) {
    if (trusted.tier === 1) {
      flags.push('Primary source');
    } else {
      score -= 5;
      flags.push('Reliable source');
    }
  } else if (tld === 'edu') {
    score -= 10;
  } else if (tld === 'gov') {
    score -= 10;
  } else if (tld === 'org') {
    score -= 20;
  } else {
    score -= 25; // .com and everything else
  }

  // Author
  if (!hasAuthor) {
    score -= 15;
    flags.push('No author detected');
  }

  // Date
  if (!hasDate) {
    score -= 10;
    flags.push('No publication date');
  } else if (dateText && isOlderThanYears(dateText, 5)) {
    score -= 5;
    flags.push('Source may be outdated');
  }

  score = Math.max(0, score);
  return { score, flags, forcedGrade: null };
}

function gradeFromScore(score) {
  if (score >= 85) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function scoreSource(source) {
  const domain          = (source.domain || '').toLowerCase();
  const tld             = domain.split('.').pop();
  const domainExtension = '.' + tld;
  const trusted         = lookupTrustedDomain(domain);
  const isWiki          = domain === 'wikipedia.org' || domain.endsWith('.wikipedia.org');

  // Determine type
  let type = trusted ? trusted.type : 'blog';
  if (isWiki)               type = 'encyclopedia';
  else if (tld === 'edu')   type = type === 'blog' ? 'academic'    : type;
  else if (tld === 'gov')   type = type === 'blog' ? 'government'  : type;

  const { score, flags, forcedGrade } = computeScore(
    domain, source.hasAuthor, source.hasDate, source.dateText || null
  );
  const grade = forcedGrade || gradeFromScore(score);

  return { grade, type, flags, domainExtension, score };
}

function scorePage(page) {
  if (!page) return null;
  const domain          = (page.domain || '').toLowerCase();
  const tld             = domain.split('.').pop();
  const domainExtension = page.domainExtension || ('.' + tld);
  const trusted         = lookupTrustedDomain(domain);
  const isWiki          = domain === 'wikipedia.org' || domain.endsWith('.wikipedia.org');

  let type = trusted ? trusted.type : 'blog';
  if (isWiki)              type = 'encyclopedia';
  else if (tld === 'edu')  type = type === 'blog' ? 'academic'   : type;
  else if (tld === 'gov')  type = type === 'blog' ? 'government' : type;

  const { score, flags, forcedGrade } = computeScore(
    domain, page.hasAuthor, page.hasDate, page.dateText || null
  );
  const grade = forcedGrade || gradeFromScore(score);

  return { grade, type, flags, domainExtension, score };
}
