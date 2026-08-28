import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { message } from 'antd';
import { List, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';
import { ENTRY_MODES } from '../academic/constants';
import { TRANSCRIPT_TYPES } from '../transcripts/constants';

const ONLINE_ONLY_FEE_CATEGORIES = ['application_fee', 'acceptance_fee', 'transcript'];

function isOnlineOnlyFee(category?: string) {
  return ONLINE_ONLY_FEE_CATEGORIES.includes(String(category || ''));
}

function requiresEntryMode(category?: string) {
  return category === 'application_fee' || category === 'acceptance_fee';
}

const FALLBACK_SCHEDULE_CATEGORIES = [
  'tuition', 'library', 'medical', 'sports', 'ict', 'laboratory', 'development', 'other',
];

function apiMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  const firstError = data?.errors && Object.values(data.errors).flat().find(Boolean);
  return firstError || data?.message || fallback;
}

export function FeeCatalog() {
  const [fees, setFees] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string; schedule?: boolean }[]>([]);
  const [scheduleCategories, setScheduleCategories] = useState<string[]>([]);
  const [installmentTranches, setInstallmentTranches] = useState<{ value: number; label: string; percent: number }[]>([]);
  const [programs, setPrograms] = useState<{ id: number; name: string; code?: string | null }[]>([]);
  const [transcriptTypes, setTranscriptTypes] = useState<{ value: string; label: string }[]>(
    TRANSCRIPT_TYPES.map((t) => ({ value: t.value, label: t.label })),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [feeForm, setFeeForm] = useState({
    name: '',
    description: '',
    category: 'sundry',
    entry_mode: '',
    transcript_type: '',
    program_id: '',
    installment_tranche: '',
    amount: '',
    is_active: true,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/fees'),
      api.get('/api/fees/meta').catch(() => ({ data: { categories: [], schedule_categories: [], installment_tranches: [], transcript_types: [] } })),
      api.get('/api/programs').catch(() => ({ data: [] })),
    ])
      .then(([feesRes, metaRes, programsRes]) => {
        setFees(Array.isArray(feesRes.data) ? feesRes.data : feesRes.data?.data || []);
        setCategories(metaRes.data.categories || []);
        setScheduleCategories(metaRes.data.schedule_categories || []);
        setInstallmentTranches(metaRes.data.installment_tranches || []);
        if (Array.isArray(metaRes.data.transcript_types) && metaRes.data.transcript_types.length) {
          setTranscriptTypes(metaRes.data.transcript_types);
        }
        setPrograms(Array.isArray(programsRes.data) ? programsRes.data : programsRes.data?.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const isScheduleFee = (category?: string) => {
    const code = String(category || '');
    if (isOnlineOnlyFee(code)) return false;
    if (scheduleCategories.includes(code) || !!categories.find((c) => c.value === code)?.schedule) {
      return true;
    }
    if (categories.length === 0 && scheduleCategories.length === 0) {
      return FALLBACK_SCHEDULE_CATEGORIES.includes(code);
    }
    return false;
  };

  const openCreateFee = () => {
    setEditingFee(null);
    setFeeForm({ name: '', description: '', category: 'tuition', entry_mode: '', transcript_type: '', program_id: '', installment_tranche: '', amount: '', is_active: true });
    setFeeModalOpen(true);
  };

  const openEditFee = (fee: any) => {
    setEditingFee(fee);
    setFeeForm({
      name: fee.name || '',
      description: fee.description || '',
      category: fee.category || 'sundry',
      entry_mode: fee.entry_mode || '',
      transcript_type: fee.transcript_type || '',
      program_id: fee.program_id != null ? String(fee.program_id) : '',
      installment_tranche: fee.installment_tranche != null ? String(fee.installment_tranche) : '',
      amount: String(fee.amount ?? ''),
      is_active: fee.is_active !== false,
    });
    setFeeModalOpen(true);
  };

  const saveFee = async () => {
    if (!feeForm.name.trim() || feeForm.amount === '') {
      message.error('Enter a name and amount.');
      return;
    }
    if (requiresEntryMode(feeForm.category) && !feeForm.entry_mode) {
      message.error('Select an entry mode for application and acceptance fees.');
      return;
    }
    if (feeForm.category === 'transcript' && (!feeForm.transcript_type || !feeForm.program_id)) {
      message.error('Select a transcript type and programme for official transcript fees.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: feeForm.name.trim(),
        description: feeForm.description.trim() || null,
        category: feeForm.category,
        entry_mode: requiresEntryMode(feeForm.category) ? (feeForm.entry_mode || null) : null,
        transcript_type: feeForm.category === 'transcript' ? (feeForm.transcript_type || null) : null,
        program_id: feeForm.category === 'transcript' ? Number(feeForm.program_id) : null,
        installment_tranche: isScheduleFee(feeForm.category) && feeForm.installment_tranche !== ''
          ? Number(feeForm.installment_tranche)
          : null,
        amount: Number(feeForm.amount),
        is_active: feeForm.is_active,
      };
      const res = editingFee
        ? await api.patch(`/api/fees/${editingFee.id}`, payload)
        : await api.post('/api/fees', payload);
      if (res.status !== 202 && res.data?.status !== 'pending_approval') {
        message.success(editingFee ? 'Fee item updated.' : 'Fee item created.');
      }
      setFeeModalOpen(false);
      load();
    } catch (err) {
      message.error(apiMessage(err, 'Could not save fee item.'));
    } finally {
      setSaving(false);
    }
  };

  const removeFee = async (fee: any) => {
    if (!window.confirm(`Remove fee “${fee.name}”?`)) return;
    try {
      const res = await api.delete(`/api/fees/${fee.id}`);
      if (res.status !== 202 && res.data?.status !== 'pending_approval') {
        message.success('Fee item removed.');
      }
      load();
    } catch (err) {
      message.error(apiMessage(err, 'Could not remove fee item.'));
    }
  };

  const categoryOptions = categories.length
    ? categories
    : [
        { value: 'tuition', label: 'Tuition' },
        { value: 'library', label: 'Library' },
        { value: 'medical', label: 'Medical levy' },
        { value: 'sports', label: 'Sports' },
        { value: 'ict', label: 'ICT' },
        { value: 'laboratory', label: 'Laboratory' },
        { value: 'development', label: 'Development levy' },
        { value: 'hostel', label: 'Hostel' },
        { value: 'clinic', label: 'Clinic services' },
        { value: 'sundry', label: 'Sundry' },
        { value: 'acceptance_fee', label: 'Acceptance fee' },
        { value: 'application_fee', label: 'Application fee' },
        { value: 'other', label: 'Other' },
      ];

  const activeFees = fees.filter((f) => f.is_active !== false).length;
  const onlineFees = fees.filter((f) => isOnlineOnlyFee(f.category)).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Fee items"
        description="Priced lines with amounts. Add a category on Fee categories when a new school charge has no matching type. Programme-schedule lines are assigned per programme under Programme fees. School-fee lines use installment shares (1st–4th 25%); application, acceptance, and transcript fees are online-only."
        icon={Wallet}
      >
        <Link
          to="/finance/categories"
          className="inline-flex items-center justify-center rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
        >
          Fee categories
        </Link>
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Fee items" value={fees.length} hint="Lines with amounts" icon={List} />
        <StatCard label="Active items" value={activeFees} hint="Available to invoice" icon={Wallet} tone="emerald" />
        <StatCard label="Online only" value={onlineFees} hint="App, acceptance, transcript" icon={Wallet} tone="amber" />
      </div>

      <Card
        title="Fee items"
        description="School-fee lines can use installment shares (1st–4th 25% or Full 100%). Application and acceptance fees need an entry mode; transcript fees need type and programme. Assign schedule lines on Programme fees."
        actions={<Btn className="!text-white" onClick={openCreateFee}>Add fee item</Btn>}
      >
        <DataTable empty={!fees.length} emptyMessage="No fees configured." colSpan={10} loading={loading}>
          <thead>
            <tr>
              <th className={thClass}>Fee</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Installment</th>
              <th className={thClass}>Entry mode / type</th>
              <th className={thClass}>Programme</th>
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
                const isSchedule = isScheduleFee(f.category);
                const trancheLabel = installmentTranches.find((t) => t.value === Number(f.installment_tranche))?.label;
                return (
                  <tr key={f.id} className={trClass}>
                    <td className={`${tdClass} font-medium`}>
                      <div>{f.name}</div>
                      {f.description && <div className="text-xs text-slate-500">{f.description}</div>}
                    </td>
                    <td className={tdClass}><Badge variant="info">{(f.category || '').replaceAll('_', ' ')}</Badge></td>
                    <td className={tdClass}>
                      {trancheLabel ? <Badge variant="success">{trancheLabel}</Badge> : '—'}
                    </td>
                    <td className={tdClass}>
                      {requiresEntryMode(f.category)
                        ? (ENTRY_MODES.find((mode) => mode.value === f.entry_mode)?.label || f.entry_mode || '—')
                        : f.category === 'transcript'
                          ? (transcriptTypes.find((t) => t.value === f.transcript_type)?.label || f.transcript_type || '—')
                          : '—'}
                    </td>
                    <td className={tdClass}>
                      {f.category === 'transcript'
                        ? (f.program?.name || programs.find((p) => p.id === f.program_id)?.name || '—')
                        : '—'}
                    </td>
                    <td className={tdClass}>
                      <Badge variant={isSchedule ? 'success' : 'default'}>
                        {isSchedule ? 'Programme schedule' : 'Operational'}
                      </Badge>
                    </td>
                    <td className={tdClass}>{formatNaira(f.amount)}</td>
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
                  installment_tranche: isScheduleFee(e.target.value) ? s.installment_tranche : '',
                }))}
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {categories.length === 0
                  ? 'No categories yet. Add one under Fees & payments → Fee categories.'
                  : isOnlineOnlyFee(feeForm.category)
                    ? 'Application, acceptance, and transcript fees are paid online. They cannot be paid from the wallet.'
                    : 'This charge is paid from the campus wallet after the student funds it.'}
              </p>
            </label>
            {isScheduleFee(feeForm.category) && (
              <label className="block">
                <span className={fieldLabelClass}>Installment share</span>
                <select
                  className={inputClass}
                  value={feeForm.installment_tranche}
                  onChange={(e) => setFeeForm((s) => ({ ...s, installment_tranche: e.target.value }))}
                >
                  <option value="">None (legacy full-fee line)</option>
                  {installmentTranches.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Create a separate catalog line for each 25% slice when amounts differ (for example Tuition · 1st 25% and Tuition · 2nd 25%). Optional Full 100% is only for a discounted pay-at-once package. Assign those lines on Programme fees.
                </p>
              </label>
            )}
            {requiresEntryMode(feeForm.category) && (
              <label className="block">
                <span className={fieldLabelClass}>Entry mode</span>
                <select
                  className={inputClass}
                  value={feeForm.entry_mode}
                  onChange={(e) => setFeeForm((s) => ({ ...s, entry_mode: e.target.value }))}
                >
                  <option value="">Select entry mode</option>
                  {ENTRY_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {feeForm.category === 'acceptance_fee'
                    ? 'Admitted students in this category pay this amount. One line per entry mode is reused for every application session. Do not create a new line when you open a new year.'
                    : 'Applicants in this category pay this amount. One line per entry mode is reused for every application session. Do not create a new line when you open a new year.'}
                </p>
              </label>
            )}
            {feeForm.category === 'transcript' && (
              <>
                <label className="block">
                  <span className={fieldLabelClass}>Transcript type</span>
                  <select
                    className={inputClass}
                    value={feeForm.transcript_type}
                    onChange={(e) => setFeeForm((s) => ({ ...s, transcript_type: e.target.value }))}
                  >
                    <option value="">Select transcript type</option>
                    {transcriptTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Create a separate line for e-copy, within Nigeria, outside Nigeria, and student copy.</p>
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>Programme</span>
                  <select
                    className={inputClass}
                    value={feeForm.program_id}
                    onChange={(e) => setFeeForm((s) => ({ ...s, program_id: e.target.value }))}
                  >
                    <option value="">Select programme</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}{program.code ? ` (${program.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">The public form quotes this amount after the student picks this programme and type.</p>
                </label>
              </>
            )}
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
              <Btn onClick={saveFee} disabled={saving || (requiresEntryMode(feeForm.category) && !feeForm.entry_mode) || (feeForm.category === 'transcript' && (!feeForm.transcript_type || !feeForm.program_id))}>{saving ? 'Saving…' : 'Save fee'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
