import { useEffect, useState } from 'react';
import { message } from 'antd';
import { List, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';

function naira(value: number) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

const emptyForm = {
  name: '',
  description: '',
  amount: '',
  is_active: true,
};

export function SundryFees() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    api.get('/api/fees', { params: { category: 'sundry' } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setItems(list.filter((row: any) => row.category === 'sundry'));
      })
      .catch(() => message.error('Could not load sundry fees.'))
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
      amount: String(row.amount ?? ''),
      is_active: row.is_active !== false,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || form.amount === '') {
      message.error('Enter a name and amount.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: 'sundry',
        amount: Number(form.amount),
        is_active: form.is_active,
      };
      if (editing) {
        await api.patch(`/api/fees/${editing.id}`, payload);
        message.success('Sundry fee updated.');
      } else {
        await api.post('/api/fees', payload);
        message.success('Sundry fee created.');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not save sundry fee.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Remove sundry fee “${row.name}”?`)) return;
    try {
      await api.delete(`/api/fees/${row.id}`);
      message.success('Sundry fee removed.');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not remove sundry fee.');
    }
  };

  const activeItems = items.filter((row) => row.is_active !== false).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Sundry fees"
        description="Create miscellaneous charges such as transcript, identity card, late registration, and other one-off items. Invoice them from Generate invoice."
        icon={Wallet}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Items" value={items.length} hint="Sundry charges in the catalog" icon={List} />
        <StatCard label="Active" value={activeItems} hint="Available to invoice" icon={Wallet} tone="emerald" />
      </div>

      <Card
        title="Sundry items"
        description="These charges are paid from the campus wallet. They are not tied to a programme schedule."
        actions={<Btn className="!text-white" onClick={openCreate}>Add sundry item</Btn>}
      >
        <DataTable
          empty={!items.length}
          emptyMessage="No sundry fees yet. Add an item to get started."
          colSpan={5}
          loading={loading}
        >
          <thead>
            <tr>
              <th className={thClass}>Item</th>
              <th className={thClass}>Amount</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Payment</th>
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
                  <td className={tdClass}>{naira(Number(row.amount))}</td>
                  <td className={tdClass}>
                    <Badge variant={row.is_active === false ? 'default' : 'success'}>
                      {row.is_active === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </td>
                  <td className={tdClass}><Badge variant="success">Wallet</Badge></td>
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
            <h3 className="text-lg font-semibold text-slate-900">{editing ? 'Edit sundry item' : 'Add sundry item'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Transcript fee"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Amount (₦)</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                placeholder="0.00"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Description</span>
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Optional note shown on invoices"
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
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save item'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
