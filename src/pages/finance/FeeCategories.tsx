import { useEffect, useState } from 'react';
import { message } from 'antd';
import { List, Tag } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';

const emptyForm = {
  name: '',
  description: '',
  is_schedule: false,
  is_active: true,
};

export function FeeCategories() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    api.get('/api/fee-categories')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setItems(list);
      })
      .catch(() => message.error('Could not load fee categories.'))
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
      is_schedule: !!row.is_schedule,
      is_active: row.is_active !== false,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      message.error('Enter a category name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_schedule: form.is_schedule,
        is_active: form.is_active,
      };
      if (editing) {
        await api.patch(`/api/fee-categories/${editing.id}`, payload);
        message.success('Fee category updated.');
      } else {
        await api.post('/api/fee-categories', payload);
        message.success('Fee category created.');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not save fee category.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (row.is_system) {
      message.error('System fee categories cannot be deleted.');
      return;
    }
    if (!window.confirm(`Remove fee category “${row.name}”?`)) return;
    try {
      await api.delete(`/api/fee-categories/${row.id}`);
      message.success('Fee category removed.');
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not remove fee category.');
    }
  };

  const activeItems = items.filter((row) => row.is_active !== false).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Fee category"
        description="Define fee categories without amounts. These appear as Category options when you create items in Fee catalog."
        icon={Tag}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Categories" value={items.length} hint="Available in fee catalog" icon={List} />
        <StatCard label="Active" value={activeItems} hint="Shown when creating fees" icon={Tag} tone="emerald" />
      </div>

      <Card
        title="Fee categories"
        description="No amount is set here. Create fee amounts under Fee catalog and assign a category from this list."
        actions={<Btn className="!text-white" onClick={openCreate}>Add category</Btn>}
      >
        <DataTable
          empty={!items.length}
          emptyMessage="No fee categories yet. Add a category to use in the fee catalog."
          colSpan={5}
          loading={loading}
        >
          <thead>
            <tr>
              <th className={thClass}>Category</th>
              <th className={thClass}>Code</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Status</th>
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
                  <td className={tdClass}><code className="text-xs text-slate-600">{row.code}</code></td>
                  <td className={tdClass}>
                    <Badge variant={row.is_schedule ? 'success' : 'default'}>
                      {row.is_schedule ? 'Programme schedule' : 'Operational'}
                    </Badge>
                  </td>
                  <td className={tdClass}>
                    <Badge variant={row.is_active === false ? 'default' : 'success'}>
                      {row.is_active === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openEdit(row)}>Edit</button>
                      {!row.is_system && (
                        <button type="button" className="text-sm text-rose-600 hover:underline" onClick={() => remove(row)}>Remove</button>
                      )}
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
            <h3 className="text-lg font-semibold text-slate-900">{editing ? 'Edit fee category' : 'Add fee category'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Transcript"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Description</span>
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Optional note"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_schedule}
                onChange={(e) => setForm((s) => ({ ...s, is_schedule: e.target.checked }))}
              />
              Programme schedule category (assignable on Programme fees)
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
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save category'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
