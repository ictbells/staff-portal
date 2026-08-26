import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatePicker, Input, Select, Tag, message } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { FileText, Search } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, Spinner, StatCard, TablePager, WorkspaceHero, fieldLabelClass, tdClass, thClass, trClass,
} from '../components/ui';
import { formatNaira } from '../lib/money';
import type { TranscriptChannel } from './transcripts/constants';
import { TRANSCRIPT_TYPES } from './transcripts/constants';

type StaffRow = {
  id: number;
  public_token: string;
  status: string;
  delivery_mode?: string | null;
  copies: number;
  purpose?: string | null;
  contact_email: string;
  transcript_type?: string | null;
  transcript_type_label?: string | null;
  delivery_email?: string | null;
  delivery_address?: string | null;
  collection_method?: string | null;
  rejected_reason?: string | null;
  paid_at?: string | null;
  ready_at?: string | null;
  created_at?: string | null;
  downloadable?: boolean;
  has_artifact?: boolean;
  invoice?: { number?: string; amount?: number; status?: string } | null;
  program?: { id?: number; name?: string; code?: string | null; department?: string | null } | null;
  student?: { id: number; name: string; matric_number?: string; programme?: string; status?: string } | null;
  transcript?: { cgpa?: number; total_credits?: number } | null;
  enabled_delivery_modes?: string[];
};

const STATUS_OPTIONS = [
  { value: undefined, label: 'All statuses' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MODE_LABELS: Record<string, string> = {
  collect: 'Collect at Registry',
  generated_pdf: 'System PDF',
  uploaded_pdf: 'Upload PDF',
};

const COLLECTION_OPTIONS = [
  { value: 'collect', label: 'Collect at Registry' },
  { value: 'post', label: 'Post to address' },
];

const DATE_FORMAT = 'DD/MM/YYYY';
const API_DATE = 'YYYY-MM-DD';

type DateRange = [Dayjs, Dayjs] | null;

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'ready') return 'success';
  if (status === 'paid' || status === 'processing') return 'info';
  if (status === 'awaiting_payment') return 'warning';
  if (status === 'rejected' || status === 'cancelled') return 'danger';
  return 'default';
}

