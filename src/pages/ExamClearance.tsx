import { useCallback, useEffect, useState } from 'react';
import { Drawer, Input, Select, Tag, message } from 'antd';
import { ClipboardList, Printer, Search } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, DataTable, StatCard, TablePager, WorkspaceHero, tdClass, thClass, trClass,
} from '../components/ui';

type CheckRow = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

type SummaryRow = {
  student_id: number;
  name: string;
  matric_number?: string | null;
  student_number?: string | null;
  program?: string | null;
  cleared: boolean;
  status: 'cleared' | 'not_cleared';
  failed: string[];
};

type Detail = {
  student: {
    id: number;
    name: string;
    matric_number?: string | null;
    student_number?: string | null;
    program?: string | null;
    current_level?: string | number | null;
  };
  cleared: boolean;
  status: string;
  checks: CheckRow[];
  term?: { name?: string; session_label?: string } | null;
};

export default function ExamClearance() {
  const { has } = useAuth();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0, from: null as number | null, to: null as number | null });
  const [selected, setSelected] = useState<SummaryRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async (nextPage = page, nextSearch = search, nextStatus = status) => {
    if (!has('exam_clearance.view')) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/exam-clearance/students', {
        params: {
          page: nextPage,
          search: nextSearch || undefined,
          status: nextStatus || undefined,
        },
      });
      setRows(data.data || []);
      setMeta({
        page: data.current_page || 1,
        lastPage: data.last_page || 1,
        total: data.total || 0,
        from: data.from ?? null,
        to: data.to ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, [has, page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row: SummaryRow) => {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/exam-clearance/students/${row.student_id}`);
      setDetail(data);
    } catch {
      message.error('Could not load clearance details.');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const printDetail = async () => {
    if (!selected) return;
    setPrinting(true);
    try {
      const { data } = await api.get(`/api/exam-clearance/students/${selected.student_id}`, {
        params: { format: 'html' },
        responseType: 'text',
        headers: { Accept: 'text/html' },
      });
      const html = typeof data === 'string' ? data : String(data);
      const popup = window.open('', '_blank');
      if (!popup) {
        message.error('Allow pop-ups to print exam clearance.');
        return;
      }
      popup.document.write(html);
      popup.document.close();
    } catch {
      message.error('Could not open exam clearance for printing.');
    } finally {
      setPrinting(false);
    }
  };

  const clearedCount = rows.filter((row) => row.cleared).length;
  const student = detail?.student;
  const termLabel = [detail?.term?.session_label, detail?.term?.name].filter(Boolean).join(' · ');

  if (!has('exam_clearance.view')) {
    return <p className="text-slate-500">You do not have access to exam clearance.</p>;
  }

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Academic"
        title="Exam clearance"
        description="See which students meet the exam-sitting conditions configured in Application settings."
        icon={ClipboardList}
      >
        <RefreshButton onClick={() => load()} loading={loading} />
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="In this list" value={meta.total} hint="Students returned by the current filter" icon={ClipboardList} />
        <StatCard label="Cleared on this page" value={clearedCount} hint="Passed every enabled check" icon={ClipboardList} tone="emerald" />
        <StatCard label="Not cleared" value={rows.length - clearedCount} hint="Failed one or more enabled checks" icon={ClipboardList} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          prefix={<Search size={14} className="text-slate-400" />}
          placeholder="Search name or matric"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onPressEnter={() => { setPage(1); setSearch(searchInput.trim()); }}
          allowClear
          className="max-w-xs"
        />
        <Select
          allowClear
          placeholder="Status"
          className="min-w-[160px]"
          value={status}
          onChange={(value) => { setPage(1); setStatus(value); }}
          options={[
            { value: 'cleared', label: 'Cleared' },
            { value: 'not_cleared', label: 'Not cleared' },
          ]}
        />
      </div>

      <DataTable empty={!rows.length} emptyMessage="No student clearance records." colSpan={5} loading={loading}>
        <thead>
          <tr>
            <th className={thClass}>Student</th>
            <th className={thClass}>Matric</th>
            <th className={thClass}>Programme</th>
            <th className={thClass}>Status</th>
            <th className={thClass}>Failed checks</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.student_id} className={`${trClass} cursor-pointer`} onClick={() => openDetail(row)}>
                <td className={tdClass}>
                  <div className="font-medium text-slate-800">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.student_number || '—'}</div>
                </td>
                <td className={tdClass}><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{row.matric_number || '—'}</code></td>
                <td className={tdClass}>{row.program || '—'}</td>
                <td className={tdClass}>
                  <Badge variant={row.cleared ? 'success' : 'warning'}>{row.cleared ? 'Cleared' : 'Not cleared'}</Badge>
                </td>
                <td className={tdClass}>
                  {row.failed?.length ? row.failed.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
      <TablePager
        page={meta.page}
        lastPage={meta.lastPage}
        total={meta.total}
        from={meta.from}
        to={meta.to}
        onChange={(next) => setPage(next)}
        disabled={loading}
      />

      <Drawer
        title={selected?.name || 'Exam clearance'}
        open={!!selected}
        onClose={closeDetail}
        width={520}
        destroyOnHidden
        extra={detail ? (
          <button
            type="button"
            onClick={printDetail}
            disabled={printing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Printer size={14} />
            Print
          </button>
        ) : null}
      >
        {detailLoading && <p className="text-sm text-slate-500">Loading clearance details…</p>}
        {detail && student && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                {student.matric_number || 'No matric'}
                {student.student_number ? ` · ${student.student_number}` : ''}
              </p>
              <p className="text-sm text-slate-600">{student.program || 'No programme'}</p>
              {student.current_level != null && student.current_level !== '' && (
                <p className="text-sm text-slate-600">Level {student.current_level}</p>
              )}
              {termLabel && <p className="text-sm text-slate-500 mt-1">{termLabel}</p>}
            </div>
            <Tag color={detail.cleared ? 'success' : 'warning'}>
              {detail.cleared ? 'Cleared to sit exams' : 'Not cleared'}
            </Tag>
            <ul className="space-y-2">
              {(detail.checks || []).map((check) => (
                <li key={check.key} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">{check.label}</span>
                    <Badge variant={check.passed ? 'success' : 'warning'}>{check.passed ? 'Passed' : 'Failed'}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{check.detail}</p>
                </li>
              ))}
            </ul>
            {(detail.checks || []).length === 0 && (
              <p className="text-sm text-slate-500">No exam-clearance conditions are currently enabled.</p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
