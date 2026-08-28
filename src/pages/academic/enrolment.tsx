import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BookOpen, Plus, Search } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { formatNaira } from '../../lib/money';
import { ConfirmDeleteButton } from '../../components/ConfirmDeleteButton';
import { SessionLevelFilters } from '../../components/SessionLevelFilters';
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
  academic_session_id?: number | null;
  extension_price_per_unit?: number | string | null;
};
type CourseRef = {
  id: number;
  code: string;
  title: string;
  units?: number;
  course_type?: string;
  status?: string;
  programs?: { id: number; name: string; code?: string | null }[];
};
type ProgramRef = { id: number; name: string; code?: string | null; courses?: { id: number }[] };
type Offering = {
  id: number;
  section?: string;
  capacity: number | null;
  seats_left?: number | null;
  unlimited?: boolean;
  enrolled_count?: number;
  course_id?: number;
  academic_term_id?: number;
  lecturer_name?: string | null;
  lecturer_display_name?: string | null;
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
  level?: { id: number; name: string; code?: string; study_level?: string } | null;
  term?: (Term & { academic_session_id?: number | null }) | null;
};
type UnitLimitGroup = {
  key: string;
  program_id: number;
  academic_level_id: number | null;
  session_label: string;
  academic_session_id: number | null;
  program?: UnitLimit['program'];
  level?: UnitLimit['level'];
  terms: Array<Term & { academic_session_id?: number | null }>;
  cell: (termId: number, bucket: string) => UnitLimit | undefined;
  rows: UnitLimit[];
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
      <WorkspaceHero eyebrow="Courses" title={title} description={description} icon={BookOpen}>
        <div className="flex flex-wrap gap-2">
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
      {extra ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          {extra}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function offeringLecturerName(row: Offering) {
  return row.lecturer_display_name || row.lecturer_name || row.lecturer?.user?.name || '—';
}

function offeringSeatsLabel(row: { capacity?: number | null; seats_left?: number | null; unlimited?: boolean; enrolled_count?: number }) {
  if (row.unlimited || row.capacity == null) return 'Unlimited';
  const left = row.seats_left ?? Math.max(0, Number(row.capacity) - (row.enrolled_count || 0));
  return String(left);
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

function courseStatusLabel(value?: string) {
  if (value === 'elective') return 'Elective';
  if (value === 'required') return 'Required';
  return 'Core';
}

function courseProgrammeNames(course?: CourseRef | null) {
  const labels = (course?.programs || [])
    .map((program) => program.name || program.code)
    .filter((value): value is string => Boolean(value));
  if (labels.length === 0) return '';
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
}

function courseOfferingLabel(course?: CourseRef | null) {
  if (!course) return '—';
  return `${course.code} — ${course.title}`;
}

function termAcademicSessionId(term: Term): number | null {
  const nested = (term as Term & { session?: { id?: number } }).session?.id;
  const id = term.academic_session_id ?? nested ?? null;
  return id == null ? null : Number(id);
}

function academicSemesterTerms(terms: Term[], sessionId?: number): Term[] {
  const current = terms.find((term) => term.is_current);
  const scopeId = sessionId ?? (current ? termAcademicSessionId(current) : undefined);
  if (scopeId == null) {
    return terms.filter((term) => termAcademicSessionId(term) != null);
  }
  return terms.filter((term) => termAcademicSessionId(term) === Number(scopeId));
}

function semesterSelectOptions(terms: Term[]) {
  return terms.map((term) => ({
    value: term.id,
    label: `${term.session_label || ''} ${term.name}`.trim(),
  }));
}

function CourseOfferingCell({ course }: { course?: CourseRef | null }) {
  if (!course) return <span>—</span>;
  const programs = courseProgrammeNames(course);
  return (
    <div className="min-w-0 max-w-[28rem]">
      <div className="font-medium text-slate-800 truncate">{course.code} — {course.title}</div>
      {programs ? (
        <div className="text-xs text-slate-500 truncate" title={programs}>{programs}</div>
      ) : null}
    </div>
  );
}

function rosterLabel(status?: string) {
  if (status === 'registered') return 'Registered';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

export function OfferingsPage() {
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [termId, setTermId] = useState<number | undefined>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishForm] = Form.useForm();
  const endpoint = useMemo(() => {
    const qs = new URLSearchParams();
    if (sessionId) qs.set('academic_session_id', String(sessionId));
    if (termId) qs.set('academic_term_id', String(termId));
    if (level) qs.set('level', level);
    const query = qs.toString();
    return query ? `/api/academic/offerings?${query}` : '/api/academic/offerings';
  }, [sessionId, termId, level]);
  const { rows, loading, reload } = useResourceList<Offering>(endpoint);
  const { rows: terms } = useResourceList<Term>('/api/academic/terms');
  const { rows: courses } = useResourceList<CourseRef>('/api/academic/courses');
  const { rows: programs } = useResourceList<ProgramRef>('/api/academic/programs');
  const crud = useCrudModal<Offering>();
  const semesterTerms = useMemo(() => academicSemesterTerms(terms, sessionId), [terms, sessionId]);
  const semesterOptions = useMemo(() => semesterSelectOptions(semesterTerms), [semesterTerms]);
  const formSemesterOptions = useMemo(() => {
    const extraId = crud.editing?.academic_term_id ?? crud.editing?.term?.id;
    if (!extraId || semesterOptions.some((option) => option.value === extraId)) return semesterOptions;
    const extra = terms.find((term) => term.id === extraId);
    if (!extra) return semesterOptions;
    return [...semesterOptions, { value: extra.id, label: `${extra.session_label || ''} ${extra.name}`.trim() }];
  }, [crud.editing, semesterOptions, terms]);
  const currentTermId = termId ?? semesterTerms.find((term) => term.is_current)?.id ?? semesterTerms[0]?.id;

  useEffect(() => {
    if (!termId) return;
    if (!semesterTerms.some((term) => term.id === termId)) {
      setTermId(undefined);
    }
  }, [termId, semesterTerms]);

  const openPublish = () => {
    publishForm.setFieldsValue({
      academic_term_id: currentTermId,
      program_id: undefined,
    });
    setPublishOpen(true);
  };

  const publishFromCurriculum = async () => {
    const values = await publishForm.validateFields();
    setPublishing(true);
    try {
      const res = await api.post('/api/academic/offerings/from-curriculum', {
        academic_term_id: values.academic_term_id,
        program_id: values.program_id || null,
      });
      if (!isPendingApproval(res)) {
        const created = Number(res.data?.created ?? 0);
        const skipped = Number(res.data?.skipped ?? 0);
        message.success(
          created === 0
            ? `No new offerings. ${skipped} mapped course${skipped === 1 ? '' : 's'} already offered this semester.`
            : `Published ${created} offering${created === 1 ? '' : 's'}. ${skipped} already existed.`,
        );
        await reload();
      }
      setPublishOpen(false);
    } catch (err) {
      message.error(apiError(err, 'Unable to publish programme courses.'));
    } finally {
      setPublishing(false);
    }
  };

  const columns: ColumnsType<Offering> = [
    { title: 'Course', key: 'course', width: 320, render: (_, row) => <CourseOfferingCell course={row.course} /> },
    { title: 'Type', key: 'type', width: 120, render: (_, row) => bucketLabel(row.course?.course_type) },
    { title: 'Status', key: 'status', width: 100, render: (_, row) => courseStatusLabel(row.course?.status) },
    { title: 'Section', dataIndex: 'section', key: 'section', width: 80, render: (value) => value || 'A' },
    { title: 'Semester', key: 'term', width: 150, ellipsis: true, render: (_, row) => (row.term ? `${row.term.session_label || ''} ${row.term.name}`.trim() : '—') },
    { title: 'Lecturer', key: 'lecturer', width: 160, ellipsis: true, render: (_, row) => offeringLecturerName(row) },
    {
      title: 'Seats',
      key: 'seats',
      width: 120,
      render: (_, row) => (row.unlimited || row.capacity == null ? 'Unlimited' : `${offeringSeatsLabel(row)} / ${row.capacity}`),
    },
    actionColumn(
      (row) => crud.openEdit(row, {
        course_id: row.course_id ?? row.course?.id,
        academic_term_id: row.academic_term_id ?? row.term?.id,
        lecturer_name: row.lecturer_name || row.lecturer_display_name || row.lecturer?.user?.name || '',
        section: row.section || 'A',
        capacity: row.capacity,
      }),
      (row) => crud.remove(`/api/academic/offerings/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    const selected = values.course_ids ?? values.course_id;
    const courseIds = (Array.isArray(selected) ? selected : [selected])
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (!crud.isEdit && courseIds.length === 0) {
      message.error('Select at least one course.');
      return;
    }
    const payload: Record<string, unknown> = {
      academic_term_id: values.academic_term_id,
      lecturer_name: values.lecturer_name || null,
      section: values.section || 'A',
      capacity: values.capacity ?? null,
    };
    if (crud.isEdit) {
      payload.course_id = values.course_id ?? courseIds[0];
    } else {
      payload.course_ids = courseIds;
      payload.course_id = courseIds[0];
    }
    await crud.save('/api/academic/offerings', (id) => `/api/academic/offerings/${id}`, payload, reload);
  };

  return (
    <ResourceShell
      title="Course offerings"
      description="Publish programme courses as section A, then set lecturers and capacity. Students register from the current semester."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate({ section: 'A', academic_term_id: currentTermId, course_id: [] })}
      canAdd={courses.length > 0 && semesterTerms.length > 0}
      count={rows.length}
      countLabel="Offerings"
      extra={(
        <>
          <SessionLevelFilters
            sessionId={sessionId}
            level={level}
            onSessionChange={(value) => {
              setSessionId(value);
              setTermId(undefined);
            }}
            onLevelChange={setLevel}
          />
          <Select
            allowClear
            className="min-w-[180px]"
            placeholder="Semester"
            value={termId}
            onChange={setTermId}
            options={semesterOptions}
          />
          <Button onClick={openPublish} disabled={semesterTerms.length === 0}>
            Publish programme courses
          </Button>
        </>
      )}
    >
      <Table rowKey="id" size="middle" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1080 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No offerings yet. Publish programme courses for this semester, or add one course.' }} />
      <Modal
        title="Publish programme courses"
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={publishFromCurriculum}
        confirmLoading={publishing}
        okText="Publish"
        destroyOnHidden
        width={520}
      >
        <p className="text-sm text-slate-600 mb-4">
          Creates a section A offering (unlimited seats, no lecturer) for every catalog course assigned on Programme courses.
          Courses that already have an offering this semester are skipped. Add extra sections or lecturers afterwards.
        </p>
        <Form form={publishForm} layout="vertical">
          <Form.Item name="academic_term_id" label="Semester" rules={[{ required: true, message: 'Choose the semester to publish into.' }]}>
            <Select options={semesterOptions} />
          </Form.Item>
          <Form.Item name="program_id" label="Programme" extra="Leave blank to publish mapped courses from every programme. Shared courses still create one offering.">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="All programmes"
              options={programs.map((program) => ({
                value: program.id,
                label: program.code ? `${program.name} (${program.code})` : program.name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title={crud.isEdit ? 'Edit offering' : 'Add offering'} open={crud.open} onCancel={crud.close} onOk={submit} confirmLoading={crud.saving} destroyOnHidden width={520}>
        <Form form={crud.form} layout="vertical" className="mt-4">
          {crud.isEdit ? (
            <Form.Item name="course_id" label="Course" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={courses.map((course) => ({ value: course.id, label: courseOfferingLabel(course) }))} />
            </Form.Item>
          ) : (
            <Form.Item name="course_id" label="Courses" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one course.' }]}>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                maxTagCount="responsive"
                placeholder="Select one or more courses"
                options={courses.map((course) => ({ value: course.id, label: courseOfferingLabel(course) }))}
              />
            </Form.Item>
          )}
          <Form.Item name="academic_term_id" label="Semester" rules={[{ required: true }]}>
            <Select options={formSemesterOptions} />
          </Form.Item>
          <Form.Item
            name="lecturer_name"
            label="Lecturer"
            extra="Type the lecturer’s name. They do not need a portal account."
          >
            <Input placeholder="e.g. Dr. Ada Okonkwo" allowClear />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="section"
              label="Section"
              extra="A, B, C… when the same course has more than one group this semester. Leave A if there is only one group."
            >
              <Input placeholder="A" />
            </Form.Item>
            <Form.Item
              name="capacity"
              label="Capacity"
              extra="Leave blank for unlimited seats. Set a number to stop registration when this group is full."
            >
              <InputNumber min={1} max={1000} className="w-full" placeholder="Unlimited" />
            </Form.Item>
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
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [matches, setMatches] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [graceBucket, setGraceBucket] = useState('overall');
  const [graceUnits, setGraceUnits] = useState(1);
  const [graceReason, setGraceReason] = useState('');
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<number[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const canGrace = has('academic.enrollments.grace');

  const loadContext = async (id: number) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/academic/course-registration', { params: { student_id: id } });
      setCtx(data);
      setStudentId(id);
      setSelectedOfferingIds([]);
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
      const { data } = await api.get('/api/academic/course-registration/students', {
        params: { search, academic_session_id: sessionId, level },
      });
      const list = Array.isArray(data) ? data : [];
      setMatches(list);
      if (list.length === 1) loadContext(list[0].id);
    } catch (err) {
      message.error(apiError(err, 'Unable to search students.'));
    }
  };

  const enroll = async (courseOfferingId: number) => {
    if (!studentId) return;
    setEnrolling(true);
    try {
      const res = await api.post('/api/academic/course-registration/enroll', {
        student_id: studentId,
        course_offering_id: courseOfferingId,
        reason: reason || undefined,
      });
      if (!isPendingApproval(res)) {
        message.success('Course registered.');
        setReason('');
        await loadContext(studentId);
      }
    } catch (err) {
      message.error(apiError(err, 'Unable to register this course.'));
    } finally {
      setEnrolling(false);
    }
  };

  const enrollSelected = async () => {
    if (!studentId || selectedOfferingIds.length === 0) return;
    setEnrolling(true);
    try {
      const res = await api.post('/api/academic/course-registration/enroll', {
        student_id: studentId,
        course_offering_ids: selectedOfferingIds,
        reason: reason || undefined,
      });
      if (!isPendingApproval(res)) {
        message.success(`Registered ${selectedOfferingIds.length} course${selectedOfferingIds.length === 1 ? '' : 's'}.`);
        setReason('');
        setSelectedOfferingIds([]);
        await loadContext(studentId);
      }
    } catch (err) {
      message.error(apiError(err, 'Unable to register the selected courses.'));
    } finally {
      setEnrolling(false);
    }
  };

  const drop = async (enrollmentId: number) => {
    if (!studentId) return;
    try {
      const res = await api.delete(`/api/academic/course-registration/enrollments/${enrollmentId}`, { data: { reason: reason || undefined } });
      if (!isPendingApproval(res)) {
        message.success('Course dropped.');
        setReason('');
        await loadContext(studentId);
      }
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
      const res = await api.post('/api/academic/course-registration/grace', {
        student_id: studentId,
        academic_term_id: ctx?.term?.id,
        bucket: graceBucket,
        extra_units: graceUnits,
        reason: graceReason,
      });
      if (!isPendingApproval(res)) {
        message.success('Grace units granted.');
        setGraceReason('');
        await loadContext(studentId);
      }
    } catch (err) {
      message.error(apiError(err, 'Unable to grant grace units.'));
    }
  };

  const reasonNeeded = ctx && (ctx.window === 'Closed' || !ctx.tuition_ok);

  return (
    <div className="space-y-4">
      <WorkspaceHero
        eyebrow="Courses"
        title="Course registration"
        description="Add or drop courses for a student, one at a time or in bulk. A reason is required when the window is closed, tuition is below 25%, or a carry-over is dropped."
        icon={BookOpen}
      >
        <RefreshButton onClick={() => studentId && loadContext(studentId)} loading={loading} />
      </WorkspaceHero>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <SessionLevelFilters sessionId={sessionId} level={level} onSessionChange={setSessionId} onLevelChange={setLevel} />
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

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-800 px-4 pt-3 pb-2">Units vs limits</h3>
            <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              {BUCKETS.map((bucket) => {
                const limit = ctx.limits?.[bucket.value] || {};
                const used = ctx.units?.[bucket.value] ?? 0;
                return (
                  <div key={bucket.value} className="px-3 py-2">
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
                { title: 'Status', width: 110, render: (_, row: any) => courseStatusLabel(row.offering?.course?.status) },
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-800">Available</h3>
              <Button
                size="small"
                type="primary"
                disabled={enrolling || selectedOfferingIds.length === 0}
                onClick={enrollSelected}
              >
                {enrolling ? 'Registering…' : `Register selected (${selectedOfferingIds.length})`}
              </Button>
            </div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={ctx.available || []}
              locale={{ emptyText: 'No offerings available for this student.' }}
              rowSelection={{
                selectedRowKeys: selectedOfferingIds,
                onChange: (keys) => setSelectedOfferingIds(keys.map((key) => Number(key))),
                getCheckboxProps: () => ({ disabled: enrolling }),
              }}
              columns={[
                { title: 'Course', render: (_, row: any) => (
                  <span>
                    {`${row.course?.code || ''} ${row.course?.title || ''}`.trim()}
                    {row.is_carry_over ? <Tag color="orange" className="ml-2">Carry-over</Tag> : null}
                    {row.is_outstanding ? <Tag color="blue" className="ml-2">Outstanding</Tag> : null}
                  </span>
                ) },
                { title: 'Units', width: 70, render: (_, row: any) => row.course?.units ?? '—' },
                { title: 'Bucket', width: 130, render: (_, row: any) => bucketLabel(row.bucket || row.course?.course_type) },
                { title: 'Status', width: 110, render: (_, row: any) => courseStatusLabel(row.course?.status) },
                { title: 'Seats', width: 100, render: (_, row: any) => offeringSeatsLabel(row) },
                {
                  title: '',
                  width: 110,
                  render: (_, row: any) => (
                    <Button size="small" type="primary" disabled={enrolling} onClick={() => enroll(row.id)}>Register</Button>
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
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form] = Form.useForm();
  const endpoint = useMemo(() => {
    const qs = new URLSearchParams();
    if (sessionId) qs.set('academic_session_id', String(sessionId));
    if (level) qs.set('level', level);
    const query = qs.toString();
    return query ? `/api/academic/unit-limits?${query}` : '/api/academic/unit-limits';
  }, [sessionId, level]);
  const { rows, loading, reload } = useResourceList<UnitLimit>(endpoint);
  const [meta, setMeta] = useState<{
    programs: Array<{ id: number; name: string; code?: string; study_level?: string }>;
    levels: Array<{ id: number; name: string; code?: string; study_level?: string }>;
    sessions: Array<{ id: number; label: string }>;
    terms: Array<Term & { academic_session_id?: number | null }>;
  }>({ programs: [], levels: [], sessions: [], terms: [] });

  useEffect(() => {
    api.get('/api/academic/unit-limits/meta').then(({ data }) => setMeta({
      programs: data.programs || [],
      levels: data.levels || [],
      sessions: data.sessions || [],
      terms: data.terms || [],
    })).catch(() => {});
  }, []);

  const selectedProgramId = Form.useWatch('program_id', form);
  const selectedSessionId = Form.useWatch('academic_session_id', form);
  const programLevels = useMemo(() => {
    const studyLevel = meta.programs.find((program) => program.id === selectedProgramId)?.study_level;
    if (!studyLevel) return meta.levels;
    const matched = meta.levels.filter((item) => item.study_level === studyLevel);
    return matched.length ? matched : meta.levels;
  }, [meta.levels, meta.programs, selectedProgramId]);
  const formTerms = useMemo(
    () => meta.terms.filter((term) => Number(term.academic_session_id) === Number(selectedSessionId)),
    [meta.terms, selectedSessionId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, UnitLimitGroup>();
    for (const row of rows) {
      const sessionLabel = row.term?.session_label || 'Any session';
      const sessionKey = row.term?.academic_session_id ?? sessionLabel;
      const key = `${row.program_id}:${row.academic_level_id ?? 'any'}:${sessionKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          program_id: row.program_id,
          academic_level_id: row.academic_level_id ?? null,
          session_label: sessionLabel,
          academic_session_id: row.term?.academic_session_id ?? null,
          program: row.program,
          level: row.level,
          terms: row.term ? [row.term] : [],
          rows: [row],
          cell: () => undefined,
        });
        continue;
      }
      existing.rows.push(row);
      if (row.term && !existing.terms.some((term) => term.id === row.term?.id)) {
        existing.terms.push(row.term);
      }
    }
    return [...map.values()].map((group) => {
      const cells = new Map(group.rows.map((row) => [`${row.academic_term_id}:${row.bucket}`, row]));
      group.terms.sort((a, b) => a.id - b.id);
      group.cell = (termId, bucket) => cells.get(`${termId}:${bucket}`);
      return group;
    });
  }, [rows]);

  const openCreate = () => {
    const current = meta.terms.find((term) => term.is_current);
    setEditingKey(null);
    form.resetFields();
    form.setFieldsValue({
      academic_session_id: sessionId || current?.academic_session_id,
      cells: {},
    });
    setOpen(true);
  };

  const openEdit = (group: UnitLimitGroup) => {
    const cells: Record<string, Record<string, { min?: number; max?: number }>> = {};
    for (const row of group.rows) {
      if (!row.academic_term_id) continue;
      cells[String(row.academic_term_id)] ??= {};
      cells[String(row.academic_term_id)][row.bucket] = { min: row.min_units, max: row.max_units };
    }
    setEditingKey(group.key);
    form.resetFields();
    form.setFieldsValue({
      program_id: group.program_id,
      academic_level_id: group.academic_level_id || undefined,
      academic_session_id: group.academic_session_id || undefined,
      cells,
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const terms = meta.terms.filter((term) => Number(term.academic_session_id) === Number(values.academic_session_id));
    if (!terms.length) {
      message.error('This session has no semesters yet.');
      return;
    }
    const limits = terms.flatMap((term) => BUCKETS.map((bucket) => {
      const cell = values.cells?.[String(term.id)]?.[bucket.value] || {};
      const min = cell.min;
      const max = cell.max;
      if (min == null && max == null) {
        return {
          academic_term_id: term.id,
          bucket: bucket.value,
          min_units: null,
          max_units: null,
        };
      }
      return {
        academic_term_id: term.id,
        bucket: bucket.value,
        min_units: min,
        max_units: max,
      };
    }));
    if (!limits.some((row) => row.min_units != null && row.max_units != null)) {
      message.error('Enter at least one min/max pair.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/api/academic/unit-limits/sync', {
        program_id: values.program_id,
        academic_level_id: values.academic_level_id || null,
        academic_term_ids: terms.map((term) => term.id),
        limits,
      });
      if (!isPendingApproval(res)) {
        message.success('Unit limits saved for this programme and level.');
        setOpen(false);
        reload();
      }
    } catch (err) {
      message.error(apiError(err, 'Could not save unit limits.'));
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async (group: UnitLimitGroup) => {
    const termIds = group.terms.map((term) => term.id);
    if (!termIds.length) return;
    try {
      const res = await api.post('/api/academic/unit-limits/destroy-group', {
        program_id: group.program_id,
        academic_level_id: group.academic_level_id,
        academic_term_ids: termIds,
      });
      if (!isPendingApproval(res)) {
        message.success('Unit limit schedule deleted.');
        reload();
      }
    } catch (err) {
      message.error(apiError(err, 'Could not delete this schedule.'));
    }
  };

  const columns: ColumnsType<UnitLimitGroup> = [
    {
      title: 'Programme',
      render: (_, group) => (
        <div>
          <div className="font-medium text-slate-900">{group.program?.name || '—'}</div>
          {group.program?.code && <div className="text-xs font-mono text-slate-500">{group.program.code}</div>}
        </div>
      ),
    },
    { title: 'Level', width: 140, render: (_, group) => group.level?.name || 'Any level' },
    { title: 'Session', width: 130, render: (_, group) => group.session_label },
    {
      title: 'Min / max by semester',
      render: (_, group) => (
        <table className="text-xs min-w-[18rem]">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium pr-3 py-0.5">Bucket</th>
              {group.terms.map((term) => (
                <th key={term.id} className="text-left font-medium pr-3 py-0.5 whitespace-nowrap">{term.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUCKETS.filter((bucket) => group.terms.some((term) => group.cell(term.id, bucket.value))).map((bucket) => (
              <tr key={bucket.value}>
                <td className="pr-3 py-0.5 text-slate-600">{bucket.label}</td>
                {group.terms.map((term) => {
                  const cell = group.cell(term.id, bucket.value);
                  return (
                    <td key={term.id} className="pr-3 py-0.5 font-medium text-slate-800 whitespace-nowrap">
                      {cell ? `${cell.min_units}–${cell.max_units}` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_, group) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openEdit(group)}>Edit</Button>
          <ConfirmDeleteButton onConfirm={() => removeGroup(group)} />
        </Space>
      ),
    },
  ];

  return (
    <ResourceShell
      title="Unit limits"
      description="One row per programme, level, and session. Set First and Second semester min/max for each bucket in a single form. Overall min and max are required for roster Registered status."
      loading={loading}
      onRefresh={reload}
      onAdd={openCreate}
      count={groups.length}
      countLabel="Schedules"
      extra={<SessionLevelFilters sessionId={sessionId} level={level} onSessionChange={setSessionId} onLevelChange={setLevel} />}
    >
      <Table
        rowKey="key"
        columns={columns}
        dataSource={groups}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: 'No unit limits yet. Add a programme schedule instead of one row per bucket.' }}
      />
      <Modal
        title={editingKey ? 'Edit unit limits' : 'Add unit limits'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Save schedule"
        confirmLoading={saving}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="program_id" label="Programme" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!!editingKey}
              onChange={() => form.setFieldValue('academic_level_id', undefined)}
              options={meta.programs.map((program) => ({
                value: program.id,
                label: program.code ? `${program.code} — ${program.name}` : program.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="academic_level_id" label="Level">
            <Select
              allowClear
              disabled={!!editingKey}
              options={programLevels.map((item) => ({
                value: item.id,
                label: item.study_level ? `${item.name} · ${item.study_level}` : item.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="academic_session_id" label="Session" rules={[{ required: true, message: 'Choose the session whose semesters you are setting.' }]}>
            <Select
              disabled={!!editingKey}
              options={meta.sessions.map((session) => ({ value: session.id, label: session.label }))}
            />
          </Form.Item>
          {formTerms.length === 0 ? (
            <p className="text-sm text-slate-500">Select a session to set First and Second semester limits together.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bucket</th>
                    {formTerms.map((term) => (
                      <th key={term.id} className="px-3 py-2 font-medium">{term.name} · min / max</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BUCKETS.map((bucket) => (
                    <tr key={bucket.value} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {bucket.label}
                        {bucket.value === 'overall' && <div className="text-xs font-normal text-slate-500">Used for Registered status</div>}
                      </td>
                      {formTerms.map((term) => (
                        <td key={`${term.id}-${bucket.value}`} className="px-2 py-2">
                          <div className="flex gap-2">
                            <Form.Item name={['cells', String(term.id), bucket.value, 'min']} className="!mb-0">
                              <InputNumber min={0} max={50} placeholder="Min" className="w-full" />
                            </Form.Item>
                            <Form.Item name={['cells', String(term.id), bucket.value, 'max']} className="!mb-0">
                              <InputNumber min={0} max={50} placeholder="Max" className="w-full" />
                            </Form.Item>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3">Leave a cell blank to skip that bucket. First and Second stay on this one schedule instead of separate rows.</p>
        </Form>
      </Modal>
    </ResourceShell>
  );
}

export function RegistrationExtensionsPage() {
  const [status, setStatus] = useState<string | undefined>('pending');
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const endpoint = useMemo(() => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (sessionId) qs.set('academic_session_id', String(sessionId));
    if (level) qs.set('level', level);
    const query = qs.toString();
    return query ? `/api/academic/registration-extensions?${query}` : '/api/academic/registration-extensions';
  }, [status, sessionId, level]);
  const { rows, loading, reload } = useResourceList<Extension>(endpoint);
  const [note, setNote] = useState('');
  const [unitsById, setUnitsById] = useState<Record<number, number>>({});

  const review = async (row: Extension, decision: 'approve' | 'reject') => {
    try {
      const res = await api.post(`/api/academic/registration-extensions/${row.id}/review`, {
        decision,
        approved_units: decision === 'approve' ? (unitsById[row.id] || row.requested_units) : undefined,
        staff_note: note || undefined,
      });
      if (!isPendingApproval(res)) {
        message.success(decision === 'approve' ? 'Extension approved. An invoice was created.' : 'Extension rejected.');
        setNote('');
        reload();
      }
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
        if (row.invoice?.amount != null) return formatNaira(row.invoice.amount);
        return rate ? formatNaira(units * rate) : 'Set price on session';
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
        eyebrow="Courses"
        title="Registration extensions"
        description="Review late-registration requests. Approval invoices the approved units at the semester price per unit."
        icon={BookOpen}
      >
        <RefreshButton onClick={reload} loading={loading} />
      </WorkspaceHero>
      <div className="flex flex-wrap gap-2">
        <SessionLevelFilters sessionId={sessionId} level={level} onSessionChange={setSessionId} onLevelChange={setLevel} />
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
