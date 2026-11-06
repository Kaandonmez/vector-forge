#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const projectFlagIndex = args.indexOf('--project');
const targetProject =
  projectFlagIndex >= 0 && args[projectFlagIndex + 1]
    ? path.resolve(args[projectFlagIndex + 1])
    : process.env.VECTORFORGE_PROJECT
      ? path.resolve(process.env.VECTORFORGE_PROJECT)
      : process.cwd();

const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0);
const projectFile = path.join(targetProject, 'vectorforge.project.json');
const hasProject = existsSync(projectFile);

let projectInfo = null;
if (hasProject) {
  try {
    projectInfo = JSON.parse(readFileSync(projectFile, 'utf8'));
  } catch (err) {
    projectInfo = { error: err instanceof Error ? err.message : String(err) };
  }
}

let cliBinary = null;
try {
  const versionOut = execFileSync('vectorforge', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (versionOut) cliBinary = { command: 'vectorforge', version: versionOut };
} catch {
  const localDist = path.resolve(import.meta.dirname, '../../../dist/cli.js');
  if (existsSync(localDist)) {
    cliBinary = { command: 'node', script: localDist };
  }
}

const report = {
  skill: 'vectorforge-mcp-starter',
  skillVersion: '1.0.0',
  nodeVersion: process.version,
  nodeSupported: nodeMajor >= 22,
  targetProject,
  projectInitialized: hasProject,
  projectMetadata: projectInfo,
  detectedCli: cliBinary,
  recommendedMcpConfig: {
    mcpServers: {
      vectorforge: cliBinary?.script
        ? {
            command: 'node',
            args: [cliBinary.script, 'mcp', '--project', targetProject],
          }
        : {
            command: 'npx',
            args: ['-y', 'vectorforge', 'mcp', '--project', targetProject],
          },
    },
  },
};

console.log(JSON.stringify(report, null, 2));
if (!report.nodeSupported) process.exitCode = 1;
