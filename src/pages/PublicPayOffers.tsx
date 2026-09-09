import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Input, InputNumber, Select, Switch, message } from 'antd';
import api from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, Spinner, WorkspaceHero, fieldLabelClass, tdClass, thClass, trClass,
} from '../components/ui';
import { formatNaira } from '../lib/money';

type FeeOption = {
  id: number;
  name: string;
  category: string;
  amount: number;
  is_active: boolean;
};

type Offer = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  instructions?: string | null;
  is_active: boolean;
  display_order: number;
  publicly_available: boolean;
  fee_item_id: number;
  fee?: { id: number; name: string; category: string; amount: number; is_active: boolean } | null;
};

const emptyForm = {
  name: '',
  description: '',
  instructions: '',
  fee_item_id: undefined as number | undefined,
  is_active: true,
  display_order: 0,
};

export default function PublicPayOffers() {
  const { has } = useAuth();
  const canManage = has('public_pay.offers');
  const [rows, setRows] = useState<Offer[]>([]);
  const [fees, setFees] = useState<FeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const [offersRes, feesRes] = await Promise.all([
        api.get('/api/staff/public-pay/offers'),
        api.get('/api/fees', { params: { active: 1 } }),
      ]);
      setRows(offersRes.data.data || []);
      setFees((Array.isArray(feesRes.data) ? feesRes.data : feesRes.data.data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        amount: Number(f.amount),
        is_active: f.is_active !== false,
      })));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not load offerings');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
  }

  function startEdit(offer: Offer) {
    setEditing(offer);
    setForm({
      name: offer.name,
      description: offer.description || '',
      instructions: offer.instructions || '',
      fee_item_id: offer.fee_item_id,
      is_active: offer.is_active,
      display_order: offer.display_order,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.fee_item_id) {
      message.error('Name and fee item are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        fee_item_id: form.fee_item_id,
        is_active: form.is_active,
        display_order: form.display_order,
      };
      if (editing) {
        await api.put(`/api/staff/public-pay/offers/${editing.id}`, payload);
        message.success('Offer updated');
      } else {
        await api.post('/api/staff/public-pay/offers', payload);
        message.success('Offer created');
      }
      setEditing(null);
      setForm(emptyForm);
      void load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not save offer');
    } finally {
      setSaving(false);
    }
  }

  async function remove(offer: Offer) {
    if (!window.confirm(`Delete “${offer.name}”? Deactivate instead if there are open requests.`)) return;
    try {
      await api.delete(`/api/staff/public-pay/offers/${offer.id}`);
      message.success('Offer deleted');
      void load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not delete');
    }
  }

  if (!canManage) {
    return <AccessDeniedPanel reason="missing_permission" resourceLabel="Public pay offerings" />;
  }

  return (
    <div className="space-y-4">
      <WorkspaceHero
        title="Public pay offerings"
        description="Define what alumni and students can request and pay for outside portal login. Each offer links to a fee catalog item."
      >
        <RefreshButton onClick={() => void load()} loading={loading} />
      </WorkspaceHero>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={editing ? `Edit: ${editing.name}` : 'New offering'}>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <label className={fieldLabelClass}>Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className={fieldLabelClass}>Fee item</label>
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                value={form.fee_item_id}
                onChange={(v) => setForm((f) => ({ ...f, fee_item_id: v }))}
                options={fees.map((fee) => ({
                  value: fee.id,
                  label: `${fee.name} (${fee.category}) — ${formatNaira(fee.amount)}`,
                }))}
                placeholder="Select fee item"
              />
            </div>
            <div>
              <label className={fieldLabelClass}>Description</label>
              <Input.TextArea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className={fieldLabelClass}>Instructions (shown on public form)</label>
              <Input.TextArea value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))} />
              <span className="text-sm text-slate-700">Active on public page</span>
            </div>
            <div>
              <label className={fieldLabelClass}>Display order</label>
              <InputNumber className="w-full" min={0} value={form.display_order} onChange={(v) => setForm((f) => ({ ...f, display_order: Number(v || 0) }))} />
            </div>
            <div className="flex gap-2">
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create offer'}</Btn>
              {editing ? <Btn type="button" onClick={startCreate}>Cancel</Btn> : null}
            </div>
          </form>
        </Card>

        <Card title="Current offerings">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <DataTable>
              <thead>
                <tr className={trClass}>
                  <th className={thClass}>Offer</th>
                  <th className={thClass}>Fee</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.slug}</div>
                    </td>
                    <td className={tdClass}>
                      {row.fee ? (
                        <>
                          <div>{row.fee.name}</div>
                          <div className="text-xs text-slate-500">{formatNaira(row.fee.amount)} · {row.fee.category}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className={tdClass}>
                      <Badge variant={row.publicly_available ? 'success' : row.is_active ? 'warning' : 'default'}>
                        {row.publicly_available ? 'Public' : row.is_active ? 'Inactive fee' : 'Off'}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <div className="flex gap-2">
                        <Btn type="button" size="sm" onClick={() => startEdit(row)}>Edit</Btn>
                        <Btn type="button" size="sm" onClick={() => void remove(row)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr className={trClass}><td className={tdClass} colSpan={4}>No offerings yet.</td></tr>
                ) : null}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
