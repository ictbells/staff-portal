import { useEffect, useState } from 'react';
import { Button, DatePicker, Modal, Select, message } from 'antd';
import dayjs from 'dayjs';
import { Award, Bell, ClipboardCheck, ExternalLink, FileText, GraduationCap, Landmark, Plug } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  PageHeader, StatCard, WorkspaceHero, stageBadge, tdClass, thClass, trClass,
} from '../components/ui';

const API_DOCS_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/docs`;

const ONLINE_ONLY_FEE_CATEGORIES = ['application_fee', 'acceptance_fee'];

function isOnlineOnlyFee(category?: string) {
  return ONLINE_ONLY_FEE_CATEGORIES.includes(String(category || ''));
}

export function Students() {
  const { has } = useAuth();
  const [rows, setRows] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('current');
  const [confer, setConfer] = useState<{ id: number; name: string } | null>(null);
  const [conferDate, setConferDate] = useState(dayjs());
  const [conferring, setConferring] = useState(false);
  const canGraduate = has('academic.graduate');
  const load = () => {
    setLoading(true);
    api.get('/api/students', { params: { status: statusFilter } }).then((r) => setRows(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statusFilter]);
  const list = rows?.data || (rows?.id ? [rows] : rows) || [];
  const items = Array.isArray(list) ? list : [];
  const withMatric = items.filter((s: any) => s.matric_number).length;

  const confirmConfer = async () => {
    if (!confer) return;
    setConferring(true);
    try {
      const { data } = await api.post(`/api/students/${confer.id}/confer`, {
        graduated_at: conferDate.format('YYYY-MM-DD'),
        require_final_year: false,
      });
      if (data?.status === 'pending_approval') {
        message.info('Graduation is waiting for office approval.');
      } else {
        message.success('Graduation recorded.');
      }
      setConfer(null);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not confirm graduation.');
    } finally {
      setConferring(false);
    }
  };

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Overview"
        title="Students"
        description="Browse student records, studentship status, and programme assignments."
        icon={GraduationCap}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Listed" value={items.length} hint="Records in this list" icon={GraduationCap} />
        <StatCard label="With matric" value={withMatric} hint="Assigned matric numbers" icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Awaiting matric" value={items.length - withMatric} hint="Not yet numbered" icon={GraduationCap} tone="amber" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'current', label: 'Current studentship' },
            { value: 'alumni', label: 'Alumni' },
            { value: 'all', label: 'All statuses' },
          ]}
          className="min-w-[200px]"
        />
      </div>
      <DataTable empty={!items.length} emptyMessage="No student records found." colSpan={canGraduate ? 6 : 5}>
        <thead>
          <tr>
            <th className={thClass}>Name</th>
            <th className={thClass}>Matric no.</th>
            <th className={thClass}>Programme</th>
            <th className={thClass}>Status</th>
            <th className={thClass}>Studentship ends</th>
            {canGraduate && <th className={thClass}>Actions</th>}
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
                <td className={`${tdClass} capitalize`}>{s.status || 'active'}</td>
                <td className={tdClass}>{s.studentship_expires_at || '—'}</td>
                {canGraduate && (
                  <td className={tdClass}>
                    {s.status === 'active' && (
                      <Button type="link" size="small" className="!px-0" onClick={() => { setConfer({ id: s.id, name: `${s.first_name} ${s.last_name}` }); setConferDate(dayjs()); }}>
                        Confer
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
      <Modal
        title={`Confirm graduation — ${confer?.name || ''}`}
        open={!!confer}
        onCancel={() => setConfer(null)}
        onOk={confirmConfer}
        confirmLoading={conferring}
        okText="Confer"
      >
        <p className="text-sm text-slate-600 mb-3">Late senate lists can confer a student who is not on the final-year candidate list.</p>
        <DatePicker className="w-full" value={conferDate} onChange={(value) => value && setConferDate(value)} />
      </Modal>
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
    const { data } = await api.post('/api/wallet/topup', { amount: Number(amount), portal: 'staff' });
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

export { Invoices } from './finance/Invoices';
export { GenerateInvoice } from './finance/GenerateInvoice';
export { FeeCatalog as Finance } from './finance/FeeCatalog';
export { ProgrammeFees } from './finance/ProgrammeFees';
export { SundryFees } from './finance/SundryFees';
export { StudentFinance } from './finance/StudentFinance';
export { Rebates } from './finance/Rebates';

function LegacyInvoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/invoices').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" description="View outstanding invoices. Students pay from the student portal.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>
      <DataTable empty={!rows.length} emptyMessage="No invoices found." colSpan={5}>
        <thead>
          <tr>
            <th className={thClass}>Number</th>
            <th className={thClass}>Category</th>
            <th className={thClass}>Balance</th>
            <th className={thClass}>Status</th>
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
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}

function LegacyFinance() {
  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string; schedule?: boolean }[]>([]);
  const [scheduleCategories, setScheduleCategories] = useState<string[]>([]);
  const [installments, setInstallments] = useState<number[]>([25, 50, 75, 100]);
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [programmeFees, setProgrammeFees] = useState<any[]>([]);
  const [programmeFeeTotal, setProgrammeFeeTotal] = useState<number | null>(null);
  const [pfProgramId, setPfProgramId] = useState<number | undefined>();
  const [pfLevel, setPfLevel] = useState('all');
  const [pfSemester, setPfSemester] = useState('both');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [pfModalOpen, setPfModalOpen] = useState(false);
  const [editingPf, setEditingPf] = useState<any | null>(null);
  const [genStudentId, setGenStudentId] = useState<number | undefined>();
  const [genFeeId, setGenFeeId] = useState<number | undefined>();
  const [genPercent, setGenPercent] = useState(100);
  const [feeForm, setFeeForm] = useState({
    name: '',
    description: '',
    category: 'sundry',
    amount: '',
    is_active: true,
  });
  const [pfForm, setPfForm] = useState({
    fee_item_id: undefined as number | undefined,
    amount: '',
    level_code: 'all',
    semester: 'both',
    is_active: true,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/fees'),
      api.get('/api/payments'),
      api.get('/api/fees/meta').catch(() => ({ data: { categories: [], installment_percents: [25, 50, 75, 100], schedule_categories: [] } })),
      api.get('/api/students', { params: { page: 1, per_page: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get('/api/programs').catch(() => ({ data: [] })),
    ])
      .then(([feesRes, paymentsRes, metaRes, studentsRes, programsRes]) => {
        setFees(Array.isArray(feesRes.data) ? feesRes.data : feesRes.data?.data || []);
        setPayments(paymentsRes.data.data || paymentsRes.data);
        setCategories(metaRes.data.categories || []);
        setScheduleCategories(metaRes.data.schedule_categories || []);
        setInstallments(metaRes.data.installment_percents || [25, 50, 75, 100]);
        setStudents(studentsRes.data.data || studentsRes.data || []);
        const progList = programsRes.data?.data || programsRes.data || [];
        setPrograms(Array.isArray(progList) ? progList : []);
      })
      .finally(() => setLoading(false));
  };

  const loadProgrammeFees = (programId?: number, level = pfLevel, semester = pfSemester) => {
    if (!programId) {
      setProgrammeFees([]);
      setProgrammeFeeTotal(null);
      return;
    }
    api.get('/api/programme-fees', {
      params: {
        program_id: programId,
        ...(level && level !== 'all' ? { level_code: level } : {}),
        ...(semester && semester !== 'both' ? { semester } : {}),
      },
    }).then((r) => {
      setProgrammeFees(r.data.data || []);
      setProgrammeFeeTotal(r.data.total_amount != null ? Number(r.data.total_amount) : null);
    }).catch(() => {
      setProgrammeFees([]);
      setProgrammeFeeTotal(null);
    });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    loadProgrammeFees(pfProgramId, pfLevel, pfSemester);
  }, [pfProgramId, pfLevel, pfSemester]);

  const openCreateFee = () => {
    setEditingFee(null);
    setFeeForm({
      name: '',
      description: '',
      category: 'tuition',
      amount: '',
      is_active: true,
    });
    setFeeModalOpen(true);
  };

  const openEditFee = (fee: any) => {
    setEditingFee(fee);
    setFeeForm({
      name: fee.name || '',
      description: fee.description || '',
      category: fee.category || 'sundry',
      amount: String(fee.amount ?? ''),
      is_active: fee.is_active !== false,
    });
    setFeeModalOpen(true);
  };

  const saveFee = async () => {
    if (!feeForm.name.trim() || feeForm.amount === '') return;
    setSaving(true);
    try {
      const payload = {
        name: feeForm.name.trim(),
        description: feeForm.description.trim() || null,
        category: feeForm.category,
        amount: Number(feeForm.amount),
        is_active: feeForm.is_active,
      };
      if (editingFee) {
        await api.patch(`/api/fees/${editingFee.id}`, payload);
      } else {
        await api.post('/api/fees', payload);
      }
      setFeeModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const removeFee = async (fee: any) => {
    if (!window.confirm(`Remove fee “${fee.name}”?`)) return;
    await api.delete(`/api/fees/${fee.id}`);
    load();
    if (pfProgramId) loadProgrammeFees(pfProgramId);
  };

  const scheduleFeeItems = fees.filter(
    (f) => f.is_active !== false && (scheduleCategories.includes(f.category) || f.category === 'tuition' || categories.find((c) => c.value === f.category)?.schedule)
  );

  const openCreatePf = () => {
    if (!pfProgramId) return;
    setEditingPf(null);
    setPfForm({
      fee_item_id: undefined,
      amount: '',
      level_code: pfLevel || 'all',
      semester: pfSemester || 'both',
      is_active: true,
    });
    setPfModalOpen(true);
  };

  const openEditPf = (row: any) => {
    setEditingPf(row);
    setPfForm({
      fee_item_id: row.fee_item_id,
      amount: row.amount != null ? String(row.amount) : '',
      level_code: row.level_code || 'all',
      semester: row.semester || 'both',
      is_active: row.is_active !== false,
    });
    setPfModalOpen(true);
  };

  const savePf = async () => {
    if (!pfProgramId || !pfForm.fee_item_id) return;
    setSaving(true);
    try {
      const payload = {
        program_id: pfProgramId,
        fee_item_id: pfForm.fee_item_id,
        amount: pfForm.amount === '' ? null : Number(pfForm.amount),
        level_code: pfForm.level_code || 'all',
        semester: pfForm.semester || 'both',
        is_active: pfForm.is_active,
      };
      if (editingPf) {
        await api.patch(`/api/programme-fees/${editingPf.id}`, payload);
      } else {
        await api.post('/api/programme-fees', payload);
      }
      setPfModalOpen(false);
      loadProgrammeFees(pfProgramId);
      load();
    } finally {
      setSaving(false);
    }
  };

  const removePf = async (row: any) => {
    const label = row.fee_item?.name || 'fee line';
    if (!window.confirm(`Remove “${label}” from this programme schedule?`)) return;
    await api.delete(`/api/programme-fees/${row.id}`);
    loadProgrammeFees(pfProgramId);
    load();
  };

  const generateInvoice = async () => {
    if (!genStudentId || !genFeeId) return;
    const fee = fees.find((f) => f.id === genFeeId);
    setSaving(true);
    try {
      await api.post('/api/invoices', {
        student_id: genStudentId,
        fee_item_id: genFeeId,
        installment_percent: fee?.category === 'tuition' ? genPercent : undefined,
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const selectedGenFee = fees.find((f) => f.id === genFeeId);
  const categoryOptions = categories.length
    ? categories
    : [
        { value: 'tuition', label: 'Tuition' },
        { value: 'library', label: 'Library' },
        { value: 'medical', label: 'Medical / clinic' },
        { value: 'sports', label: 'Sports' },
        { value: 'ict', label: 'ICT' },
        { value: 'laboratory', label: 'Laboratory' },
        { value: 'development', label: 'Development levy' },
        { value: 'hostel', label: 'Hostel' },
        { value: 'sundry', label: 'Sundry' },
        { value: 'acceptance_fee', label: 'Acceptance fee' },
        { value: 'other', label: 'Other' },
      ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fees & payments" description="Maintain school-fee lines and programme fees. Application fees are set per application window under Academic → Application windows. Acceptance fee defaults can be updated in the fee catalog or when issuing offers.">
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>

      <Card
        title="Fee catalog"
        description="Define reusable fee items. School charges are paid from the campus wallet. Only application and acceptance fees are paid online. Schedule categories (tuition, library, medical, …) can be assigned per programme below. Operational items (hostel, sundry, acceptance) are invoiced directly."
      >
        <div className="mb-4">
          <Btn onClick={openCreateFee}>Add fee item</Btn>
        </div>
        <DataTable empty={!fees.length} emptyMessage="No fees configured." colSpan={7}>
          <thead>
            <tr>
              <th className={thClass}>Fee</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Default amount</th>
              <th className={thClass}>Payment</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          {!fees.length ? null : (
            <tbody>
              {fees.map((f) => {
                const isSchedule = scheduleCategories.includes(f.category)
                  || categories.find((c) => c.value === f.category)?.schedule;
                return (
                  <tr key={f.id} className={trClass}>
                    <td className={`${tdClass} font-medium`}>
                      <div>{f.name}</div>
                      {f.description && <div className="text-xs text-slate-500">{f.description}</div>}
                    </td>
                    <td className={tdClass}><Badge variant="info">{(f.category || '').replaceAll('_', ' ')}</Badge></td>
                    <td className={tdClass}>
                      <Badge variant={isSchedule ? 'success' : 'default'}>
                        {isSchedule ? 'Programme schedule' : 'Operational'}
                      </Badge>
                    </td>
                    <td className={tdClass}>₦{Number(f.amount).toLocaleString()}</td>
                    <td className={tdClass}>
                      <Badge variant={isOnlineOnlyFee(f.category) ? 'default' : 'success'}>
                        {isOnlineOnlyFee(f.category) ? 'Online only' : 'Wallet'}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <Badge variant={f.is_active === false ? 'default' : 'success'}>
                        {f.is_active === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openEditFee(f)}>Edit</button>
                        <button type="button" className="text-sm text-rose-600 hover:underline" onClick={() => removeFee(f)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </DataTable>
      </Card>

      <Card
        title="Programme fees"
        description="Assign catalog school-fee lines to a programme (optional level and semester). Leave amount blank to use the catalog default. The total drives tuition invoices and installments."
      >
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <label className="block min-w-[240px]">
            <span className={fieldLabelClass}>Programme</span>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select programme"
              value={pfProgramId}
              onChange={setPfProgramId}
              options={programs.map((p: any) => ({
                value: p.id,
                label: p.code ? `${p.name} (${p.code})` : p.name,
              }))}
            />
          </label>
          <label className="block min-w-[120px]">
            <span className={fieldLabelClass}>Level</span>
            <Select
              className="w-full"
              value={pfLevel}
              onChange={setPfLevel}
              options={[
                { value: 'all', label: 'All levels' },
                { value: '100', label: '100' },
                { value: '200', label: '200' },
                { value: '300', label: '300' },
                { value: '400', label: '400' },
                { value: '500', label: '500' },
                { value: 'Y1', label: 'Y1' },
                { value: 'Y2', label: 'Y2' },
              ]}
            />
          </label>
          <label className="block min-w-[140px]">
            <span className={fieldLabelClass}>Semester</span>
            <Select
              className="w-full"
              value={pfSemester}
              onChange={setPfSemester}
              options={[
                { value: 'both', label: 'Both' },
                { value: 'first', label: 'First' },
                { value: 'second', label: 'Second' },
              ]}
            />
          </label>
          <Btn onClick={openCreatePf} disabled={!pfProgramId}>Add line</Btn>
          {programmeFeeTotal != null && (
            <div className="text-sm font-medium text-slate-800 ml-auto">
              Schedule total: ₦{programmeFeeTotal.toLocaleString()}
            </div>
          )}
        </div>
        <DataTable empty={!pfProgramId || !programmeFees.length} emptyMessage={pfProgramId ? 'No fee lines for this programme yet. Add tuition (and other schedule items) here.' : 'Select a programme to manage its fee schedule.'} colSpan={7}>
          <thead>
            <tr>
              <th className={thClass}>Fee item</th>
              <th className={thClass}>Level</th>
              <th className={thClass}>Semester</th>
              <th className={thClass}>Override</th>
              <th className={thClass}>Effective</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          {!pfProgramId || !programmeFees.length ? null : (
            <tbody>
              {programmeFees.map((row) => (
                <tr key={row.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>
                    <div>{row.fee_item?.name || '—'}</div>
                    <div className="text-xs text-slate-500">{(row.fee_item?.category || '').replaceAll('_', ' ')}</div>
                  </td>
                  <td className={tdClass}>{row.level_code || 'all'}</td>
                  <td className={tdClass}>{row.semester || 'both'}</td>
                  <td className={tdClass}>{row.amount != null ? `₦${Number(row.amount).toLocaleString()}` : 'Catalog default'}</td>
                  <td className={`${tdClass} font-medium`}>₦{Number(row.effective_amount ?? 0).toLocaleString()}</td>
                  <td className={tdClass}>
                    <Badge variant={row.is_active === false ? 'default' : 'success'}>
                      {row.is_active === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openEditPf(row)}>Edit</button>
                      <button type="button" className="text-sm text-rose-600 hover:underline" onClick={() => removePf(row)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>

      {feeModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{editingFee ? 'Edit fee item' : 'Add fee item'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Name</span>
              <input className={inputClass} value={feeForm.name} onChange={(e) => setFeeForm((s) => ({ ...s, name: e.target.value }))} />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Category</span>
              <select
                className={inputClass}
                value={feeForm.category}
                onChange={(e) => setFeeForm((s) => ({
                  ...s,
                  category: e.target.value,
                }))}
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {isOnlineOnlyFee(feeForm.category)
                  ? 'Application and acceptance fees are paid online. They cannot be paid from the wallet.'
                  : 'This charge is paid from the campus wallet after the student funds it.'}
              </p>
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Default amount (₦)</span>
              <input className={inputClass} type="number" min={0} value={feeForm.amount} onChange={(e) => setFeeForm((s) => ({ ...s, amount: e.target.value }))} />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Description</span>
              <input className={inputClass} value={feeForm.description} onChange={(e) => setFeeForm((s) => ({ ...s, description: e.target.value }))} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={feeForm.is_active} onChange={(e) => setFeeForm((s) => ({ ...s, is_active: e.target.checked }))} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setFeeModalOpen(false)}>Cancel</Btn>
              <Btn onClick={saveFee} disabled={saving}>{saving ? 'Saving…' : 'Save fee'}</Btn>
            </div>
          </div>
        </div>
      )}

      {pfModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{editingPf ? 'Edit programme fee' : 'Assign fee to programme'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Fee item</span>
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                placeholder="Select catalog item"
                value={pfForm.fee_item_id}
                disabled={!!editingPf}
                onChange={(v) => setPfForm((s) => ({ ...s, fee_item_id: v }))}
                options={scheduleFeeItems.map((f) => ({
                  value: f.id,
                  label: `${f.name} (₦${Number(f.amount).toLocaleString()})`,
                }))}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Amount override (₦)</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                placeholder="Leave blank for catalog default"
                value={pfForm.amount}
                onChange={(e) => setPfForm((s) => ({ ...s, amount: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Level</span>
              <Select
                className="w-full"
                value={pfForm.level_code}
                onChange={(v) => setPfForm((s) => ({ ...s, level_code: v }))}
                options={[
                  { value: 'all', label: 'All levels' },
                  { value: '100', label: '100' },
                  { value: '200', label: '200' },
                  { value: '300', label: '300' },
                  { value: '400', label: '400' },
                  { value: '500', label: '500' },
                  { value: 'Y1', label: 'Y1' },
                  { value: 'Y2', label: 'Y2' },
                ]}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Semester</span>
              <Select
                className="w-full"
                value={pfForm.semester}
                onChange={(v) => setPfForm((s) => ({ ...s, semester: v }))}
                options={[
                  { value: 'both', label: 'Both' },
                  { value: 'first', label: 'First' },
                  { value: 'second', label: 'Second' },
                ]}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={pfForm.is_active} onChange={(e) => setPfForm((s) => ({ ...s, is_active: e.target.checked }))} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setPfModalOpen(false)}>Cancel</Btn>
              <Btn onClick={savePf} disabled={saving || !pfForm.fee_item_id}>{saving ? 'Saving…' : 'Save'}</Btn>
            </div>
          </div>
        </div>
      )}

      <Card title="Generate student invoice" description="Operational fees invoice the catalog amount. Choosing Tuition builds the invoice from the student’s programme fee schedule (with optional 25/50/75/100% installment).">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block min-w-[220px]">
            <span className={fieldLabelClass}>Student</span>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select student"
              value={genStudentId}
              onChange={setGenStudentId}
              options={students.map((s: any) => ({
                value: s.id,
                label: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.matric_number || `#${s.id}`,
              }))}
            />
          </label>
          <label className="block min-w-[220px]">
            <span className={fieldLabelClass}>Fee</span>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select fee"
              value={genFeeId}
              onChange={setGenFeeId}
              options={fees.filter((f) => f.is_active !== false).map((f) => ({
                value: f.id,
                label: `${f.name} (₦${Number(f.amount).toLocaleString()})`,
              }))}
            />
          </label>
          {selectedGenFee?.category === 'tuition' && (
            <label className="block min-w-[160px]">
              <span className={fieldLabelClass}>Installment</span>
              <Select
                className="w-full"
                value={genPercent}
                onChange={setGenPercent}
                options={installments.map((p) => ({ value: p, label: `${p}%` }))}
              />
            </label>
          )}
          <Btn onClick={generateInvoice} disabled={saving || !genStudentId || !genFeeId}>
            {saving ? 'Generating…' : 'Generate'}
          </Btn>
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

