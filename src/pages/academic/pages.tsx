import {
  Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import { RefreshButton } from '../../components/RefreshButton';
import { ENTRY_MODES, STUDY_LEVELS } from './constants';
import { actionColumn, formatDisplayDate, fromDateValue, toDateValue, useCrudModal } from './crudHelpers';
import { useResourceList } from './useResourceList';

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((m) => m.value === mode)?.label ?? mode.toUpperCase();
}

function entryModeTags(modes?: string[]) {
  if (!modes?.length) return '—';
  return (
    <Space size={[4, 4]} wrap>
      {modes.map((m) => <Tag key={m}>{entryModeLabel(m)}</Tag>)}
    </Space>
  );
}

type ProgramRef = { id: number; name: string; code?: string };
type CourseRef = { id: number; code: string; title: string };

function programTags(programs?: ProgramRef[]) {
  if (!programs?.length) return '—';
  return (
    <Space size={[4, 4]} wrap>
      {programs.map((p) => <Tag key={p.id}>{p.code || p.name}</Tag>)}
    </Space>
  );
}

function courseTags(courses?: CourseRef[]) {
  if (!courses?.length) return '—';
  return (
    <Space size={[4, 4]} wrap>
      {courses.map((c) => <Tag key={c.id}>{c.code}</Tag>)}
    </Space>
  );
}

type Campus = { id: number; name: string; code?: string; city?: string; address?: string; is_active?: boolean };
type Faculty = { id: number; name: string; code?: string; campus_id?: number; campus?: Campus };
type Department = { id: number; name: string; code?: string; faculty_id?: number; faculty?: Faculty };
type Term = { id: number; name: string; session_label: string; starts_on?: string; ends_on?: string; is_current: boolean };
type Program = {
  id: number; name: string; code?: string; award_type: string; study_level: string;
  entry_modes?: string[]; duration_years: number; is_active: boolean;
  department_id?: number; department?: Department; courses?: CourseRef[];
};
type Course = {
  id: number; code: string; title: string; units: number;
  department_id?: number; department?: Department; programs?: ProgramRef[];
};
type Level = { id: number; name: string; code?: string; study_level: string; sort_order: number; is_active: boolean };
type OlevelSubject = { id: number; name: string; code?: string; is_active: boolean };
type Intake = {
  id: number; name: string; entry_mode: string; academic_term_id?: number;
  opens_on?: string; closes_on?: string; is_open: boolean; application_fee_amount?: number | string;
  term?: Term;
};

