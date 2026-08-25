import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Upload, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClipboardList } from 'lucide-react';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import api from '../../api';
import { useAuth } from '../../auth';
import { SessionLevelFilters } from '../../components/SessionLevelFilters';

type Term = { id: number; name: string; session_label?: string; is_current?: boolean; academic_session_id?: number };
type Faculty = { id: number; name: string };
type Department = { id: number; name: string; faculty_id?: number };

function ResourceShell({
  title, description, loading, onRefresh, children, extra,
}: {
  title: string; description: string; loading: boolean; onRefresh: () => void;
  children: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <WorkspaceHero eyebrow="Results" title={title} description={description} icon={ClipboardList} />
      <div className="flex flex-wrap items-center gap-2">
        <RefreshButton loading={loading} onClick={onRefresh} />
        {extra}
      </div>
      {children}
    </div>
  );
}

function useTermsFaculties() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  useEffect(() => {
    api.get('/api/academic/terms').then((r) => setTerms(Array.isArray(r.data) ? r.data : r.data?.data || [])).catch(() => {});
    api.get('/api/academic/faculties').then((r) => setFaculties(Array.isArray(r.data) ? r.data : r.data?.data || [])).catch(() => {});
    api.get('/api/academic/departments').then((r) => setDepartments(Array.isArray(r.data) ? r.data : r.data?.data || [])).catch(() => {});
  }, []);
  return { terms, faculties, departments };
}

function openPrintable(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
  });
  qs.set('format', 'html');
  const token = sessionStorage.getItem('bells_token');
  const base = import.meta.env.VITE_API_URL || '';
  const url = `${base}${path}?${qs.toString()}`;
  fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/html' } })
    .then(async (res) => {
      if (!res.ok) throw new Error('Could not load printable list');
      const html = await res.text();
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    })
    .catch((e) => message.error(e.message || 'Printable list failed'));
}

