(function () {
  'use strict';

  // blockedLinkPatterns is provided by domainLists.js (loaded before this script)
  const BLOCKED = (typeof blockedLinkPatterns !== 'undefined') ? blockedLinkPatterns : [];

  const NAV_TEXTS = new Set([
    'here', 'click here', 'read more', 'more', 'back', 'next',
    'previous', 'prev', 'home', 'source', 'link', 'url',
  ]);

  // ── Helpers ─────────────────────────────────────────────────────────

  function extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  }

  function isBlockedHref(href) {
    return BLOCKED.some(p => href.includes(p));
  }

  function isNavText(text) {
    const t = text.toLowerCase().trim();
    return t.length < 3 || NAV_TEXTS.has(t);
  }

  // Finds the best article-scoped container, or null to fall back to body
  function getArticleContainer() {
    const selectors = [
      'article', '[role="main"]', 'main',
      '.article-body', '.article-content', '.post-content',
      '.entry-content', '.story-body', '.content-body',
      '#content', '#main-content', '#article',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // Elements to exclude when falling back to body scan
  const EXCLUDE_SELECTORS = [
    'header', 'footer', 'nav',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    'aside', '.sidebar', '.widget',
    '.ad', '.advertisement', '.social-share', '.share-buttons',
    '.comments', '.related-articles', '.recommended',
  ].join(', ');

  function getSurroundingText(el, limit) {
    try {
      const block = el.closest('p, li, blockquote, td, figcaption') || el.parentElement;
      if (!block) return '';
      const text = (block.innerText || block.textContent || '').replace(/\s+/g, ' ').trim();
      const linkText = (el.innerText || el.textContent || '').trim();
      const idx = linkText ? text.indexOf(linkText) : -1;
      if (idx === -1) return text.slice(0, limit * 2);
      return text.slice(Math.max(0, idx - limit), Math.min(text.length, idx + linkText.length + limit));
    } catch { return ''; }
  }

  // Returns the matched date string or null
  function extractDateText(text) {
    const m = text.match(
      /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i
    );
    return m ? m[0] : null;
  }

  function hasAuthorNearby(text) {
    return /\b(by|author\s*:|written by|posted by|published by|reported by)\s+[A-Z][a-z]/i.test(text);
  }

  // Returns false if the URL should be excluded from results
  function isValidSourceUrl(href, parsed) {
    const host = parsed.hostname;
    const path = parsed.pathname;
    // Rule 3: block non-English Wikipedia subdomains (uk., fr., de., es. etc.)
    if (host.endsWith('.wikipedia.org')) {
      const sub = host.slice(0, host.length - '.wikipedia.org'.length);
      if (sub !== 'en' && /^[a-z]{2,3}$/.test(sub)) return false;
    }
    // Rule 2: language namespace in path e.g. /wiki/uk:Article
    if (/\/wiki\/[a-z]{2,3}:/.test(path)) return false;
    // Rule 1: non-Latin characters in decoded path (outside U+0000–U+024F)
    try {
      const decoded = decodeURIComponent(path);
      for (let i = 0; i < decoded.length; i++) {
        if (decoded.charCodeAt(i) > 0x024F) return false;
      }
    } catch { return false; }
    return true;
  }

  // ── Link scanner ─────────────────────────────────────────────────────

  function scanLinks() {
    const container = getArticleContainer();
    const excludedEls = container ? [] : Array.from(document.querySelectorAll(EXCLUDE_SELECTORS));
    const scope = container || document.body;

    const seenUrlPaths = new Set(); // dedup by domain+pathname
    const sources = [];

    scope.querySelectorAll('a[href^="http"]').forEach(a => {
      try {
        // Exclude nav/chrome when falling back to body
        if (!container && excludedEls.some(ex => ex.contains(a))) return;

        const href = a.href;
        if (isBlockedHref(href)) return;

        const rawText = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ');
        if (isNavText(rawText)) return;

        const parsed   = new URL(href);
        if (!isValidSourceUrl(href, parsed)) return;
        const domain   = parsed.hostname.replace(/^www\./, '');
        const pathKey  = domain + parsed.pathname;
        if (seenUrlPaths.has(pathKey)) return;
        seenUrlPaths.add(pathKey);

        const surrounding = getSurroundingText(a, 100);
        const dateText    = extractDateText(surrounding);

        sources.push({
          url:         href,
          domain,
          displayText: (rawText || domain).slice(0, 120),
          hasDate:     !!dateText,
          dateText:    dateText || null,
          hasAuthor:   hasAuthorNearby(surrounding),
        });
      } catch { /* skip malformed link */ }
    });

    return sources;
  }

  // ── Current-page analyser ────────────────────────────────────────────

  function detectPageAuthor() {
    // 1. Meta tags
    for (const sel of ['meta[name="author"]', 'meta[property="article:author"]']) {
      const el = document.querySelector(sel);
      if (el && el.content) return el.content.trim();
    }
    // 2. Class/attribute hints
    const candidates = document.querySelectorAll(
      '[class*="author"],[class*="byline"],[class*="by-line"],[itemprop="author"],[rel="author"]'
    );
    for (const el of candidates) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text && text.length < 100 && text.length > 2) return text;
    }
    // 3. "By [Name]" pattern near top of article
    const container = getArticleContainer() || document.body;
    const topText   = (container.innerText || container.textContent || '').slice(0, 600);
    const m = topText.match(/(?:By|Written by)\s+([A-Z][a-zA-Z\-]{1,30}(?:\s+[A-Z][a-zA-Z\-]{1,30}){0,3})/);
    return m ? m[1].trim() : null;
  }

  function detectPageDate() {
    // 1-2. Meta tags
    for (const sel of [
      'meta[property="article:published_time"]',
      'meta[property="article:modified_time"]',
      'meta[name="date"]',
    ]) {
      const el = document.querySelector(sel);
      if (el && el.content) return el.content.trim();
    }
    // 3. <time datetime>
    const time = document.querySelector('time[datetime]');
    if (time && time.dateTime) return time.dateTime.trim();
    // 4. Class-based elements
    const dateEls = document.querySelectorAll('[class*="date"],[class*="published"],[class*="timestamp"]');
    for (const el of dateEls) {
      if (el.dateTime) return el.dateTime.trim();
      const text = (el.innerText || el.textContent || '').trim();
      if (text && /\d{4}/.test(text) && text.length < 60) return text;
    }
    return null;
  }

  function scanCurrentPage() {
    try {
      const url    = location.href;
      const domain = extractDomain(url);
      const tld    = domain.split('.').pop();

      const authorName = detectPageAuthor();
      const dateText   = detectPageDate();

      return {
        url,
        domain,
        title:           document.title || domain,
        hasAuthor:       !!authorName,
        authorName:      authorName || null,
        hasDate:         !!dateText,
        dateText:        dateText || null,
        domainExtension: '.' + tld,
      };
    } catch { return null; }
  }

  // ── Message listener ─────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'scan') {
      try {
        sendResponse({ sources: scanLinks(), currentPage: scanCurrentPage() });
      } catch (e) {
        sendResponse({ sources: [], currentPage: null, error: e.message });
      }
    }
    return true;
  });
})();