function ResourceShell({
  title, description, loading, onRefresh, onAdd, canAdd = true, accessError, children,
}: {
  title: string; description: string; loading: boolean; onRefresh: () => void;
  onAdd?: () => void; canAdd?: boolean; accessError?: string | null; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {accessError && (
        <Alert type="warning" showIcon message="No access" description={accessError} />
      )}
      <PageHeader title={title} description={description}>
        <div className="flex gap-2">
          <RefreshButton onClick={onRefresh} loading={loading} />
          {canAdd && onAdd && (
            <Button type="primary" icon={<Plus size={14} />} onClick={onAdd}>Add</Button>
          )}
        </div>
      </PageHeader>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function CrudModal({
  title, open, saving, isEdit, form, onClose, onSubmit, children,
}: {
  title: string; open: boolean; saving: boolean; isEdit: boolean;
  form: ReturnType<typeof Form.useForm>[0]; onClose: () => void; onSubmit: () => void; children: React.ReactNode;
}) {
  return (
    <Modal
      title={isEdit ? `Edit ${title}` : `Add ${title}`}
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={saving}
      destroyOnClose
      width={480}
    >
      <Form form={form} layout="vertical" className="mt-4">{children}</Form>
    </Modal>
  );
}

export function CampusesPage() {
  const { rows, loading, reload, accessError } = useResourceList<Campus>('/api/academic/campuses');
  const crud = useCrudModal<Campus>();

  const columns: ColumnsType<Campus> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100, render: (v) => v || '—' },
    { title: 'City', dataIndex: 'city', key: 'city', render: (v) => v || '—' },
    { title: 'Address', dataIndex: 'address', key: 'address', render: (v) => v || '—' },
    actionColumn(
      (row) => crud.openEdit(row, { ...row, is_active: row.is_active ?? true }),
      (row) => crud.remove(`/api/campuses/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/campuses', (id) => `/api/campuses/${id}`, values, reload);
  };

  return (
    <ResourceShell title="Campuses" description="Physical campuses where colleges and departments are located." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ is_active: true })} accessError={accessError}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 700 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No campuses yet.' }} />
      <CrudModal title="campus" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="Code"><Input /></Form.Item>
        <Form.Item name="city" label="City"><Input /></Form.Item>
        <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
        {crud.isEdit && <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>}
      </CrudModal>
    </ResourceShell>
  );
}

export function CollegesPage() {
  const { rows, loading, reload } = useResourceList<Faculty>('/api/academic/faculties');
  const { rows: campuses } = useResourceList<Campus>('/api/academic/campuses');
  const crud = useCrudModal<Faculty>();

  const columns: ColumnsType<Faculty> = [
    { title: 'College', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100, render: (v) => v || '—' },
    { title: 'Campus', key: 'campus', render: (_, r) => r.campus?.name || '—' },
    actionColumn(
      (row) => crud.openEdit(row, { name: row.name, code: row.code, campus_id: row.campus_id ?? row.campus?.id }),
      (row) => crud.remove(`/api/faculties/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/faculties', (id) => `/api/faculties/${id}`, values, reload);
  };

  return (
    <ResourceShell title="Colleges" description="Academic colleges (faculties) within each campus." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate()} canAdd={campuses.length > 0}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 700 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No colleges yet.' }} />
      <CrudModal title="college" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="campus_id" label="Campus" rules={[{ required: true }]}>
          <Select options={campuses.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select campus" />
        </Form.Item>
        <Form.Item name="name" label="College name" rules={[{ required: true }]}><Input placeholder="College of Engineering" /></Form.Item>
        <Form.Item name="code" label="Code"><Input placeholder="COE" /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function DepartmentsPage() {
  const { rows, loading, reload } = useResourceList<Department>('/api/academic/departments');
  const { rows: faculties } = useResourceList<Faculty>('/api/academic/faculties');
  const crud = useCrudModal<Department>();

  const columns: ColumnsType<Department> = [
    { title: 'Department', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100, render: (v) => v || '—' },
    { title: 'College', key: 'faculty', render: (_, r) => r.faculty?.name || '—' },
    { title: 'Campus', key: 'campus', render: (_, r) => r.faculty?.campus?.name || '—' },
    actionColumn(
      (row) => crud.openEdit(row, { name: row.name, code: row.code, faculty_id: row.faculty_id ?? row.faculty?.id }),
      (row) => crud.remove(`/api/departments/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/departments', (id) => `/api/departments/${id}`, values, reload);
  };

  return (
    <ResourceShell title="Departments" description="Academic departments under each college." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate()} canAdd={faculties.length > 0}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No departments yet.' }} />
      <CrudModal title="department" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="faculty_id" label="College" rules={[{ required: true }]}>
          <Select options={faculties.map((f) => ({ value: f.id, label: `${f.name}${f.campus ? ` (${f.campus.name})` : ''}` }))} placeholder="Select college" showSearch optionFilterProp="label" />
        </Form.Item>
        <Form.Item name="name" label="Department name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="Code"><Input /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function SessionsPage() {
  const { rows, loading, reload } = useResourceList<Term>('/api/academic/terms');
  const crud = useCrudModal<Term>();

  const columns: ColumnsType<Term> = [
    { title: 'Session', dataIndex: 'session_label', key: 'session_label' },
    { title: 'Term', dataIndex: 'name', key: 'name' },
    { title: 'Starts', dataIndex: 'starts_on', key: 'starts_on', width: 120, render: (v) => formatDisplayDate(v) },
    { title: 'Ends', dataIndex: 'ends_on', key: 'ends_on', width: 120, render: (v) => formatDisplayDate(v) },
    { title: 'Current', dataIndex: 'is_current', key: 'is_current', width: 90, render: (v) => (v ? <Tag color="blue">Current</Tag> : '—') },
    actionColumn(
      (row) => crud.openEdit(row, {
        session_label: row.session_label,
        name: row.name,
        starts_on: toDateValue(row.starts_on),
        ends_on: toDateValue(row.ends_on),
        is_current: row.is_current,
      }),
      (row) => crud.remove(`/api/terms/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/terms', (id) => `/api/terms/${id}`, {
      ...values,
      starts_on: fromDateValue(values.starts_on),
      ends_on: fromDateValue(values.ends_on),
      is_current: values.is_current ?? false,
    }, reload);
  };

  return (
    <ResourceShell title="Academic sessions" description="Sessions and terms (e.g. 2025/2026 Harmattan)." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ is_current: false })}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No sessions yet.' }} />
      <CrudModal title="session / term" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="session_label" label="Session label" rules={[{ required: true }]}><Input placeholder="2025/2026" /></Form.Item>
        <Form.Item name="name" label="Term name" rules={[{ required: true }]}><Input placeholder="Harmattan 2025/2026" /></Form.Item>
        <Form.Item name="starts_on" label="Starts on"><DatePicker className="w-full" /></Form.Item>
        <Form.Item name="ends_on" label="Ends on"><DatePicker className="w-full" /></Form.Item>
        <Form.Item name="is_current" label="Set as current" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function ProgrammesPage() {
  const { rows, loading, reload } = useResourceList<Program>('/api/academic/programs');
  const { rows: departments } = useResourceList<Department>('/api/academic/departments');
  const { rows: allCourses } = useResourceList<Course>('/api/academic/courses');
  const crud = useCrudModal<Program>();

  const columns: ColumnsType<Program> = [
    { title: 'Programme', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: (v) => v || '—' },
    { title: 'Award', dataIndex: 'award_type', key: 'award_type', width: 90 },
    { title: 'Years', dataIndex: 'duration_years', key: 'duration_years', width: 70 },
    { title: 'Admission categories', key: 'entry_modes', width: 180, render: (_, r) => entryModeTags(r.entry_modes) },
    { title: 'Courses', key: 'courses', width: 160, render: (_, r) => courseTags(r.courses) },
    { title: 'Department', key: 'department', render: (_, r) => r.department?.name || '—' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90, render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    actionColumn(
      (row) => crud.openEdit(row, {
        department_id: row.department_id ?? row.department?.id,
        name: row.name,
        code: row.code,
        award_type: row.award_type,
        study_level: row.study_level,
        entry_modes: row.entry_modes ?? [],
        duration_years: row.duration_years,
        course_ids: row.courses?.map((c) => c.id) ?? [],
        is_active: row.is_active,
      }),
      (row) => crud.remove(`/api/programs/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/programs', (id) => `/api/programs/${id}`, values, reload);
  };

  return (
    <ResourceShell title="Programmes" description="Define programmes, map courses to the curriculum, and set admission categories." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ duration_years: 4, is_active: true, entry_modes: ['utme'], course_ids: [] })} canAdd={departments.length > 0}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1200 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No programmes yet.' }} />
      <CrudModal title="programme" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="department_id" label="Department" rules={[{ required: true }]}>
          <Select options={departments.map((d) => ({ value: d.id, label: d.name }))} showSearch optionFilterProp="label" />
        </Form.Item>
        <Form.Item name="name" label="Programme name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="Code"><Input /></Form.Item>
        <Form.Item name="award_type" label="Award type" rules={[{ required: true }]}><Input placeholder="B.Eng" /></Form.Item>
        <Form.Item name="study_level" label="Study level" rules={[{ required: true }]}><Select options={STUDY_LEVELS} /></Form.Item>
        <Form.Item name="duration_years" label="Number of years" rules={[{ required: true, type: 'number', min: 1, max: 10 }]}>
          <InputNumber min={1} max={10} className="w-full" />
        </Form.Item>
        <Form.Item name="entry_modes" label="Admission categories" rules={[{ required: true, type: 'array', min: 1 }]} extra="Which entry modes can select this programme on the application form.">
          <Select mode="multiple" options={ENTRY_MODES} placeholder="Select UTME, DE, JUPEB, PG…" />
        </Form.Item>
        <Form.Item name="course_ids" label="Courses in curriculum" extra="Map catalogue courses that belong to this programme.">
          <Select
            mode="multiple"
            placeholder="Select courses"
            showSearch
            optionFilterProp="label"
            options={allCourses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
          />
        </Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function LevelsPage() {
  const { rows, loading, reload } = useResourceList<Level>('/api/academic/levels');
  const crud = useCrudModal<Level>();

  const columns: ColumnsType<Level> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: (v) => v || '—' },
    { title: 'Study level', dataIndex: 'study_level', key: 'study_level', width: 130, render: (v) => <Tag>{v}</Tag> },
    { title: 'Order', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90, render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    actionColumn(
      (row) => crud.openEdit(row, row),
      (row) => crud.remove(`/api/academic/levels/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/academic/levels', (id) => `/api/academic/levels/${id}`, { ...values, is_active: values.is_active ?? true }, reload);
  };

  return (
    <ResourceShell title="Levels" description="Study levels such as 100, 200, or Year 1." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ sort_order: 1, is_active: true })}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 700 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No levels yet.' }} />
      <CrudModal title="level" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="name" label="Level name" rules={[{ required: true }]}><Input placeholder="100 Level" /></Form.Item>
        <Form.Item name="code" label="Code"><Input placeholder="100" /></Form.Item>
        <Form.Item name="study_level" label="Study level" rules={[{ required: true }]}><Select options={STUDY_LEVELS} /></Form.Item>
        <Form.Item name="sort_order" label="Sort order"><InputNumber min={0} className="w-full" /></Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function CoursesPage() {
  const { rows, loading, reload } = useResourceList<Course>('/api/academic/courses');
  const { rows: departments } = useResourceList<Department>('/api/academic/departments');
  const { rows: programs } = useResourceList<Program>('/api/academic/programs');
  const crud = useCrudModal<Course>();

  const columns: ColumnsType<Course> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 110 },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Units', dataIndex: 'units', key: 'units', width: 70 },
    { title: 'Programmes', key: 'programs', width: 180, render: (_, r) => programTags(r.programs) },
    { title: 'Department', key: 'department', render: (_, r) => r.department?.name || '—' },
    actionColumn(
      (row) => crud.openEdit(row, {
        department_id: row.department_id ?? row.department?.id,
        code: row.code,
        title: row.title,
        units: row.units,
        program_ids: row.programs?.map((p) => p.id) ?? [],
      }),
      (row) => crud.remove(`/api/academic/courses/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/academic/courses', (id) => `/api/academic/courses/${id}`, values, reload);
  };

  return (
    <ResourceShell title="Courses" description="Course catalog — each course must be linked to one or more programmes." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ units: 3, program_ids: [] })} canAdd={departments.length > 0 && programs.length > 0}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 900 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No courses yet.' }} />
      <CrudModal title="course" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="department_id" label="Department" rules={[{ required: true }]}>
          <Select options={departments.map((d) => ({ value: d.id, label: d.name }))} showSearch optionFilterProp="label" />
        </Form.Item>
        <Form.Item name="code" label="Course code" rules={[{ required: true }]}><Input placeholder="CPE 201" /></Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="units" label="Credit units" rules={[{ required: true }]}><InputNumber min={1} max={12} className="w-full" /></Form.Item>
        <Form.Item name="program_ids" label="Programmes" rules={[{ required: true, type: 'array', min: 1 }]} extra="Which programmes include this course in their curriculum.">
          <Select
            mode="multiple"
            placeholder="Select programmes"
            showSearch
            optionFilterProp="label"
            options={programs.map((p) => ({ value: p.id, label: `${p.code || p.name} — ${p.name}` }))}
          />
        </Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function IntakesPage() {
  const { rows, loading, reload } = useResourceList<Intake>('/api/academic/intakes');
  const { rows: terms } = useResourceList<Term>('/api/academic/terms');
  const crud = useCrudModal<Intake>();

  const columns: ColumnsType<Intake> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'entry_mode', key: 'entry_mode', width: 120, render: (v) => <Tag>{entryModeLabel(v)}</Tag> },
    { title: 'Session', key: 'term', render: (_, r) => r.term?.session_label || '—' },
    { title: 'Opens', dataIndex: 'opens_on', key: 'opens_on', width: 110, render: (v) => formatDisplayDate(v) },
    { title: 'Closes', dataIndex: 'closes_on', key: 'closes_on', width: 110, render: (v) => formatDisplayDate(v) },
    {
      title: 'Application fee',
      dataIndex: 'application_fee_amount',
      key: 'application_fee_amount',
      width: 130,
      render: (value?: number | string) => (value != null ? `₦${Number(value).toLocaleString()}` : '—'),
    },
    { title: 'Open', dataIndex: 'is_open', key: 'is_open', width: 90, render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? 'Open' : 'Closed'}</Tag> },
    actionColumn(
      (row) => crud.openEdit(row, {
        academic_term_id: row.academic_term_id ?? row.term?.id,
        name: row.name,
        entry_mode: row.entry_mode,
        opens_on: toDateValue(row.opens_on),
        closes_on: toDateValue(row.closes_on),
        application_fee_amount: row.application_fee_amount != null ? Number(row.application_fee_amount) : undefined,
        is_open: row.is_open,
      }),
      (row) => crud.remove(`/api/intakes/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/intakes', (id) => `/api/intakes/${id}`, {
      ...values,
      opens_on: fromDateValue(values.opens_on),
      closes_on: fromDateValue(values.closes_on),
      is_open: values.is_open === true,
    }, reload);
  };

  return (
    <ResourceShell title="Application windows" description="Control when the application form opens and closes, which session it applies to, the application fee, and whether it is for UTME, DE, JUPEB, PG, or Transfer." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ is_open: true })} canAdd={terms.length > 0}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No application windows yet.' }} />
      <CrudModal title="application window" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="academic_term_id" label="Academic session" rules={[{ required: true }]}>
          <Select options={terms.map((t) => ({ value: t.id, label: `${t.session_label} — ${t.name}` }))} />
        </Form.Item>
        <Form.Item name="name" label="Window name" rules={[{ required: true }]}><Input placeholder="UTME 2025/2026" /></Form.Item>
        <Form.Item name="entry_mode" label="Admission category" rules={[{ required: true }]} extra="UTME, Direct Entry, JUPEB, Postgraduate, or Transfer.">
          <Select options={ENTRY_MODES} />
        </Form.Item>
        <Form.Item name="opens_on" label="Application opens" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item>
        <Form.Item name="closes_on" label="Application closes" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item>
        <Form.Item
          name="application_fee_amount"
          label="Application fee (₦)"
          rules={[{ required: true, message: 'Set the application fee for this window.' }]}
          extra="Applicants pay this amount before they can complete the form."
        >
          <InputNumber min={0} className="w-full" />
        </Form.Item>
        <Form.Item name="is_open" label="Accepting applications" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function OlevelPage() {
  const { rows, loading, reload } = useResourceList<OlevelSubject>('/api/academic/olevel-subjects');
  const crud = useCrudModal<OlevelSubject>();

  const columns: ColumnsType<OlevelSubject> = [
    { title: 'Subject', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90, render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    actionColumn(
      (row) => crud.openEdit(row, row),
      (row) => crud.remove(`/api/olevel-subjects/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    await crud.save('/api/olevel-subjects', (id) => `/api/olevel-subjects/${id}`, { ...values, is_active: values.is_active ?? true }, reload);
  };

  return (
    <ResourceShell title="O'level subjects" description="Subjects applicants pick when entering WAEC/NECO results." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ is_active: true })}>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 600 }} pagination={{ pageSize: 20 }} locale={{ emptyText: "No O'level subjects yet." }} />
      <CrudModal title="O'level subject" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="name" label="Subject name" rules={[{ required: true }]}><Input placeholder="English Language" /></Form.Item>
        <Form.Item name="code" label="Code"><Input placeholder="ENG" /></Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}
