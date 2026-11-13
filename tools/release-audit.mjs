#!/usr/bin/env node
// Read-only release candidate export and redacted secret scanning. Never publishes.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--gitleaks') {
  console.error('Usage: node tools/release-audit.mjs --gitleaks <gitleaks executable>');
  process.exit(2);
}
const scanner = resolve(args[1]);
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
env.GIT_NO_LAZY_FETCH = '1';
function git(...argv) {
  const run = spawnSync('git', argv, { cwd: root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (run.status !== 0) throw Error(`git ${argv[0]} failed`);
  return run.stdout;
}
if (git('rev-parse', '--is-shallow-repository').trim() !== 'false') throw Error('Complete Git history required');
if (/promisor|partialclone/i.test(git('config', '--local', '--list'))) throw Error('Fetch the complete repository before auditing');
if (/^160000 /m.test(git('ls-files', '--stage'))) throw Error('Review submodule contents separately before publishing');
const base = join(root, 'work', 'security');
mkdirSync(base, { recursive: true });
const output = mkdtempSync(join(base, 'release-audit-'));
const snapshot = join(output, 'candidate');
mkdirSync(snapshot);
const names = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))].sort();
const forbidden = /(^|\/)(\.env(?:\..*)?|credentials(?:\.json)?|id_rsa|id_ed25519)$|\.(pem|key|pfx|p12)$/i;
const localOnly = /^(?:work|release|\.codegraph|\.mimosa)\/|(?:^|\/)(?:node_modules|target|\.godot)\/|^tools\/(?:sts2-decompiled|spire-codex)\//;
const gameBinary = /(?:^|\/)(?:sts2|GodotSharp|0Harmony)\.dll$/i;
const files = [];
for (const name of names) {
  const source = resolve(root, name);
  if (!source.startsWith(root + sep)) throw Error(`Out-of-root path: ${name}`);
  if (!existsSync(source)) continue; // Tracked deletion.
  if (localOnly.test(name) || gameBinary.test(name) || (forbidden.test(name) && !name.endsWith('.env.example'))) throw Error(`Review excluded file: ${name}`);
  const info = lstatSync(source);
  if (!info.isFile() || info.isSymbolicLink()) throw Error(`Review non-regular file: ${name}`);
  const target = join(snapshot, name);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  files.push({ path: name, bytes: info.size });
}
const scans = [];
for (const [name, argv] of [
  ['history', ['git', root, '--log-opts=--all --full-history --diff-merges=first-parent']],
  ['candidate', ['dir', snapshot]],
]) {
  const report = join(output, `${name}.json`);
  const run = spawnSync(scanner, [...argv, '--config', join(root, '.gitleaks.toml'), '--redact=100', '--report-format', 'json', '--report-path', report, '--no-banner'], {
    cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(join(output, `${name}.log`), `${run.stdout ?? ''}${run.stderr ?? ''}`);
  const findings = existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')).length : null;
  scans.push({ name, exitCode: run.status, findings, passed: run.status === 0 && findings === 0 });
}
const result = { head: git('rev-parse', 'HEAD').trim(), commits: Number(git('rev-list', '--all', '--count').trim()), files, scans,
  scope: 'All reachable local Git refs and non-ignored working-tree source candidates. Binary behavior, dependencies and packaged assets require separate checks.' };
writeFileSync(join(output, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: relative(root, output), commits: result.commits, files: files.length, scans }, null, 2));
process.exitCode = scans.every(s => s.passed) ? 0 : 1;
