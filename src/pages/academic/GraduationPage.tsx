import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { GraduationCap } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';

type Candidate = {
  id: number;
  first_name: string;
  last_name: string;
  matric_number?: string | null;
  current_level: number;
  final_level?: number | null;
  status: string;
  program?: { id: number; name: string; code?: string };
};

type SessionRow = { id: number; label: string; is_closed?: boolean };
type ProgramRow = { id: number; name: string; code?: string };
type CampusRow = { id: number; name: string };

export function GraduationPage() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [programId, setProgramId] = useState<number | undefined>();
  const [campusId, setCampusId] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [selected, setSelected] = useState<number[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [conferOpen, setConferOpen] = useState(false);
  const [conferDate, setConferDate] = useState<Dayjs | null>(dayjs());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/api/academic/sessions').then(({ data }) => {
      const list = Array.isArray(data) ? data : data.data ?? [];
      setSessions(list);
    }).catch(() => undefined);
    api.get('/api/academic/programs').then(({ data }) => {
      const list = Array.isArray(data) ? data : data.data ?? [];
      setPrograms(list);
    }).catch(() => undefined);
    api.get('/api/academic/campuses').then(({ data }) => {
      const list = Array.isArray(data) ? data : data.data ?? [];
      setCampuses(list);
    }).catch(() => undefined);
  }, []);

  const load = useCallback(async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/academic/graduation/candidates', {
        params: {
          search: search || undefined,
          program_id: programId,
          campus_id: campusId,
          page,
          per_page: pageSize,
        },
      });
      setRows(Array.isArray(data) ? data : data.data ?? []);
      setPagination({
        current: data.current_page ?? page,
        pageSize: data.per_page ?? pageSize,
        total: data.total ?? 0,
      });
    } catch {
      message.error('Unable to load graduation candidates.');
    } finally {
      setLoading(false);
    }
  }, [campusId, pagination.pageSize, programId, search]);

  useEffect(() => { load(1); }, [load]);

  const programOptions = useMemo(
    () => programs.map((p) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name })),
    [programs],
  );

  const columns: ColumnsType<Candidate> = [
    { title: 'Name', key: 'name', render: (_, r) => `${r.last_name}, ${r.first_name}` },
    { title: 'Matric no.', dataIndex: 'matric_number', width: 150, render: (v) => v || '—' },
    { title: 'Programme', key: 'program', render: (_, r) => r.program?.name || '—' },
    { title: 'Level', dataIndex: 'current_level', width: 90 },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <Tag>{v}</Tag> },
  ];

  const confirmConfer = async () => {
    if (!conferDate || selected.length === 0) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/academic/graduation/confer', {
        student_ids: selected,
        graduated_at: conferDate.format('YYYY-MM-DD'),
        academic_session_id: sessionId,
        require_final_year: true,
      });
      if (data?.status === 'pending_approval') {
        message.info('Graduation is waiting for office approval.');
      } else {
        message.success(`Conferred ${data.conferred_count ?? selected.length} student(s). Studentship ends ${data.studentship_expires_at || ''}.`);
      }
      setConferOpen(false);
      setSelected([]);
      load(pagination.current);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      message.error(msg?.errors?.student_ids?.[0] || msg?.message || 'Could not confirm graduation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <WorkspaceHero
        eyebrow="Admission Setup"
        title="Graduation"
        description="Confirm conferment for final-year students. Studentship continues for the configured years, then the student portal is locked."
        icon={GraduationCap}
      >
        <div className="flex gap-2">
          <RefreshButton onClick={() => load(pagination.current)} loading={loading} />
          <Button type="primary" disabled={!selected.length} onClick={() => setConferOpen(true)}>
            Confirm graduation ({selected.length})
          </Button>
        </div>
      </WorkspaceHero>

      <Alert
        type="info"
        showIcon
        message="Session close only promotes levels. Use this page to record graduation after senate conferment."
      />

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Final-year candidates" value={pagination.total} hint="Active students at programme final level" icon={GraduationCap} />
        <StatCard label="Selected" value={selected.length} hint="Will be conferred" icon={GraduationCap} tone="emerald" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100">
          <Input.Search
            allowClear
            placeholder="Search name or matric"
            className="w-full sm:w-64"
            onSearch={(value) => setSearch(value)}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Programme"
            className="min-w-[220px]"
            value={programId}
            onChange={setProgramId}
            options={programOptions}
          />
          <Select
            allowClear
            placeholder="Campus"
            className="min-w-[160px]"
            value={campusId}
            onChange={setCampusId}
            options={campuses.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            allowClear
            placeholder="Graduating session (optional)"
            className="min-w-[200px]"
            value={sessionId}
            onChange={setSessionId}
            options={sessions.map((s) => ({ value: s.id, label: s.is_closed ? `${s.label} (closed)` : s.label }))}
          />
        </div>
        <Table<Candidate>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys.map((k) => Number(k))),
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => load(page, pageSize),
          }}
        />
      </div>

      <Modal
        title="Confirm graduation"
        open={conferOpen}
        onCancel={() => setConferOpen(false)}
        onOk={confirmConfer}
        okText="Confer selected students"
        confirmLoading={submitting}
        destroyOnClose
      >
        <p className="text-sm text-slate-600 mb-3">
          {selected.length} student(s) will be marked graduated. Studentship continues for the years set in Application settings, then the student portal is locked.
        </p>
        <Space direction="vertical" className="w-full">
          <span className="text-sm font-medium">Conferment date</span>
          <DatePicker className="w-full" value={conferDate} onChange={setConferDate} />
        </Space>
      </Modal>
    </div>
  );
}
