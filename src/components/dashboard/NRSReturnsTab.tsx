/**
 * NRSReturnsTab.tsx — "NRS Returns" workspace (Phases 1–4).
 *
 *  Ledger    → import bank CSV / Smart Vault, review & correct classifications
 *  Health    → compliance issues with one-click fixes
 *  Returns   → VAT Schedules A & C, WHT schedule, CIT summary, exports, filing status
 */

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileSpreadsheet, FileText,
  Info, Landmark, Lock, ShieldAlert, ShieldCheck, Trash2, Unlock, Upload, X,
} from 'lucide-react';
import { useToast } from '../Toast';
import { useTaxLedger } from '../../nrs/ledgerStore';
import { importBankCsv, importSmartVault } from '../../nrs/importers';
import { needsReview } from '../../nrs/classifier';
import { runCompliance, type ComplianceIssue } from '../../nrs/compliance';
import { buildCitSummary, buildVatReturn, buildWhtSchedule } from '../../nrs/schedules';
import { DEFAULT_LAYOUTS, downloadCsv, toCsv } from '../../nrs/exportLayouts';
import { generateReviewPackPDF } from '../../nrs/pdf';
import { formatKobo } from '../../nrs/money';
import { getTaxYearConfig } from '../../nrs/taxYearConfig';
import { validateTin } from '../../nrs/tin';
import { WHT_RATE_SCHEDULE } from '../../utils/whtEngine';
import { useUserPersistedState } from '../../utils/userScope';
import type { SyncTransaction } from '../../types';
import type {
  CitCategory, LedgerTransaction, LedgerTransactionPatch, PeriodStatus, VatTreatment,
} from '../../nrs/types';

interface NRSReturnsTabProps {
  smartVaultTransactions: SyncTransaction[];
  accountMode: 'personal' | 'business';
  taxpayerName: string;
  taxId?: string;
}

const CIT_LABELS: Record<CitCategory, string> = {
  SALES_REVENUE: 'Sales revenue',
  OTHER_INCOME: 'Other income',
  OPERATING_EXPENSE: 'Operating expense',
  CAPEX: 'Capital purchase (asset)',
  SALARY_PAYE: 'Salaries & staff costs',
  RENT_EXPENSE: 'Rent',
  EXEMPT_SUPPLY: 'Exempt supply',
  NON_ALLOWABLE: 'Not allowable',
  TAX_PAYMENT: 'Tax / levy payment',
  TRANSFER: 'Transfer / not income or expense',
  UNCLASSIFIED: 'Unclassified',
};

const VAT_LABELS: Record<VatTreatment, string> = {
  STANDARD: 'Standard 7.5%',
  ZERO_RATED: 'Zero-rated',
  EXEMPT: 'Exempt',
  OUT_OF_SCOPE: 'No VAT (out of scope)',
};

const STATUS_STYLE: Record<PeriodStatus, string> = {
  OPEN: 'bg-surface-container text-on-surface-variant',
  REVIEWED: 'bg-amber-100 text-amber-800',
  FILED: 'bg-emerald-100 text-emerald-800',
  AMENDING: 'bg-rose-100 text-rose-800',
};

const SEVERITY_ICON = { error: ShieldAlert, warning: AlertTriangle, info: Info };
const SEVERITY_STYLE = {
  error: 'text-error bg-error/10 border-error/30',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  info: 'text-sky-700 bg-sky-50 border-sky-200',
};

type View = 'ledger' | 'health' | 'returns';
type LedgerFilter = 'all' | 'review' | 'issues';

