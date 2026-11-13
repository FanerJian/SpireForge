#!/usr/bin/env node
// Repository verification: no shell, network publishing, or game deployment.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tools/verify.mjs [--scope all|frontend|backend|runtime] [--skip-build]');
  process.exit(0);
}
let scope = 'all';
let skipBuild = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scope') scope = args[++i];
  else if (args[i] === '--skip-build') skipBuild = true;
  else throw new Error(`Unknown option: ${args[i]}`);
}
if (!['all', 'frontend', 'backend', 'runtime'].includes(scope)) throw new Error(`Unknown scope: ${scope}`);
const output = join(root, 'work', 'verification', new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`);
const temp = join(output, 'tmp');
mkdirSync(temp, { recursive: true });
const env = {
  ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp,
  DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
  MSBuildEnableWorkloadResolver: 'false',
};
const steps = [];
function add(name, command, commandArgs, cwd = root) { steps.push({ name, command, args: commandArgs, cwd }); }
if (scope === 'all' || scope === 'frontend') {
  const editor = join(root, 'editor');
  // New regression scripts join the gate automatically.
  for (const file of readdirSync(join(editor, 'scripts')).filter(f => /^check-.*\.cjs$/.test(f)).sort()) {
    add(file.replace(/\.cjs$/, ''), process.execPath, [join(editor, 'scripts', file)], editor);
  }
  add('typescript', process.execPath, [join(editor, 'node_modules/typescript/bin/tsc'), '--noEmit'], editor);
  if (!skipBuild) add('frontend-build', process.execPath, [join(editor, 'node_modules/vite/bin/vite.js'), 'build'], editor);
}
if (scope === 'all' || scope === 'backend') {
  for (const [name, dir] of [['pcktool', 'tools/pcktool'], ['publish', 'tools/publish-test'], ['editor-backend', 'editor/src-tauri']]) {
    add(name, 'cargo', ['test', '--locked', '--manifest-path', join(root, dir, 'Cargo.toml'), '--lib']);
  }
}
if (scope === 'all' || scope === 'runtime') {
  for (const entry of readdirSync(join(root, 'runtime/tests'), { withFileTypes: true }).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    for (const project of readdirSync(join(root, 'runtime/tests', entry.name)).filter(f => f.endsWith('.csproj')).sort()) {
      add(entry.name, 'dotnet', ['run', '--project', join(root, 'runtime/tests', entry.name, project), '-c', 'Release']);
    }
  }
}
const results = [];
for (const step of steps) {
  console.log(`\n[${results.length + 1}/${steps.length}] ${step.name}`);
  const start = Date.now();
  const run = spawnSync(step.command, step.args, {
    cwd: step.cwd, env, encoding: 'utf8', windowsHide: true,
    timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024,
  });
  const log = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? `\n${run.error.message}` : ''}`;
  writeFileSync(join(output, `${step.name}.log`), log);
  const passed = run.status === 0 && !run.error;
  const result = { ...step, passed, exitCode: run.status, signal: run.signal, milliseconds: Date.now() - start };
  results.push(result);
  console.log(`${passed ? 'PASS' : 'FAIL'} (${(result.milliseconds / 1000).toFixed(1)}s)`);
  if (!passed) console.error(log.slice(-10000));
  writeFileSync(join(output, 'results.json'), JSON.stringify({ scope, results }, null, 2) + '\n');
}
console.log(`\n${results.filter(r => r.passed).length}/${results.length} passed. Logs: ${output}`);
process.exitCode = results.every(r => r.passed) ? 0 : 1;
