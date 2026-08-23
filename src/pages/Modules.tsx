import { useEffect, useState } from 'react';
import { Button, Select } from 'antd';
import { ExternalLink } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { AuditDetailModal, type AuditRow } from '../components/AuditDetailModal';
import { RefreshButton } from '../components/RefreshButton';
import { auditChanges, formatAuditPreview } from '../lib/auditDiff';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  PageHeader, stageBadge, tdClass, thClass, trClass,
} from '../components/ui';

const API_DOCS_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/docs`;

export function Students() {
  const [rows, setRows] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/students').then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const list = rows?.data || (rows?.id ? [rows] : rows) || [];
  const items = Array.isArray(list) ? list : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Students" description="Browse enrolled students and their programme assignments.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!items.length} emptyMessage="No student records found." colSpan={3}>
        <thead>
          <tr>
            <th className={thClass}>Name</th>
            <th className={thClass}>Matric no.</th>
            <th className={thClass}>Programme</th>
          </tr>
        </thead>
        {!items.length ? null : (
          <tbody>
            {items.map((s: any) => (
              <tr key={s.id} className={trClass}>
                <td className={tdClass}>
                  <div className="font-medium text-slate-800">{s.first_name} {s.last_name}</div>
                </td>
                <td className={tdClass}>
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{s.matric_number || '—'}</code>
                </td>
                <td className={tdClass}>{s.program?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}

export function Profile() {
  const { auth } = useAuth();
  const s = auth?.user?.student;
  if (!s) return <p className="text-slate-500">No student record yet. Complete acceptance fee first.</p>;
  const fields = ['first_name', 'last_name', 'date_of_birth', 'gender', 'nin', 'matric_number'];
  return (
    <Card title="My student record" description="NIN identity fields are locked.">
      <DataTable colSpan={2}>
        <thead>
          <tr>
            <th className={thClass}>Field</th>
            <th className={thClass}>Value</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f} className={trClass}>
              <td className={`${tdClass} capitalize text-slate-500`}>{f.replace(/_/g, ' ')}</td>
              <td className={`${tdClass} font-medium`}>{s[f] || '—'}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Card>
  );
}

export function WalletPage() {
  const [w, setW] = useState<any>(null);
  const [amount, setAmount] = useState('5000');
  const load = () => api.get('/api/wallet').then((r) => setW(r.data)).catch(() => setW(null));
  useEffect(() => { load(); }, []);
  const fund = async () => {
    const { data } = await api.post('/api/wallet/topup', { amount: Number(amount) });
    if (data.demo) {
      await api.get(`/api/payments/paystack/verify/${data.reference}`);
      load();
    } else if (data.authorization_url) window.location.href = data.authorization_url;
  };
  if (!w) return <p className="text-slate-500">Wallet opens after student creation.</p>;
  return (
    <div className="space-y-5">
      <PageHeader title="Campus wallet" />
      <div className="text-3xl font-semibold text-sky-600">₦{w.balance}</div>
      <div className="flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-[160px]`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Btn onClick={fund}>Fund with Paystack</Btn>
      </div>
      <Card title="Credentials">
        <DataTable empty={!w.credentials?.length} emptyMessage="No credentials issued." colSpan={1}>
          <thead><tr><th className={thClass}>Title</th></tr></thead>
          {!w.credentials?.length ? null : (
            <tbody>{w.credentials.map((c: any) => <tr key={c.id} className={trClass}><td className={tdClass}>{c.title}</td></tr>)}</tbody>
          )}
        </DataTable>
      </Card>
      <Card title="Ledger">
        <DataTable empty={!w.transactions?.length} emptyMessage="No transactions yet." colSpan={3}>
          <thead>
            <tr>
              <th className={thClass}>Type</th>
              <th className={thClass}>Amount</th>
              <th className={thClass}>Description</th>
            </tr>
          </thead>
          {!w.transactions?.length ? null : (
            <tbody>
              {w.transactions.map((t: any) => (
                <tr key={t.id} className={trClass}>
                  <td className={tdClass}><Badge>{t.type}</Badge></td>
                  <td className={`${tdClass} font-medium`}>₦{t.amount}</td>
                  <td className={tdClass}>{t.description}</td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>
    </div>
  );
}

export function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/invoices').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const payWallet = async (id: number) => { await api.post(`/api/wallet/pay/${id}`); load(); };
  const paystack = async (id: number) => {
    const { data } = await api.post('/api/payments/paystack/initialize', { invoice_id: id });
    if (data.demo) { await api.get(`/api/payments/paystack/verify/${data.reference}`); load(); }
    else if (data.authorization_url) window.location.href = data.authorization_url;
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" description="View and pay outstanding invoices.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!rows.length} emptyMessage="No invoices found." colSpan={5}>
        <thead>
          <tr>
            <th className={thClass}>Number</th>
            <th className={thClass}>Category</th>
            <th className={thClass}>Balance</th>
            <th className={thClass}>Status</th>
            <th className={`${thClass} text-right`}>Actions</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={trClass}>
                <td className={`${tdClass} font-medium`}>{i.number}</td>
                <td className={tdClass}>{i.category}</td>
                <td className={tdClass}>₦{i.balance}</td>
                <td className={tdClass}><Badge variant={stageBadge(i.status)}>{i.status}</Badge></td>
                <td className={`${tdClass} text-right`}>
                  {i.status !== 'paid' && (
                    <div className="inline-flex gap-1">
                      {i.wallet_allowed && <Btn variant="ghost" size="sm" onClick={() => payWallet(i.id)}>Wallet</Btn>}
                      <Btn variant="secondary" size="sm" onClick={() => paystack(i.id)}>Paystack</Btn>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}

export function Finance() {
  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/fees'),
      api.get('/api/payments'),
    ])
      .then(([feesRes, paymentsRes]) => {
        setFees(feesRes.data);
        setPayments(paymentsRes.data.data || paymentsRes.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const record = async () => {
    await api.post('/api/payments/record', { invoice_id: Number(invoiceId), method: 'cash', amount: Number(amount) });
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Fees & payments" description="Manage fee schedules and record cashier payments.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>

      <Card title="Fee schedule">
        <DataTable empty={!fees.length} emptyMessage="No fees configured." colSpan={3}>
          <thead>
            <tr>
              <th className={thClass}>Fee</th>
              <th className={thClass}>Amount</th>
              <th className={thClass}>Wallet</th>
            </tr>
          </thead>
          {!fees.length ? null : (
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>{f.name}</td>
                  <td className={tdClass}>₦{f.amount}</td>
                  <td className={tdClass}>
                    <Badge variant={f.wallet_allowed ? 'success' : 'default'}>
                      {f.wallet_allowed ? 'Allowed' : 'Not allowed'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>

      <Card title="Record cash payment">
        <div className="flex flex-wrap gap-2">
          <input className={`${inputClass} max-w-[140px]`} placeholder="Invoice ID" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
          <input className={`${inputClass} max-w-[140px]`} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Btn onClick={record}>Record cash</Btn>
        </div>
      </Card>

      <Card title="Recent payments">
        <DataTable empty={!payments.length} emptyMessage="No payments recorded." colSpan={3}>
          <thead>
            <tr>
              <th className={thClass}>Method</th>
              <th className={thClass}>Amount</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          {!payments.length ? null : (
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className={trClass}>
                  <td className={tdClass}><Badge variant="info">{p.method}</Badge></td>
                  <td className={`${tdClass} font-medium`}>₦{p.amount}</td>
                  <td className={tdClass}><Badge variant={stageBadge(p.status)}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>
    </div>
  );
}

export function Medical() {
  const { has } = useAuth();
  const canView = has('medical.view_any') || has('medical.manage');
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<number | undefined>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView) return;
    api.get('/api/students', { params: { page: 1 } })
      .then((r) => setStudents(r.data.data ?? r.data ?? []))
      .catch(() => {});
  }, [canView]);

  const load = () => {
    if (!studentId) {
      setData(null);
      return;
    }
    setLoading(true);
    api.get(`/api/medical/${studentId}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [studentId]);

  if (!canView) {
    return (
      <div className="space-y-5">
        <PageHeader title="Medical" description="Student health records and clinic visits." />
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          You need <code className="text-xs">medical.view_any</code> or{' '}
          <code className="text-xs">medical.manage</code> to view student medical records.
        </p>
      </div>
    );
  }

  const profile = data?.profile;
  const immunizations = data?.immunizations || [];
  const visits = data?.visits || [];
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.first_name} ${s.last_name}${s.matric_number ? ` (${s.matric_number})` : ''}`,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Medical" description="Look up student health records and clinic visits.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
        <label className={fieldLabelClass}>
          Student
          <Select
            showSearch
            allowClear
            placeholder="Select student"
            className="w-full mt-1.5 max-w-md"
            value={studentId}
            onChange={setStudentId}
            options={studentOptions}
            optionFilterProp="label"
          />
        </label>
      </div>

      {!studentId && (
        <p className="text-sm text-slate-500">Select a student to view their medical file.</p>
      )}

      {studentId && profile && (
        <Card title="Medical profile">
          <DataTable colSpan={2}>
            <tbody>
              {[
                ['Blood type', profile.blood_type],
                ['Allergies', profile.allergies],
                ['Conditions', profile.conditions],
              ].map(([label, value]) => (
                <tr key={label} className={trClass}>
                  <td className={`${tdClass} text-slate-500 w-40`}>{label}</td>
                  <td className={tdClass}>{value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      )}

      {studentId && (
        <Card title="Immunizations">
          <DataTable empty={!immunizations.length} emptyMessage="No immunizations recorded." colSpan={2}>
            <thead>
              <tr>
                <th className={thClass}>Vaccine</th>
                <th className={thClass}>Given on</th>
              </tr>
            </thead>
            {!immunizations.length ? null : (
              <tbody>
                {immunizations.map((row: any) => (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>{row.vaccine}</td>
                    <td className={tdClass}>{row.given_on || '—'}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </DataTable>
        </Card>
      )}

      {studentId && (
        <Card title="Clinic visits">
          <DataTable empty={!visits.length} emptyMessage="No clinic visits on record." colSpan={4}>
            <thead>
              <tr>
                <th className={thClass}>Date</th>
                <th className={thClass}>Complaint</th>
                <th className={thClass}>Diagnosis</th>
                <th className={thClass}>Notes</th>
              </tr>
            </thead>
            {!visits.length ? null : (
              <tbody>
                {visits.map((v: any) => (
                  <tr key={v.id} className={trClass}>
                    <td className={tdClass}>{v.visited_on || v.created_at}</td>
                    <td className={tdClass}>{v.complaint || '—'}</td>
                    <td className={tdClass}>{v.diagnosis || '—'}</td>
                    <td className={tdClass}>{v.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </DataTable>
        </Card>
      )}
    </div>
  );
}

export function Documents() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/documents').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Documents" description="Issued certificates, letters, and official documents.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!rows.length} emptyMessage="No documents issued." colSpan={2}>
        <thead>
          <tr>
            <th className={thClass}>Title</th>
            <th className={thClass}>Issued</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={trClass}>
                <td className={tdClass}>
                  <div className="font-medium text-slate-800">{d.title}</div>
                  {d.html_body && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: d.html_body }} />
                  )}
                </td>
                <td className={tdClass}>{d.issued_at || d.created_at || '—'}</td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}

export function Institution() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/institution').then((r) => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  if (!data && loading) return <p className="text-slate-500">Loading…</p>;
  if (!data) return <p className="text-slate-500">Unable to load institution settings.</p>;

  const entries = Object.entries(data).filter(([, v]) => v !== null && typeof v !== 'object');
  return (
    <div className="space-y-5">
      <PageHeader title="Institution setup" description="Core institution configuration.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable colSpan={2}>
        <thead>
          <tr>
            <th className={thClass}>Setting</th>
            <th className={thClass}>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className={trClass}>
              <td className={`${tdClass} capitalize text-slate-500`}>{k.replace(/_/g, ' ')}</td>
              <td className={`${tdClass} font-medium`}>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export function Audit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const load = () => {
    setLoading(true);
    api.get('/api/audit-logs').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Audit trail" description="Immutable log of system actions. Read-only — no edit or delete.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!rows.length} emptyMessage="No audit entries yet." colSpan={6}>
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
                  <td className={`${tdClass} text-xs whitespace-nowrap`}>{a.occurred_at}</td>
                  <td className={`${tdClass} text-xs`}>{a.actor_email}</td>
                  <td className={tdClass}>
                    <Badge variant="info">{a.action}</Badge>
                    {a.summary && <div className="text-xs text-slate-500 mt-1">{a.summary}</div>}
                    {a.reason && <div className="text-xs text-amber-700 mt-1">Reason: {a.reason}</div>}
                  </td>
                  <td className={`${tdClass} text-xs`}>
                    <span className="font-medium">{a.module}</span>
                    <div className="text-slate-500">{a.entity_type}:{a.entity_id}</div>
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
                    <code className="bg-slate-100 px-1 rounded">{a.request_id}</code>
                    <div className="text-slate-500 mt-1">{a.ip} · {a.device}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </DataTable>
      <AuditDetailModal entry={detail} open={detail != null} onClose={() => setDetail(null)} />
    </div>
  );
}

export function Reports() {
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/reports/summary').then((r) => setS(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  if (!s && loading) return <p className="text-slate-500">Loading…</p>;
  if (!s) return <p className="text-slate-500">Unable to load reports.</p>;

  const entries = Object.entries(s);
  return (
    <div className="space-y-5">
      <PageHeader title="Reporting" description="Summary metrics across the platform.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable colSpan={2}>
        <thead>
          <tr>
            <th className={thClass}>Metric</th>
            <th className={thClass}>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className={trClass}>
              <td className={`${tdClass} capitalize text-slate-500`}>{k.replace(/_/g, ' ')}</td>
              <td className={`${tdClass} font-semibold text-slate-800`}>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export function Notifications() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/notifications').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" description="System alerts and messages for your account.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!rows.length} emptyMessage="No notifications." colSpan={3}>
        <thead>
          <tr>
            <th className={thClass}>Title</th>
            <th className={thClass}>Status</th>
            <th className={`${thClass} text-right`}>Action</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className={trClass}>
                <td className={`${tdClass} font-medium`}>{n.title}</td>
                <td className={tdClass}>
                  <Badge variant={n.read_at ? 'default' : 'info'}>{n.read_at ? 'Read' : 'Unread'}</Badge>
                </td>
                <td className={`${tdClass} text-right`}>
                  {!n.read_at && (
                    <Btn variant="ghost" size="sm" onClick={() => api.post(`/api/notifications/${n.id}/read`).then(load)}>
                      Mark read
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}

export function Announcements() {
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/announcements').then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Publish notices visible to students and staff.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>

      <Card title="Publish announcement">
        <div className="space-y-3">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea className={`${inputClass} min-h-[100px]`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" />
          <Btn onClick={async () => { await api.post('/api/announcements', { title, body }); setTitle(''); setBody(''); load(); }}>
            Publish
          </Btn>
        </div>
      </Card>

      <DataTable empty={!rows.length} emptyMessage="No announcements published." colSpan={2}>
        <thead>
          <tr>
            <th className={thClass}>Title</th>
            <th className={thClass}>Message</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={trClass}>
                <td className={`${tdClass} font-medium align-top`}>{a.title}</td>
                <td className={`${tdClass} text-slate-600 align-top`}>{a.body}</td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}

export function Integrations() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/integrations').then((r) => setD(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  if (!d && loading) return <p className="text-slate-500">Loading…</p>;
  if (!d) return <p className="text-slate-500">Unable to load integrations.</p>;

  const entries = Object.entries(d);
  return (
    <div className="space-y-5">
      <PageHeader title="Integrations" description="External service connections and API status.">
        <div className="flex flex-wrap gap-2">
          <RefreshButton onClick={load} loading={loading} />
          <Btn
            type="button"
            variant="secondary"
            className="inline-flex items-center gap-1.5"
            onClick={() => window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            API documentation
          </Btn>
        </div>
      </PageHeader>
      <DataTable colSpan={2}>
        <thead>
          <tr>
            <th className={thClass}>Integration</th>
            <th className={thClass}>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className={trClass}>
              <td className={`${tdClass} capitalize font-medium`}>{k.replace(/_/g, ' ')}</td>
              <td className={tdClass}>
                {typeof v === 'boolean' ? (
                  <Badge variant={v ? 'success' : 'default'}>{v ? 'Enabled' : 'Disabled'}</Badge>
                ) : (
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{String(v)}</code>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

export function Pg() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/pg-records').then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="PG research" description="Thesis supervision and postgraduate records.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!rows.length} emptyMessage="No postgraduate records." colSpan={3}>
        <thead>
          <tr>
            <th className={thClass}>Student</th>
            <th className={thClass}>Topic</th>
            <th className={thClass}>Thesis status</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={trClass}>
                <td className={tdClass}>{r.student?.first_name} {r.student?.last_name}</td>
                <td className={tdClass}>{r.topic}</td>
                <td className={tdClass}><Badge variant={stageBadge(r.thesis_status)}>{r.thesis_status?.replace(/_/g, ' ')}</Badge></td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}