export function ResultsDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/academic/results/dashboard')
      .then((r) => setData(r.data))
      .catch(() => message.error('Could not load dashboard'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const counts = data?.counts || {};
  return (
    <ResourceShell title="Results" description="Result processing overview by workflow status." loading={loading} onRefresh={load}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(counts).map(([status, total]) => (
          <StatCard key={status} label={String(status).replace(/_/g, ' ')} value={String(total)} icon={ClipboardList} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link to="/academic/results/students"><Button type="primary">Enter results</Button></Link>
        <Link to="/academic/results/approvals"><Button>Approvals</Button></Link>
        <Link to="/academic/results/release"><Button>Release</Button></Link>
      </div>
    </ResourceShell>
  );
}

export function ResultsStudentsPage() {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/academic/results/students', { params: { search, academic_session_id: sessionId, level } })
      .then((r) => setRows(r.data?.data || r.data || []))
      .catch(() => message.error('Could not search students'))
      .finally(() => setLoading(false));
  }, [search, sessionId, level]);
  useEffect(() => { load(); }, [load]);
  const columns: ColumnsType = [
    { title: 'Matric', dataIndex: 'matric_number' },
    { title: 'Name', render: (_, r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() },
    { title: 'Level', dataIndex: 'current_level' },
    { title: 'Programme', render: (_, r) => r.program?.name || '—' },
    {
      title: '',
      render: (_, r) => <Link to={`/academic/results/students/${r.id}`}><Button size="small">Open</Button></Link>,
    },
  ];
  return (
    <ResourceShell title="Result entry" description="Search students and enter CA/exam scores." loading={loading} onRefresh={load}
      extra={(
        <Space wrap>
          <SessionLevelFilters sessionId={sessionId} level={level} onSessionChange={setSessionId} onLevelChange={setLevel} />
          <Input.Search placeholder="Matric or name" allowClear onSearch={setSearch} style={{ width: 260 }} />
          <Button onClick={load}>Search</Button>
        </Space>
      )}
    >
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
    </ResourceShell>
  );
}

export function ResultsStudentDetailPage() {
  const { id } = useParams();
  const { has } = useAuth();
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [form] = Form.useForm();
  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/academic/results/students/${id}`)
      .then((r) => setPayload(r.data))
      .catch(() => message.error('Could not load student results'))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/api/academic/results/grades', values);
      message.success('Grade saved as draft');
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Save failed');
    }
  };

  const submitIds = async (ids: number[]) => {
    try {
      const res = await api.post('/api/academic/results/submit', { ids });
      message.success(`Submitted ${res.data?.updated ?? 0}`);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Submit failed');
    }
  };

  const grades = payload?.grades || [];
  const columns: ColumnsType = [
    { title: 'Course', render: (_, r) => r.enrollment?.offering?.course?.code },
    { title: 'Sitting', dataIndex: 'sitting' },
    { title: 'CA', dataIndex: 'ca_score' },
    { title: 'Exam', dataIndex: 'exam_score' },
    { title: 'Total', dataIndex: 'score' },
    { title: 'Letter', dataIndex: 'letter' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
    {
      title: '',
      render: (_, r) => (['draft', 'correction_required'].includes(r.status) && has('results.submit')
        ? <Button size="small" onClick={() => submitIds([r.id])}>Submit</Button>
        : null),
    },
  ];

  return (
    <ResourceShell
      title={payload?.student ? `${payload.student.matric_number} · ${payload.student.first_name} ${payload.student.last_name}` : 'Student results'}
      description="Enter scores for enrolled courses. Only draft/correction rows are editable."
      loading={loading}
      onRefresh={load}
      extra={<Link to="/academic/results/students"><Button>Back</Button></Link>}
    >
      {has('results.write') && (
        <Form form={form} layout="inline" className="mb-4 flex flex-wrap gap-2" onFinish={save}>
          <Form.Item name="enrollment_id" rules={[{ required: true }]} label="Enrollment ID">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="ca_score" label="CA"><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="exam_score" label="Exam"><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="score" label="Total"><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="sitting" initialValue="main" label="Sitting">
            <Select options={[{ value: 'main', label: 'Main' }, { value: 'supplementary', label: 'Supplementary' }]} style={{ width: 140 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Save draft</Button>
        </Form>
      )}
      <Alert type="info" showIcon className="mb-3" message="Use enrollment IDs from course registration context, or import via CSV." />
      <Table rowKey="id" loading={loading} dataSource={grades} columns={columns} pagination={false} />
    </ResourceShell>
  );
}

export function ResultsImportPage() {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [result, setResult] = useState<any>(null);
  useEffect(() => {
    api.get('/api/academic/offerings').then((r) => setOfferings(Array.isArray(r.data) ? r.data : r.data?.data || [])).catch(() => {});
  }, []);
  const run = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.post('/api/academic/results/import', values);
      setResult(res.data);
      message.success(`Import done: ${res.data.created} created, ${res.data.updated} updated`);
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Import failed');
    }
  };
  return (
    <ResourceShell title="CSV import" description="Import matric,score (or ca/exam columns) into draft grades." loading={false} onRefresh={() => {}}>
      <Form form={form} layout="vertical" className="max-w-xl" onFinish={run}>
        <Form.Item name="course_offering_id" label="Course offering" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={offerings.map((o) => ({
              value: o.id,
              label: `${o.course?.code || o.id} · ${o.term?.session_label || ''} ${o.term?.name || ''}`.trim(),
            }))}
          />
        </Form.Item>
        <Form.Item name="score_component" label="Score column maps to" initialValue="total">
          <Select options={[
            { value: 'total', label: 'Total' },
            { value: 'ca', label: 'CA' },
            { value: 'exam', label: 'Exam' },
          ]} />
        </Form.Item>
        <Form.Item name="csv" label="CSV text" rules={[{ required: true }]}>
          <Input.TextArea rows={10} placeholder={'matric,score\nBU/2020/001,72'} />
        </Form.Item>
        <Button type="primary" htmlType="submit">Import</Button>
      </Form>
      {result && (
        <Alert className="mt-4" type={result.errors?.length ? 'warning' : 'success'}
          message={`${result.created} created, ${result.updated} updated`}
          description={result.errors?.length ? result.errors.join('\n') : undefined}
        />
      )}
    </ResourceShell>
  );
}

export function ResultsApprovalsPage() {
  const { has } = useAuth();
  const { terms, faculties, departments } = useTermsFaculties();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [filters, setFilters] = useState<{ academic_term_id?: number; academic_session_id?: number; level?: string; status?: string; faculty_id?: number; department_id?: number }>({
    status: 'submitted',
  });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/academic/results/grades', { params: { ...filters, per_page: 100 } })
      .then((r) => setRows(r.data?.data || []))
      .catch(() => message.error('Could not load queue'))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const act = async (path: string, body: any) => {
    try {
      const res = await api.post(path, body);
      message.success(`Updated ${res.data?.updated ?? 0}`);
      if (res.data?.errors?.length) message.warning(res.data.errors.join('; '));
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Action failed');
    }
  };

  const columns: ColumnsType = [
    { title: 'Matric', render: (_, r) => r.enrollment?.student?.matric_number },
    { title: 'Course', render: (_, r) => r.enrollment?.offering?.course?.code },
    { title: 'Score', dataIndex: 'score' },
    { title: 'Letter', dataIndex: 'letter' },
    { title: 'Status', dataIndex: 'status' },
  ];

  return (
    <ResourceShell title="Approvals" description="Submit queue and faculty approve/return. Download printable lists." loading={loading} onRefresh={load}
      extra={(
        <Space wrap>
          <SessionLevelFilters
            sessionId={filters.academic_session_id}
            level={filters.level}
            onSessionChange={(v) => setFilters((f) => ({ ...f, academic_session_id: v }))}
            onLevelChange={(v) => setFilters((f) => ({ ...f, level: v }))}
          />
          <Select placeholder="Term" allowClear style={{ width: 180 }}
            options={terms.map((t) => ({ value: t.id, label: `${t.session_label || ''} ${t.name}`.trim() }))}
            onChange={(v) => setFilters((f) => ({ ...f, academic_term_id: v }))}
          />
          <Select placeholder="Status" style={{ width: 160 }} value={filters.status}
            options={['draft', 'submitted', 'board_ready', 'correction_required', 'board_cleared'].map((s) => ({ value: s, label: s }))}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          />
          {has('results.submit') && <Button onClick={() => act('/api/academic/results/submit', { ids: selected })} disabled={!selected.length}>Submit</Button>}
          {has('results.faculty_approve') && (
            <>
              <Button type="primary" onClick={() => act('/api/academic/results/faculty-approve', { ids: selected })} disabled={!selected.length}>Approve</Button>
              <Button danger onClick={() => act('/api/academic/results/faculty-return', { ids: selected, note: 'Returned for correction' })} disabled={!selected.length}>Return</Button>
            </>
          )}
          <Button onClick={() => openPrintable('/api/academic/results/reports/submission-list/department', {
            academic_term_id: filters.academic_term_id,
            department_id: filters.department_id,
            status: filters.status,
          })}>Print dept list</Button>
          <Button onClick={() => openPrintable('/api/academic/results/reports/submission-list/faculty', {
            academic_term_id: filters.academic_term_id,
            faculty_id: filters.faculty_id,
            status: filters.status,
          })}>Print faculty list</Button>
        </Space>
      )}
    >
      <Space className="mb-3" wrap>
        <Select placeholder="Faculty" allowClear style={{ width: 180 }}
          options={faculties.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(v) => setFilters((f) => ({ ...f, faculty_id: v }))}
        />
        <Select placeholder="Department" allowClear style={{ width: 180 }}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(v) => setFilters((f) => ({ ...f, department_id: v }))}
        />
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as number[]) }}
        pagination={false}
      />
    </ResourceShell>
  );
}

export function ResultsBoardPage() {
  const { terms, faculties, departments } = useTermsFaculties();
  const [form] = Form.useForm();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const termOptions = terms
    .filter((t) => !sessionId || t.academic_session_id === sessionId || !t.academic_session_id)
    .map((t) => ({ value: t.id, label: `${t.session_label || ''} ${t.name}`.trim() }));
  const run = async (path: string) => {
    try {
      const values = await form.validateFields();
      const res = await api.post(path, { ...values, level });
      message.success(`Updated ${res.data?.updated ?? 0}`);
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Board action failed');
    }
  };
  return (
    <ResourceShell title="Board" description="Clear board-ready results or request corrections. Print board lists." loading={false} onRefresh={() => {}}
      extra={<SessionLevelFilters sessionId={sessionId} level={level} onSessionChange={setSessionId} onLevelChange={setLevel} />}
    >
      <Form form={form} layout="vertical" className="max-w-lg">
        <Form.Item name="academic_term_id" label="Term" rules={[{ required: true }]}>
          <Select options={termOptions} />
        </Form.Item>
        <Form.Item name="faculty_id" label="Faculty">
          <Select allowClear options={faculties.map((f) => ({ value: f.id, label: f.name }))} />
        </Form.Item>
        <Form.Item name="department_id" label="Department">
          <Select allowClear options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        </Form.Item>
        <Form.Item name="note" label="Note"><Input.TextArea rows={2} /></Form.Item>
        <Space wrap>
          <Button type="primary" onClick={() => run('/api/academic/results/board-scopes/clear')}>Board clear</Button>
          <Button danger onClick={() => run('/api/academic/results/board-scopes/request-corrections')}>Request corrections</Button>
          <Button onClick={() => {
            const v = form.getFieldsValue();
            openPrintable('/api/academic/results/board-lists/faculty', {
              academic_term_id: v.academic_term_id,
              faculty_id: v.faculty_id,
              department_id: v.department_id,
              status: 'board_ready',
            });
          }}>Print board list</Button>
        </Space>
      </Form>
    </ResourceShell>
  );
}

export function ResultsReleasePage() {
  const { terms, faculties, departments } = useTermsFaculties();
  const [form] = Form.useForm();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const termOptions = terms
    .filter((t) => !sessionId || t.academic_session_id === sessionId || !t.academic_session_id)
    .map((t) => ({ value: t.id, label: `${t.session_label || ''} ${t.name}`.trim() }));
  const release = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.post('/api/academic/results/release', { ...values, level });
      if (res.data?.pending_approval) {
        message.info(res.data.message || 'Queued for office approval');
      } else {
        message.success(`Released ${res.data?.updated ?? 0}`);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Release failed');
    }
  };
  return (
    <ResourceShell title="Release results" description="Release board-cleared grades to the student portal." loading={false} onRefresh={() => {}}
      extra={<SessionLevelFilters sessionId={sessionId} level={level} onSessionChange={setSessionId} onLevelChange={setLevel} />}
    >
      <Form form={form} layout="vertical" className="max-w-lg" onFinish={release}>
        <Form.Item name="academic_term_id" label="Term" rules={[{ required: true }]}>
          <Select options={termOptions} />
        </Form.Item>
        <Form.Item name="faculty_id" label="Faculty">
          <Select allowClear options={faculties.map((f) => ({ value: f.id, label: f.name }))} />
        </Form.Item>
        <Form.Item name="department_id" label="Department">
          <Select allowClear options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        </Form.Item>
        <Button type="primary" htmlType="submit">Release</Button>
      </Form>
    </ResourceShell>
  );
}

export function ResultsGradingScalePage() {
  const [scale, setScale] = useState<any>(null);
  const [form] = Form.useForm();
  const load = () => {
    api.get('/api/academic/results/grading-scales').then((r) => {
      const list = Array.isArray(r.data) ? r.data : [];
      const def = list.find((s: any) => s.is_default) || list[0];
      setScale(def);
      if (def) {
        form.setFieldsValue({
          name: def.name,
          max_points: def.max_points,
          is_default: def.is_default,
          boundaries: def.boundaries || [],
        });
      }
    }).catch(() => message.error('Could not load scale'));
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!scale) return;
    try {
      const values = await form.validateFields();
      await api.put(`/api/academic/results/grading-scales/${scale.id}`, values);
      message.success('Grading scale updated');
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Save failed');
    }
  };
  return (
    <ResourceShell title="Grading scale" description="Review letter boundaries before first release." loading={false} onRefresh={load}>
      <Form form={form} layout="vertical" className="max-w-2xl" onFinish={save}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="max_points" label="Max points"><InputNumber min={1} max={10} step={0.1} /></Form.Item>
        <Form.List name="boundaries">
          {(fields) => (
            <div className="space-y-2">
              {fields.map((field) => (
                <Space key={field.key} align="start">
                  <Form.Item {...field} name={[field.name, 'letter']} rules={[{ required: true }]}><Input placeholder="Letter" style={{ width: 70 }} /></Form.Item>
                  <Form.Item {...field} name={[field.name, 'min_score']} rules={[{ required: true }]}><InputNumber placeholder="Min" /></Form.Item>
                  <Form.Item {...field} name={[field.name, 'max_score']} rules={[{ required: true }]}><InputNumber placeholder="Max" /></Form.Item>
                  <Form.Item {...field} name={[field.name, 'grade_point']} rules={[{ required: true }]}><InputNumber placeholder="Point" step={0.1} /></Form.Item>
                </Space>
              ))}
            </div>
          )}
        </Form.List>
        <Button type="primary" htmlType="submit" className="mt-3">Save scale</Button>
      </Form>
    </ResourceShell>
  );
}
