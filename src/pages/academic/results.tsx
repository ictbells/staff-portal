import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert, Button, Dropdown, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag, Tooltip, Upload, message,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import { ClipboardList, Download } from 'lucide-react';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import api, { isPendingApproval } from '../../api';
import { useAuth } from '../../auth';

type Term = {
  id: number;
  name: string;
  session_label?: string;
  is_current?: boolean;
  academic_session_id?: number;
  session?: { id?: number; label?: string };
};
type Faculty = { id: number; name: string };
type Department = { id: number; name: string; faculty_id?: number };
type LevelOption = { id: number; name: string; code?: string | null };

function academicSessionsFromTerms(terms: Term[]) {
  const map = new Map<number, { id: number; label: string; is_current: boolean }>();
  for (const term of terms) {
    const id = term.academic_session_id;
    if (!id) continue;
    const label = term.session?.label || term.session_label || '';
    if (!label) continue;
    const previous = map.get(id);
    map.set(id, {
      id,
      label: previous?.label || label,
      is_current: !!(previous?.is_current || term.is_current),
    });
  }
  return [...map.values()];
}

function semesterOptions(terms: Term[], sessionId?: number) {
  return terms
    .filter((term) => !sessionId || term.academic_session_id === sessionId)
    .map((term) => ({
      value: term.id,
      label: term.is_current ? `${term.name} (current)` : term.name,
    }));
}

function termInSession(terms: Term[], sessionId?: number, termId?: number) {
  if (!sessionId) return undefined;
  const current = terms.find((term) => term.id === termId && term.academic_session_id === sessionId);
  if (current) return current.id;
  return (
    terms.find((term) => term.academic_session_id === sessionId && term.is_current)?.id
    || terms.find((term) => term.academic_session_id === sessionId)?.id
  );
}

function CourseLevelFilter({
  levels,
  value,
  onChange,
}: {
  levels: LevelOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select
      allowClear
      placeholder="Level"
      style={{ width: 140 }}
      value={value}
      options={levels.map((level) => ({
        value: level.code || String(level.id),
        label: level.name || level.code || String(level.id),
      }))}
      onChange={onChange}
    />
  );
}

function AcademicSessionSemesterFilters({
  terms,
  sessionId,
  termId,
  onChange,
}: {
  terms: Term[];
  sessionId?: number;
  termId?: number;
  onChange: (next: { academic_session_id?: number; academic_term_id?: number }) => void;
}) {
  return (
    <>
      <Select
        allowClear
        placeholder="Session"
        style={{ width: 160 }}
        value={sessionId}
        options={academicSessionsFromTerms(terms).map((session) => ({
          value: session.id,
          label: session.is_current ? `${session.label} (current)` : session.label,
        }))}
        onChange={(value) => onChange({
          academic_session_id: value,
          academic_term_id: value ? termInSession(terms, value, termId) : undefined,
        })}
      />
      <Select
        allowClear
        placeholder="Semester"
        style={{ width: 160 }}
        value={termId}
        options={semesterOptions(terms, sessionId)}
        onChange={(value) => {
          const term = terms.find((row) => row.id === value);
          onChange({
            academic_term_id: value,
            academic_session_id: term?.academic_session_id ?? (value ? sessionId : undefined),
          });
        }}
      />
    </>
  );
}

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

function useResultsLookups() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  useEffect(() => {
    api.get('/api/academic/results/meta')
      .then((r) => {
        setTerms(r.data?.terms || []);
        setFaculties(r.data?.faculties || []);
        setDepartments(r.data?.departments || []);
        setLevels(r.data?.levels || []);
      })
      .catch(() => {});
  }, []);
  return { terms, faculties, departments, levels };
}

const QUEUE_PAGE_SIZE = 5000;

function gradeStudent(row: any) {
  return row?.student || row?.enrollment?.student || {};
}

function gradeCourse(row: any) {
  return row?.offering?.course || row?.enrollment?.offering?.course || row?.course || {};
}

function gradeDepartmentId(row: any): number | undefined {
  const id = row?.department_id
    || row?.offering?.course?.department_id
    || row?.enrollment?.offering?.course?.department_id;
  return id ? Number(id) : undefined;
}

function uniqueNumericId(values: Array<number | undefined>): number | undefined {
  const ids = [...new Set(values.filter((value): value is number => Number.isFinite(value)))];
  return ids.length === 1 ? ids[0] : undefined;
}

function departmentOptions(departments: Department[], facultyId?: number) {
  return departments
    .filter((d) => !facultyId || d.faculty_id === facultyId)
    .map((d) => ({ value: d.id, label: d.name }));
}

const letterColumn = {
  title: (
    <Tooltip title="Letter grade (A–F) from the total score and the university grading scale. Staff do not type this.">
      <span>Grade</span>
    </Tooltip>
  ),
  dataIndex: 'letter',
  width: 80,
  render: (value: string | null) => value || '—',
};

function listQuery(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value) !== ''),
  );
}

