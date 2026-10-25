#!/usr/bin/env node
/**
 * Cross-platform wrapper around `firebase-tools deploy`.
 *
 * The Firebase CLI loads functions/lib/index.js locally to discover endpoints
 * and aborts with "User code failed to load ... Timeout after 10000" if that
 * takes longer than 10s. On Windows a cold Node start (antivirus scanning
 * node_modules, or running right after a heavy `vite build`) can exceed this,
 * so we raise the discovery timeout. Extra CLI args are passed through.
 *
 * Usage: node scripts/firebase-deploy.mjs [--only functions,hosting,firestore]
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const deployArgs = ['firebase-tools', 'deploy', '--non-interactive', ...args];

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', deployArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    // Seconds. Default in firebase-tools is 10.
    FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60',
  },
});

process.exit(result.status ?? 1);
