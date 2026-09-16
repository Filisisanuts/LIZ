import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const legacyDirectory = resolve('src/js');
const legacyFiles = readdirSync(legacyDirectory)
  .filter((fileName) => fileName.endsWith('.js'))
  .sort();

let failed = false;
for (const fileName of legacyFiles) {
  const filePath = resolve(legacyDirectory, fileName);
  const result = spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  }
}

if (failed) process.exitCode = 1;
else console.log(`Legacy JavaScript syntax passed for ${legacyFiles.length} files.`);
