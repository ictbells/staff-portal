import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DatePicker, Dropdown, Select, message } from 'antd';
import type { MenuProps } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { BarChart3, Download, FileSpreadsheet, FileText, GraduationCap, History, Search } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { AuditDetailModal, type AuditRow } from '../components/AuditDetailModal';
import { RefreshButton } from '../components/RefreshButton';
import { auditChanges, formatAuditPreview } from '../lib/auditDiff';
import {
  Badge, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, TablePager, WorkspaceHero, tdClass, thClass, trClass,
} from '../components/ui';

type PageMeta = {
  page: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
};

type Facets = {
  modules: string[];
  actions: string[];
};

type DateRange = [Dayjs, Dayjs] | null;

const emptyMeta: PageMeta = { page: 1, lastPage: 1, total: 0, from: null, to: null };
const PAGE_SIZE = 25;
const DATE_FORMAT = 'DD/MM/YYYY';
const API_DATE = 'YYYY-MM-DD';

function todayRange(): [Dayjs, Dayjs] {
  const today = dayjs();
  return [today.startOf('day'), today.endOf('day')];
}

function isTodayRange(range: DateRange) {
  if (!range?.[0] || !range[1]) return false;
  const today = dayjs();
  return range[0].isSame(today, 'day') && range[1].isSame(today, 'day');
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = dayjs(value);
  return date.isValid() ? date.format('DD MMM YYYY, HH:mm:ss') : String(value);
}

function actorLabel(row: AuditRow) {
  return row.actor_email || row.actor_name || '—';
}

