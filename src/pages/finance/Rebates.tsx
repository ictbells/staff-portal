import { useEffect, useState } from 'react';
import { message } from 'antd';
import { Percent, Wallet } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';

const emptyForm = {
  name: '',
  description: '',
  kind: 'percent' as 'percent' | 'amount',
  default_value: '',
  is_active: true,
};

export function Rebates() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    api.get('/api/rebate-types')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setItems(list);
      })
      .catch(() => message.error('Could not load rebate types.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      name: row.name || '',
      description: row.description || '',
      kind: row.kind === 'amount' ? 'amount' : 'percent',
      default_value: String(row.default_value ?? ''),
      is_active: row.is_active !== false,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || form.default_value === '') {
      message.error('Enter a name and default value.');
      return;
    }
    const value = Number(form.default_value);
    if (!Number.isFinite(value) || value <= 0) {
      message.error('Default value must be greater than zero.');
      return;
    }
    if (form.kind === 'percent' && value > 100) {
      message.error('A percentage rebate cannot exceed 100%.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        default_value: value,
        is_active: form.is_active,
      };
      const res = editing
        ? await api.patch(`/api/rebate-types/${editing.id}`, payload)
        : await api.post('/api/rebate-types', payload);
      if (!isPendingApproval(res)) {
        message.success(editing ? 'Rebate type updated.' : 'Rebate type created.');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not save rebate type.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Remove rebate type “${row.name}”?`)) return;
    try {
      const res = await api.delete(`/api/rebate-types/${row.id}`);
      if (!isPendingApproval(res)) {
        message.success('Rebate type removed.');
      }
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not remove rebate type.');
    }
  };

  const activeItems = items.filter((row) => row.is_active !== false).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Rebates"
        description="Define named bursary rebates such as staff-child or scholarship discounts. Apply them to unpaid wallet invoices from the Invoices page."
        icon={Percent}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Rebate types" value={items.length} hint="Named bursary discounts" icon={Percent} />
        <StatCard label="Active" value={activeItems} hint="Available to apply" icon={Wallet} tone="emerald" />
      </div>

      <Card
        title="Rebate types"
        description="Percentage and fixed naira reductions. The original billed amount stays on the invoice; only the amount due falls."
        actions={<Btn className="!text-white" onClick={openCreate}>Add rebate type</Btn>}
      >
        <DataTable
          empty={!items.length}
          emptyMessage="No rebate types yet. Add a type to get started."
          colSpan={5}
          loading={loading}
        >
          <thead>
            <tr>
              <th className={thClass}>Type</th>
              <th className={thClass}>Default</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Kind</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          {!items.length ? null : (
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>
                    <div>{row.name}</div>
                    {row.description && <div className="text-xs text-slate-500">{row.description}</div>}
                  </td>
                  <td className={tdClass}>
                    {row.kind === 'percent' ? `${Number(row.default_value || 0)}%` : formatNaira(Number(row.default_value))}
                  </td>
                  <td className={tdClass}>
                    <Badge variant={row.is_active === false ? 'default' : 'success'}>
                      {row.is_active === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </td>
                  <td className={tdClass}>{row.kind === 'percent' ? 'Percent' : 'Amount'}</td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openEdit(row)}>Edit</button>
                      <button type="button" className="text-sm text-rose-600 hover:underline" onClick={() => remove(row)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{editing ? 'Edit rebate type' : 'Add rebate type'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Staff child"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Kind</span>
              <select
                className={inputClass}
                value={form.kind}
                onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as 'percent' | 'amount' }))}
              >
                <option value="percent">Percent of billed amount</option>
                <option value="amount">Fixed amount (₦)</option>
              </select>
            </label>
            <label className="block">
              <span className={fieldLabelClass}>{form.kind === 'percent' ? 'Default percent' : 'Default amount (₦)'}</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                max={form.kind === 'percent' ? 100 : undefined}
                value={form.default_value}
                onChange={(e) => setForm((s) => ({ ...s, default_value: e.target.value }))}
                placeholder={form.kind === 'percent' ? '20' : '0.00'}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Description</span>
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Optional note for bursary staff"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Btn>
              <Btn className="!text-white" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save type'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
