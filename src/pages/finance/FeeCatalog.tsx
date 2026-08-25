import { useEffect, useState } from 'react';
import { List, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';

const ONLINE_ONLY_FEE_CATEGORIES = ['application_fee', 'acceptance_fee'];

function isOnlineOnlyFee(category?: string) {
  return ONLINE_ONLY_FEE_CATEGORIES.includes(String(category || ''));
}

export function FeeCatalog() {
  const [fees, setFees] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string; schedule?: boolean }[]>([]);
  const [scheduleCategories, setScheduleCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [feeForm, setFeeForm] = useState({
    name: '',
    description: '',
    category: 'sundry',
    amount: '',
    is_active: true,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/fees'),
      api.get('/api/fees/meta').catch(() => ({ data: { categories: [], schedule_categories: [] } })),
    ])
      .then(([feesRes, metaRes]) => {
        setFees(Array.isArray(feesRes.data) ? feesRes.data : feesRes.data?.data || []);
        setCategories(metaRes.data.categories || []);
        setScheduleCategories(metaRes.data.schedule_categories || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreateFee = () => {
    setEditingFee(null);
    setFeeForm({ name: '', description: '', category: 'tuition', amount: '', is_active: true });
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
  };

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

  const activeFees = fees.filter((f) => f.is_active !== false).length;
  const onlineFees = fees.filter((f) => isOnlineOnlyFee(f.category)).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Fee catalog"
        description="Define reusable school-fee lines. School charges are paid from the campus wallet. Only application and acceptance fees are paid online. Application fees are set per application session under Academic → Application sessions."
        icon={Wallet}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Fee items" value={fees.length} hint="Lines in the catalog" icon={List} />
        <StatCard label="Active" value={activeFees} hint="Available to invoice" icon={Wallet} tone="emerald" />
        <StatCard label="Online only" value={onlineFees} hint="Application and acceptance" icon={Wallet} tone="amber" />
      </div>

      <Card
        title="Fee items"
        description="Schedule categories (tuition, library, medical, …) are assigned per programme on Programme fees. Operational items (hostel, sundry, acceptance) are invoiced directly."
      >
        <div className="mb-4">
          <Btn className="!text-white" onClick={openCreateFee}>Add fee item</Btn>
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
                onChange={(e) => setFeeForm((s) => ({ ...s, category: e.target.value }))}
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
    </div>
  );
}