function openPrintable(path: string, params: Record<string, string | number | undefined>) {
  if (!params.academic_term_id) {
    message.warning('Choose a semester before printing.');
    return;
  }
  const popup = window.open('', '_blank');
  api.get(path, {
    params: listQuery({ ...params, format: 'html' }),
    responseType: 'text',
    headers: { Accept: 'text/html' },
  })
    .then((res) => {
      if (!popup) {
        message.warning('Allow pop-ups to view the printable list.');
        return;
      }
      popup.document.write(String(res.data || ''));
      popup.document.close();
    })
    .catch((e: any) => {
      popup?.close();
      const errors = e?.response?.data?.errors;
      message.error(
        errors
          ? Object.values(errors).flat().join(' ')
          : (e?.response?.data?.message || 'Could not load printable list'),
      );
    });
}

async function downloadSubmissionList(
  path: string,
  params: Record<string, string | number | undefined>,
  format: 'pdf' | 'doc',
  filename: string,
  extra?: { requireDepartment?: boolean; requireFaculty?: boolean },
) {
  if (!params.academic_term_id) {
    message.warning('Choose a semester before downloading.');
    return;
  }
  if (!params.level) {
    message.warning('Select a level to download the list.');
    return;
  }
  if (extra?.requireDepartment && !params.department_id) {
    message.warning('Select a department to download the department list.');
    return;
  }
  if (extra?.requireFaculty && !params.faculty_id) {
    message.warning('Select a faculty to download the faculty list.');
    return;
  }
  try {
    const { data } = await api.get(path, {
      params: listQuery({ ...params, format }),
      responseType: 'blob',
    });
    const blob = new Blob([data], {
      type: format === 'pdf' ? 'application/pdf' : 'application/msword',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${format === 'doc' ? 'doc' : 'pdf'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    const blob = e?.response?.data;
    if (blob instanceof Blob) {
      try {
        const parsed = JSON.parse(await blob.text());
        message.error(
          parsed.message
            || (parsed.errors ? Object.values(parsed.errors).flat().join(' ') : '')
            || 'Download failed',
        );
      } catch {
        message.error('Download failed');
      }
    } else {
      message.error(e?.response?.data?.message || 'Download failed');
    }
  }
}

function listDownloadItems(
  onPick: (format: 'pdf' | 'doc' | 'html') => void,
): MenuProps['items'] {
  return [
    { key: 'pdf', label: 'PDF', onClick: () => onPick('pdf') },
    { key: 'doc', label: 'MS Word (.doc)', onClick: () => onPick('doc') },
    { key: 'html', label: 'Print preview', onClick: () => onPick('html') },
  ];
}

export function ResultsDashboardPage() {
  const { has } = useAuth();
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
        <Link to="/academic/results/department"><Button>Department uploads</Button></Link>
        {(has('results.faculty_approve') || has('results.submit')) && (
          <Link to="/academic/results/approvals"><Button>Faculty Approval</Button></Link>
        )}
        {has('results.board') && <Link to="/academic/results/board"><Button>Board</Button></Link>}
        {has('results.release') && <Link to="/academic/results/release"><Button>Release</Button></Link>}
      </div>
    </ResourceShell>
  );
}

export function ResultsStudentsPage() {
  const { levels } = useResultsLookups();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string | undefined>();
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/academic/results/students', { params: { search, level } })
      .then((r) => setRows(r.data?.data || r.data || []))
      .catch(() => message.error('Could not search students'))
      .finally(() => setLoading(false));
  }, [search, level]);
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
          <CourseLevelFilter levels={levels} value={level} onChange={setLevel} />
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
  const { terms } = useResultsLookups();
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [termId, setTermId] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/academic/results/students/${id}`, { params: { academic_term_id: termId } })
      .then((r) => setPayload(r.data))
      .catch(() => message.error('Could not load student results'))
      .finally(() => setLoading(false));
  }, [id, termId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/api/academic/results/offerings', { params: { academic_term_id: termId } })
      .then((r) => setOfferings(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch(() => {});
  }, [termId]);

  const save = async () => {
    try {
      const values = await form.validateFields();
      const body = {
        student_id: Number(id),
        course_offering_id: values.course_offering_id,
        ca_score: values.ca_score,
        exam_score: values.exam_score,
        score: values.score,
        sitting: values.sitting || 'main',
      };
      const res = editingId
        ? await api.patch(`/api/academic/results/grades/${editingId}`, body)
        : await api.post('/api/academic/results/grades', body);
      if (!isPendingApproval(res)) {
        message.success(editingId ? 'Grade updated' : 'Grade saved as draft');
      }
      form.resetFields();
      setEditingId(null);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Save failed');
    }
  };

  const submitIds = async (ids: number[]) => {
    try {
      const res = await api.post('/api/academic/results/submit', { ids });
      if (!isPendingApproval(res)) {
        message.success(`Submitted ${res.data?.updated ?? 0}`);
      }
      if (res.data?.errors?.length) message.warning(res.data.errors.join('; '));
      setSelected([]);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Submit failed');
    }
  };

  const removeGrade = async (gradeId: number) => {
    try {
      const res = await api.delete(`/api/academic/results/grades/${gradeId}`);
      if (!isPendingApproval(res)) {
        message.success('Grade deleted');
      }
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Delete failed');
    }
  };

  const grades = payload?.grades || [];
  const columns: ColumnsType = [
    { title: 'Course', render: (_, r) => gradeCourse(r).code || '—' },
    { title: 'Sitting', dataIndex: 'sitting' },
    { title: 'CA', dataIndex: 'ca_score' },
    { title: 'Exam', dataIndex: 'exam_score' },
    { title: 'Total', dataIndex: 'score' },
    letterColumn,
    {
      title: 'Status',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tag>{String(r.status || '').replace(/_/g, ' ')}</Tag>
          {r.registration_held ? <Tag color="orange">Held</Tag> : null}
        </Space>
      ),
    },
    {
      title: '',
      render: (_, r) => {
        const editable = ['draft', 'correction_required'].includes(r.status);
        return (
          <Space size={4} wrap>
            {editable && has('results.write') && (
              <Button
                size="small"
                onClick={() => {
                  setEditingId(r.id);
                  form.setFieldsValue({
                    course_offering_id: r.course_offering_id || r.offering?.id || r.enrollment?.course_offering_id,
                    ca_score: r.ca_score,
                    exam_score: r.exam_score,
                    score: r.score,
                    sitting: r.sitting || 'main',
                  });
                }}
              >
                Edit
              </Button>
            )}
            {editable && has('results.write') && (
              <Button size="small" danger onClick={() => removeGrade(r.id)}>Delete</Button>
            )}
            {editable && has('results.submit') && (
              <Button size="small" onClick={() => submitIds([r.id])}>Submit</Button>
            )}
          </Space>
        );
      },
    },
  ];

  const transcriptRows = payload?.transcript?.rows || payload?.transcript?.terms?.flatMap((t: any) => t.rows) || [];
  const auditRows = payload?.audit || [];

  return (
    <ResourceShell
      title={payload?.student ? `${payload.student.matric_number} · ${payload.student.first_name} ${payload.student.last_name}` : 'Student results'}
      description="Enter CA/exam scores by course offering. Drafts can be saved before the student registers; held rows cannot be submitted until registration."
      loading={loading}
      onRefresh={load}
      extra={(
        <Space wrap>
          <Select
            allowClear
            placeholder="GPA term"
            style={{ width: 200 }}
            value={termId}
            options={terms.map((t) => ({ value: t.id, label: `${t.session_label || ''} ${t.name}`.trim() }))}
            onChange={(v) => setTermId(v)}
          />
          <Tag>GPA {payload?.gpa ?? '—'}</Tag>
          <Tag>CGPA {payload?.cgpa ?? payload?.transcript?.cgpa ?? '—'}</Tag>
          <Link to="/academic/results/students"><Button>Back</Button></Link>
        </Space>
      )}
    >
      {has('results.write') && (
        <Form form={form} layout="inline" className="mb-4 flex flex-wrap gap-2" onFinish={save}>
          <Form.Item name="course_offering_id" rules={[{ required: true, message: 'Select a course' }]} label="Course">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Search offering"
              style={{ minWidth: 260 }}
              options={offerings.map((o) => ({
                value: o.id,
                label: `${o.course?.code || o.id} · ${o.course?.title || ''} · ${o.term?.session_label || ''} ${o.term?.name || ''}`.trim(),
              }))}
            />
          </Form.Item>
          <Form.Item name="ca_score" label="CA"><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="exam_score" label="Exam"><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="score" label="Total"><InputNumber min={0} max={100} /></Form.Item>
          <Form.Item name="sitting" initialValue="main" label="Sitting">
            <Select options={[{ value: 'main', label: 'Main' }, { value: 'supplementary', label: 'Supplementary' }]} style={{ width: 140 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit">{editingId ? 'Update draft' : 'Save draft'}</Button>
          {editingId && (
            <Button onClick={() => { setEditingId(null); form.resetFields(); }}>Cancel</Button>
          )}
        </Form>
      )}
      <Tabs
        items={[
          {
            key: 'scores',
            label: 'Scores',
            children: (
              <>
                {has('results.submit') && (
                  <div className="mb-2">
                    <Button
                      type="primary"
                      disabled={!selected.length}
                      onClick={() => submitIds(selected)}
                    >
                      Submit selected
                    </Button>
                  </div>
                )}
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={grades}
                  columns={columns}
                  pagination={false}
                  rowSelection={has('results.submit') ? {
                    selectedRowKeys: selected,
                    onChange: (keys) => setSelected(keys as number[]),
                    getCheckboxProps: (r) => ({
                      disabled: !['draft', 'correction_required'].includes(r.status) || r.registration_held,
                    }),
                  } : undefined}
                />
              </>
            ),
          },
          {
            key: 'transcript',
            label: 'Transcript',
            children: (
              <Table
                rowKey={(r: any) => r.id || `${r.course?.code}-${r.sitting}`}
                dataSource={transcriptRows}
                pagination={false}
                columns={[
                  { title: 'Course', render: (_: any, r: any) => r.course?.code || '—' },
                  { title: 'Title', render: (_: any, r: any) => r.course?.title || '—' },
                  { title: 'Units', render: (_: any, r: any) => r.course?.units ?? '—' },
                  { title: 'Sitting', dataIndex: 'sitting' },
                  letterColumn,
                  { title: 'Points', dataIndex: 'points' },
                  { title: 'Term', render: (_: any, r: any) => `${r.term?.session_label || ''} ${r.term?.name || ''}`.trim() || '—' },
                ]}
              />
            ),
          },
          {
            key: 'audit',
            label: 'Audit',
            children: (
              <Table
                rowKey="id"
                dataSource={auditRows}
                pagination={false}
                columns={[
                  { title: 'When', dataIndex: 'occurred_at', width: 200 },
                  { title: 'Action', dataIndex: 'action' },
                  { title: 'Actor', dataIndex: 'actor_name' },
                  { title: 'Summary', dataIndex: 'summary' },
                ]}
              />
            ),
          },
        ]}
      />
    </ResourceShell>
  );
}

export function ResultsImportPage() {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [result, setResult] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    api.get('/api/academic/results/offerings').then((r) => setOfferings(Array.isArray(r.data) ? r.data : r.data?.data || [])).catch(() => {});
  }, []);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/academic/results/import-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'results-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the template.');
    }
  };

  const run = async () => {
    try {
      const values = await form.validateFields();
      const file = fileList[0]?.originFileObj;
      if (!file && !String(values.csv || '').trim()) {
        message.warning('Download the template, then upload the filled file or paste CSV.');
        return;
      }
      setUploading(true);
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('course_offering_id', String(values.course_offering_id));
        formData.append('score_component', values.score_component || 'total');
        formData.append('sitting', values.sitting || 'main');
        formData.append('file', file);
        res = await api.post('/api/academic/results/import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/api/academic/results/import', values);
      }
      if (isPendingApproval(res)) {
        return;
      }
      setResult(res.data);
      setFileList([]);
      message.success(`Import done: ${res.data.created} created, ${res.data.updated} updated`);
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ResourceShell
      title="CSV import"
      description="Download the template, fill one row per student (registration is optional), then upload the file or paste CSV."
      loading={false}
      onRefresh={() => {}}
      extra={<Button icon={<Download size={14} />} onClick={downloadTemplate}>Template</Button>}
    >
      <Form form={form} layout="vertical" className="max-w-xl p-4" onFinish={run}>
        <p className="text-sm text-slate-600 mb-4">
          Required column: matric. Use ca and exam together, or score for a single total. Choose sitting here; it applies to every row. Students do not need to be registered yet — unregistered scores stay held until they register.
        </p>
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
        <Form.Item name="sitting" label="Sitting" initialValue="main">
          <Select options={[
            { value: 'main', label: 'Main' },
            { value: 'supplementary', label: 'Supplementary' },
          ]} />
        </Form.Item>
        <Form.Item label="Template file">
          <Upload
            beforeUpload={() => false}
            maxCount={1}
            accept=".xlsx,.xls,.csv"
            fileList={fileList}
            onChange={({ fileList: next }) => setFileList(next)}
          >
            <Button>Choose file</Button>
          </Upload>
        </Form.Item>
        <Form.Item name="csv" label="CSV text" extra="Optional if you upload the template file.">
          <Input.TextArea rows={8} placeholder={'matric,ca,exam,score\nBUT/2024/001,28,44,'} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={uploading}>Import</Button>
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

export function ResultsDepartmentUploadsPage() {
  const { has } = useAuth();
  const { terms, faculties, departments, levels } = useResultsLookups();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [filters, setFilters] = useState<{ academic_term_id?: number; academic_session_id?: number; level?: string; status?: string; faculty_id?: number; department_id?: number; sitting?: string; matric?: string; course?: string }>({
    status: 'draft',
  });

  useEffect(() => {
    const term = terms.find((row) => row.is_current);
    if (!term) return;
    setFilters((current) => ({
      ...current,
      academic_term_id: current.academic_term_id ?? term.id,
      academic_session_id: current.academic_session_id ?? term.academic_session_id,
    }));
  }, [terms]);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/academic/results/grades', { params: { ...filters, per_page: QUEUE_PAGE_SIZE } })
      .then((r) => setRows(r.data?.data || []))
      .catch(() => message.error('Could not load department uploads'))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const act = async (path: string, body: any) => {
    try {
      const res = await api.post(path, body);
      if (!isPendingApproval(res)) {
        message.success(`Updated ${res.data?.updated ?? 0}`);
      }
      if (res.data?.errors?.length) message.warning(res.data.errors.join('; '));
      setSelected([]);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Action failed');
    }
  };

  const columns: ColumnsType = [
    { title: 'Matric', render: (_, r) => gradeStudent(r).matric_number },
    { title: 'Student', render: (_, r) => `${gradeStudent(r).first_name || ''} ${gradeStudent(r).last_name || ''}`.trim() || '—' },
    { title: 'Course', render: (_, r) => gradeCourse(r).code },
    { title: 'CA', dataIndex: 'ca_score', width: 70 },
    { title: 'Exam', dataIndex: 'exam_score', width: 70 },
    { title: 'Score', dataIndex: 'score', width: 70 },
    letterColumn,
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{String(v || '').replace(/_/g, ' ')}</Tag> },
  ];

  return (
    <ResourceShell
      title="Department uploads"
      description="Review department scores. Grade is the A–F letter from the total (you do not type it). Choose a semester, department, and level, then download the department list."
      loading={loading}
      onRefresh={load}
      extra={(
        <Space wrap>
          <CourseLevelFilter levels={levels} value={filters.level} onChange={(v) => setFilters((f) => ({ ...f, level: v }))} />
          <AcademicSessionSemesterFilters
            terms={terms}
            sessionId={filters.academic_session_id}
            termId={filters.academic_term_id}
            onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
          />
          <Select
            placeholder="Status"
            style={{ width: 180 }}
            value={filters.status}
            options={['draft', 'submitted', 'correction_required', 'board_ready'].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          />
          <Select
            placeholder="Sitting"
            allowClear
            style={{ width: 150 }}
            value={filters.sitting}
            options={[{ value: 'main', label: 'Main' }, { value: 'supplementary', label: 'Supplementary' }]}
            onChange={(v) => setFilters((f) => ({ ...f, sitting: v }))}
          />
          <Select
            placeholder="Faculty"
            allowClear
            style={{ width: 180 }}
            value={filters.faculty_id}
            options={faculties.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(v) => setFilters((f) => ({
              ...f,
              faculty_id: v,
              department_id: !v || departments.find((d) => d.id === f.department_id)?.faculty_id === v
                ? f.department_id
                : undefined,
            }))}
          />
          <Select
            placeholder="Department"
            allowClear
            style={{ width: 200 }}
            value={filters.department_id}
            options={departmentOptions(departments, filters.faculty_id)}
            onChange={(v) => setFilters((f) => ({ ...f, department_id: v }))}
          />
          {has('results.submit') && (
            <Button type="primary" onClick={() => act('/api/academic/results/submit', { ids: selected })} disabled={!selected.length}>
              Submit selected
            </Button>
          )}
          <Dropdown
            menu={{
              items: listDownloadItems((format) => {
                const departmentId = filters.department_id || uniqueNumericId(rows.map(gradeDepartmentId));
                const facultyId = filters.faculty_id
                  || departments.find((d) => d.id === departmentId)?.faculty_id;
                const params = {
                  academic_term_id: filters.academic_term_id,
                  academic_session_id: filters.academic_session_id,
                  department_id: departmentId,
                  faculty_id: facultyId,
                  status: filters.status,
                  level: filters.level,
                  sitting: filters.sitting,
                };
                const term = terms.find((t) => t.id === filters.academic_term_id);
                const filename = `department-results-${(term?.session_label || 'session').replace(/[/\s]/g, '-')}-${filters.sitting === 'supplementary' ? 'supplementary' : 'main'}`;
                if (format === 'html') {
                  if (!params.department_id) {
                    message.warning('Select a department to download the department list.');
                    return;
                  }
                  openPrintable('/api/academic/results/reports/submission-list/department', params);
                  return;
                }
                void downloadSubmissionList(
                  '/api/academic/results/reports/submission-list/department',
                  params,
                  format,
                  filename,
                  { requireDepartment: true },
                );
              }),
            }}
            trigger={['click']}
          >
            <Button icon={<Download size={14} />}>Department list</Button>
          </Dropdown>
        </Space>
      )}
    >
      <Space className="mb-3" wrap>
        <Input
          placeholder="Matric"
          allowClear
          style={{ width: 160 }}
          value={filters.matric}
          onChange={(e) => setFilters((f) => ({ ...f, matric: e.target.value || undefined }))}
        />
        <Input
          placeholder="Course code"
          allowClear
          style={{ width: 140 }}
          value={filters.course}
          onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value || undefined }))}
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

export function ResultsApprovalsPage() {
  const { has } = useAuth();
  const { terms, faculties, departments, levels } = useResultsLookups();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [filters, setFilters] = useState<{ academic_term_id?: number; academic_session_id?: number; level?: string; status?: string; faculty_id?: number; department_id?: number; sitting?: string; matric?: string; course?: string }>({
    status: 'submitted',
  });
  const [returnNote, setReturnNote] = useState('');

  useEffect(() => {
    const term = terms.find((row) => row.is_current);
    if (!term) return;
    setFilters((current) => ({
      ...current,
      academic_term_id: current.academic_term_id ?? term.id,
      academic_session_id: current.academic_session_id ?? term.academic_session_id,
    }));
  }, [terms]);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/academic/results/grades', { params: { ...filters, per_page: QUEUE_PAGE_SIZE } })
      .then((r) => setRows(r.data?.data || []))
      .catch(() => message.error('Could not load faculty approval queue'))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const act = async (path: string, body: any) => {
    try {
      const res = await api.post(path, body);
      if (!isPendingApproval(res)) {
        message.success(`Updated ${res.data?.updated ?? 0}`);
      }
      if (res.data?.errors?.length) message.warning(res.data.errors.join('; '));
      setSelected([]);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Action failed');
    }
  };

  const columns: ColumnsType = [
    { title: 'Matric', render: (_, r) => gradeStudent(r).matric_number },
    { title: 'Student', render: (_, r) => `${gradeStudent(r).first_name || ''} ${gradeStudent(r).last_name || ''}`.trim() || '—' },
    { title: 'Course', render: (_, r) => gradeCourse(r).code },
    { title: 'Score', dataIndex: 'score' },
    letterColumn,
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{String(v || '').replace(/_/g, ' ')}</Tag> },
  ];

  return (
    <ResourceShell
      title="Faculty Approval"
      description="Approve or return department submissions. Print the faculty list from this page."
      loading={loading}
      onRefresh={load}
      extra={(
        <Space wrap>
          <CourseLevelFilter levels={levels} value={filters.level} onChange={(v) => setFilters((f) => ({ ...f, level: v }))} />
          <AcademicSessionSemesterFilters
            terms={terms}
            sessionId={filters.academic_session_id}
            termId={filters.academic_term_id}
            onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
          />
          <Select
            placeholder="Status"
            style={{ width: 160 }}
            value={filters.status}
            options={['submitted', 'board_ready', 'correction_required'].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          />
          <Select
            placeholder="Sitting"
            allowClear
            style={{ width: 150 }}
            value={filters.sitting}
            options={[{ value: 'main', label: 'Main' }, { value: 'supplementary', label: 'Supplementary' }]}
            onChange={(v) => setFilters((f) => ({ ...f, sitting: v }))}
          />
          {has('results.faculty_approve') && (
            <>
              <Input
                placeholder="Return note"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                style={{ width: 200 }}
              />
              <Button type="primary" onClick={() => act('/api/academic/results/faculty-approve', { ids: selected })} disabled={!selected.length}>Approve</Button>
              <Button danger onClick={() => act('/api/academic/results/faculty-return', { ids: selected, note: returnNote.trim() || 'Returned for correction' })} disabled={!selected.length}>Return</Button>
            </>
          )}
          <Dropdown
            menu={{
              items: listDownloadItems((format) => {
                const facultyId = filters.faculty_id
                  || departments.find((d) => d.id === filters.department_id)?.faculty_id;
                const params = {
                  academic_term_id: filters.academic_term_id,
                  faculty_id: facultyId,
                  department_id: filters.department_id,
                  status: filters.status,
                  level: filters.level,
                  sitting: filters.sitting,
                };
                const term = terms.find((t) => t.id === filters.academic_term_id);
                const filename = `faculty-results-${(term?.session_label || 'session').replace(/[/\s]/g, '-')}-${filters.sitting === 'supplementary' ? 'supplementary' : 'main'}`;
                if (format === 'html') {
                  openPrintable('/api/academic/results/reports/submission-list/faculty', params);
                  return;
                }
                void downloadSubmissionList(
                  '/api/academic/results/reports/submission-list/faculty',
                  params,
                  format,
                  filename,
                  { requireFaculty: true },
                );
              }),
            }}
            trigger={['click']}
          >
            <Button icon={<Download size={14} />}>Faculty list</Button>
          </Dropdown>
        </Space>
      )}
    >
      <Space className="mb-3" wrap>
        <Select
          placeholder="Faculty"
          allowClear
          style={{ width: 180 }}
          value={filters.faculty_id}
          options={faculties.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(v) => setFilters((f) => ({
            ...f,
            faculty_id: v,
            department_id: !v || departments.find((d) => d.id === f.department_id)?.faculty_id === v
              ? f.department_id
              : undefined,
          }))}
        />
        <Select
          placeholder="Department"
          allowClear
          style={{ width: 180 }}
          value={filters.department_id}
          options={departmentOptions(departments, filters.faculty_id)}
          onChange={(v) => setFilters((f) => ({ ...f, department_id: v }))}
        />
        <Input
          placeholder="Matric"
          allowClear
          style={{ width: 160 }}
          value={filters.matric}
          onChange={(e) => setFilters((f) => ({ ...f, matric: e.target.value || undefined }))}
        />
        <Input
          placeholder="Course code"
          allowClear
          style={{ width: 140 }}
          value={filters.course}
          onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value || undefined }))}
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
  const { terms, faculties, departments, levels } = useResultsLookups();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [status, setStatus] = useState('board_ready');
  const [sitting, setSitting] = useState<string | undefined>();
  const [matric, setMatric] = useState<string | undefined>();
  const [course, setCourse] = useState<string | undefined>();
  const termOptions = semesterOptions(terms, sessionId);

  const load = useCallback(async () => {
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      const { data } = await api.get('/api/academic/results/grades', {
        params: {
          status,
          academic_term_id: values.academic_term_id,
          faculty_id: values.faculty_id,
          department_id: values.department_id,
          academic_session_id: sessionId,
          level,
          sitting,
          matric,
          course,
          per_page: QUEUE_PAGE_SIZE,
        },
      });
      setRows(data?.data || []);
    } catch {
      message.error('Could not load board records');
    } finally {
      setLoading(false);
    }
  }, [form, status, sessionId, level, sitting, matric, course]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (path: string) => {
    try {
      const values = await form.validateFields();
      const res = await api.post(path, { ...values, level });
      if (!isPendingApproval(res)) {
        message.success(`Updated ${res.data?.updated ?? 0}`);
      }
      await load();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Board action failed');
    }
  };

  const columns: ColumnsType = [
    { title: 'Matric', render: (_, r) => gradeStudent(r).matric_number },
    { title: 'Student', render: (_, r) => `${gradeStudent(r).first_name || ''} ${gradeStudent(r).last_name || ''}`.trim() || '—' },
    { title: 'Course', render: (_, r) => gradeCourse(r).code },
    { title: 'Score', dataIndex: 'score', width: 70 },
    letterColumn,
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{String(v || '').replace(/_/g, ' ')}</Tag> },
  ];

  return (
    <ResourceShell
      title="Board"
      description="Review board-ready grades, clear them, or request corrections. Print the board list when needed."
      loading={loading}
      onRefresh={load}
      extra={(
        <Space wrap>
          <CourseLevelFilter levels={levels} value={level} onChange={setLevel} />
          <Select
            allowClear
            placeholder="Session"
            style={{ width: 160 }}
            value={sessionId}
            options={academicSessionsFromTerms(terms).map((session) => ({
              value: session.id,
              label: session.is_current ? `${session.label} (current)` : session.label,
            }))}
            onChange={(value) => {
              setSessionId(value);
              form.setFieldsValue({
                academic_term_id: value ? termInSession(terms, value, form.getFieldValue('academic_term_id')) : undefined,
              });
            }}
          />
        </Space>
      )}
    >
      <Form
        form={form}
        layout="vertical"
        className="max-w-3xl"
        onValuesChange={() => {
          window.setTimeout(() => { void load(); }, 0);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Form.Item name="academic_term_id" label="Semester" rules={[{ required: true }]}>
            <Select options={termOptions} placeholder="Select semester" />
          </Form.Item>
          <Form.Item label="Status">
            <Select
              value={status}
              options={[
                { value: 'board_ready', label: 'board ready' },
                { value: 'board_cleared', label: 'board cleared' },
                { value: 'correction_required', label: 'correction required' },
              ]}
              onChange={setStatus}
            />
          </Form.Item>
          <Form.Item name="faculty_id" label="Faculty">
            <Select allowClear options={faculties.map((f) => ({ value: f.id, label: f.name }))} />
          </Form.Item>
          <Form.Item name="department_id" label="Department">
            <Select allowClear options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
          <Form.Item label="Sitting">
            <Select
              allowClear
              value={sitting}
              options={[{ value: 'main', label: 'Main' }, { value: 'supplementary', label: 'Supplementary' }]}
              onChange={setSitting}
            />
          </Form.Item>
          <Form.Item label="Matric">
            <Input allowClear value={matric} onChange={(e) => setMatric(e.target.value || undefined)} />
          </Form.Item>
          <Form.Item label="Course">
            <Input allowClear value={course} onChange={(e) => setCourse(e.target.value || undefined)} />
          </Form.Item>
        </div>
        <Form.Item name="note" label="Note"><Input.TextArea rows={2} /></Form.Item>
        <Space wrap className="mb-4">
          <Button type="primary" onClick={() => run('/api/academic/results/board-scopes/clear')}>Board clear</Button>
          <Button danger onClick={() => run('/api/academic/results/board-scopes/request-corrections')}>Request corrections</Button>
          <Dropdown
            menu={{
              items: listDownloadItems((format) => {
                const v = form.getFieldsValue();
                const path = v.department_id && !v.faculty_id
                  ? '/api/academic/results/board-lists/department'
                  : '/api/academic/results/board-lists/faculty';
                const params = {
                  academic_term_id: v.academic_term_id,
                  faculty_id: v.faculty_id,
                  department_id: v.department_id,
                  status: status || 'board_ready',
                  level,
                  sitting,
                };
                const term = terms.find((t) => t.id === v.academic_term_id);
                const filename = `senate-list-${(term?.session_label || 'session').replace(/[/\s]/g, '-')}${sitting === 'supplementary' ? '-supplementary' : ''}`;
                if (format === 'html') {
                  openPrintable(path, params);
                  return;
                }
                void downloadSubmissionList(path, params, format, filename, {
                  requireFaculty: path.endsWith('/faculty'),
                  requireDepartment: path.endsWith('/department'),
                });
              }),
            }}
            trigger={['click']}
          >
            <Button icon={<Download size={14} />}>Board list</Button>
          </Dropdown>
          <Button onClick={load}>Refresh list</Button>
        </Space>
      </Form>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        locale={{ emptyText: 'No board records for these filters. Select a term to load the list.' }}
      />
    </ResourceShell>
  );
}

export function ResultsReleasePage() {
  const { terms, faculties, departments, levels } = useResultsLookups();
  const [form] = Form.useForm();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const termOptions = semesterOptions(terms, sessionId);
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
      extra={(
        <Space wrap>
          <CourseLevelFilter levels={levels} value={level} onChange={setLevel} />
          <Select
            allowClear
            placeholder="Session"
            style={{ width: 160 }}
            value={sessionId}
            options={academicSessionsFromTerms(terms).map((session) => ({
              value: session.id,
              label: session.is_current ? `${session.label} (current)` : session.label,
            }))}
            onChange={(value) => {
              setSessionId(value);
              form.setFieldsValue({
                academic_term_id: value ? termInSession(terms, value, form.getFieldValue('academic_term_id')) : undefined,
              });
            }}
          />
        </Space>
      )}
    >
      <Form form={form} layout="vertical" className="max-w-lg" onFinish={release}>
        <Form.Item name="academic_term_id" label="Semester" rules={[{ required: true }]}>
          <Select options={termOptions} placeholder="Select semester" />
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
  const { has } = useAuth();
  const canEdit = has('scales.manage');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState<any>(null);
  const [form] = Form.useForm();

  const applyScale = (def: any) => {
    setScale(def);
    form.setFieldsValue({
      name: def.name,
      max_points: Number(def.max_points),
      is_default: !!def.is_default,
      boundaries: (def.boundaries || []).map((row: any) => ({
        letter: row.letter,
        min_score: Number(row.min_score),
        max_score: Number(row.max_score),
        grade_point: Number(row.grade_point),
      })),
    });
  };

  const load = () => {
    setLoading(true);
    api.get('/api/academic/results/grading-scales')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        const def = list.find((s: any) => s.is_default) || list[0];
        if (def) {
          applyScale(def);
        } else {
          setScale(null);
          form.resetFields();
        }
      })
      .catch(() => message.error('Could not load scale'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!scale || !canEdit) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await api.put(`/api/academic/results/grading-scales/${scale.id}`, {
        ...values,
        max_points: values.max_points != null ? Number(values.max_points) : undefined,
        boundaries: (values.boundaries || []).map((row: any) => ({
          letter: String(row.letter || '').trim().toUpperCase(),
          min_score: Number(row.min_score),
          max_score: Number(row.max_score),
          grade_point: Number(row.grade_point),
        })),
      });
      if (!isPendingApproval(res)) {
        message.success('Grading scale updated');
        if (res.data?.id) {
          applyScale(res.data);
        } else {
          load();
        }
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResourceShell
      title="Grading scale"
      description="Letter bands used to turn a total score into A–F and grade points. This is applied when scores are saved."
      loading={loading}
      onRefresh={load}
    >
      <Form form={form} layout="vertical" className="max-w-2xl" onFinish={save} disabled={!canEdit}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="max_points" label="Max points"><InputNumber min={1} max={10} step={0.1} className="w-full" /></Form.Item>
        <Form.List name="boundaries">
          {(fields, { add, remove }) => (
            <div className="space-y-2">
              {fields.map((field) => (
                <Space key={field.key} align="start" wrap>
                  <Form.Item {...field} name={[field.name, 'letter']} rules={[{ required: true, message: 'Letter' }]}>
                    <Input placeholder="Letter" style={{ width: 70 }} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'min_score']} rules={[{ required: true, message: 'Min' }]}>
                    <InputNumber placeholder="Min" min={0} max={100} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'max_score']} rules={[{ required: true, message: 'Max' }]}>
                    <InputNumber placeholder="Max" min={0} max={100} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'grade_point']} rules={[{ required: true, message: 'Point' }]}>
                    <InputNumber placeholder="Point" min={0} max={10} step={0.1} />
                  </Form.Item>
                  {canEdit && (
                    <Button type="link" danger onClick={() => remove(field.name)}>Remove</Button>
                  )}
                </Space>
              ))}
              {canEdit && (
                <Button onClick={() => add({ letter: '', min_score: 0, max_score: 0, grade_point: 0 })}>
                  Add band
                </Button>
              )}
            </div>
          )}
        </Form.List>
        {canEdit && (
          <Button type="primary" htmlType="submit" className="mt-3" loading={saving} disabled={!scale}>
            Save scale
          </Button>
        )}
      </Form>
    </ResourceShell>
  );
}
