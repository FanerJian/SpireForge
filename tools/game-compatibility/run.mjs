import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arguments_ = process.argv.slice(2);
if (!arguments_.length || arguments_.includes('--help')) {
  console.log('node tools/game-compatibility/run.mjs --game-dir <directory> --output <report.json>');
  process.exit(0);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = join(root, 'work/compatibility', `probe-${Date.now()}-${process.pid}`);
const intermediate = join(work, 'obj') + '/';
const output = join(work, 'bin') + '/';
const temporary = join(work, 'temp');
const feed = join(work, 'empty-feed');
mkdirSync(temporary, { recursive: true });
mkdirSync(feed, { recursive: true });
const env = {
  ...process.env,
  MSBuildEnableWorkloadResolver: 'false',
  DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
  TEMP: temporary,
  TMP: temporary,
};

function run(args, log) {
  const result = spawnSync('dotnet', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const content = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(work, log), content);
  process.stdout.write(content);
  if (result.error) console.error(result.error.message);
  return result.status ?? 2;
}

const build = run([
  'build', join(root, 'tools/game-compatibility/GameCompatibility.csproj'), '-c', 'Release',
  `-p:BaseIntermediateOutputPath=${intermediate}`,
  `-p:IntermediateOutputPath=${intermediate}Release/`,
  `-p:MSBuildProjectExtensionsPath=${intermediate}`,
  `-p:OutputPath=${output}`,
  `-p:RestoreSources=${feed}`,
  '-p:NuGetAudit=false',
], 'build.log');
if (build !== 0) process.exit(build);
process.exit(run([join(output, 'GameCompatibility.dll'), ...arguments_], 'inspect.log'));
