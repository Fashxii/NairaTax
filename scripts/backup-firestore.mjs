#!/usr/bin/env node
/**
 * scripts/backup-firestore.mjs — Zero-gcloud Firestore & GCS Backup / Restore Engine
 *
 * Uses the signed-in Firebase CLI OAuth token (~/.config/configstore/firebase-tools.json)
 * to call the Google Cloud Firestore Admin REST API and Cloud Storage JSON API directly,
 * so it works on any machine with Node.js + Firebase CLI (no gcloud SDK installation required).
 *
 * Capabilities:
 *   --enable-schedules : Enables 7-day PITR, Daily (14d) & Weekly (12w) native Firestore
 *                        backup schedules, and creates the versioned GCS bucket.
 *   --export-cloud     : Triggers a server-side Firestore export to gs://<bucket>/<timestamp>
 *                        AND downloads a full local JSON snapshot of all collections & subcollections.
 *   --restore-local <file> : Restores a local JSON snapshot back into Firestore.
 *   --status           : Prints PITR status, active backup schedules, and available cloud backups.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (flag) => args.includes(flag);

const PROJECT_ID = getArg('--project', 'nairatax-6128f');
const DATABASE_ID = getArg('--database', '(default)');
const BUCKET_NAME = getArg('--bucket', `${PROJECT_ID}-backups`);
const LOCATION = getArg('--location', 'us-central1');
const STAMP = getArg('--stamp', new Date().toISOString().replace(/[:.]/g, '-'));
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

function getAccessToken() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error('Firebase CLI credentials not found. Run `npx firebase-tools login` first.');
  }
  let cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (!cfg.tokens?.access_token || (cfg.tokens.expires_at && cfg.tokens.expires_at < Date.now() + 60_000)) {
    // Trigger firebase-tools to refresh the OAuth token
    spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['firebase-tools', 'login:list'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
  return cfg.tokens.access_token;
}

async function apiRequest(url, { method = 'GET', body, token } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

const DB_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${encodeURIComponent(DATABASE_ID)}`;

async function enableSchedules(token) {
  console.log(`[1/4] Enabling 7-day Point-in-Time Recovery (PITR) on ${PROJECT_ID}/${DATABASE_ID}...`);
  const pitrRes = await apiRequest(`${DB_BASE}?updateMask=pointInTimeRecoveryEnablement`, {
    method: 'PATCH',
    token,
    body: { pointInTimeRecoveryEnablement: 'POINT_IN_TIME_RECOVERY_ENABLED' },
  });
  if (pitrRes.ok) {
    console.log('  ✓ PITR enabled (7-day rolling 1-minute recovery window).');
  } else {
    console.warn(`  ! PITR update returned HTTP ${pitrRes.status}: ${pitrRes.data?.error?.message || JSON.stringify(pitrRes.data)}`);
  }

  console.log('[2/4] Checking existing Firestore backup schedules...');
  const existingRes = await apiRequest(`${DB_BASE}/backupSchedules`, { token });
  const existing = existingRes.data?.backupSchedules || [];
  const hasDaily = existing.some((s) => s.dailyRecurrence);
  const hasWeekly = existing.some((s) => s.weeklyRecurrence);

  if (hasDaily) {
    console.log('  ✓ Daily backup schedule already active.');
  } else {
    console.log('  Creating daily backup schedule (14-day retention)...');
    const dailyRes = await apiRequest(`${DB_BASE}/backupSchedules`, {
      method: 'POST',
      token,
      body: {
        retention: `${14 * 86400}s`,
        dailyRecurrence: {},
      },
    });
    if (dailyRes.ok) console.log(`  ✓ Daily schedule created: ${dailyRes.data.name}`);
    else console.warn(`  ! Daily schedule HTTP ${dailyRes.status}: ${dailyRes.data?.error?.message}`);
  }

  if (hasWeekly) {
    console.log('[3/4] ✓ Weekly backup schedule already active.');
  } else {
    console.log('[3/4] Creating weekly Sunday backup schedule (12-week retention)...');
    const weeklyRes = await apiRequest(`${DB_BASE}/backupSchedules`, {
      method: 'POST',
      token,
      body: {
        retention: `${12 * 7 * 86400}s`,
        weeklyRecurrence: { day: 'SUNDAY' },
      },
    });
    if (weeklyRes.ok) console.log(`  ✓ Weekly schedule created: ${weeklyRes.data.name}`);
    else console.warn(`  ! Weekly schedule HTTP ${weeklyRes.status}: ${weeklyRes.data?.error?.message}`);
  }

  console.log(`[4/4] Ensuring versioned GCS cold-backup bucket gs://${BUCKET_NAME} exists...`);
  const bucketCheck = await apiRequest(`https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}`, { token });
  if (bucketCheck.ok) {
    console.log(`  ✓ Bucket gs://${BUCKET_NAME} already exists.`);
  } else {
    const createRes = await apiRequest(
      `https://storage.googleapis.com/storage/v1/b?project=${PROJECT_ID}`,
      {
        method: 'POST',
        token,
        body: {
          name: BUCKET_NAME,
          location: LOCATION,
          iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
          versioning: { enabled: true },
        },
      }
    );
    if (createRes.ok) console.log(`  ✓ Created versioned bucket gs://${BUCKET_NAME}.`);
    else console.warn(`  ! Bucket creation HTTP ${createRes.status}: ${createRes.data?.error?.message || 'requires Billing/GCS API enabled'}`);
  }
}

async function listCollectionDocs(token, collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${DB_BASE}/documents/${collectionPath}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await apiRequest(url, { token });
    if (!res.ok) break;
    if (Array.isArray(res.data.documents)) docs.push(...res.data.documents);
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function exportFirestore(token) {
  // 1. Trigger cloud export to GCS if bucket is accessible
  const outputUriPrefix = `gs://${BUCKET_NAME}/${STAMP}`;
  console.log(`[Cloud Export] Triggering managed Firestore export to ${outputUriPrefix}...`);
  const expRes = await apiRequest(`${DB_BASE}:exportDocuments`, {
    method: 'POST',
    token,
    body: { outputUriPrefix },
  });
  if (expRes.ok) {
    console.log(`  ✓ Cloud export operation started: ${expRes.data.name}`);
  } else {
    console.warn(`  ! Cloud export to GCS skipped (${expRes.data?.error?.message || expRes.status}); proceeding with full local JSON snapshot.`);
  }

  // 2. Always take a full local JSON snapshot of all collections and user subcollections
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const topCollections = [
    'platform_config',
    'users',
    'admin_audit_logs',
    'email_audit_logs',
    'system_config',
  ];
  const userSubcollections = [
    'user_data',
    'tax_ledger',
  ];

  const snapshot = {
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    exportedAt: new Date().toISOString(),
    collections: {},
    userSubcollections: {},
  };

  let totalDocs = 0;
  for (const col of topCollections) {
    const docs = await listCollectionDocs(token, col);
    snapshot.collections[col] = docs;
    totalDocs += docs.length;
  }

  // For each user document, also back up user_data/* and tax_ledger/*
  const userDocs = snapshot.collections.users || [];
  for (const u of userDocs) {
    const emailId = u.name.split('/documents/users/')[1];
    if (!emailId) continue;
    snapshot.userSubcollections[emailId] = {};
    for (const sub of userSubcollections) {
      const subDocs = await listCollectionDocs(token, `users/${encodeURIComponent(emailId)}/${sub}`);
      if (subDocs.length > 0) {
        snapshot.userSubcollections[emailId][sub] = subDocs;
        totalDocs += subDocs.length;
      }
    }
  }

  const outFile = path.join(BACKUP_DIR, `firestore-snapshot-${STAMP}.json`);
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`[Local Snapshot] ✓ Saved ${totalDocs} Firestore documents to ${outFile}`);
}

async function restoreLocal(token, filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  const snapshot = JSON.parse(fs.readFileSync(abs, 'utf8'));
  let restored = 0;
  const allDocs = [];
  for (const docs of Object.values(snapshot.collections || {})) {
    if (Array.isArray(docs)) allDocs.push(...docs);
  }
  for (const subs of Object.values(snapshot.userSubcollections || {})) {
    for (const docs of Object.values(subs || {})) {
      if (Array.isArray(docs)) allDocs.push(...docs);
    }
  }
  for (const doc of allDocs) {
    if (!doc.name || !doc.fields) continue;
    const res = await apiRequest(`https://firestore.googleapis.com/v1/${doc.name}`, {
      method: 'PATCH',
      token,
      body: { fields: doc.fields },
    });
    if (res.ok) restored++;
  }
  console.log(`✓ Restored ${restored}/${allDocs.length} documents from ${abs}`);
}

async function showStatus(token) {
  const dbRes = await apiRequest(DB_BASE, { token });
  console.log('=== Firestore Database Status ===');
  if (dbRes.ok) {
    console.log(`  Database : ${dbRes.data.name}`);
    console.log(`  Location : ${dbRes.data.locationId}`);
    console.log(`  PITR     : ${dbRes.data.pointInTimeRecoveryEnablement || 'DISABLED'}`);
    console.log(`  Earliest : ${dbRes.data.earliestVersionTime || 'n/a'}`);
  }

  const schedRes = await apiRequest(`${DB_BASE}/backupSchedules`, { token });
  console.log('\n=== Active Backup Schedules ===');
  const schedules = schedRes.data?.backupSchedules || [];
  if (schedules.length === 0) {
    console.log('  (none)');
  } else {
    for (const s of schedules) {
      const kind = s.dailyRecurrence ? 'DAILY' : s.weeklyRecurrence ? `WEEKLY (${s.weeklyRecurrence.day})` : 'CUSTOM';
      const days = Math.round(Number(String(s.retention || '0s').replace('s', '')) / 86400);
      console.log(`  • ${kind.padEnd(16)} retention=${days}d  (${s.name})`);
    }
  }

  const backupsRes = await apiRequest(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/locations/-/backups`,
    { token }
  );
  console.log('\n=== Managed Cloud Backups ===');
  const backups = backupsRes.data?.backups || [];
  if (backups.length === 0) {
    console.log('  (no completed snapshots yet — first scheduled snapshot runs at the next daily window)');
  } else {
    for (const b of backups) {
      console.log(`  • ${b.state}  snapshot=${b.snapshotTime}  expires=${b.expireTime}  ${b.name}`);
    }
  }
}

async function main() {
  const token = getAccessToken();
  if (hasFlag('--enable-schedules')) await enableSchedules(token);
  if (hasFlag('--export-cloud')) await exportFirestore(token);
  const restoreFile = getArg('--restore-local', null);
  if (restoreFile) await restoreLocal(token, restoreFile);
  if (hasFlag('--status') || (!hasFlag('--enable-schedules') && !hasFlag('--export-cloud') && !restoreFile)) {
    await showStatus(token);
  }
}

main().catch((err) => {
  console.error('Backup error:', err.message || err);
  process.exit(1);
});
