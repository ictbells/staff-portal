import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BookOpen, Plus, Search } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { actionColumn, useCrudModal } from './crudHelpers';
import { useResourceList } from './useResourceList';

const BUCKETS = [
  { value: 'general', label: 'General' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'departmental', label: 'Departmental' },
  { value: 'overall', label: 'Overall' },
];

type Term = {
  id: number;
  name: string;
  session_label?: string;
  is_current?: boolean;
  extension_price_per_unit?: number | string | null;
};
type CourseRef = { id: number; code: string; title: string; units?: number; course_type?: string };
type Lecturer = { id: number; title?: string; staff_number?: string; user?: { name?: string } };
type Offering = {
  id: number;
  section?: string;
  capacity: number;
  seats_left?: number;
  enrolled_count?: number;
  course_id?: number;
  academic_term_id?: number;
  faculty_staff_id?: number | null;
  course?: CourseRef;
  term?: Term;
  lecturer?: { user?: { name?: string } };
};
type UnitLimit = {
  id: number;
  program_id: number;
  academic_level_id?: number | null;
  academic_term_id?: number | null;
  bucket: string;
  min_units: number;
  max_units: number;
  program?: { id: number; name: string; code?: string };
  level?: { id: number; name: string; code?: string } | null;
  term?: Term | null;
};
type Extension = {
  id: number;
  status: string;
  requested_units: number;
  approved_units?: number | null;
  reason?: string | null;
  staff_note?: string | null;
  student?: {
    first_name?: string;
    last_name?: string;
    matric_number?: string;
    user?: { name?: string };
    program?: { name?: string };
  };
  term?: Term;
  invoice?: { number?: string; amount?: number; balance?: number; status?: string } | null;
};

