// popup.js — depends on domainLists.js and scorer.js loaded before this

let allSources      = [];
let currentPageData = null;
let activeFilter    = 'academic';
let selectedIds     = new Set();

document.getElementById('scan-btn').addEventListener('click', handleScan);
document.getElementById('export-btn').addEventListener('click', handleExport);
document.getElementById('select-all-btn').addEventListener('click', handleSelectAll);
document.querySelectorAll('.pill').forEach(p => p.addEventListener('click', handleFilter));
document.getElementById('source-list').addEventListener('change', e => {
  if (!e.target.classList.contains('row-check')) return;
  e.target.checked ? selectedIds.add(e.target.dataset.id) : selectedIds.delete(e.target.dataset.id);
  updateSelectedCount();
});

// ── Scan ──────────────────────────────────────────────────────────────

async function handleScan() {
  const btn = document.getElementById('scan-btn');
  btn.textContent = 'Scanning…';
  btn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['domainLists.js', 'content.js'] });
      response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });
    }

    allSources = (response?.sources || []).map((s, i) => ({ ...s, _id: String(i), ...scoreSource(s) }));

    const cp = response?.currentPage || null;
    currentPageData = cp ? { ...cp, ...scorePage(cp) } : null;

    selectedIds.clear();
    renderAll();
  } catch {
    showError('Cannot scan this page. Try a regular web page.');
  } finally {
    btn.textContent = 'Scan page';
    btn.disabled = false;
  }
}

// ── Filter ────────────────────────────────────────────────────────────

function handleFilter(e) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  e.currentTarget.classList.add('active');
  activeFilter = e.currentTarget.dataset.filter;
  renderList();
}

// ── Select all ────────────────────────────────────────────────────────

function handleSelectAll() {
  const allIds = allSources.map(s => s._id);
  if (currentPageData) allIds.unshift('this-page');
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  allIds.forEach(id => allSelected ? selectedIds.delete(id) : selectedIds.add(id));
  document.getElementById('select-all-btn').textContent = allSelected ? 'Select all' : 'Deselect all';
  renderList();
  updateSelectedCount();
}

// ── Export + citations ────────────────────────────────────────────────

function handleExport() {
  if (!selectedIds.size) return;
  const format = document.getElementById('cite-format').value;
  const lines  = [];

  if (selectedIds.has('this-page') && currentPageData) {
    lines.push(buildCitation({ ...currentPageData, displayText: currentPageData.title || currentPageData.domain }, format, true));
  }
  allSources.filter(s => selectedIds.has(s._id)).forEach(s => lines.push(buildCitation(s, format, false)));

  const sep = format === 'bibtex' ? '\n\n' : '\n';
  navigator.clipboard.writeText(lines.join(sep)).then(() => {
    const btn = document.getElementById('export-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }).catch(() => {});
}

function buildCitation(s, format, isThisPage) {
  const rawTitle = (s.displayText || s.title || s.domain).trim();
  const title    = rawTitle.length > 120 ? rawTitle.slice(0, 120) : rawTitle;
  const url      = s.url;
  const domain   = s.domain;
  const sitePart = domain.split('.').slice(-2, -1)[0] || domain;
  const site     = sitePart.charAt(0).toUpperCase() + sitePart.slice(1);
  const author   = s.authorName || (s.hasAuthor ? 'Unknown Author' : null);
  const dtRaw    = s.dateText || null;
  const yearM    = dtRaw && dtRaw.match(/\b(19|20)\d{2}\b/);
  const year     = yearM ? yearM[0] : null;
  const today    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (format === 'mla') {
    const nameParts = (author || '').trim().split(/\s+/);
    const a = author
      ? (nameParts.length > 1 ? `${nameParts.at(-1)}, ${nameParts.slice(0,-1).join(' ')}` : author)
      : '[Author Unknown]';
    return `${a}. "${title}." ${site}, ${year || dtRaw || '[Date Unknown]'}, ${url}.`;
  }
  if (format === 'apa') {
    const nameParts = (author || '').trim().split(/\s+/);
    const a = author
      ? (nameParts.length > 1 ? `${nameParts.at(-1)}, ${nameParts.slice(0,-1).map(n => n[0]+'.').join(' ')}` : author)
      : '[Author Unknown]';
    return `${a} (${year || '[n.d.]'}). ${title}. ${site}. ${url}`;
  }
  if (format === 'chicago') {
    return `${author || '[Author Unknown]'}, "${title}," ${site}, ${year || '[Date Unknown]'}, accessed ${today}, ${url}.`;
  }
  if (format === 'bibtex') {
    const key = domain.replace(/\W+/g, '_') + '_' + (year || 'nd');
    return `@misc{${key},\n  author = {${author || '[Author Unknown]'}},\n  title  = {${title}},\n  year   = {${year || '[n.d.]'}},\n  url    = {${url}},\n  note   = {Accessed: ${today}}\n}`;
  }
  // plain text
  const dt    = title.length > 60 ? title.slice(0, 60) + '...' : title;
  const flags = (s.flags || []).join(', ') || 'No flags';
  const pfx   = isThisPage ? `[${s.grade}] THIS PAGE: ` : `[${s.grade}] `;
  return `${pfx}${dt} — ${domain} — ${url} — ${flags}`;
}

// ── Render: summary + list ────────────────────────────────────────────

function renderAll() {
  document.getElementById('total-count').textContent = allSources.length;
  document.getElementById('good-count').textContent  = allSources.filter(s => 'AB'.includes(s.grade)).length;
  document.getElementById('bad-count').textContent   = allSources.filter(s => s.grade === 'D').length;

  ['summary', 'filters', 'footer', 'select-all-bar'].forEach(id => {
    document.getElementById(id).classList.remove('hidden');
  });

  document.getElementById('select-all-btn').textContent = 'Select all';
  renderPageCard(currentPageData);
  activeFilter = 'academic';
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.filter === 'academic'));
  renderList();
  updateSelectedCount();
}

function renderList() {
  const list  = document.getElementById('source-list');
  const empty = document.getElementById('empty-state');

  const filtered = activeFilter === 'all'
    ? allSources
    : allSources.filter(s => s.type === activeFilter);

  const rows = [];
  if (currentPageData) rows.push(renderPageRow(currentPageData, selectedIds.has('this-page')));
  filtered.forEach(s => rows.push(renderRow(s, selectedIds.has(s._id))));

  if (!rows.length) {
    list.classList.add('hidden');
    list.innerHTML = '';
    empty.innerHTML = allSources.length
      ? '<p>No sources match this filter.</p>'
      : '<p>No outbound sources were found on this page.</p>';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');
  list.innerHTML = rows.join('');
}

function updateSelectedCount() {
  const n   = selectedIds.size;
  const el  = document.getElementById('selected-count');
  if (el) { el.textContent = `${n} selected`; el.classList.toggle('muted-count', n === 0); }
  const btn = document.getElementById('export-btn');
  if (btn) { btn.disabled = n === 0; btn.style.opacity = n === 0 ? '0.5' : '1'; btn.style.cursor = n === 0 ? 'not-allowed' : 'pointer'; }
}

function showError(msg) {
  ['summary', 'filters', 'source-list', 'page-card', 'select-all-bar'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const empty = document.getElementById('empty-state');
  empty.innerHTML = `<p>${esc(msg)}</p>`;
  empty.classList.remove('hidden');
}