const card = 'bg-white border border-outline-variant rounded-2xl p-5 shadow-xs';
const btnPrimary = 'h-10 px-4 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed';
const btnSecondary = 'h-10 px-4 border border-outline-variant bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed';
const inputCls = 'w-full h-10 px-3 rounded-lg border border-outline-variant bg-white text-sm';

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function NRSReturnsTab({ smartVaultTransactions, accountMode, taxpayerName, taxId }: NRSReturnsTabProps) {
  const { showToast } = useToast();
  const ledger = useTaxLedger();
  const [settings, setSettings] = useUserPersistedState<{ isVatRegistered: boolean; isTechLevySector: boolean }>(
    'nrs_taxpayer_settings',
    { isVatRegistered: false, isTechLevySector: false },
  );
  const [view, setView] = useState<View>('ledger');
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [period, setPeriod] = useState<string>(currentPeriod());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filingRefDraft, setFilingRefDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const year = Number(period.slice(0, 4));
  const cfg = getTaxYearConfig(year);
  const periodDoc = ledger.periods[period];
  const status: PeriodStatus = periodDoc?.meta.status ?? 'OPEN';
  const locked = status === 'FILED';

  const availablePeriods = useMemo(() => {
    const set = new Set<string>([currentPeriod(), ...Object.keys(ledger.periods)]);
    return [...set].sort().reverse();
  }, [ledger.periods]);

  const periodTxs = useMemo(() => ledger.allTransactions.filter((t) => t.taxPeriod === period), [ledger.allTransactions, period]);
  const yearTxs = useMemo(() => ledger.allTransactions.filter((t) => t.date.startsWith(String(year))), [ledger.allTransactions, year]);

  const report = useMemo(
    () => runCompliance(periodTxs, yearTxs, year, {
      isVatRegistered: settings.isVatRegistered,
      accountType: accountMode === 'business' ? 'business' : 'individual',
      taxId,
    }),
    [periodTxs, yearTxs, year, settings.isVatRegistered, accountMode, taxId],
  );
  const issuesByTx = useMemo(() => {
    const map = new Map<string, ComplianceIssue[]>();
    for (const i of report.issues) if (i.txId) map.set(i.txId, [...(map.get(i.txId) ?? []), i]);
    return map;
  }, [report.issues]);

  const vat = useMemo(() => buildVatReturn(period, periodTxs), [period, periodTxs]);
  const wht = useMemo(() => buildWhtSchedule(period, periodTxs), [period, periodTxs]);
  const cit = useMemo(() => buildCitSummary(year, yearTxs, settings.isTechLevySector), [year, yearTxs, settings.isTechLevySector]);

  const reviewCount = periodTxs.filter((t) => needsReview(t.classification.confidence, t.classification.reviewedAt)).length;
  const visibleTxs = periodTxs.filter((t) =>
    filter === 'all' ? true
      : filter === 'review' ? needsReview(t.classification.confidence, t.classification.reviewedAt) || t.citCategory === 'UNCLASSIFIED'
      : (issuesByTx.get(t.id) ?? []).some((i) => i.severity !== 'info'),
  );
  const editing = editingId ? ledger.allTransactions.find((t) => t.id === editingId) ?? null : null;

  // ── Import handlers ──
  const reportImport = (res: ReturnType<typeof ledger.importInputs>, extra = '') => {
    const parts = [`${res.added} added`];
    if (res.duplicates) parts.push(`${res.duplicates} already imported`);
    if (res.locked) parts.push(`${res.locked} skipped (filed period)`);
    showToast(res.added > 0 ? 'success' : 'info', 'Import complete', parts.join(' · ') + extra);
    if (res.oversized.length) {
      showToast('warning', 'Large period', `${res.oversized.join(', ')} has over 1,200 transactions — contact support before adding more.`);
    }
    if (res.touched.length && !res.touched.includes(period)) setPeriod(res.touched.sort().reverse()[0]);
  };

  const handleCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = importBankCsv(String(reader.result ?? ''), file.name);
      if (parsed.transactions.length === 0) {
        showToast('error', 'Nothing imported', parsed.errors[0]?.message ?? 'No transactions found in the file.');
        return;
      }
      reportImport(ledger.importInputs(parsed.transactions), parsed.errors.length ? ` · ${parsed.errors.length} row(s) unreadable` : '');
    };
    reader.readAsText(file);
  };

  const handleSmartVault = () => {
    const { transactions, skipped } = importSmartVault(smartVaultTransactions);
    if (transactions.length === 0) {
      showToast('info', 'Smart Vault is empty', 'Sync a bank or scan receipts on the Overview tab first.');
      return;
    }
    reportImport(ledger.importInputs(transactions), skipped ? ` · ${skipped} skipped` : '');
  };

  // ── Period status ──
  const changeStatus = (to: PeriodStatus) => {
    if (to === 'FILED' && !filingRefDraft.trim()) {
      showToast('warning', 'Filing reference needed', 'Enter the acknowledgement / reference number from the NRS portal.');
      return;
    }
    const res = ledger.setPeriodStatus(period, to, to === 'FILED' ? filingRefDraft.trim() : undefined);
    if (!res.ok) showToast('error', 'Status not changed', res.error);
    else {
      setFilingRefDraft('');
      showToast('success', `${monthLabel(period)}: ${to.toLowerCase()}`);
    }
  };

  // ── Exports ──
  const exportCsv = (kind: 'vatA' | 'vatC' | 'wht') => {
    const rows = kind === 'vatA' ? vat.scheduleA : kind === 'vatC' ? vat.scheduleC : wht.rows;
    if (rows.length === 0) {
      showToast('info', 'Nothing to export', 'This schedule has no rows for the selected month.');
      return;
    }
    const layout = DEFAULT_LAYOUTS[kind];
    // Each layout is typed to its own row shape; the kind switch above guarantees a match.
    const csv = toCsv(layout as typeof DEFAULT_LAYOUTS['vatA'], rows as typeof vat.scheduleA);
    downloadCsv(`${layout.id}_${period}.csv`, csv);
    ledger.logExport(period, `Exported ${layout.label} (${rows.length} rows)`);
  };

  const exportPdf = () => {
    generateReviewPackPDF({
      taxpayerName,
      taxId,
      vat,
      wht,
      status,
      layoutNote: 'Draft working paper generated by DIYtax9ja for review before filing on the NRS portal. Figures depend on the classifications you confirmed. Statutory thresholds pending adviser confirmation where marked.',
    });
    ledger.logExport(period, 'Exported PDF review pack');
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-primary-container flex items-center gap-2">
            <Landmark className="w-6 h-6" /> NRS Returns
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Turn your bank transactions into VAT, WHT and CIT schedules ready to review and file.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tax period" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-10 px-3 rounded-xl border border-outline-variant bg-white text-sm font-bold">
            {availablePeriods.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
          </select>
          <span className={`h-10 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${STATUS_STYLE[status]}`}>
            {locked ? <Lock className="w-3.5 h-3.5" /> : null}{status}
          </span>
        </div>
      </div>

      {!cfg.verified && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <b>{cfg.year} thresholds are awaiting tax-adviser confirmation.</b> VAT and WHT figures come from your own transactions,
            but small-company and VAT-registration checks are estimates for now. Exports use a draft column layout until the official NRS templates are confirmed.
          </span>
        </div>
      )}
      {ledger.syncError && (
        <div className="p-3 rounded-xl border border-outline-variant bg-surface-container-low text-xs text-on-surface-variant">{ledger.syncError}</div>
      )}

      {/* Sub-navigation */}
      <div className="flex gap-2 border-b border-outline-variant" role="tablist">
        {([
          ['ledger', `Ledger (${periodTxs.length})`],
          ['health', `Compliance health · ${report.score}%`],
          ['returns', 'Returns & export'],
        ] as [View, string][]).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px cursor-pointer ${view === v ? 'border-primary-container text-primary-container' : 'border-transparent text-on-surface-variant hover:text-primary-container'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── LEDGER ── */}
      {view === 'ledger' && (
        <div className="space-y-4">
          <div className={`${card} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
            <div className="text-sm text-on-surface-variant">
              Import a bank statement (CSV) or bring in expenses already in your Smart Vault. Re-importing the same file is safe — duplicates are skipped.
              <span className="block text-[11px] mt-1">Classification runs on this device using rules — your narrations are not sent to any AI service.</span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <label className={btnPrimary}>
                <Upload className="w-4 h-4" /> Bank CSV
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsv} />
              </label>
              <button className={btnSecondary} onClick={handleSmartVault}>
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> From Smart Vault
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl">
              {([['all', 'All'], ['review', `Needs review (${reviewCount})`], ['issues', 'Has issues']] as [LedgerFilter, string][]).map(([f, label]) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${filter === f ? 'bg-white shadow-xs text-primary-container' : 'text-on-surface-variant'}`}>
                  {label}
                </button>
              ))}
            </div>
            {reviewCount > 0 && !locked && (
              <button className={btnSecondary}
                onClick={() => {
                  const ids = periodTxs.filter((t) => needsReview(t.classification.confidence, t.classification.reviewedAt) && t.citCategory !== 'UNCLASSIFIED').map((t) => t.id);
                  const n = ledger.confirmTransactions(ids);
                  showToast('success', `Confirmed ${n} classification(s)`);
                }}>
                <ClipboardCheck className="w-4 h-4" /> Accept all suggestions
              </button>
            )}
          </div>

          <div className={`${card} p-0 overflow-x-auto`}>
            {ledger.loading ? (
              <p className="p-6 text-sm text-on-surface-variant">Loading ledger…</p>
            ) : visibleTxs.length === 0 ? (
              <p className="p-6 text-sm text-on-surface-variant">
                {periodTxs.length === 0 ? `No transactions for ${monthLabel(period)} yet. Import a bank statement to begin.` : 'Nothing matches this filter.'}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">VAT</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-right p-3">VAT / WHT</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTxs.map((t) => {
                    const issues = (issuesByTx.get(t.id) ?? []).filter((i) => i.severity !== 'info');
                    const review = needsReview(t.classification.confidence, t.classification.reviewedAt);
                    return (
                      <tr key={t.id} className="border-t border-outline-variant/40 hover:bg-surface-container-lowest">
                        <td className="p-3 whitespace-nowrap font-mono">{t.date}</td>
                        <td className="p-3 max-w-[260px]">
                          <p className="font-bold text-on-surface truncate">{t.counterpartyName || t.narration}</p>
                          {t.counterpartyName && <p className="text-[10px] text-on-surface-variant truncate">{t.narration}</p>}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold">{CIT_LABELS[t.citCategory]}</span>
                          {review && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase">Check</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">{VAT_LABELS[t.vatTreatment]}</td>
                        <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${t.direction === 'INFLOW' ? 'text-emerald-700' : 'text-on-surface'}`}>
                          {t.direction === 'INFLOW' ? '+' : '−'}{formatKobo(t.amountKobo)}
                        </td>
                        <td className="p-3 text-right font-mono whitespace-nowrap text-on-surface-variant">
                          {t.vatKobo > 0 ? formatKobo(t.vatKobo) : '—'}
                          {t.whtKobo > 0 && <span className="block text-[10px]">WHT {formatKobo(t.whtKobo)}</span>}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {issues.length > 0 && <span title={issues.map((i) => i.title).join('\n')}><AlertTriangle className="w-4 h-4 inline text-amber-600 mr-2" /></span>}
                          <button onClick={() => setEditingId(t.id)} className="text-xs font-bold text-primary-container hover:underline cursor-pointer">
                            {locked ? 'View' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── HEALTH ── */}
      {view === 'health' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={card}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Health score</p>
              <p className={`text-3xl font-black mt-1 ${report.score >= 80 ? 'text-emerald-700' : report.score >= 50 ? 'text-amber-600' : 'text-error'}`}>{report.score}%</p>
            </div>
            {(['error', 'warning', 'info'] as const).map((s) => (
              <div key={s} className={card}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{s === 'error' ? 'Must fix' : s === 'warning' ? 'Should fix' : 'For your info'}</p>
                <p className="text-3xl font-black mt-1 text-primary-container">{report.counts[s]}</p>
              </div>
            ))}
          </div>
          <div className={`${card} flex flex-wrap gap-6 text-sm`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={settings.isVatRegistered} onChange={(e) => setSettings((s) => ({ ...s, isVatRegistered: e.target.checked }))} />
              I am registered for VAT
            </label>
            {accountMode === 'business' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.isTechLevySector} onChange={(e) => setSettings((s) => ({ ...s, isTechLevySector: e.target.checked }))} />
                Tech-levy sector (ICT, telecoms, banking…)
              </label>
            )}
            <span className="text-on-surface-variant">{year} turnover so far: <b>{formatKobo(report.turnoverKobo, 0)}</b></span>
          </div>
          {report.issues.length === 0 ? (
            <div className={`${card} flex items-center gap-3 text-emerald-700`}><ShieldCheck className="w-5 h-5" /> No issues for {monthLabel(period)}.</div>
          ) : (
            <ul className="space-y-2">
              {report.issues.map((i) => {
                const Icon = SEVERITY_ICON[i.severity];
                return (
                  <li key={i.id} className={`p-4 rounded-xl border flex items-start gap-3 ${SEVERITY_STYLE[i.severity]}`}>
                    <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-sm">{i.title}</p>
                      <p className="mt-0.5 opacity-90">{i.why}</p>
                      <p className="mt-0.5"><b>Fix:</b> {i.fix}</p>
                    </div>
                    {i.txId && (
                      <button onClick={() => setEditingId(i.txId!)} className="text-xs font-bold underline cursor-pointer flex-shrink-0">Fix now</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── RETURNS ── */}
      {view === 'returns' && (
        <div className="space-y-5">
          {/* VAT */}
          <div className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-primary-container">VAT return — {monthLabel(period)}</h3>
                <p className="text-xs text-on-surface-variant">Due {vat.dueDate}</p>
              </div>
              <div className="flex gap-2">
                <button className={btnSecondary} onClick={() => exportCsv('vatA')}><Download className="w-4 h-4" /> Schedule A</button>
                <button className={btnSecondary} onClick={() => exportCsv('vatC')}><Download className="w-4 h-4" /> Schedule C</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="Output VAT (sales)" value={formatKobo(vat.outputVatKobo)} />
              <Stat label="Input VAT claimable" value={formatKobo(vat.inputVatClaimableKobo)} />
              <Stat label="Input VAT excluded (no TIN)" value={formatKobo(vat.inputVatUnsupportedKobo)} tone={vat.inputVatUnsupportedKobo > 0 ? 'warn' : undefined} />
              <Stat label={vat.netVatKobo >= 0 ? 'Net VAT payable' : 'Credit carried forward'} value={formatKobo(Math.abs(vat.netVatKobo))} tone="strong" />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3">
              Schedule A: {vat.scheduleA.length} sale(s) · Schedule C: {vat.scheduleC.length} purchase(s) · Zero-rated sales {formatKobo(vat.zeroRatedSalesKobo)} · Exempt sales {formatKobo(vat.exemptSalesKobo)}
            </p>
          </div>

          {/* WHT */}
          <div className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-primary-container">WHT deduction schedule — {monthLabel(period)}</h3>
                <p className="text-xs text-on-surface-variant">Remit by {wht.dueDate}</p>
              </div>
              <button className={btnSecondary} onClick={() => exportCsv('wht')}><Download className="w-4 h-4" /> WHT schedule</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              <Stat label="Payments with WHT" value={String(wht.rows.length)} />
              <Stat label="Base amount (excl. VAT)" value={formatKobo(wht.totalBaseKobo)} />
              <Stat label="WHT to remit" value={formatKobo(wht.totalWhtKobo)} tone="strong" />
            </div>
          </div>

          {/* CIT */}
          <div className={card}>
            <h3 className="text-lg font-black text-primary-container">CIT summary — {year} so far</h3>
            <p className="text-xs text-on-surface-variant">All figures exclude VAT. Capital allowances on asset purchases are not yet deducted, so this is an upper-bound estimate.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Stat label="Turnover" value={formatKobo(cit.turnoverKobo, 0)} />
              <Stat label="Allowable expenses" value={formatKobo(cit.allowableExpensesKobo, 0)} />
              <Stat label="Asset purchases (capex)" value={formatKobo(cit.capexKobo, 0)} />
              <Stat label="Not allowable" value={formatKobo(cit.nonAllowableKobo, 0)} />
            </div>
            <div className="mt-3 p-3 rounded-xl bg-surface-container-low text-sm flex flex-wrap gap-x-6 gap-y-1">
              <span>Status: <b>{cit.isSmallCompany ? 'Small company (0% CIT)' : cit.estimate.companyClassification}</b></span>
              <span>Estimated tax: <b>₦{Math.round(cit.estimate.totalTaxPayable).toLocaleString()}</b></span>
            </div>
          </div>

          {/* Filing */}
          <div className={card}>
            <h3 className="text-lg font-black text-primary-container">File {monthLabel(period)}</h3>
            <ol className="text-xs text-on-surface-variant mt-2 space-y-1 list-decimal ml-4">
              <li>Clear the "Must fix" items on Compliance health ({report.counts.error} left).</li>
              <li>Download the review pack and schedules; check them (ideally with your adviser).</li>
              <li>File on the NRS portal, then record the acknowledgement number here to lock the month.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button className={btnSecondary} onClick={exportPdf}><FileText className="w-4 h-4" /> Review pack (PDF)</button>
              {status === 'OPEN' && (
                <button className={btnPrimary} disabled={report.counts.error > 0 || periodTxs.length === 0} onClick={() => changeStatus('REVIEWED')}>
                  <CheckCircle2 className="w-4 h-4" /> Mark as reviewed
                </button>
              )}
              {(status === 'REVIEWED' || status === 'AMENDING') && (
                <>
                  <input className={`${inputCls} max-w-[240px]`} placeholder="NRS acknowledgement / ref no." value={filingRefDraft} onChange={(e) => setFilingRefDraft(e.target.value)} />
                  <button className={btnPrimary} disabled={report.counts.error > 0} onClick={() => changeStatus('FILED')}><Lock className="w-4 h-4" /> Mark as filed &amp; lock</button>
                  {status === 'REVIEWED' && <button className={btnSecondary} onClick={() => changeStatus('OPEN')}>Reopen</button>}
                </>
              )}
              {status === 'FILED' && (
                <>
                  <span className="text-xs text-emerald-700 font-bold">Filed {periodDoc?.meta.filedAt?.slice(0, 10)} · Ref {periodDoc?.meta.filingRef}</span>
                  <button className={btnSecondary} onClick={() => changeStatus('AMENDING')}><Unlock className="w-4 h-4" /> Start amendment</button>
                </>
              )}
            </div>
            {periodDoc && periodDoc.audit.length > 0 && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer font-bold text-on-surface-variant">Audit trail ({periodDoc.audit.length})</summary>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto font-mono text-[11px] text-on-surface-variant">
                  {periodDoc.audit.map((a, idx) => <li key={idx}>{a.at.replace('T', ' ').slice(0, 16)} · {a.action} · {a.detail}</li>)}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      {editing && (
        <TransactionEditor
          tx={editing}
          locked={locked}
          issues={issuesByTx.get(editing.id) ?? []}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            const res = ledger.updateTransaction(editing.id, patch);
            if (!res.ok) showToast('error', 'Not saved', res.error);
            else { showToast('success', 'Saved', 'Similar transactions from this counterparty will be sorted the same way.'); setEditingId(null); }
          }}
          onConfirm={() => { ledger.confirmTransactions([editing.id]); setEditingId(null); }}
          onDelete={() => {
            const res = ledger.deleteTransaction(editing.id);
            if (!res.ok) showToast('error', 'Not deleted', res.error);
            else setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'strong' | 'warn' }) {
  return (
    <div className={`rounded-xl p-3 border ${tone === 'strong' ? 'bg-emerald-50 border-emerald-200' : tone === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-surface-container-low border-outline-variant'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={`text-lg font-black mt-0.5 ${tone === 'strong' ? 'text-emerald-800' : 'text-primary-container'}`}>{value}</p>
    </div>
  );
}

interface EditorProps {
  tx: LedgerTransaction;
  locked: boolean;
  issues: ComplianceIssue[];
  onClose: () => void;
  onSave: (patch: LedgerTransactionPatch) => void;
  onConfirm: () => void;
  onDelete: () => void;
}

function TransactionEditor({ tx, locked, issues, onClose, onSave, onConfirm, onDelete }: EditorProps) {
  const [form, setForm] = useState({
    citCategory: tx.citCategory,
    vatTreatment: tx.vatTreatment,
    whtCategoryId: tx.whtCategoryId ?? '',
    payeeType: tx.payeeType,
    counterpartyName: tx.counterpartyName ?? '',
    counterpartyTin: tx.counterpartyTin ?? '',
    invoiceRef: tx.invoiceRef ?? '',
    whtCreditNoteRef: tx.whtCreditNoteRef ?? '',
    proofRef: tx.documentProof?.fileName ?? '',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const tinCheck = form.counterpartyTin ? validateTin(form.counterpartyTin) : null;
  const review = needsReview(tx.classification.confidence, tx.classification.reviewedAt);

  const save = () => onSave({
    citCategory: form.citCategory,
    vatTreatment: form.vatTreatment,
    whtCategoryId: tx.direction === 'OUTFLOW' && form.whtCategoryId ? form.whtCategoryId : null,
    payeeType: form.payeeType,
    counterpartyName: form.counterpartyName.trim() || undefined,
    counterpartyTin: form.counterpartyTin,
    invoiceRef: form.invoiceRef.trim() || undefined,
    whtCreditNoteRef: form.whtCreditNoteRef.trim() || undefined,
    documentProof: form.proofRef.trim() ? { ...tx.documentProof, fileName: form.proofRef.trim() } : undefined,
  });

  const field = 'block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Edit transaction">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-on-surface-variant font-mono">{tx.date} · {tx.direction === 'INFLOW' ? 'Money in' : 'Money out'}</p>
            <h3 className="text-lg font-black text-primary-container break-words">{formatKobo(tx.amountKobo)}</h3>
            <p className="text-xs text-on-surface-variant break-words">{tx.narration}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              Sorted by: {tx.classification.source.toLowerCase().replace('_', ' ')}{tx.classification.ruleId ? ` (${tx.classification.ruleId})` : ''} · confidence {Math.round(tx.classification.confidence * 100)}%
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-surface-container cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {issues.length > 0 && (
          <ul className="space-y-1">
            {issues.map((i) => <li key={i.id} className={`text-xs p-2 rounded-lg border ${SEVERITY_STYLE[i.severity]}`}><b>{i.fix}</b></li>)}
          </ul>
        )}

        <fieldset disabled={locked} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2"><span className={field}>Category</span>
            <select className={inputCls} value={form.citCategory} onChange={(e) => set('citCategory', e.target.value as CitCategory)}>
              {Object.entries(CIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label><span className={field}>VAT treatment</span>
            <select className={inputCls} value={form.vatTreatment} onChange={(e) => set('vatTreatment', e.target.value as VatTreatment)}>
              {Object.entries(VAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label><span className={field}>{tx.direction === 'INFLOW' ? 'Customer' : 'Supplier / payee'}</span>
            <input className={inputCls} value={form.counterpartyName} onChange={(e) => set('counterpartyName', e.target.value)} />
          </label>
          <label><span className={field}>Their TIN</span>
            <input className={inputCls} value={form.counterpartyTin} placeholder="12345678-0001" onChange={(e) => set('counterpartyTin', e.target.value)} />
            {tinCheck && <span className={`text-[10px] ${tinCheck.valid ? 'text-emerald-700' : 'text-error'}`}>{tinCheck.valid ? 'Format OK (not verified with NRS)' : tinCheck.error}</span>}
          </label>
          <label><span className={field}>Invoice number</span>
            <input className={inputCls} value={form.invoiceRef} onChange={(e) => set('invoiceRef', e.target.value)} />
          </label>
          {tx.direction === 'OUTFLOW' && (
            <>
              <label><span className={field}>WHT type</span>
                <select className={inputCls} value={form.whtCategoryId} onChange={(e) => set('whtCategoryId', e.target.value)}>
                  <option value="">No WHT</option>
                  {WHT_RATE_SCHEDULE.map((r) => <option key={r.id} value={r.id}>{r.paymentType}</option>)}
                </select>
              </label>
              <label><span className={field}>Payee is a</span>
                <select className={inputCls} value={form.payeeType} onChange={(e) => set('payeeType', e.target.value as 'company' | 'individual')}>
                  <option value="company">Company</option>
                  <option value="individual">Individual</option>
                </select>
              </label>
              <label><span className={field}>WHT receipt / credit note ref</span>
                <input className={inputCls} value={form.whtCreditNoteRef} onChange={(e) => set('whtCreditNoteRef', e.target.value)} />
              </label>
              <label><span className={field}>Receipt / proof reference</span>
                <input className={inputCls} value={form.proofRef} placeholder="e.g. receipt no. or file name" onChange={(e) => set('proofRef', e.target.value)} />
              </label>
            </>
          )}
        </fieldset>

        {locked ? (
          <p className="text-xs text-on-surface-variant flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> This month is filed. Start an amendment on the Returns tab to edit.</p>
        ) : (
          <div className="flex flex-wrap gap-2 justify-between pt-2">
            <button onClick={onDelete} className="h-10 px-3 text-xs font-bold text-error hover:bg-error/10 rounded-xl cursor-pointer flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete</button>
            <div className="flex gap-2">
              {review && <button onClick={onConfirm} className={btnSecondary}>Looks right</button>}
              <button onClick={save} className={btnPrimary}>Save changes</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