export default function TranscriptRequests({ channel }: { channel: TranscriptChannel }) {
  const { has } = useAuth();
  const canView = has('transcripts.view');
  const canProcess = has('transcripts.process');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [transcriptType, setTranscriptType] = useState<string | undefined>();
  const [programId, setProgramId] = useState<number | undefined>();
  const [collectionMethod, setCollectionMethod] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [programs, setPrograms] = useState<{ id: number; name: string; code?: string | null }[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0, from: null as number | null, to: null as number | null });
  const [detail, setDetail] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<string>('collect');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const from = dateRange?.[0]?.format(API_DATE);
  const to = dateRange?.[1]?.format(API_DATE);

  const programOptions = useMemo(
    () => programs.map((program) => ({
      value: program.id,
      label: program.code ? `${program.name} (${program.code})` : program.name,
    })),
    [programs],
  );

  const load = useCallback(async (
    nextPage = page,
    nextSearch = search,
    nextStatus = status,
    nextType = transcriptType,
    nextProgramId = programId,
    nextCollection = collectionMethod,
    nextFrom = from,
    nextTo = to,
  ) => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/staff/transcript-requests', {
        params: {
          page: nextPage,
          search: nextSearch || undefined,
          status: nextStatus || undefined,
          transcript_type: nextType || undefined,
          program_id: nextProgramId || undefined,
          collection_method: nextCollection || undefined,
          from: nextFrom || undefined,
          to: nextTo || undefined,
          channel: channel.key,
        },
      });
      setRows(Array.isArray(data.data) ? data.data : []);
      setMeta({
        page: data.meta?.current_page || 1,
        lastPage: data.meta?.last_page || 1,
        total: data.meta?.total || 0,
        from: data.meta?.from ?? null,
        to: data.meta?.to ?? null,
      });
    } catch {
      message.error('Unable to load transcript requests.');
    } finally {
      setLoading(false);
    }
  }, [canView, channel.key, page, search, status, transcriptType, programId, collectionMethod, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    api.get('/api/programs', { params: { entry_modes: channel.entryModes.join(',') } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setPrograms(list);
      })
      .catch(() => setPrograms([]));
  }, [channel.entryModes]);

  const openDetail = async (id: number) => {
    try {
      const { data } = await api.get(`/api/staff/transcript-requests/${id}`);
      setDetail(data);
      const modes: string[] = data.enabled_delivery_modes || [];
      setDeliveryMode(modes[0] || 'collect');
      setUploadFile(null);
      setRejectReason('');
    } catch {
      message.error('Unable to load request.');
    }
  };

  const startProcessing = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/api/staff/transcript-requests/${detail.id}/start`);
      setDetail(data);
      message.success('Marked as processing.');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to start processing.');
    } finally {
      setBusy(false);
    }
  };

  const markReady = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('delivery_mode', deliveryMode);
      if (deliveryMode === 'uploaded_pdf' && uploadFile) {
        form.append('file', uploadFile);
      }
      const { data } = await api.post(`/api/staff/transcript-requests/${detail.id}/ready`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDetail(data);
      message.success('Request marked ready. Requester notified by email.');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to mark ready.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!detail || rejectReason.trim().length < 3) {
      message.error('Enter a rejection reason.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/api/staff/transcript-requests/${detail.id}/reject`, {
        reason: rejectReason.trim(),
      });
      setDetail(data);
      message.success('Request rejected. Requester notified.');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to reject.');
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AccessDeniedPanel reason="missing_permission" resourceLabel="Transcript requests" />;
  }

  const paidCount = rows.filter((r) => r.status === 'paid' || r.status === 'processing').length;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Transcript Requests"
        title={channel.title}
        description={channel.description}
        icon={FileText}
      >
        <RefreshButton onClick={() => load()} loading={loading} />
      </WorkspaceHero>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="In queue" value={String(meta.total)} hint="Matching current filters" icon={FileText} />
        <StatCard label="Needs action (this page)" value={String(paidCount)} hint="Paid or processing on this page" tone="amber" />
        <StatCard label="Selected" value={detail?.student?.matric_number || '—'} hint={detail?.status || 'Open a row'} tone="sky" />
      </div>

      <Card
        title="Request queue"
        description="Filter by status, type, programme, collection, and date. Search by matric, name, email, programme, or reference token."
      >
        <div className="mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block min-w-0 sm:col-span-2 xl:col-span-1">
              <span className={fieldLabelClass}>Search</span>
              <Input
                allowClear
                prefix={<Search className="h-4 w-4 text-slate-400" />}
                placeholder="Matric, name, email, token"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </label>
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Status</span>
              <Select
                allowClear
                placeholder="All statuses"
                className="w-full"
                value={status}
                onChange={(value) => { setStatus(value); setPage(1); }}
                options={STATUS_OPTIONS.filter((o) => o.value !== undefined) as { value: string; label: string }[]}
              />
            </label>
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Transcript type</span>
              <Select
                allowClear
                placeholder="All types"
                className="w-full"
                value={transcriptType}
                onChange={(value) => { setTranscriptType(value); setPage(1); }}
                options={TRANSCRIPT_TYPES.map((type) => ({ value: type.value, label: type.label }))}
              />
            </label>
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Programme</span>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="All programmes"
                className="w-full"
                value={programId}
                onChange={(value) => { setProgramId(value); setPage(1); }}
                options={programOptions}
              />
            </label>
            <label className="block min-w-0">
              <span className={fieldLabelClass}>Collection</span>
              <Select
                allowClear
                placeholder="All methods"
                className="w-full"
                value={collectionMethod}
                onChange={(value) => { setCollectionMethod(value); setPage(1); }}
                options={COLLECTION_OPTIONS}
              />
            </label>
            <label className="block min-w-0 sm:col-span-2">
              <span className={fieldLabelClass}>Created</span>
              <DatePicker.RangePicker
                allowClear
                className="w-full"
                format={DATE_FORMAT}
                placeholder={['From', 'To']}
                value={dateRange}
                disabledDate={(current) => !!current && current.isAfter(dayjs(), 'day')}
                presets={[
                  { label: 'Today', value: [dayjs().startOf('day'), dayjs()] },
                  { label: 'Last 7 days', value: [dayjs().subtract(6, 'day'), dayjs()] },
                  { label: 'Last 30 days', value: [dayjs().subtract(29, 'day'), dayjs()] },
                  { label: 'This month', value: [dayjs().startOf('month'), dayjs()] },
                ]}
                onChange={(next) => {
                  setDateRange(next && next[0] && next[1] ? [next[0], next[1]] : null);
                  setPage(1);
                }}
              />
            </label>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12 text-slate-500"><Spinner label="Loading…" /></div>
        ) : (
          <>
            <DataTable>
              <thead>
                <tr className={trClass}>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Fee</th>
                  <th className={thClass}>Copies</th>
                  <th className={thClass}>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`${trClass} cursor-pointer hover:bg-sky-50/60`}
                    onClick={() => openDetail(row.id)}
                  >
                    <td className={tdClass}>
                      <div className="font-medium text-slate-800">{row.student?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{row.student?.matric_number}</div>
                    </td>
                    <td className={tdClass}>{row.transcript_type_label || row.transcript_type || '—'}</td>
                    <td className={tdClass}><Badge variant={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</Badge></td>
                    <td className={tdClass}>{row.invoice?.amount != null ? formatNaira(row.invoice.amount) : '—'}</td>
                    <td className={tdClass}>{row.copies}</td>
                    <td className={tdClass}>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className={tdClass} colSpan={6}>No transcript requests match these filters.</td></tr>
                )}
              </tbody>
            </DataTable>
            <TablePager
              page={meta.page}
              lastPage={meta.lastPage}
              total={meta.total}
              from={meta.from}
              to={meta.to}
              onChange={(next) => setPage(next)}
            />
          </>
        )}
      </Card>

      {detail && (
        <Card
          title={detail.student?.name || 'Request detail'}
          description={`${detail.student?.matric_number || ''} · ${detail.contact_email}`}
          actions={<Btn type="button" onClick={() => setDetail(null)}>Close</Btn>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Status:</span> <Tag>{detail.status}</Tag></p>
              <p><span className="text-slate-500">Token:</span> <span className="font-mono text-xs">{detail.public_token}</span></p>
              <p><span className="text-slate-500">Programme:</span> {detail.program?.name || detail.student?.programme || '—'}</p>
              <p><span className="text-slate-500">Transcript type:</span> {detail.transcript_type_label || detail.transcript_type || '—'}</p>
              {detail.delivery_email && <p><span className="text-slate-500">Send e-copy to:</span> {detail.delivery_email}</p>}
              {detail.delivery_address && <p><span className="text-slate-500">Address:</span> {detail.delivery_address}</p>}
              {detail.collection_method === 'collect' && <p><span className="text-slate-500">Collection:</span> Physical collection at Registry</p>}
              {detail.collection_method === 'post' && !detail.delivery_address && <p><span className="text-slate-500">Collection:</span> Post</p>}
              <p><span className="text-slate-500">Purpose:</span> {detail.purpose || '—'}</p>
              <p><span className="text-slate-500">CGPA:</span> {detail.transcript?.cgpa ?? '—'}</p>
              <p><span className="text-slate-500">Invoice:</span> {detail.invoice?.number || '—'} ({detail.invoice?.status || '—'})</p>
              {detail.rejected_reason && <p className="text-red-700">Rejected: {detail.rejected_reason}</p>}
            </div>
            {canProcess && (detail.status === 'paid' || detail.status === 'processing') && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                {detail.status === 'paid' && (
                  <Btn type="button" disabled={busy} onClick={startProcessing} className="bg-sky-600 text-white hover:bg-sky-700">
                    Start processing
                  </Btn>
                )}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Delivery mode</label>
                  <Select
                    className="mt-1 w-full"
                    value={deliveryMode}
                    onChange={setDeliveryMode}
                    options={(detail.enabled_delivery_modes || []).map((mode) => ({
                      value: mode,
                      label: MODE_LABELS[mode] || mode,
                    }))}
                  />
                </div>
                {deliveryMode === 'uploaded_pdf' && (
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                )}
                <Btn type="button" disabled={busy} onClick={markReady} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Mark ready & email
                </Btn>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Reject reason</label>
                  <Input.TextArea
                    className="mt-1"
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <Btn type="button" disabled={busy} onClick={reject} className="mt-2 border border-red-200 text-red-700">
                    Reject & email
                  </Btn>
                </div>
              </div>
            )}
            {detail.downloadable && (
              <Btn
                type="button"
                onClick={async () => {
                  try {
                    const res = await api.get(`/api/staff/transcript-requests/${detail.id}/download`, {
                      responseType: 'blob',
                    });
                    const url = URL.createObjectURL(res.data);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `official-transcript-${detail.student?.matric_number || detail.id}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    message.error('Download failed.');
                  }
                }}
              >
                Download artifact
              </Btn>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