export { default as Medical } from './clinic/ClinicWorkspace';

export function Documents() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/documents').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const issuedThisMonth = rows.filter((d) => {
    const raw = d.issued_at || d.created_at;
    if (!raw) return false;
    const date = new Date(raw);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Campus services"
        title="Documents"
        description="Issued certificates, letters, and official documents."
        icon={FileText}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Issued" value={rows.length} hint="All documents on file" icon={FileText} />
        <StatCard label="This month" value={issuedThisMonth} hint="Issued in the current month" icon={ClipboardCheck} tone="emerald" />
      </div>
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
      <WorkspaceHero
        eyebrow="Administration"
        title="Institution setup"
        description="Core institution configuration used across admissions, finance, and student records."
        icon={Landmark}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Settings" value={entries.length} hint="Configured institution fields" icon={Landmark} />
      </div>
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

export { default as Audit } from './Audit';

export function Notifications() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    api.get('/api/notifications').then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="System"
        title="Notifications"
        description="System alerts and messages for your account."
        icon={Bell}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="All" value={rows.length} hint="Messages in your inbox" icon={Bell} />
        <StatCard label="Unread" value={unread} hint="Waiting for your attention" icon={Bell} tone="amber" />
        <StatCard label="Read" value={rows.length - unread} hint="Already opened" icon={ClipboardCheck} tone="emerald" />
      </div>
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
      <WorkspaceHero
        eyebrow="System"
        title="Integrations"
        description="External service connections and API status."
        icon={Plug}
      >
        <RefreshButton onClick={load} loading={loading} />
        <Btn
          type="button"
          variant="secondary"
          className="inline-flex items-center gap-1.5 !text-white"
          onClick={() => window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          API documentation
        </Btn>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Services" value={entries.length} hint="Configured connections" icon={Plug} />
        <StatCard
          label="Enabled"
          value={entries.filter(([, v]) => v === true).length}
          hint="Active integrations"
          icon={ClipboardCheck}
          tone="emerald"
        />
        <StatCard
          label="Disabled"
          value={entries.filter(([, v]) => v === false).length}
          hint="Turned off"
          icon={Plug}
          tone="amber"
        />
      </div>
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
  const inProgress = rows.filter((r) => String(r.thesis_status || '').includes('progress') || r.thesis_status === 'submitted').length;
  const completed = rows.filter((r) => ['completed', 'graduated', 'approved'].includes(String(r.thesis_status || ''))).length;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Academic"
        title="PG research"
        description="Thesis supervision and postgraduate records."
        icon={Award}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Records" value={rows.length} hint="Postgraduate research files" icon={Award} />
        <StatCard label="In progress" value={inProgress} hint="Active supervision" icon={ClipboardCheck} tone="amber" />
        <StatCard label="Completed" value={completed} hint="Finished or approved" icon={ClipboardCheck} tone="emerald" />
      </div>
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
