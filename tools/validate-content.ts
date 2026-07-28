import { validateMaps } from '../src/content/validate';

function printGroup(title: string, lines: string[]): void {
  if (lines.length === 0) return;
  console.log(`${title} (${lines.length})`);
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}

const issues = validateMaps();
const errors = issues.filter((issue) => issue.severity === 'error').map((issue) => `[${issue.where}] ${issue.message}`);
const warnings = issues.filter((issue) => issue.severity === 'warn').map((issue) => `[${issue.where}] ${issue.message}`);

if (errors.length === 0 && warnings.length === 0) {
  console.log('Content validation passed with no issues.');
  process.exit(0);
}

printGroup('Errors', errors);
printGroup('Warnings', warnings);

process.exit(errors.length > 0 ? 1 : 0);
