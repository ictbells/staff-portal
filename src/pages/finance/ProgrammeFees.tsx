import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { BookOpen, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';

export function ProgrammeFees() {
  const [fees, setFees] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string; schedule?: boolean }[]>([]);
  const [scheduleCategories, setScheduleCategories] = useState<string[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [programmeFees, setProgrammeFees] = useState<any[]>([]);
  const [programmeFeeTotal, setProgrammeFeeTotal] = useState<number | null>(null);
  const [pfProgramId, setPfProgramId] = useState<number | undefined>();
  const [pfLevel, setPfLevel] = useState('all');
  const [pfSemester, setPfSemester] = useState('both');
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pfModalOpen, setPfModalOpen] = useState(false);
  const [editingPf, setEditingPf] = useState<any | null>(null);
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
      api.get('/api/fees/meta').catch(() => ({ data: { categories: [], schedule_categories: [] } })),
      api.get('/api/programs').catch(() => ({ data: [] })),
    ])
      .then(([feesRes, metaRes, programsRes]) => {
        setFees(Array.isArray(feesRes.data) ? feesRes.data : feesRes.data?.data || []);
        setCategories(metaRes.data.categories || []);
        setScheduleCategories(metaRes.data.schedule_categories || []);
        const progList = programsRes.data?.data || programsRes.data || [];
        setPrograms(Array.isArray(progList) ? progList : []);
      })
      .finally(() => setLoading(false));
  };

  const loadProgrammeFees = (programId?: number, level = pfLevel, semester = pfSemester) => {
    if (!programId) {
      setProgrammeFees([]);
      setProgrammeFeeTotal(null);
      setScheduleLoading(false);
      return;
    }
    setScheduleLoading(true);
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
    }).finally(() => setScheduleLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    loadProgrammeFees(pfProgramId, pfLevel, pfSemester);
  }, [pfProgramId, pfLevel, pfSemester]);

  const scheduleFeeItems = fees.filter(
    (f) => f.is_active !== false && (
      scheduleCategories.includes(f.category)
      || f.category === 'tuition'
      || categories.find((c) => c.value === f.category)?.schedule
    ),
  );

  const openCreate = () => {
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

  const openEdit = (row: any) => {
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

  const saveLine = async () => {
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

  const removeLine = async (row: any) => {
    const label = row.fee_item?.name || 'fee line';
    if (!window.confirm(`Remove “${label}” from this programme schedule?`)) return;
    await api.delete(`/api/programme-fees/${row.id}`);
    loadProgrammeFees(pfProgramId);
    load();
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Programme fees"
        description="Assign catalog school-fee lines to a programme (optional level and semester). Leave amount blank to use the catalog default. The total drives tuition invoices and installments."
        icon={Wallet}
      >
        <RefreshButton onClick={() => { load(); loadProgrammeFees(pfProgramId); }} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Programmes" value={programs.length} hint="Available to schedule" icon={BookOpen} />
        <StatCard label="Fee lines" value={programmeFees.length} hint="On the selected programme" icon={Wallet} />
      </div>

      <Card title="Programme schedule">
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
          <Btn className="!text-white" onClick={openCreate} disabled={!pfProgramId}>Add line</Btn>
          {programmeFeeTotal != null && (
            <div className="text-sm font-medium text-slate-800 ml-auto">
              Schedule total: ₦{programmeFeeTotal.toLocaleString()}
            </div>
          )}
        </div>
        <DataTable
          empty={!pfProgramId || !programmeFees.length}
          emptyMessage={pfProgramId ? 'No fee lines for this programme yet. Add tuition (and other schedule items) here.' : 'Select a programme to manage its fee schedule.'}
          colSpan={7}
          loading={scheduleLoading}
          loadingLabel="Loading schedule…"
        >
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
                      <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openEdit(row)}>Edit</button>
                      <button type="button" className="text-sm text-rose-600 hover:underline" onClick={() => removeLine(row)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>

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
              <Btn onClick={saveLine} disabled={saving || !pfForm.fee_item_id}>{saving ? 'Saving…' : 'Save'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