export default function Audit() {
  const { has } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [summary, setSummary] = useState({ actors: 0, modules: 0 });
  const [facets, setFacets] = useState<Facets>({ modules: [], actions: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>(todayRange);
  const reqId = useRef(0);

  const fromDate = dateRange?.[0]?.format(API_DATE) || '';
  const toDate = dateRange?.[1]?.format(API_DATE) || '';

  const filterParams = useMemo(() => ({
    ...(search ? { search } : {}),
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(fromDate ? { from: fromDate } : {}),
    ...(toDate ? { to: toDate } : {}),
  }), [actionFilter, fromDate, moduleFilter, search, toDate]);

  const hasFilters = Boolean(searchInput || search || moduleFilter || actionFilter || !isTodayRange(dateRange));

  const load = (nextPage = page) => {
    const req = ++reqId.current;
    setLoading(true);
    api.get('/api/audit-logs', {
      params: { page: nextPage, per_page: PAGE_SIZE, ...filterParams },
    })
      .then((res) => {
        if (req !== reqId.current) return;
        const body = res.data || {};
        const list: AuditRow[] = Array.isArray(body.data) ? body.data : [];
        const current = Number(body.current_page || nextPage);
        if (list.length === 0 && current > 1) {
          setPage(current - 1);
          return;
        }
        setRows(list);
        setMeta({
          page: current,
          lastPage: Math.max(1, Number(body.last_page || 1)),
          total: Number(body.total || 0),
          from: body.from ?? (list.length ? 1 : null),
          to: body.to ?? (list.length || null),
        });
        setSummary({
          actors: Number(body.summary?.actors || 0),
          modules: Number(body.summary?.modules || 0),
        });
        setFacets({
          modules: Array.isArray(body.facets?.modules) ? body.facets.modules : [],
          actions: Array.isArray(body.facets?.actions) ? body.facets.actions : [],
        });
      })
      .catch(() => {
        if (req !== reqId.current) return;
        setRows([]);
        setMeta(emptyMeta);
        setSummary({ actors: 0, modules: 0 });
      })
      .finally(() => {
        if (req === reqId.current) setLoading(false);
      });
  };

  useEffect(() => {
    load(page);
  }, [page, filterParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  const changeModule = (next?: string) => {
    setModuleFilter(next);
    setPage(1);
  };

  const changeAction = (next?: string) => {
    setActionFilter(next);
    setPage(1);
  };

  const changeDateRange = (next: DateRange) => {
    setDateRange(next);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setModuleFilter(undefined);
    setActionFilter(undefined);
    setDateRange(todayRange());
    setPage(1);
  };

  const download = async (format: 'pdf' | 'excel' | 'word') => {
    if (!has('audit.view')) {
      message.error('You do not have permission to download the audit trail.');
      return;
    }
    setExporting(true);
    try {
      const { data } = await api.get('/api/audit-logs/export', {
        params: { ...filterParams, format, title: 'Audit trail' },
        responseType: 'blob',
      });
      const mime = format === 'pdf'
        ? 'application/pdf'
        : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx';
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
      if (blob.type.includes('application/json')) {
        const parsed = JSON.parse(await blob.text());
        message.error(parsed.message || 'Unable to download the audit trail.');
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `audit-trail-${stamp}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Download started (${format === 'word' ? 'Word' : format.toUpperCase()}).`);
    } catch (err: any) {
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try {
          message.error(JSON.parse(await blob.text()).message || 'Unable to download the audit trail.');
        } catch {
          message.error('Unable to download the audit trail.');
        }
      } else {
        message.error(err.response?.data?.message || 'Unable to download the audit trail.');
      }
    } finally {
      setExporting(false);
    }
  };

  const downloadMenu: MenuProps['items'] = [
    { key: 'pdf', icon: <FileText size={14} />, label: 'PDF', onClick: () => download('pdf') },
    { key: 'excel', icon: <FileSpreadsheet size={14} />, label: 'Excel (.xlsx)', onClick: () => download('excel') },
    { key: 'word', icon: <FileText size={14} />, label: 'MS Word (.docx)', onClick: () => download('word') },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="System"
        title="Audit trail"
        description="Immutable log of system actions. Search, filter, and download the matching entries. Read-only — no edit or delete."
        icon={History}
      >
        <RefreshButton onClick={() => load()} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard
          label="Entries"
          value={meta.total}
          hint={hasFilters ? 'Matching current filters' : 'Today'}
          icon={History}
        />
        <StatCard
          label="Actors"
          value={summary.actors}
          hint="Distinct accounts in this view"
          icon={GraduationCap}
        />
        <StatCard
          label="Modules"
          value={summary.modules}
          hint="Areas that recorded activity"
          icon={BarChart3}
          tone="amber"
        />
      </div>
      <Card
        title="Audit log"
        description="Newest events first. Downloads use the same search and filters as this list (up to 5,000 rows)."
        actions={(
          <Dropdown menu={{ items: downloadMenu }} trigger={['click']} disabled={exporting || loading || !meta.total}>
            <Button type="primary" icon={<Download size={14} />} loading={exporting}>
              Download
            </Button>
          </Dropdown>
        )}
      >
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-5">
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Search</span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="Actor, action, summary…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </label>
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Module</span>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                className="w-full"
                placeholder="All modules"
                value={moduleFilter}
                onChange={changeModule}
                options={facets.modules.map((value) => ({ value, label: value }))}
              />
            </label>
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Action</span>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                className="w-full"
                placeholder="All actions"
                value={actionFilter}
                onChange={changeAction}
                options={facets.actions.map((value) => ({ value, label: value }))}
              />
            </label>
            <label className="block min-w-0 lg:col-span-2">
              <span className={fieldLabelClass}>From – To</span>
              <DatePicker.RangePicker
                allowClear
                className="w-full"
                format={DATE_FORMAT}
                placeholder={['From', 'To']}
                value={dateRange}
                disabledDate={(current) => !!current && current.isAfter(dayjs(), 'day')}
                presets={[
                  { label: 'Today', value: todayRange },
                  { label: 'Last 7 days', value: [dayjs().subtract(6, 'day'), dayjs()] },
                  { label: 'Last 30 days', value: [dayjs().subtract(29, 'day'), dayjs()] },
                  { label: 'This month', value: [dayjs().startOf('month'), dayjs()] },
                ]}
                onChange={(next) => changeDateRange(next && next[0] && next[1] ? [next[0], next[1]] : null)}
              />
            </label>
          </div>
          {hasFilters ? (
            <Button className="shrink-0" onClick={clearFilters}>Clear filters</Button>
          ) : null}
        </div>
        <DataTable
          empty={!rows.length}
          emptyMessage={hasFilters ? 'No audit entries match this filter.' : 'No audit entries for today.'}
          colSpan={6}
          loading={loading}
          loadingLabel="Loading audit trail…"
        >
          <thead>
            <tr>
              <th className={thClass}>When</th>
              <th className={thClass}>Who</th>
              <th className={thClass}>Action</th>
              <th className={thClass}>Entity</th>
              <th className={thClass}>Changes</th>
              <th className={thClass}>Request</th>
            </tr>
          </thead>
          {!rows.length ? null : (
            <tbody>
              {rows.map((a) => {
                const changes = auditChanges(a.before_state, a.after_state);
                const hasStates = a.before_state != null || a.after_state != null;
                return (
                  <tr key={a.id} className={`${trClass} align-top`}>
                    <td className={`${tdClass} text-xs whitespace-nowrap`}>{formatWhen(a.occurred_at)}</td>
                    <td className={`${tdClass} text-xs`}>
                      <div>{actorLabel(a)}</div>
                      {a.actor_name && a.actor_email ? (
                        <div className="text-slate-500">{a.actor_name}</div>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      <Badge variant="info">{a.action}</Badge>
                      {a.summary && <div className="text-xs text-slate-500 mt-1">{a.summary}</div>}
                      {a.reason && <div className="text-xs text-amber-700 mt-1">Reason: {a.reason}</div>}
                    </td>
                    <td className={`${tdClass} text-xs`}>
                      <span className="font-medium">{a.module || '—'}</span>
                      <div className="text-slate-500">
                        {a.entity_type ? `${a.entity_type}${a.entity_id != null ? `:${a.entity_id}` : ''}` : '—'}
                      </div>
                    </td>
                    <td className={`${tdClass} text-xs`}>
                      {!hasStates ? (
                        <span className="text-slate-400">—</span>
                      ) : changes.length ? (
                        <div className="space-y-2">
                          <Badge variant="warning">{changes.length} field{changes.length === 1 ? '' : 's'}</Badge>
                          <ul className="space-y-1 text-slate-600">
                            {changes.slice(0, 2).map((c) => (
                              <li key={c.field}>
                                <span className="font-mono text-[11px] text-slate-500">{c.field}</span>
                                <div>
                                  <span className="text-rose-700">{formatAuditPreview(c.before)}</span>
                                  {' → '}
                                  <span className="text-emerald-700">{formatAuditPreview(c.after)}</span>
                                </div>
                              </li>
                            ))}
                            {changes.length > 2 && (
                              <li className="text-slate-400">+{changes.length - 2} more</li>
                            )}
                          </ul>
                          <Button size="small" type="link" className="!px-0" onClick={() => setDetail(a)}>
                            View all
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-slate-500">No diff</span>
                          <Button size="small" type="link" className="!px-0" onClick={() => setDetail(a)}>
                            View snapshot
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className={`${tdClass} text-xs`}>
                      <code className="bg-slate-100 px-1 rounded">{a.request_id || '—'}</code>
                      <div className="text-slate-500 mt-1">{[a.ip, a.device].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </DataTable>
        <TablePager
          page={meta.page}
          lastPage={meta.lastPage}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          disabled={loading}
          onChange={setPage}
        />
      </Card>
      <AuditDetailModal entry={detail} open={detail != null} onClose={() => setDetail(null)} />
    </div>
  );
}
