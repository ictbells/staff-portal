import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  is_schedule: true,
  is_active: true,
};

function apiMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  const firstError = data?.errors && Object.values(data.errors).flat().find(Boolean);
  return firstError || data?.message || fallback;
}

export function FeeCategories() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    api.get('/api/fee-categories')
      .then((res) => {
        setRows(Array.isArray(res.data) ? res.data : res.data?.data || []);
      })
      .catch((err) => message.error(apiMessage(err, 'Could not load fee categories.')))
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
      const res = editing
        ? await api.patch(`/api/fee-categories/${editing.id}`, payload)
        : await api.post('/api/fee-categories', payload);
      if (res.status !== 202 && res.data?.status !== 'pending_approval') {
        message.success(editing ? 'Category updated.' : 'Category created.');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      message.error(apiMessage(err, 'Could not save category.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (row.is_system) {
      message.error('System fee categories cannot be deleted.');
      return;
    }
    if (!window.confirm(`Remove category “${row.name}”?`)) return;
    try {
      const res = await api.delete(`/api/fee-categories/${row.id}`);
      if (res.status !== 202 && res.data?.status !== 'pending_approval') {
        message.success('Category removed.');
      }
      load();
    } catch (err) {
      message.error(apiMessage(err, 'Could not remove category.'));
    }
  };

  const activeCount = rows.filter((row) => row.is_active !== false).length;
  const scheduleCount = rows.filter((row) => row.is_schedule).length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Fee categories"
        description="Types used when creating fee items. Mark Programme schedule for charges that belong on school fees / Programme fees. System categories cannot be deleted. Add priced lines on Fee items after the category exists."
        icon={Tag}
      >
        <Link
          to="/finance"
          className="inline-flex items-center justify-center rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
        >
          Fee items
        </Link>
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Categories" value={rows.length} hint={`${activeCount} active`} icon={Tag} />
        <StatCard label="Programme schedule" value={scheduleCount} hint="Assigned per programme" icon={List} />
        <StatCard label="Operational" value={rows.length - scheduleCount} hint="Invoiced directly" icon={Tag} />
      </div>

      <Card
        title="Categories"
        description="Add a category when a new school charge has no matching type, then create the fee item with an amount."
        actions={<Btn className="!text-white" onClick={openCreate}>Add category</Btn>}
      >
        <DataTable
          empty={!rows.length}
          emptyMessage="No categories yet. Add one before creating fee items."
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
          {!rows.length ? null : (
            <tbody>
              {rows.map((row) => (
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
            <h3 className="text-lg font-semibold text-slate-900">{editing ? 'Edit category' : 'Add category'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Accreditation levy"
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
              Programme schedule (shows on school fees / Programme fees)
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
