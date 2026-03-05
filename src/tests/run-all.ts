// run-all.ts — Discovers and runs all test-v2-*.ts files, reports summary
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const quiet = process.argv.includes('--quiet') || process.argv.includes('-q');
const testFiles = readdirSync(__dirname)
  .filter(f => f.startsWith('test-v2-') && f.endsWith('.ts'))
  .sort();

let totalPassed = 0;
let totalFailed = 0;
let failedFiles: string[] = [];

for (const file of testFiles) {
  const filePath = join(__dirname, file);
  try {
    const output = execSync(`npx tsx "${filePath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: join(__dirname, '..', '..'),
    });

    if (quiet) {
      // Only print FAIL lines and the file summary if it had failures
      const lines = output.split('\n');
      const fails = lines.filter(l => l.includes('FAIL'));
      const summary = lines.find(l => /\d+ passed, \d+ failed/.test(l));
      if (fails.length > 0) {
        console.log(`\n--- ${file} ---`);
        for (const f of fails) console.log(f);
        if (summary) console.log(summary);
      }
    } else {
      process.stdout.write(output);
    }

    // Parse pass/fail counts from output
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    if (passMatch) totalPassed += parseInt(passMatch[1]);
    if (failMatch) {
      const fails = parseInt(failMatch[1]);
      totalFailed += fails;
      if (fails > 0) failedFiles.push(file);
    }
  } catch (err: any) {
    console.log(`\n=== ${file} === CRASHED`);
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    totalFailed++;
    failedFiles.push(file + ' (CRASH)');
  }
}

console.log('\n========================================');
console.log(`  ALL TESTS: ${totalPassed} passed, ${totalFailed} failed (${testFiles.length} files)`);
if (failedFiles.length > 0) {
  console.log(`  FAILURES: ${failedFiles.join(', ')}`);
}
console.log('========================================');

process.exit(totalFailed > 0 ? 1 : 0);
