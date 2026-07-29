// Shared rendering for the cross-run findings index, used both by pm-server
// when a run finalizes and by mark-finding.mjs when a status changes by hand.
// Keeping it here stops the two writers from drifting apart.

const STATUS_ORDER = { open: 0, regressed: 1, fixed: 2, wontfix: 3 };

// Entries recorded before the status field existed have none; they are untriaged.
const statusOf = (e) => e.status ?? 'open';

export function renderFindingsIndexMd(index) {
  const entries = Object.values(index);
  entries.sort((a, b) => (STATUS_ORDER[statusOf(a)] ?? 9) - (STATUS_ORDER[statusOf(b)] ?? 9));

  const byStatus = entries.reduce((acc, e) => {
    (acc[statusOf(e)] ??= []).push(e);
    return acc;
  }, {});

  const lines = ['# Cross-Run Findings Index', ''];
  lines.push(
    `Total ${entries.length} (` +
      Object.entries(byStatus)
        .map(([s, l]) => `${l.length} ${s}`)
        .join(', ') +
      ')',
    '',
  );
  lines.push('| fingerprint | status | severity | area | title | runs | last seen |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const e of entries) {
    lines.push(
      `| \`${e.print}\` | ${statusOf(e)} | ${e.severity} | ${e.area} | ${e.title.replace(/\|/g, '/')} | ${e.runs.length} | ${e.lastSeenAt?.slice(0, 10) ?? '-'} |`,
    );
  }

  // A status alone doesn't tell a fixer whether to trust it, so surface the
  // commit and reasoning for everything that has been triaged.
  const annotated = entries.filter((e) => e.fixedInCommit || e.statusNote);
  if (annotated.length) {
    lines.push('', '## Status notes', '');
    for (const e of annotated) {
      const commit = e.fixedInCommit ? ` (\`${e.fixedInCommit}\`)` : '';
      lines.push(`- \`${e.print}\` **${statusOf(e)}**${commit}: ${e.title}`);
      if (e.statusNote) lines.push(`  - ${e.statusNote}`);
    }
  }

  return lines.join('\n');
}
