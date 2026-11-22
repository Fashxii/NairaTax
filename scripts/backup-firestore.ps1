<#
.SYNOPSIS
  DIYtax9ja (nairatax-6128f) — Backup & Disaster Recovery Automation Script

.DESCRIPTION
  Uses scripts/backup-firestore.mjs (Firestore Admin REST API via Firebase CLI auth — no gcloud install needed)
  plus Firebase CLI and Git to back up and restore the entire platform:
    1. -EnableSchedules : Enables Firestore 7-day PITR + Daily (14d) & Weekly (12w) managed backup schedules,
                          and creates the private versioned GCS bucket gs://nairatax-6128f-backups.
    2. -ExportFirestore : Triggers a cloud export to gs://nairatax-6128f-backups/<timestamp> AND saves a full
                          local JSON snapshot of all Firestore collections/subcollections to ./backups/.
    3. -ExportAuth      : Exports Firebase Authentication user accounts to ./backups/auth-users-<timestamp>.json.
    4. -CreateGitBundle : Creates an offline single-file git bundle in ./backups/NairaTax-<timestamp>.bundle.
    5. -RestoreLocal    : Restores a local Firestore JSON snapshot file back to Firestore.
    6. -Status          : Lists PITR state, active Firestore backup schedules, and recent snapshots.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/backup-firestore.ps1 -EnableSchedules
  powershell -ExecutionPolicy Bypass -File scripts/backup-firestore.ps1 -ExportFirestore -ExportAuth -CreateGitBundle
  powershell -ExecutionPolicy Bypass -File scripts/backup-firestore.ps1 -Status
#>

param(
  [string]$ProjectId = "nairatax-6128f",
  [string]$DatabaseId = "(default)",
  [string]$BucketName = "nairatax-6128f-backups",
  [string]$Location = "us-central1",
  [switch]$EnableSchedules,
  [switch]$ExportFirestore,
  [switch]$ExportAuth,
  [switch]$CreateGitBundle,
  [string]$RestoreLocal = "",
  [switch]$Status
)

$ErrorActionPreference = "Stop"
$Stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$LocalBackupDir = Join-Path $PSScriptRoot "..\backups"
$NodeScript = Join-Path $PSScriptRoot "backup-firestore.mjs"

if (-not (Test-Path $LocalBackupDir)) {
  New-Item -ItemType Directory -Path $LocalBackupDir | Out-Null
}

if ($EnableSchedules) {
  node $NodeScript --project $ProjectId --database $DatabaseId --bucket $BucketName --location $Location --stamp $Stamp --enable-schedules
}

if ($ExportFirestore) {
  node $NodeScript --project $ProjectId --database $DatabaseId --bucket $BucketName --location $Location --stamp $Stamp --export-cloud
}

if ($RestoreLocal -ne "") {
  node $NodeScript --project $ProjectId --database $DatabaseId --restore-local $RestoreLocal
}

if ($ExportAuth) {
  $AuthFile = Join-Path $LocalBackupDir "auth-users-$Stamp.json"
  Write-Host "[Auth Export] Exporting Firebase Auth users to $AuthFile ..." -ForegroundColor Cyan
  npx.cmd firebase-tools auth:export "$AuthFile" --format=json --project "$ProjectId"
  Write-Host "[Auth Export] ✓ Firebase Auth export saved: $AuthFile" -ForegroundColor Green
}

if ($CreateGitBundle) {
  $BundleFile = Join-Path $LocalBackupDir "NairaTax-$Stamp.bundle"
  Write-Host "[Git Bundle] Creating full git repository bundle at $BundleFile ..." -ForegroundColor Cyan
  git bundle create "$BundleFile" --all
  Write-Host "[Git Bundle] ✓ Git bundle created: $BundleFile" -ForegroundColor Green
}

if ($Status -or (-not $EnableSchedules -and -not $ExportFirestore -and -not $ExportAuth -and -not $CreateGitBundle -and $RestoreLocal -eq "")) {
  node $NodeScript --project $ProjectId --database $DatabaseId --status
}
