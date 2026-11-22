# DIYtax9ja (`nairatax-6128f`) — Backup, Restore & Search-Engine Protection Runbook

## 1. Quick-Run Backup Commands ([scripts/backup-firestore.ps1](file:///c:/Users/Samso/Documents/Agents/NairaTax/scripts/backup-firestore.ps1))

Run from the repository root in PowerShell:

```powershell
# First-time setup: enable 7-day PITR, daily (14d) & weekly (12w) schedules, and create gs://nairatax-6128f-backups
powershell -ExecutionPolicy Bypass -File scripts/backup-firestore.ps1 -EnableSchedules

# On-demand snapshot before a release (Firestore + Firebase Auth + Git bundle)
powershell -ExecutionPolicy Bypass -File scripts/backup-firestore.ps1 -ExportFirestore -ExportAuth -CreateGitBundle

# Check backup schedules and available restore snapshots
powershell -ExecutionPolicy Bypass -File scripts/backup-firestore.ps1 -Status
```

Local exports land in `./backups/` (git-ignored). Copy `./backups/` to encrypted off-site storage.

---

## 2. Step-by-Step Restore Procedures

### A. Roll Back a Frontend Deploy
- **Console (30s):** Firebase Console → **Hosting → Release history** → click the menu on the previous release → **Rollback**.
- **CLI from tag:**
  ```powershell
  git checkout v1.0.0
  npx.cmd vite build
  node scripts/firebase-deploy.mjs --only hosting
  ```

### B. Restore Specific Collections (`platform_config`, `users`, `admin_audit_logs`)
```powershell
gcloud firestore import gs://nairatax-6128f-backups/<TIMESTAMP_FOLDER> `
  --collection-ids=platform_config,admin_audit_logs `
  --database="(default)" `
  --project=nairatax-6128f
```

### C. Full Database Disaster Recovery (into a verification database first)
1. List backups:
   ```powershell
   gcloud firestore backups list --project=nairatax-6128f
   ```
2. Restore into `recovery-db` without touching live traffic:
   ```powershell
   gcloud firestore databases restore `
     --source-backup="projects/nairatax-6128f/locations/us-central1/backups/<BACKUP_ID>" `
     --destination-database="recovery-db" `
     --project=nairatax-6128f
   ```
3. Inspect `recovery-db` in the Firebase Console, then export and import into `(default)`.

### D. Restore Firebase Authentication Users
```powershell
npx.cmd firebase-tools auth:import backups/auth-users-<TIMESTAMP>.json --project nairatax-6128f
```

---

## 3. Search Engine, App Script & Cloud Hosting Protection

### What Is Enforced Automatically in the Repo
1. **[public/robots.txt](file:///c:/Users/Samso/Documents/Agents/NairaTax/public/robots.txt):**
   - Blocks AI & code scrapers (`GPTBot`, `CCBot`, `ClaudeBot`, `Google-Extended`, `Bytespider`, `PerplexityBot`, etc.) across the entire site.
   - Allows standard search engines on `/` only, and disallows `/admin`, `/dashboard`, `/verify`, `/compliance`, `/register`, `/api/`, and `/assets/`.
2. **`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`** in [firebase.json](file:///c:/Users/Samso/Documents/Agents/NairaTax/firebase.json):
   - Sent on `/assets/**` (compiled JS/CSS bundles) and on `/admin**`, `/dashboard**`, `/verify**`, `/compliance**`, and `/register**`.
3. **Runtime `<meta name="robots">` guard** in [src/AppShell.tsx](file:///c:/Users/Samso/Documents/Agents/NairaTax/src/AppShell.tsx):
   - Automatically sets `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` whenever the visitor is on a raw Firebase domain (`*.web.app`, `*.firebaseapp.com`) or on any non-landing route (`location.pathname !== '/'`).
   - Only `https://diytax9ja.ng/` receives `index, follow`.
4. **Bundle Hardening** in [vite.config.ts](file:///c:/Users/Samso/Documents/Agents/NairaTax/vite.config.ts):
   - Production builds disable source maps (`sourcemap: false`), strip `console.*` and `debugger`, and strip license/comment banners.

### Manual DNS & Cloud Masking Checklist (Cloudflare + Registrar)
- [ ] Enable **WHOIS Privacy** at your domain registrar for `diytax9ja.ng`.
- [ ] Place **Cloudflare DNS (Proxied / Orange Cloud 🟠)** in front of `diytax9ja.ng` with **SSL/TLS = Full (Strict)** so public DNS/IP lookups show Cloudflare rather than Google Cloud / Fastly IPs.
- [ ] Turn on **Cloudflare Bot Fight Mode** to block automated script downloading (`curl`, `wget`, headless scrapers).

