import { useCallback, useEffect, useState } from 'react';
import { DatePicker, Input, Select, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { Search } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, Spinner, TablePager, WorkspaceHero, fieldLabelClass, tdClass, thClass, trClass,
} from '../components/ui';
import { formatNaira } from '../lib/money';

type StaffRow = {
  id: number;
  public_token: string;
  status: string;
  delivery_mode?: string | null;
  purpose?: string | null;
  contact_email: string;
  rejected_reason?: string | null;
  paid_at?: string | null;
  ready_at?: string | null;
  created_at?: string | null;
  downloadable?: boolean;
  has_artifact?: boolean;
  invoice?: { number?: string; amount?: number; status?: string; category?: string } | null;
  offer?: { id: number; name: string; slug?: string; fee?: { amount?: number } | null } | null;
  student?: { id: number; name: string; matric_number?: string; programme?: string; status?: string } | null;
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

export default function PublicPayRequests() {
  const { has } = useAuth();
  const canView = has('public_pay.view');
  const canProcess = has('public_pay.process');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>('paid');
  const [offerId, setOfferId] = useState<number | undefined>();
  const [offers, setOffers] = useState<{ id: number; name: string }[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0, from: null as number | null, to: null as number | null });
  const [detail, setDetail] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<string>('collect');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const from = dateRange?.[0]?.format(API_DATE);
  const to = dateRange?.[1]?.format(API_DATE);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/staff/public-pay/requests', {
        params: {
          page,
          per_page: 25,
          search: search || undefined,
          status: status || undefined,
          offer_id: offerId || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setRows(data.data || []);
      setMeta({
        page: data.meta?.current_page || 1,
        lastPage: data.meta?.last_page || 1,
        total: data.meta?.total || 0,
        from: data.meta?.from ?? null,
        to: data.meta?.to ?? null,
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not load requests');
    } finally {
      setLoading(false);
    }
  }, [canView, page, search, status, offerId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canView) return;
    api.get('/api/staff/public-pay/offers').then(({ data }) => {
      setOffers((data.data || []).map((o: any) => ({ id: o.id, name: o.name })));
    }).catch(() => undefined);
  }, [canView]);

  async function openDetail(id: number) {
    try {
      const { data } = await api.get(`/api/staff/public-pay/requests/${id}`);
      setDetail(data);
      setDeliveryMode('collect');
      setUploadFile(null);
      setRejectReason('');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not load request');
    }
  }

  async function start() {
    if (!detail) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/api/staff/public-pay/requests/${detail.id}/start`);
      setDetail(data);
      message.success('Moved to processing');
      void load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not start');
    } finally {
      setBusy(false);
    }
  }

  async function markReady() {
    if (!detail) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('delivery_mode', deliveryMode);
      if (deliveryMode === 'uploaded' && uploadFile) form.append('file', uploadFile);
      const { data } = await api.post(`/api/staff/public-pay/requests/${detail.id}/ready`, form);
      setDetail(data);
      message.success('Marked ready');
      void load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not mark ready');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!detail || rejectReason.trim().length < 3) {
      message.error('Enter a rejection reason');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/api/staff/public-pay/requests/${detail.id}/reject`, {
        reason: rejectReason.trim(),
      });
      setDetail(data);
      message.success('Request rejected');
      void load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not reject');
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return <AccessDeniedPanel reason="missing_permission" resourceLabel="Public requests" />;
  }

  return (
    <div className="space-y-4">
      <WorkspaceHero
        title="Public requests"
        description="Inbox for services requested and paid outside the student portal login."
      >
        <RefreshButton onClick={() => void load()} loading={loading} />
      </WorkspaceHero>

      <Card title="Filters" description="Search and narrow the request inbox.">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[200px] flex-1">
            <label className={fieldLabelClass}>Search</label>
            <Input
              prefix={<Search className="h-4 w-4 text-slate-400" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={() => { setPage(1); setSearch(searchInput.trim()); }}
              placeholder="Matric, name, token, offer…"
              allowClear
            />
          </div>
          <div className="w-44">
            <label className={fieldLabelClass}>Status</label>
            <Select
              className="w-full"
              value={status}
              onChange={(v) => { setPage(1); setStatus(v); }}
              options={STATUS_OPTIONS}
              allowClear
              placeholder="All statuses"
            />
          </div>
          <div className="w-52">
            <label className={fieldLabelClass}>Offer</label>
            <Select
              className="w-full"
              value={offerId}
              onChange={(v) => { setPage(1); setOfferId(v); }}
              options={[{ value: undefined, label: 'All offers' }, ...offers.map((o) => ({ value: o.id, label: o.name }))]}
              allowClear
              placeholder="All offers"
            />
          </div>
          <div>
            <label className={fieldLabelClass}>Dates</label>
            <DatePicker.RangePicker
              format={DATE_FORMAT}
              value={dateRange}
              onChange={(v) => { setPage(1); setDateRange(v as DateRange); }}
            />
          </div>
          <Btn type="button" onClick={() => { setPage(1); setSearch(searchInput.trim()); }}>Apply</Btn>
        </div>
      </Card>

      <Card title="Request queue" description="Paid and in-progress public requests for staff fulfilment.">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <>
            <DataTable>
              <thead>
                <tr className={trClass}>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Service</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Paid</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>
                      <div className="font-medium text-slate-900">{row.student?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{row.student?.matric_number}</div>
                      <div className="text-xs text-slate-500">{row.contact_email}</div>
                    </td>
                    <td className={tdClass}>{row.offer?.name || '—'}</td>
                    <td className={tdClass}>{row.invoice?.amount != null ? formatNaira(row.invoice.amount) : '—'}</td>
                    <td className={tdClass}><Badge variant={statusTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge></td>
                    <td className={tdClass}>{row.paid_at ? new Date(row.paid_at).toLocaleString() : '—'}</td>
                    <td className={tdClass}>
                      <Btn type="button" size="sm" onClick={() => void openDetail(row.id)}>Open</Btn>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr className={trClass}><td className={tdClass} colSpan={6}>No requests found.</td></tr>
                ) : null}
              </tbody>
            </DataTable>
            <TablePager
              page={meta.page}
              lastPage={meta.lastPage}
              total={meta.total}
              from={meta.from}
              to={meta.to}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{detail.offer?.name || 'Request'}</h2>
                <p className="text-sm text-slate-500">{detail.student?.name} · {detail.student?.matric_number}</p>
              </div>
              <Btn type="button" size="sm" onClick={() => setDetail(null)}>Close</Btn>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-slate-500">Status:</span> {detail.status.replace(/_/g, ' ')}</p>
              <p><span className="text-slate-500">Email:</span> {detail.contact_email}</p>
              <p><span className="text-slate-500">Invoice:</span> {detail.invoice?.number || '—'} ({detail.invoice?.amount != null ? formatNaira(detail.invoice.amount) : '—'})</p>
              <p><span className="text-slate-500">Token:</span> <span className="font-mono text-xs">{detail.public_token}</span></p>
              {detail.purpose ? <p><span className="text-slate-500">Purpose:</span> {detail.purpose}</p> : null}
              {detail.rejected_reason ? <p><span className="text-slate-500">Rejected:</span> {detail.rejected_reason}</p> : null}
            </div>

            {canProcess && (detail.status === 'paid' || detail.status === 'processing') ? (
              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                {detail.status === 'paid' ? (
                  <Btn type="button" disabled={busy} onClick={() => void start()}>Start processing</Btn>
                ) : null}
                <div>
                  <label className={fieldLabelClass}>Fulfilment</label>
                  <Select
                    className="w-full"
                    value={deliveryMode}
                    onChange={setDeliveryMode}
                    options={[
                      { value: 'collect', label: 'Collect at office' },
                      { value: 'uploaded', label: 'Upload file for download' },
                    ]}
                  />
                </div>
                {deliveryMode === 'uploaded' ? (
                  <input type="file" accept=".pdf,image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                ) : null}
                <Btn type="button" disabled={busy} onClick={() => void markReady()}>Mark ready</Btn>
                <div>
                  <label className={fieldLabelClass}>Reject reason</label>
                  <Input.TextArea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
                  <Btn type="button" className="mt-2" disabled={busy} onClick={() => void reject()}>Reject</Btn>
                </div>
              </div>
            ) : null}

            {detail.downloadable ? (
              <Btn
                type="button"
                className="mt-4"
                onClick={async () => {
                  const res = await api.get(`/api/staff/public-pay/requests/${detail.id}/download`, { responseType: 'blob' });
                  const url = URL.createObjectURL(res.data);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `public-pay-${detail.id}.bin`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download artifact
              </Btn>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
