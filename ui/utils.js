export function sanitizeRepo(str) {
  return str.trim()
    .replace(/\s+/g, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\/(tree|blob|issues|pulls|actions|releases|wiki|discussions|commits|tags)(\/.*)?$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

export function fmt(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString('en-US');
}

export function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^<[a-z]/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');
}

export function sum30(series, idx) {
  if (!series || series.length === 0) return 0;
  return series.slice(-30).reduce((s, e) => s + (e[idx] || 0), 0);
}
