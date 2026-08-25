import { useEffect, useState } from 'react';
import { List, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';
import { ENTRY_MODES } from '../academic/constants';

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
    entry_mode: '',
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
    setFeeForm({ name: '', description: '', category: 'tuition', entry_mode: '', amount: '', is_active: true });
    setFeeModalOpen(true);
  };

  const openEditFee = (fee: any) => {
    setEditingFee(fee);
    setFeeForm({
      name: fee.name || '',
      description: fee.description || '',
      category: fee.category || 'sundry',
      entry_mode: fee.entry_mode || '',
      amount: String(fee.amount ?? ''),
      is_active: fee.is_active !== false,
    });
    setFeeModalOpen(true);
  };

  const saveFee = async () => {
    if (!feeForm.name.trim() || feeForm.amount === '') return;
    if (feeForm.category === 'application_fee' && !feeForm.entry_mode) return;
    setSaving(true);
    try {
      const payload = {
        name: feeForm.name.trim(),
        description: feeForm.description.trim() || null,
        category: feeForm.category,
        entry_mode: feeForm.category === 'application_fee' ? (feeForm.entry_mode || null) : null,
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
        { value: 'application_fee', label: 'Application fee' },
        { value: 'other', label: 'Other' },
      ];

  const activeFees = fees.filter((f) => f.is_active !== false).length;
  const onlineFees = fees.filter((f) => isOnlineOnlyFee(f.category)).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Fee catalog"
        description="Define reusable school-fee lines with amounts. Categories come from Fee category. Create an application fee line for each entry mode (UTME, DE, JUPEB, Transfer, PG). School charges are paid from the campus wallet; application and acceptance fees are paid online."
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
        description="Pick a category from Fee category when creating a line. Application fees are per entry mode. Schedule categories are assigned per programme on Programme fees; operational categories are invoiced directly."
      >
        <div className="mb-4">
          <Btn className="!text-white" onClick={openCreateFee}>Add fee item</Btn>
        </div>
        <DataTable empty={!fees.length} emptyMessage="No fees configured." colSpan={8}>
          <thead>
            <tr>
              <th className={thClass}>Fee</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Entry mode</th>
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
                      {f.category === 'application_fee'
                        ? (ENTRY_MODES.find((mode) => mode.value === f.entry_mode)?.label || f.entry_mode || '—')
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
                onChange={(e) => setFeeForm((s) => ({ ...s, category: e.target.value }))}
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {categories.length === 0
                  ? 'No fee categories yet. Add them under Fees & payments → Fee category.'
                  : isOnlineOnlyFee(feeForm.category)
                    ? 'Application and acceptance fees are paid online. They cannot be paid from the wallet.'
                    : 'This charge is paid from the campus wallet after the student funds it.'}
              </p>
            </label>
            {feeForm.category === 'application_fee' && (
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
                <p className="mt-1 text-xs text-slate-500">Applicants in this category pay this amount. Create a separate line for each entry mode.</p>
              </label>
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
              <Btn onClick={saveFee} disabled={saving || (feeForm.category === 'application_fee' && !feeForm.entry_mode)}>{saving ? 'Saving…' : 'Save fee'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
