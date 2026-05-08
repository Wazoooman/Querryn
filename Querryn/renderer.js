// renderer.js — DOM rendering helpers; loaded before popup.js

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getTldClass(s) {
  if (s.domainExtension === '.edu') return 'badge-edu';
  if (s.domainExtension === '.gov') return 'badge-gov';
  if (s.type === 'news')            return 'badge-news';
  if (s.type === 'encyclopedia' || (s.domain || '').endsWith('wikipedia.org')) return 'badge-wiki';
  return 'badge-blog';
}

function renderPageCard(cp) {
  const card = document.getElementById('page-card');
  if (!cp) { card.classList.add('hidden'); return; }

  const title = (cp.title || cp.domain).length > 50
    ? (cp.title || cp.domain).slice(0, 50) + '…' : (cp.title || cp.domain);

  const authorTag = cp.hasAuthor
    ? `<span class="tag tag-author">${esc(cp.authorName || 'Author found')}</span>`
    : '<span class="tag tag-missing">No author</span>';
  const dateTag = cp.hasDate
    ? `<span class="tag tag-date">${esc(cp.dateText || 'Date found')}</span>`
    : '<span class="tag tag-missing">No date</span>';

  document.getElementById('page-title').textContent = title;
  document.getElementById('page-domain').innerHTML =
    `<span class="domain-badge ${getTldClass(cp)}">${esc(cp.domainExtension)}</span> ${esc(cp.domain)}`;
  document.getElementById('page-tags').innerHTML = authorTag + dateTag;

  const g = document.getElementById('page-grade');
  g.textContent = cp.grade;
  g.setAttribute('data-grade', cp.grade);
  g.className = 'grade-badge';
  g.title = `Score: ${cp.score}`;

  card.classList.remove('hidden');
}

// Renders the "this page" row in the source list (with checkbox)
function renderPageRow(cp, isSelected) {
  const chk   = isSelected ? 'checked' : '';
  const title = (cp.title || cp.domain).length > 42
    ? (cp.title || cp.domain).slice(0, 42) + '…' : (cp.title || cp.domain);
  const url   = cp.url.length > 44 ? cp.url.slice(0, 44) + '…' : cp.url;
  return `<div class="source-row" data-id="this-page">
    <input type="checkbox" class="row-check" data-id="this-page" ${chk}>
    <div class="source-left">
      <span class="domain-badge ${getTldClass(cp)}">${esc(cp.domainExtension)}</span>
      <div class="source-info">
        <div class="source-name" title="${esc(cp.title||cp.domain)}">${esc(title)}&nbsp;<span class="this-page-badge">this page</span></div>
        <div class="source-url" title="${esc(cp.url)}">${esc(url)}</div>
      </div>
    </div>
    <div class="grade-badge" data-grade="${esc(cp.grade)}" title="Score: ${cp.score}">${esc(cp.grade)}</div>
  </div>`;
}

function renderRow(s, isSelected) {
  const chk  = isSelected ? 'checked' : '';
  const url  = s.url.length > 44 ? s.url.slice(0, 44) + '…' : s.url;
  const name = (s.displayText || s.domain).length > 42
    ? (s.displayText || s.domain).slice(0, 42) + '…' : (s.displayText || s.domain);
  const tags = (s.hasAuthor ? '<span class="tag tag-author">Author</span>' : '')
             + (s.hasDate   ? '<span class="tag tag-date">Date</span>'     : '');
  return `<div class="source-row" data-id="${esc(String(s._id))}">
    <input type="checkbox" class="row-check" data-id="${esc(String(s._id))}" ${chk}>
    <div class="source-left">
      <span class="domain-badge ${getTldClass(s)}">${esc(s.domainExtension)}</span>
      <div class="source-info">
        <div class="source-name" title="${esc(s.displayText)}">${esc(name)}</div>
        <div class="source-url"  title="${esc(s.url)}">${esc(url)}</div>
        ${tags ? `<div class="source-tags">${tags}</div>` : ''}
      </div>
    </div>
    <div class="grade-badge" data-grade="${esc(s.grade)}" title="Score: ${s.score}">${esc(s.grade)}</div>
  </div>`;
}
