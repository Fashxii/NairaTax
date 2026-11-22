<#
.SYNOPSIS
  DIYtax9ja (nairatax-6128f) — Backup & Disaster Recovery Automation Script

.DESCRIPTION
  Automates:
    1. -EnableSchedules : Enables Firestore 7-day PITR + Daily (14d) & Weekly (12w) managed backup schedules,
                          and creates the private versioned GCS bucket gs://nairatax-6128f-backups.
    2. -ExportFirestore : Triggers an on-demand full Firestore export to gs://nairatax-6128f-backups/<timestamp>.
    3. -ExportAuth      : Exports Firebase Authentication user accounts to ./backups/auth-users-<timestamp>.json.
    4. -CreateGitBundle : Creates an offline single-file git bundle in ./backups/NairaTax-<timestamp>.bundle.
    5. -Status          : Lists active Firestore backup schedules and recent snapshots.

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
  [switch]$Status
)

$ErrorActionPreference = "Stop"
$Stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$LocalBackupDir = Join-Path $PSScriptRoot "..\backups"

if (-not (Test-Path $LocalBackupDir)) {
  New-Item -ItemType Directory -Path $LocalBackupDir | Out-Null
}

if ($EnableSchedules) {
  Write-Host "[1/4] Enabling 7-day Point-in-Time Recovery (PITR) on Firestore..." -ForegroundColor Cyan
  gcloud firestore databases update --database="$DatabaseId" --enable-pitr --project="$ProjectId"

  Write-Host "[2/4] Creating daily backup schedule (14-day retention)..." -ForegroundColor Cyan
  gcloud firestore backups schedules create --database="$DatabaseId" --recurrence=daily --retention=14d --project="$ProjectId"

  Write-Host "[3/4] Creating weekly Sunday backup schedule (12-week retention)..." -ForegroundColor Cyan
  gcloud firestore backups schedules create --database="$DatabaseId" --recurrence=weekly --day-of-week=SUN --retention=12w --project="$ProjectId"

  Write-Host "[4/4] Creating versioned GCS cold-backup bucket gs://$BucketName..." -ForegroundColor Cyan
  gcloud storage buckets create "gs://$BucketName" --project="$ProjectId" --location="$Location" --uniform-bucket-level-access
  gcloud storage buckets update "gs://$BucketName" --versioning
  Write-Host "Backup schedules and bucket configured." -ForegroundColor Green
}

if ($ExportFirestore) {
  $TargetUri = "gs://$BucketName/$Stamp"
  Write-Host "Exporting Firestore ($DatabaseId) to $TargetUri ..." -ForegroundColor Cyan
  gcloud firestore export "$TargetUri" --database="$DatabaseId" --project="$ProjectId"
  Write-Host "Firestore export complete: $TargetUri" -ForegroundColor Green
}

if ($ExportAuth) {
  $AuthFile = Join-Path $LocalBackupDir "auth-users-$Stamp.json"
  Write-Host "Exporting Firebase Auth users to $AuthFile ..." -ForegroundColor Cyan
  npx.cmd firebase-tools auth:export "$AuthFile" --format=json --project "$ProjectId"
  Write-Host "Firebase Auth export saved (keep outside git): $AuthFile" -ForegroundColor Green
}

if ($CreateGitBundle) {
  $BundleFile = Join-Path $LocalBackupDir "NairaTax-$Stamp.bundle"
  Write-Host "Creating full git repository bundle at $BundleFile ..." -ForegroundColor Cyan
  git bundle create "$BundleFile" --all
  Write-Host "Git bundle created: $BundleFile" -ForegroundColor Green
}

if ($Status -or (-not $EnableSchedules -and -not $ExportFirestore -and -not $ExportAuth -and -not $CreateGitBundle)) {
  Write-Host "=== Active Firestore Backup Schedules ===" -ForegroundColor Cyan
  gcloud firestore backups schedules list --database="$DatabaseId" --project="$ProjectId"
  Write-Host "`n=== Available Firestore Backups ===" -ForegroundColor Cyan
  gcloud firestore backups list --format="table(name, database, state, snapshotTime, expireTime)" --project="$ProjectId"
}

