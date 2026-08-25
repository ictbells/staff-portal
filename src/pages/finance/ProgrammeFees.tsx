import { useEffect, useMemo, useState } from 'react';
import { Select, message } from 'antd';
import { BookOpen, Search, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: '300', label: '300' },
  { value: '400', label: '400' },
  { value: '500', label: '500' },
  { value: 'Y1', label: 'Y1' },
  { value: 'Y2', label: 'Y2' },
];

const SEMESTER_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
];

function naira(value?: number | string | null) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function apiMessage(err: unknown, fallback: string) {
  const ax = err as { response?: { data?: { message?: string } } };
  return ax.response?.data?.message || fallback;
}

type ProgrammeSummary = {
  id: number;
  name: string;
  code?: string | null;
  study_level?: string | null;
  is_active?: boolean;
  department?: { id: number; name: string } | null;
  faculty?: { id: number; name: string } | null;
  line_count: number;
  total_amount: number;
};

export function ProgrammeFees() {
  const [fees, setFees] = useState<any[]>([]);
  const [programOptions, setProgramOptions] = useState<{ id: number; name: string; code?: string | null }[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string; schedule?: boolean }[]>([]);
  const [scheduleCategories, setScheduleCategories] = useState<string[]>([]);
  const [rows, setRows] = useState<ProgrammeSummary[]>([]);
  const [faculties, setFaculties] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string; faculty_id?: number }[]>([]);
  const [meta, setMeta] = useState({ programmes: 0, with_schedule: 0, without_schedule: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [facultyId, setFacultyId] = useState<number | undefined>();
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [studyLevel, setStudyLevel] = useState<string | undefined>();
  const [scheduled, setScheduled] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detail, setDetail] = useState<ProgrammeSummary | null>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);
  const [detailTotal, setDetailTotal] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingLine, setEditingLine] = useState<any | null>(null);
  const [assignForm, setAssignForm] = useState({
    program_id: undefined as number | undefined,
    fee_item_ids: [] as number[],
    amount: '',
    level_code: 'all',
    semester: 'both',
    is_active: true,
  });

  const scheduleFeeItems = useMemo(() => fees.filter(
    (f) => f.is_active !== false && (
      scheduleCategories.includes(f.category)
      || f.category === 'tuition'
      || categories.find((c) => c.value === f.category)?.schedule
    ),
  ), [fees, scheduleCategories, categories]);

  const assignProgramOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code?: string | null }>();
    for (const p of programOptions) map.set(p.id, p);
    for (const p of rows) map.set(p.id, p);
    if (detail) map.set(detail.id, detail);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [programOptions, rows, detail]);

  const loadCatalog = () => {
    Promise.all([
      api.get('/api/fees'),
      api.get('/api/fees/meta').catch(() => ({ data: { categories: [], schedule_categories: [] } })),
      api.get('/api/programs').catch(() => ({ data: [] })),
    ]).then(([feesRes, metaRes, programsRes]) => {
      setFees(Array.isArray(feesRes.data) ? feesRes.data : feesRes.data?.data || []);
      setCategories(metaRes.data.categories || []);
      setScheduleCategories(metaRes.data.schedule_categories || []);
      const progList = programsRes.data?.data || programsRes.data || [];
      setProgramOptions(Array.isArray(progList) ? progList : []);
    }).catch(() => {
      setFees([]);
    });
  };

  const loadSummaries = () => {
    setLoading(true);
    api.get('/api/programme-fees/summaries', {
      params: {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(facultyId ? { faculty_id: facultyId } : {}),
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(studyLevel ? { study_level: studyLevel } : {}),
        ...(scheduled !== 'all' ? { scheduled } : {}),
      },
    }).then((r) => {
      setRows(r.data.data || []);
      setMeta(r.data.meta || { programmes: 0, with_schedule: 0, without_schedule: 0 });
      setFaculties(r.data.filters?.faculties || []);
      setDepartments(r.data.filters?.departments || []);
    }).catch((err) => {
      setRows([]);
      message.error(apiMessage(err, 'Could not load programme fees.'));
    }).finally(() => setLoading(false));
  };

  const loadDetail = (program: ProgrammeSummary) => {
    setDetail(program);
    setDetailLoading(true);
    api.get(`/api/programme-fees/program/${program.id}`)
      .then((r) => {
        setDetailLines(r.data.data || []);
        setDetailTotal(r.data.total_amount != null ? Number(r.data.total_amount) : null);
      })
      .catch((err) => {
        setDetailLines([]);
        setDetailTotal(null);
        message.error(apiMessage(err, 'Could not load the fee breakdown.'));
      })
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { loadSummaries(); }, [search, facultyId, departmentId, studyLevel, scheduled]);

  const openAssign = (program?: ProgrammeSummary, line?: any) => {
    setEditingLine(line || null);
    setAssignForm({
      program_id: program?.id ?? detail?.id,
      fee_item_ids: line?.fee_item_id ? [line.fee_item_id] : [],
      amount: line?.amount != null ? String(line.amount) : '',
      level_code: line?.level_code || 'all',
      semester: line?.semester || 'both',
      is_active: line ? line.is_active !== false : true,
    });
    setAssignOpen(true);
  };

  const saveAssign = async () => {
    if (!assignForm.program_id || assignForm.fee_item_ids.length === 0) return;
    setSaving(true);
    try {
      if (editingLine) {
        await api.patch(`/api/programme-fees/${editingLine.id}`, {
          program_id: assignForm.program_id,
          fee_item_id: assignForm.fee_item_ids[0],
          amount: assignForm.amount === '' ? null : Number(assignForm.amount),
          level_code: assignForm.level_code || 'all',
          semester: assignForm.semester || 'both',
          is_active: assignForm.is_active,
        });
      } else {
        await api.post('/api/programme-fees/bulk', {
          program_id: assignForm.program_id,
          level_code: assignForm.level_code || 'all',
          semester: assignForm.semester || 'both',
          items: assignForm.fee_item_ids.map((id) => ({
            fee_item_id: id,
            amount: assignForm.amount === '' ? null : Number(assignForm.amount),
            is_active: assignForm.is_active,
          })),
        });
      }
      message.success(editingLine ? 'Fee line updated.' : 'Fees assigned to programme.');
      setAssignOpen(false);
      loadSummaries();
      loadCatalog();
      if (detail && detail.id === assignForm.program_id) {
        loadDetail(detail);
      }
    } catch (err) {
      message.error(apiMessage(err, 'Could not save programme fees.'));
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (row: any) => {
    const label = row.fee_item?.name || 'fee line';
    if (!window.confirm(`Remove “${label}” from this programme schedule?`)) return;
    try {
      await api.delete(`/api/programme-fees/${row.id}`);
      loadSummaries();
      if (detail) loadDetail(detail);
    } catch (err) {
      message.error(apiMessage(err, 'Could not remove this fee line.'));
    }
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero
        title="Programme fees"
        description="Assign catalog school fees to programmes. View a programme to see the full breakdown."
      >
        <RefreshButton onClick={() => { loadCatalog(); loadSummaries(); if (detail) loadDetail(detail); }} loading={loading} />
        <Btn className="!text-white" onClick={() => openAssign()}>Assign fees</Btn>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Programmes" value={meta.programmes} hint="Matching current filters" icon={BookOpen} />
        <StatCard label="With schedule" value={meta.with_schedule} hint="At least one fee line" icon={Wallet} />
        <StatCard label="Not set" value={meta.without_schedule} hint="No programme fee lines yet" />
      </div>

      <Card title="Programmes" description="Filter the list, then open details to review or edit the breakdown.">
        <form
          className="flex flex-wrap gap-3 items-end mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <label className="block min-w-[220px] flex-1">
            <span className={fieldLabelClass}>Search</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Programme name or code"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>College</span>
            <Select
              allowClear
              className="w-full"
              placeholder="All colleges"
              value={facultyId}
              onChange={(v) => { setFacultyId(v); setDepartmentId(undefined); }}
              options={faculties.map((f) => ({ value: f.id, label: f.name }))}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>Department</span>
            <Select
              allowClear
              className="w-full"
              placeholder="All departments"
              value={departmentId}
              onChange={setDepartmentId}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </label>
          <label className="block min-w-[160px]">
            <span className={fieldLabelClass}>Study level</span>
            <Select
              allowClear
              className="w-full"
              placeholder="All"
              value={studyLevel}
              onChange={setStudyLevel}
              options={[
                { value: 'undergraduate', label: 'Undergraduate' },
                { value: 'postgraduate', label: 'Postgraduate' },
              ]}
            />
          </label>
          <label className="block min-w-[160px]">
            <span className={fieldLabelClass}>Schedule</span>
            <Select
              className="w-full"
              value={scheduled}
              onChange={setScheduled}
              options={[
                { value: 'all', label: 'All programmes' },
                { value: 'yes', label: 'Fees set' },
                { value: 'no', label: 'Not set' },
              ]}
            />
          </label>
          <Btn type="submit" className="!text-white">Apply</Btn>
        </form>
        <DataTable
          empty={!rows.length}
          emptyMessage="No programmes match these filters."
          colSpan={7}
          loading={loading}
          loadingLabel="Loading programmes…"
        >
          <thead>
            <tr>
              <th className={thClass}>Programme</th>
              <th className={thClass}>College</th>
              <th className={thClass}>Department</th>
              <th className={thClass}>Level</th>
              <th className={thClass}>Fee lines</th>
              <th className={thClass}>Schedule total</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          {!rows.length ? null : (
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>
                    <div>{row.name}</div>
                    {row.code && <div className="text-xs text-slate-500 font-mono">{row.code}</div>}
                  </td>
                  <td className={tdClass}>{row.faculty?.name || '—'}</td>
                  <td className={tdClass}>{row.department?.name || '—'}</td>
                  <td className={tdClass}>
                    <Badge variant={row.study_level === 'postgraduate' ? 'purple' : 'info'}>
                      {row.study_level || '—'}
                    </Badge>
                  </td>
                  <td className={tdClass}>
                    {row.line_count > 0 ? (
                      <Badge variant="success">{row.line_count} set</Badge>
                    ) : (
                      <Badge>Not set</Badge>
                    )}
                  </td>
                  <td className={`${tdClass} font-medium`}>{row.line_count > 0 ? naira(row.total_amount) : '—'}</td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => loadDetail(row)}>
                        View details
                      </button>
                      <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openAssign(row)}>
                        Assign fees
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
      </Card>

      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Fee breakdown</p>
                <h3 className="text-lg font-semibold text-slate-900">{detail.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {[detail.code, detail.faculty?.name, detail.department?.name].filter(Boolean).join(' · ') || 'Programme schedule'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Btn className="!text-white" onClick={() => openAssign(detail)}>Assign fees</Btn>
                <Btn variant="secondary" onClick={() => setDetail(null)}>Close</Btn>
              </div>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              {detailTotal != null && (
                <p className="text-sm font-medium text-slate-800 mb-3">Schedule total: {naira(detailTotal)}</p>
              )}
              <DataTable
                empty={!detailLines.length}
                emptyMessage="No fee lines on this programme yet."
                colSpan={6}
                loading={detailLoading}
                loadingLabel="Loading breakdown…"
              >
                <thead>
                  <tr>
                    <th className={thClass}>Fee item</th>
                    <th className={thClass}>Level</th>
                    <th className={thClass}>Semester</th>
                    <th className={thClass}>Override</th>
                    <th className={thClass}>Effective</th>
                    <th className={thClass}>Actions</th>
                  </tr>
                </thead>
                {!detailLines.length ? null : (
                  <tbody>
                    {detailLines.map((line) => (
                      <tr key={line.id} className={trClass}>
                        <td className={`${tdClass} font-medium`}>
                          <div>{line.fee_item?.name || '—'}</div>
                          <div className="text-xs text-slate-500">{(line.fee_item?.category || '').replaceAll('_', ' ')}</div>
                        </td>
                        <td className={tdClass}>{line.level_code || 'all'}</td>
                        <td className={tdClass}>{line.semester || 'both'}</td>
                        <td className={tdClass}>{line.amount != null ? naira(line.amount) : 'Catalog default'}</td>
                        <td className={`${tdClass} font-medium`}>{naira(line.effective_amount)}</td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => openAssign(detail, line)}>Edit</button>
                            <button type="button" className="text-sm text-rose-600 hover:underline" onClick={() => removeLine(line)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </DataTable>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{editingLine ? 'Edit programme fee' : 'Assign fees to programme'}</h3>
            <label className="block">
              <span className={fieldLabelClass}>Programme</span>
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                placeholder="Select programme"
                value={assignForm.program_id}
                disabled={!!editingLine}
                onChange={(v) => setAssignForm((s) => ({ ...s, program_id: v }))}
                options={assignProgramOptions.map((p) => ({
                  value: p.id,
                  label: p.code ? `${p.name} (${p.code})` : p.name,
                }))}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Fee item{editingLine ? '' : 's'}</span>
              <Select
                className="w-full"
                mode={editingLine ? undefined : 'multiple'}
                showSearch
                optionFilterProp="label"
                placeholder={editingLine ? 'Select catalog item' : 'Select one or more catalog items'}
                value={editingLine ? assignForm.fee_item_ids[0] : assignForm.fee_item_ids}
                disabled={!!editingLine}
                onChange={(v) => setAssignForm((s) => ({
                  ...s,
                  fee_item_ids: editingLine ? [v as number] : (v as number[]),
                }))}
                options={scheduleFeeItems.map((f) => ({
                  value: f.id,
                  label: `${f.name} (${naira(f.amount)})`,
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
                value={assignForm.amount}
                onChange={(e) => setAssignForm((s) => ({ ...s, amount: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Level</span>
              <Select
                className="w-full"
                value={assignForm.level_code}
                onChange={(v) => setAssignForm((s) => ({ ...s, level_code: v }))}
                options={LEVEL_OPTIONS}
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Semester</span>
              <Select
                className="w-full"
                value={assignForm.semester}
                onChange={(v) => setAssignForm((s) => ({ ...s, semester: v }))}
                options={SEMESTER_OPTIONS}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={assignForm.is_active} onChange={(e) => setAssignForm((s) => ({ ...s, is_active: e.target.checked }))} />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Btn>
              <Btn
                onClick={saveAssign}
                disabled={saving || !assignForm.program_id || assignForm.fee_item_ids.length === 0}
              >
                {saving ? 'Saving…' : 'Save'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
