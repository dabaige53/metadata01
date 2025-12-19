const DAY = 24 * 60 * 60 * 1000;

function parse(dateString?: string): Date | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateShort(dateString?: string): string {
  const d = parse(dateString);
  if (!d) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatRelative(dateString?: string): string {
  const d = parse(dateString);
  if (!d) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return '未来';

  const diffDays = Math.floor(diffMs / DAY);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}周前`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}月前`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}年前`;
}

export function formatDateWithRelative(dateString?: string): string {
  const base = formatDateShort(dateString);
  if (base === '-') return '-';
  const rel = formatRelative(dateString);
  return rel ? `${base} (${rel})` : base;
}

export function isRecent(dateString?: string, days = 7): boolean {
  const d = parse(dateString);
  if (!d) return false;
  const now = new Date();
  return now.getTime() - d.getTime() <= days * DAY;
}
