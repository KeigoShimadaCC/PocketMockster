#!/usr/bin/env node
/**
 * Mark a finding's status in the cross-run findings index.
 *
 * Usage:
 *   node tools/agent/mark-finding.mjs <fingerprint> <status> [--commit <sha>] [--note <text>]
 *
 * Statuses: open, fixed, wontfix
 * (regressed is auto-set by the server when a "fixed" fingerprint reappears)
 *
 * Examples:
 *   node tools/agent/mark-finding.mjs abee4d871e fixed --commit 722d1c0 --note "null guard in renderMenu"
 *   node tools/agent/mark-finding.mjs 4e4eceabd7 wontfix --note "positive finding, not a bug"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, '..', '..', 'agent-runs', 'findings-index.json');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node tools/agent/mark-finding.mjs <fingerprint> <status> [--commit <sha>] [--note <text>]');
  console.error('Statuses: open, fixed, wontfix');
  process.exit(1);
}

const [print, status] = args;
const valid = ['open', 'fixed', 'wontfix', 'regressed'];
if (!valid.includes(status)) {
  console.error(`Invalid status "${status}". Must be one of: ${valid.join(', ')}`);
  process.exit(1);
}

// Parse optional flags
let commit, note;
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--commit') commit = args[++i];
  else if (args[i] === '--note') note = args[++i];
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const entry = index[print];
if (!entry) {
  console.error(`Fingerprint "${print}" not found in index`);
  console.error('Available:', Object.keys(index).join(', '));
  process.exit(1);
}

entry.status = status;
if (commit) entry.fixedInCommit = commit;
if (note) entry.statusNote = note;

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`Marked ${print} as "${status}"`);
console.log(`  title: ${entry.title}`);
if (commit) console.log(`  commit: ${commit}`);
if (note) console.log(`  note: ${note}`);
