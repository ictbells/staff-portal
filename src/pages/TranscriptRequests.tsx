import { useCallback, useEffect, useState } from 'react';
import { Input, Select, Tag, message } from 'antd';
import { FileText, Search } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, Spinner, StatCard, TablePager, WorkspaceHero, tdClass, thClass, trClass,
} from '../components/ui';
import { formatNaira } from '../lib/money';

type StaffRow = {
  id: number;
  public_token: string;
  status: string;
  delivery_mode?: string | null;
  copies: number;
  purpose?: string | null;
  contact_email: string;
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

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'ready') return 'success';
  if (status === 'paid' || status === 'processing') return 'info';
  if (status === 'awaiting_payment') return 'warning';
  if (status === 'rejected' || status === 'cancelled') return 'danger';
  return 'default';
}

export default function TranscriptRequests() {
  const { has } = useAuth();
  const canView = has('transcripts.view');
  const canProcess = has('transcripts.process');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0, from: null as number | null, to: null as number | null });
  const [detail, setDetail] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<string>('collect');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async (nextPage = page, nextSearch = search, nextStatus = status) => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/staff/transcript-requests', {
        params: {
          page: nextPage,
          search: nextSearch || undefined,
          status: nextStatus || undefined,
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
  }, [canView, page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

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
        eyebrow="Services"
        title="Transcript requests"
        description="Paid official transcript requests from the public student-portal form. Notify requesters by email when ready."
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
        description="Search by matric, name, email, or reference token."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Input
              allowClear
              prefix={<Search className="h-4 w-4 text-slate-400" />}
              placeholder="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={() => { setSearch(searchInput.trim()); setPage(1); }}
              className="w-56"
            />
            <Select
              allowClear
              placeholder="Status"
              className="w-44"
              value={status}
              onChange={(value) => { setStatus(value); setPage(1); }}
              options={STATUS_OPTIONS.filter((o) => o.value !== undefined) as any}
            />
            <Btn type="button" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>
              Filter
            </Btn>
          </div>
        )}
      >
        {loading ? (
          <div className="flex justify-center py-12 text-slate-500"><Spinner label="Loading…" /></div>
        ) : (
          <>
            <DataTable>
              <thead>
                <tr className={trClass}>
                  <th className={thClass}>Student</th>
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
                    <td className={tdClass}><Badge variant={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</Badge></td>
                    <td className={tdClass}>{row.invoice?.amount != null ? formatNaira(row.invoice.amount) : '—'}</td>
                    <td className={tdClass}>{row.copies}</td>
                    <td className={tdClass}>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className={tdClass} colSpan={5}>No transcript requests match these filters.</td></tr>
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