function ResourceShell({
  title, description, loading, onRefresh, onAdd, canAdd = true, children, count, countLabel = 'Records', extra,
}: {
  title: string; description: string; loading: boolean; onRefresh: () => void;
  onAdd?: () => void; canAdd?: boolean; children: React.ReactNode;
  count?: number; countLabel?: string; extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <WorkspaceHero eyebrow="Enrolment" title={title} description={description} icon={BookOpen}>
        <div className="flex gap-2">
          {extra}
          <RefreshButton onClick={onRefresh} loading={loading} />
          {canAdd && onAdd && (
            <Button type="primary" icon={<Plus size={14} />} onClick={onAdd}>Add</Button>
          )}
        </div>
      </WorkspaceHero>
      {count != null && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard label={countLabel} value={count} hint="Records in this list" icon={BookOpen} />
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function lecturerLabel(row: Lecturer) {
  const name = row.user?.name || `Staff #${row.id}`;
  return row.title ? `${row.title} ${name}` : name;
}

function apiError(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (first) return first;
  }
  return data?.message || fallback;
}

function bucketLabel(value?: string) {
  return BUCKETS.find((item) => item.value === value)?.label || value || '—';
}

function rosterLabel(status?: string) {
  if (status === 'registered') return 'Registered';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

export function OfferingsPage() {
  const { rows, loading, reload } = useResourceList<Offering>('/api/academic/offerings');
  const { rows: terms } = useResourceList<Term>('/api/academic/terms');
  const { rows: courses } = useResourceList<CourseRef>('/api/academic/courses');
  const { rows: lecturers } = useResourceList<Lecturer>('/api/academic/lecturers');
  const crud = useCrudModal<Offering>();

  const columns: ColumnsType<Offering> = [
    { title: 'Course', key: 'course', render: (_, row) => (row.course ? `${row.course.code} — ${row.course.title}` : '—') },
    { title: 'Type', key: 'type', width: 130, render: (_, row) => bucketLabel(row.course?.course_type) },
    { title: 'Section', dataIndex: 'section', key: 'section', width: 90, render: (value) => value || 'A' },
    { title: 'Semester', key: 'term', render: (_, row) => (row.term ? `${row.term.session_label || ''} ${row.term.name}`.trim() : '—') },
    { title: 'Lecturer', key: 'lecturer', render: (_, row) => row.lecturer?.user?.name || '—' },
    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity', width: 90 },
    {
      title: 'Seats left',
      key: 'seats',
      width: 100,
      render: (_, row) => row.seats_left ?? Math.max(0, (row.capacity || 0) - (row.enrolled_count || 0)),
    },
    actionColumn(
      (row) => crud.openEdit(row, {
        course_id: row.course_id ?? row.course?.id,
        academic_term_id: row.academic_term_id ?? row.term?.id,
        faculty_staff_id: row.faculty_staff_id,
        section: row.section || 'A',
        capacity: row.capacity,
      }),
      (row) => crud.remove(`/api/academic/offerings/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/academic/offerings', (id) => `/api/academic/offerings/${id}`, values, reload);
  };

  return (
    <ResourceShell
      title="Course offerings"
      description="Publish semester sections, capacity, and lecturers. Students can only register from offerings in the current term."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate({ section: 'A', capacity: 50 })}
      canAdd={courses.length > 0 && terms.length > 0}
      count={rows.length}
      countLabel="Offerings"
    >
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1100 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No offerings yet.' }} />
      <Modal title={crud.isEdit ? 'Edit offering' : 'Add offering'} open={crud.open} onCancel={crud.close} onOk={submit} confirmLoading={crud.saving} destroyOnClose width={520}>
        <Form form={crud.form} layout="vertical" className="mt-4">
          <Form.Item name="course_id" label="Course" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={courses.map((course) => ({ value: course.id, label: `${course.code} — ${course.title}` }))} />
          </Form.Item>
          <Form.Item name="academic_term_id" label="Semester" rules={[{ required: true }]}>
            <Select options={terms.map((term) => ({ value: term.id, label: `${term.session_label || ''} ${term.name}`.trim() }))} />
          </Form.Item>
          <Form.Item name="faculty_staff_id" label="Lecturer">
            <Select allowClear showSearch optionFilterProp="label" options={lecturers.map((row) => ({ value: row.id, label: lecturerLabel(row) }))} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="section" label="Section"><Input placeholder="A" /></Form.Item>
            <Form.Item name="capacity" label="Capacity" rules={[{ required: true }]}><InputNumber min={1} max={1000} className="w-full" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </ResourceShell>
  );
}

export function CourseRegistrationPage() {
  const { has } = useAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [graceBucket, setGraceBucket] = useState('overall');
  const [graceUnits, setGraceUnits] = useState(1);
  const [graceReason, setGraceReason] = useState('');
  const canGrace = has('academic.enrollments.grace');

  const loadContext = async (id: number) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/academic/course-registration', { params: { student_id: id } });
      setCtx(data);
      setStudentId(id);
    } catch (err) {
      setCtx(null);
      message.error(apiError(err, "Unable to load this student's course registration."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fromUrl = Number(params.get('student_id') || 0);
    if (fromUrl) loadContext(fromUrl);
  }, [params]);

  const findStudents = async () => {
    try {
      const { data } = await api.get('/api/academic/course-registration/students', { params: { search } });
      const list = Array.isArray(data) ? data : [];
      setMatches(list);
      if (list.length === 1) loadContext(list[0].id);
    } catch (err) {
      message.error(apiError(err, 'Unable to search students.'));
    }
  };

  const enroll = async (courseOfferingId: number) => {
    if (!studentId) return;
    try {
      await api.post('/api/academic/course-registration/enroll', {
        student_id: studentId,
        course_offering_id: courseOfferingId,
        reason: reason || undefined,
      });
      message.success('Course registered.');
      setReason('');
      await loadContext(studentId);
    } catch (err) {
      message.error(apiError(err, 'Unable to register this course.'));
    }
  };

  const drop = async (enrollmentId: number) => {
    if (!studentId) return;
    try {
      await api.delete(`/api/academic/course-registration/enrollments/${enrollmentId}`, { data: { reason: reason || undefined } });
      message.success('Course dropped.');
      setReason('');
      await loadContext(studentId);
    } catch (err) {
      message.error(apiError(err, 'Unable to drop this course.'));
    }
  };

  const grantGrace = async () => {
    if (!studentId) return;
    if (!graceReason.trim()) {
      message.warning('A reason is required to grant grace units.');
      return;
    }
    try {
      await api.post('/api/academic/course-registration/grace', {
        student_id: studentId,
        academic_term_id: ctx?.term?.id,
        bucket: graceBucket,
        extra_units: graceUnits,
        reason: graceReason,
      });
      message.success('Grace units granted.');
      setGraceReason('');
      await loadContext(studentId);
    } catch (err) {
      message.error(apiError(err, 'Unable to grant grace units.'));
    }
  };

  const reasonNeeded = ctx && (ctx.window === 'Closed' || !ctx.tuition_ok);

  return (
    <div className="space-y-4">
      <WorkspaceHero
        eyebrow="Enrolment"
        title="Course registration"
        description="Add or drop courses for a student. A reason is required when the window is closed, tuition is below 25%, or a carry-over is dropped."
        icon={BookOpen}
      >
        <RefreshButton onClick={() => studentId && loadContext(studentId)} loading={loading} />
      </WorkspaceHero>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-sm"
            placeholder="Search by name, matric, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={findStudents}
          />
          <Button icon={<Search size={14} />} onClick={findStudents}>Find student</Button>
        </div>
        {matches.length > 0 && (
          <Select
            className="w-full max-w-xl"
            placeholder="Select student"
            value={studentId || undefined}
            options={matches.map((student) => ({
              value: student.id,
              label: `${student.last_name || ''} ${student.first_name || ''}`.trim() + (student.matric_number ? ` (${student.matric_number})` : ''),
            }))}
            onChange={(id) => loadContext(id)}
          />
        )}
        <Input.TextArea
          rows={2}
          placeholder={reasonNeeded ? 'Reason required for this override' : 'Staff override reason (when required)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {ctx && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Window" value={ctx.window || '—'} hint={ctx.term?.name || 'No current semester'} icon={BookOpen} />
            <StatCard label="Roster" value={rosterLabel(ctx.roster_status)} hint={`${ctx.units?.overall || 0} units enrolled`} icon={BookOpen} />
            <StatCard label="Tuition" value={`${Math.round(ctx.tuition_percent || 0)}%`} hint={ctx.tuition_ok ? 'Minimum met' : 'Pay at least 25%'} icon={BookOpen} />
            <StatCard label="Extension" value={ctx.extension?.status || 'None'} hint={ctx.extension?.approved_units ? `${ctx.extension.approved_units} approved units` : 'No active request'} icon={BookOpen} />
          </div>

          {!ctx.tuition_ok && (
            <Alert type="warning" showIcon message="This student has paid less than 25% of current-session tuition. Staff can still register with a reason." />
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Units vs limits</h3>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {BUCKETS.map((bucket) => {
                const limit = ctx.limits?.[bucket.value] || {};
                const used = ctx.units?.[bucket.value] ?? 0;
                return (
                  <div key={bucket.value} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{bucket.label}</p>
                    <p className="text-sm font-semibold text-slate-800">{used} / {limit.max ?? '—'} units</p>
                    <p className="text-xs text-slate-500">Min {limit.min ?? '—'}{limit.grace ? ` · grace +${limit.grace}` : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {canGrace && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Grant grace units</h3>
              <div className="flex flex-wrap gap-2">
                <Select className="w-40" value={graceBucket} onChange={setGraceBucket} options={BUCKETS} />
                <InputNumber min={1} max={30} value={graceUnits} onChange={(value) => setGraceUnits(Number(value || 1))} />
                <Input className="min-w-[220px] flex-1" placeholder="Reason (required)" value={graceReason} onChange={(e) => setGraceReason(e.target.value)} />
                <Button onClick={grantGrace}>Grant grace</Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Registered</h3>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={ctx.enrollments || []}
              locale={{ emptyText: 'No courses registered.' }}
              columns={[
                { title: 'Course', render: (_, row: any) => `${row.offering?.course?.code || ''} ${row.offering?.course?.title || ''}`.trim() },
                { title: 'Units', width: 70, render: (_, row: any) => row.offering?.course?.units ?? '—' },
                { title: 'Bucket', width: 130, render: (_, row: any) => bucketLabel(row.bucket) },
                { title: 'Carry-over', width: 110, render: (_, row: any) => (row.is_carry_over ? <Tag color="orange">Required</Tag> : '—') },
                {
                  title: '',
                  width: 90,
                  render: (_, row: any) => (
                    <Popconfirm title={row.is_carry_over ? 'Drop this required carry-over?' : 'Drop this course?'} onConfirm={() => drop(row.id)}>
                      <Button size="small" danger>Drop</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Available</h3>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={ctx.available || []}
              locale={{ emptyText: 'No offerings available for this student.' }}
              columns={[
                { title: 'Course', render: (_, row: any) => `${row.course?.code || ''} ${row.course?.title || ''}`.trim() },
                { title: 'Units', width: 70, render: (_, row: any) => row.course?.units ?? '—' },
                { title: 'Bucket', width: 130, render: (_, row: any) => bucketLabel(row.bucket || row.course?.course_type) },
                { title: 'Seats', width: 80, dataIndex: 'seats_left' },
                {
                  title: '',
                  width: 110,
                  render: (_, row: any) => (
                    <Button size="small" type="primary" onClick={() => enroll(row.id)}>Register</Button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function UnitLimitsPage() {
  const { rows, loading, reload } = useResourceList<UnitLimit>('/api/academic/unit-limits');
  const crud = useCrudModal<UnitLimit>();
  const [meta, setMeta] = useState<{ programs: any[]; levels: any[]; terms: Term[] }>({ programs: [], levels: [], terms: [] });

  useEffect(() => {
    api.get('/api/academic/unit-limits/meta').then(({ data }) => setMeta({
      programs: data.programs || [],
      levels: data.levels || [],
      terms: data.terms || [],
    })).catch(() => {});
  }, []);

  const columns: ColumnsType<UnitLimit> = [
    { title: 'Programme', render: (_, row) => row.program?.code || row.program?.name || '—' },
    { title: 'Level', render: (_, row) => row.level?.name || 'Any' },
    { title: 'Semester', render: (_, row) => (row.term ? `${row.term.session_label || ''} ${row.term.name}`.trim() : 'Any') },
    { title: 'Bucket', dataIndex: 'bucket', width: 130, render: (value) => bucketLabel(value) },
    { title: 'Min', dataIndex: 'min_units', width: 70 },
    { title: 'Max', dataIndex: 'max_units', width: 70 },
    actionColumn(
      (row) => crud.openEdit(row, {
        program_id: row.program_id,
        academic_level_id: row.academic_level_id,
        academic_term_id: row.academic_term_id,
        bucket: row.bucket,
        min_units: row.min_units,
        max_units: row.max_units,
      }),
      (row) => crud.remove(`/api/academic/unit-limits/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/academic/unit-limits', (id) => `/api/academic/unit-limits/${id}`, {
      ...values,
      academic_level_id: values.academic_level_id || null,
      academic_term_id: values.academic_term_id || null,
    }, reload);
  };

  return (
    <ResourceShell
      title="Unit limits"
      description="Set minimum and maximum units by programme, level, and bucket. Overall min and max are required for roster Registered status."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate({ bucket: 'overall', min_units: 15, max_units: 24 })}
      count={rows.length}
      countLabel="Limits"
    >
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 900 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No unit limits yet.' }} />
      <Modal title={crud.isEdit ? 'Edit unit limit' : 'Add unit limit'} open={crud.open} onCancel={crud.close} onOk={submit} confirmLoading={crud.saving} destroyOnClose>
        <Form form={crud.form} layout="vertical" className="mt-4">
          <Form.Item name="program_id" label="Programme" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={meta.programs.map((program) => ({ value: program.id, label: program.code ? `${program.code} — ${program.name}` : program.name }))} />
          </Form.Item>
          <Form.Item name="academic_level_id" label="Level">
            <Select allowClear options={meta.levels.map((level) => ({ value: level.id, label: level.name }))} />
          </Form.Item>
          <Form.Item name="academic_term_id" label="Semester">
            <Select allowClear options={meta.terms.map((term) => ({ value: term.id, label: `${term.session_label || ''} ${term.name}`.trim() }))} />
          </Form.Item>
          <Form.Item name="bucket" label="Bucket" rules={[{ required: true }]}>
            <Select options={BUCKETS} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="min_units" label="Minimum" rules={[{ required: true }]}><InputNumber min={0} max={50} className="w-full" /></Form.Item>
            <Form.Item name="max_units" label="Maximum" rules={[{ required: true }]}><InputNumber min={0} max={50} className="w-full" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </ResourceShell>
  );
}

export function RegistrationExtensionsPage() {
  const [status, setStatus] = useState<string | undefined>('pending');
  const endpoint = useMemo(
    () => (status ? `/api/academic/registration-extensions?status=${status}` : '/api/academic/registration-extensions'),
    [status],
  );
  const { rows, loading, reload } = useResourceList<Extension>(endpoint);
  const [note, setNote] = useState('');
  const [unitsById, setUnitsById] = useState<Record<number, number>>({});

  const review = async (row: Extension, decision: 'approve' | 'reject') => {
    try {
      await api.post(`/api/academic/registration-extensions/${row.id}/review`, {
        decision,
        approved_units: decision === 'approve' ? (unitsById[row.id] || row.requested_units) : undefined,
        staff_note: note || undefined,
      });
      message.success(decision === 'approve' ? 'Extension approved. An invoice was created.' : 'Extension rejected.');
      setNote('');
      reload();
    } catch (err) {
      message.error(apiError(err, 'Unable to review this extension.'));
    }
  };

  const columns: ColumnsType<Extension> = [
    {
      title: 'Student',
      render: (_, row) => row.student?.user?.name
        || `${row.student?.last_name || ''} ${row.student?.first_name || ''}`.trim()
        || row.student?.matric_number
        || '—',
    },
    { title: 'Programme', render: (_, row) => row.student?.program?.name || '—' },
    { title: 'Semester', render: (_, row) => (row.term ? `${row.term.session_label || ''} ${row.term.name}`.trim() : '—') },
    { title: 'Requested', dataIndex: 'requested_units', width: 100 },
    {
      title: 'Approve units',
      width: 130,
      render: (_, row) => (
        <InputNumber
          min={1}
          max={50}
          disabled={row.status !== 'pending'}
          value={unitsById[row.id] ?? row.approved_units ?? row.requested_units}
          onChange={(value) => setUnitsById((current) => ({ ...current, [row.id]: Number(value || row.requested_units) }))}
        />
      ),
    },
    {
      title: 'Amount',
      width: 140,
      render: (_, row) => {
        const units = unitsById[row.id] ?? row.approved_units ?? row.requested_units;
        const rate = Number(row.term?.extension_price_per_unit || 0);
        if (row.invoice?.amount != null) return `₦${Number(row.invoice.amount).toLocaleString()}`;
        return rate ? `₦${(units * rate).toLocaleString()}` : 'Set price on session';
      },
    },
    { title: 'Status', dataIndex: 'status', width: 110, render: (value) => <Tag>{value}</Tag> },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    {
      title: 'Actions',
      width: 180,
      render: (_, row) => (row.status === 'pending' ? (
        <Space>
          <Popconfirm title="Approve this extension?" onConfirm={() => review(row, 'approve')}>
            <Button size="small" type="primary">Approve</Button>
          </Popconfirm>
          <Popconfirm title="Reject this extension?" onConfirm={() => review(row, 'reject')}>
            <Button size="small" danger>Reject</Button>
          </Popconfirm>
        </Space>
      ) : (row.invoice?.number || '—')),
    },
  ];

  return (
    <div className="space-y-4">
      <WorkspaceHero
        eyebrow="Enrolment"
        title="Registration extensions"
        description="Review late-registration requests. Approval invoices the approved units at the semester price per unit."
        icon={BookOpen}
      >
        <RefreshButton onClick={reload} loading={loading} />
      </WorkspaceHero>
      <div className="flex flex-wrap gap-2">
        <Select
          allowClear
          className="w-44"
          placeholder="Status"
          value={status}
          onChange={(value) => setStatus(value)}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved (unpaid)' },
            { value: 'paid', label: 'Paid' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'expired', label: 'Expired' },
          ]}
        />
        <Input.TextArea className="max-w-md" rows={2} placeholder="Staff note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1200 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No extension requests.' }} />
      </div>
    </div>
  );
}
