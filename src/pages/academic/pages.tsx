import {
  Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Award, BookOpen, Building2, GraduationCap, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { ConfirmDeleteButton } from '../../components/ConfirmDeleteButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { RefreshButton } from '../../components/RefreshButton';
import { SessionLevelFilters } from '../../components/SessionLevelFilters';
import { formatNaira } from '../../lib/money';
import { ENTRY_MODES, STUDY_LEVELS } from './constants';
import { actionColumn, formatDisplayDate, fromDateTimeValue, fromDateValue, toDateValue, useCrudModal } from './crudHelpers';
import { CatalogImportPanel } from './CatalogImportPanel';
import { patchResource, useResourceList } from './useResourceList';

const COURSE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'departmental', label: 'Departmental' },
];

const COURSE_STATUSES = [
  { value: 'core', label: 'Core' },
  { value: 'elective', label: 'Elective' },
  { value: 'required', label: 'Required' },
];

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
type Term = {
  id: number;
  name: string;
  session_label: string;
  academic_session_id?: number;
  starts_on?: string;
  ends_on?: string;
  normal_registration_closes_at?: string;
  late_registration_closes_at?: string;
  extension_price_per_unit?: number | string | null;
  is_current: boolean;
  auto_schedule?: boolean;
};
type AcademicSessionRow = {
  id: number;
  label: string;
  starts_on?: string;
  ends_on?: string;
  is_current?: boolean;
  is_closed?: boolean;
  closed_at?: string | null;
  auto_close_on_end?: boolean;
  can_set_current?: boolean;
  accepting_application_sessions?: string[];
  last_closure?: {
    promoted_count: number;
    skipped_final_count: number;
    skipped_inactive_count: number;
    skipped_no_program_count: number;
    trigger: string;
    ran_at: string;
  };
  semesters?: Term[];
};
type SessionClosePreview = {
  session_id: number;
  session_label: string;
  promoted_count: number;
  skipped_final_count: number;
  skipped_inactive_count: number;
  skipped_no_program_count: number;
  samples?: Record<string, Array<{ matric_number?: string; name?: string; from_level?: number; to_level?: number }>>;
};
type Program = {
  id: number; name: string; code?: string; award_type: string; study_level: string;
  entry_modes?: string[]; duration_years: number; tuition_amount?: number | string; is_active: boolean;
  department_id?: number; department?: Department; courses?: CourseRef[];
  is_research_degree?: boolean; workflow_template_id?: number | null;
  eligibility?: {
    min_classification?: string | null;
    nysc_required?: boolean;
    min_referees?: number | null;
    min_prior_award?: string | null;
    qualifying_note?: string | null;
    notes?: string | null;
  } | null;
  workflow_template?: { id: number; name: string; code?: string };
};
type WorkflowTemplate = { id: number; name: string; code?: string };
type Course = {
  id: number; code: string; title: string; units: number; course_type?: string; status?: string;
  department_id?: number; department?: Department; programs?: ProgramRef[];
};
type Level = { id: number; name: string; code?: string; study_level: string; sort_order: number; is_active: boolean };
type OlevelSubject = { id: number; name: string; code?: string; is_active: boolean };
type Intake = {
  id: number; name: string; entry_mode: string; academic_term_id?: number;
  opens_on?: string; closes_on?: string; is_open: boolean;
  application_fee_amount?: number | string;
  acceptance_fee_amount?: number | string;
  resolved_application_fee_amount?: number | string;
  resolved_acceptance_fee_amount?: number | string;
  term?: Term;
};

function ResourceShell({
  title, description, loading, onRefresh, onAdd, canAdd = true, accessError, children,
  count, countLabel = 'Records', eyebrow = 'Academic setup', stats, extra,
}: {
  title: string; description: string; loading: boolean; onRefresh: () => void;
  onAdd?: () => void; canAdd?: boolean; accessError?: string | null; children: React.ReactNode;
  count?: number; countLabel?: string; eyebrow?: string; stats?: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {accessError && (
        <Alert type="warning" showIcon message="No access" description={accessError} />
      )}
      <WorkspaceHero eyebrow={eyebrow} title={title} description={description} icon={BookOpen}>
        <div className="flex gap-2">
          {extra}
          <RefreshButton onClick={onRefresh} loading={loading} />
          {canAdd && onAdd && (
            <Button type="primary" icon={<Plus size={14} />} onClick={onAdd}>Add</Button>
          )}
        </div>
      </WorkspaceHero>
      {stats ?? (count != null && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard label={countLabel} value={count} hint="Records in this list" icon={BookOpen} />
        </div>
      ))}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

function CrudModal({
  title, open, saving, isEdit, form, onClose, onSubmit, children, width = 480,
}: {
  title: string; open: boolean; saving: boolean; isEdit: boolean;
  form: ReturnType<typeof Form.useForm>[0]; onClose: () => void; onSubmit: () => void; children: React.ReactNode;
  width?: number;
}) {
  return (
    <Modal
      title={isEdit ? `Edit ${title}` : `Add ${title}`}
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={saving}
      destroyOnHidden
      width={width}
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
    <ResourceShell title="Campuses" description="Physical campuses where colleges and departments are located." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ is_active: true })} accessError={accessError} count={rows.length} countLabel="Campuses">
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
  const { rows: departments } = useResourceList<Department>('/api/academic/departments');
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
    <ResourceShell
      title="Colleges"
      description="Academic colleges (faculties) within each campus."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate()}
      canAdd={campuses.length > 0}
      stats={(
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard label="Colleges" value={rows.length} hint="Faculties in this list" icon={BookOpen} />
          <StatCard label="Departments" value={departments.length} hint="Total departments across all colleges" icon={Building2} />
        </div>
      )}
    >
      <CatalogImportPanel
        templateUrl="/api/academic/faculties/import-template"
        templateFilename="college-import-template.xlsx"
        importUrl="/api/academic/faculties/import"
        description="Upload Excel with columns: name, campus_id, plus optional code. Matching codes (or the same name on the same campus) are skipped. Copy campus_id from the Campuses lookup sheet. Import colleges before departments."
        onImported={reload}
      />
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
  const { rows: programmes } = useResourceList<Program>('/api/academic/programs');
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
    <ResourceShell
      title="Departments"
      description="Academic departments under each college."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate()}
      canAdd={faculties.length > 0}
      stats={(
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard label="Departments" value={rows.length} hint="Departments in this list" icon={Building2} />
          <StatCard label="Programmes" value={programmes.length} hint="Total programmes across all departments" icon={GraduationCap} />
        </div>
      )}
    >
      <CatalogImportPanel
        templateUrl="/api/academic/departments/import-template"
        templateFilename="department-import-template.xlsx"
        importUrl="/api/academic/departments/import"
        description="Upload Excel with columns: name, college_id, plus optional code. Matching codes (or the same name in the same college) are skipped. Copy college_id from the Colleges lookup sheet. Import colleges first."
        onImported={reload}
      />
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
  const { rows, loading, reload } = useResourceList<AcademicSessionRow>('/api/academic/sessions');
  const sessionCrud = useCrudModal<AcademicSessionRow>();
  const semesterCrud = useCrudModal<Term>();
  const [semesterSessionId, setSemesterSessionId] = useState<number | null>(null);
  const [togglingSemesterId, setTogglingSemesterId] = useState<number | null>(null);
  const [closeSession, setCloseSession] = useState<AcademicSessionRow | null>(null);
  const [closePreview, setClosePreview] = useState<SessionClosePreview | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const openCloseModal = async (row: AcademicSessionRow) => {
    setCloseSession(row);
    setClosePreview(null);
    setCloseLoading(true);
    try {
      const { data } = await api.get<SessionClosePreview>(`/api/academic/sessions/${row.id}/close-preview`);
      setClosePreview(data);
    } catch {
      message.error('Could not load session close preview.');
      setCloseSession(null);
    } finally {
      setCloseLoading(false);
    }
  };

  const confirmCloseSession = async () => {
    if (!closeSession) return;
    setCloseSubmitting(true);
    try {
      const { data } = await api.post(`/api/academic/sessions/${closeSession.id}/close`);
      message.success(
        `Session closed. Promoted ${data.promoted_count ?? 0} student(s); `
        + `${data.skipped_final_count ?? 0} unchanged at final year.`,
      );
      setCloseSession(null);
      setClosePreview(null);
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      message.error(msg?.errors?.session?.[0] || msg?.message || 'Session close failed.');
    } finally {
      setCloseSubmitting(false);
    }
  };

  const setSemesterCurrent = async (semester: Term, isCurrent: boolean, session: AcademicSessionRow) => {
    if (isCurrent && session.can_set_current === false) {
      const open = (session.accepting_application_sessions || []).join(', ');
      message.error(
        open
          ? `Stop accepting applications before setting this session current. Still accepting: ${open}.`
          : 'Stop accepting applications for this admission session before setting it current.',
      );
      return;
    }
    setTogglingSemesterId(semester.id);
    try {
      await patchResource(`/api/terms/${semester.id}`, { is_current: isCurrent });
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      message.error(msg?.errors?.is_current?.[0] || msg?.message || 'Unable to update current semester.');
    } finally {
      setTogglingSemesterId(null);
    }
  };

  const columns: ColumnsType<AcademicSessionRow> = [
    { title: 'Session', dataIndex: 'label', key: 'label', width: 140 },
    {
      title: 'Semesters',
      key: 'semesters',
      render: (_, row) => (
        <Space size={[4, 4]} wrap>
          {(row.semesters || []).map((s) => (
            <Tag key={s.id} color={s.is_current ? 'blue' : undefined}>
              {s.name}{s.is_current ? ' · current' : ''}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: 'Starts', dataIndex: 'starts_on', key: 'starts_on', width: 120, render: (v) => formatDisplayDate(v) },
    { title: 'Ends', dataIndex: 'ends_on', key: 'ends_on', width: 120, render: (v) => formatDisplayDate(v) },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_, row) => (
        <Space size={[4, 4]} wrap>
          {row.is_closed && <Tag color="default">Closed</Tag>}
          {row.is_current && !row.is_closed && <Tag color="blue">Active session</Tag>}
          {!row.is_closed && !row.is_current && row.can_set_current === false && (
            <Tag color="orange">Applications open</Tag>
          )}
          {!row.is_closed && !row.is_current && row.can_set_current !== false && '—'}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, row) => (
        <Space size={4} wrap>
          {!row.is_closed && (
            <Button type="link" size="small" danger onClick={() => openCloseModal(row)}>
              Close session
            </Button>
          )}
          <Button type="link" size="small" onClick={() => sessionCrud.openEdit(row, {
            label: row.label,
            starts_on: toDateValue(row.starts_on),
            ends_on: toDateValue(row.ends_on),
            auto_close_on_end: !!row.auto_close_on_end,
          })}>
            Edit session
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSemesterSessionId(row.id);
              semesterCrud.openCreate({ is_current: false, auto_schedule: false, academic_session_id: row.id });
            }}
          >
            Add semester
          </Button>
          <ConfirmDeleteButton onConfirm={() => sessionCrud.remove(`/api/academic/sessions/${row.id}`, reload)} disabled={!!row.is_closed} />
        </Space>
      ),
    },
  ];

  const expandedRowRender = (session: AcademicSessionRow) => {
    const accepting = session.accepting_application_sessions || [];
    const canSetCurrent = session.can_set_current !== false;
    const semesterColumns: ColumnsType<Term> = [
      { title: 'Semester', dataIndex: 'name', key: 'name' },
      { title: 'Starts', dataIndex: 'starts_on', key: 'starts_on', width: 120, render: (v) => formatDisplayDate(v) },
      { title: 'Ends', dataIndex: 'ends_on', key: 'ends_on', width: 120, render: (v) => formatDisplayDate(v) },
      {
        title: 'Current',
        dataIndex: 'is_current',
        key: 'is_current',
        width: 120,
        render: (isCurrent, row) => {
          const switchEl = (
            <Switch
              checked={!!isCurrent}
              loading={togglingSemesterId === row.id}
              disabled={!isCurrent && !canSetCurrent}
              onChange={(checked) => setSemesterCurrent(row, checked, session)}
            />
          );
          if (!isCurrent && !canSetCurrent) {
            return (
              <Tooltip title={`Stop accepting applications first${accepting.length ? `: ${accepting.join(', ')}` : ''}. Then run admission, then set current.`}>
                <span>{switchEl}</span>
              </Tooltip>
            );
          }
          return switchEl;
        },
      },
      actionColumn(
        (row) => {
          setSemesterSessionId(session.id);
          semesterCrud.openEdit(row, {
            name: row.name,
            starts_on: toDateValue(row.starts_on),
            ends_on: toDateValue(row.ends_on),
            normal_registration_closes_at: toDateValue(row.normal_registration_closes_at),
            late_registration_closes_at: toDateValue(row.late_registration_closes_at),
            extension_price_per_unit: row.extension_price_per_unit != null ? Number(row.extension_price_per_unit) : undefined,
            is_current: row.is_current,
            auto_schedule: row.auto_schedule ?? true,
            academic_session_id: session.id,
          });
        },
        (row) => semesterCrud.remove(`/api/terms/${row.id}`, reload),
      ),
    ];

    return (
      <div className="space-y-3 py-1">
        {!canSetCurrent && (
          <Alert
            type="warning"
            showIcon
            message="Application sessions still accepting"
            description={`Stop accepting (${accepting.join(', ') || 'open intakes'}) before running admission and setting this session current.`}
          />
        )}
        {canSetCurrent && !session.is_current && !session.is_closed && (
          <Alert
            type="info"
            showIcon
            message="Ready for admission"
            description="Applications are closed for this session. Run admission (offers and matriculation), then set a semester current when ready."
          />
        )}
        <Table
          rowKey="id"
          columns={semesterColumns}
          dataSource={session.semesters || []}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No semesters in this session.' }}
        />
      </div>
    );
  };

  const submitSession = async () => {
    const values = await sessionCrud.form.validateFields();
    if (sessionCrud.isEdit) {
      await sessionCrud.save('/api/academic/sessions', (id) => `/api/academic/sessions/${id}`, {
        label: values.label,
        starts_on: fromDateValue(values.starts_on),
        ends_on: fromDateValue(values.ends_on),
        auto_close_on_end: !!values.auto_close_on_end,
      }, reload);
      return;
    }

    const semesters = (values.semesters || []).map((s: {
      name: string; starts_on?: unknown; ends_on?: unknown; is_current?: boolean;
    }) => ({
      name: s.name,
      starts_on: fromDateValue(s.starts_on),
      ends_on: fromDateValue(s.ends_on),
      is_current: !!s.is_current,
    }));

    await sessionCrud.save('/api/academic/sessions', (id) => `/api/academic/sessions/${id}`, {
      label: values.label,
      starts_on: fromDateValue(values.starts_on),
      ends_on: fromDateValue(values.ends_on),
      auto_close_on_end: !!values.auto_close_on_end,
      semesters,
    }, reload);
  };

  const submitSemester = async () => {
    const values = await semesterCrud.form.validateFields();
    const sessionId = values.academic_session_id || semesterSessionId;
    await semesterCrud.save('/api/terms', (id) => `/api/terms/${id}`, {
      academic_session_id: sessionId,
      name: values.name,
      starts_on: fromDateValue(values.starts_on),
      ends_on: fromDateValue(values.ends_on),
      normal_registration_closes_at: fromDateTimeValue(values.normal_registration_closes_at),
      late_registration_closes_at: fromDateTimeValue(values.late_registration_closes_at),
      extension_price_per_unit: values.extension_price_per_unit ?? null,
      is_current: values.is_current ?? false,
      auto_schedule: values.auto_schedule ?? true,
    }, () => {
      setSemesterSessionId(null);
      reload();
    });
  };

  return (
    <ResourceShell
      title="Academic Sessions"
      description="Create the academic session first (not current). Open application sessions next, stop accepting, run admission, then set a semester current. Close session at year end to promote students."
      loading={loading}
      onRefresh={reload}
      onAdd={() => sessionCrud.openCreate({
        semesters: [
          { name: 'First', is_current: false },
          { name: 'Second', is_current: false },
        ],
      })}
      count={rows.length}
      countLabel="Sessions"
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15 }}
        expandable={{ expandedRowRender, defaultExpandAllRows: true }}
        locale={{ emptyText: 'No academic sessions yet.' }}
      />

      <Modal
        title={sessionCrud.isEdit ? 'Edit session' : 'Add session'}
        open={sessionCrud.open}
        onCancel={sessionCrud.close}
        onOk={submitSession}
        confirmLoading={sessionCrud.saving}
        destroyOnHidden
        width={640}
      >
        <Form form={sessionCrud.form} layout="vertical" className="mt-4">
          <Form.Item
            name="label"
            label="Session"
            extra="Academic year, e.g. 2025/2026"
            rules={[{ required: true, message: 'Enter the session' }]}
          >
            <Input placeholder="2025/2026" />
          </Form.Item>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <Form.Item name="starts_on" label="Session starts"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
            <Form.Item name="ends_on" label="Session ends"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
          </div>
          <Form.Item
            name="auto_close_on_end"
            label="Auto-close on end date"
            valuePropName="checked"
            extra="When enabled, the nightly calendar job closes this session after the end date and promotes eligible students."
          >
            <Switch />
          </Form.Item>

          {!sessionCrud.isEdit && (
            <Form.List
              name="semesters"
              rules={[{
                validator: async (_, value) => {
                  if (!value || value.length < 2) {
                    return Promise.reject(new Error('Add at least two semesters'));
                  }
                },
              }]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 m-0">Semesters</p>
                    <Button type="dashed" size="small" onClick={() => add({ is_current: false })}>Add semester</Button>
                  </div>
                  {fields.map((field) => (
                    <div key={field.key} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Form.Item
                          {...field}
                          name={[field.name, 'name']}
                          label="Semester name"
                          className="flex-1 mb-2"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Input placeholder="First" />
                        </Form.Item>
                        {fields.length > 2 && (
                          <Button type="link" danger size="small" className="mt-7" onClick={() => remove(field.name)}>
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                        <Form.Item {...field} name={[field.name, 'starts_on']} label="Starts" className="mb-2">
                          <DatePicker className="w-full" format="DD/MM/YYYY" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'ends_on']} label="Ends" className="mb-2">
                          <DatePicker className="w-full" format="DD/MM/YYYY" />
                        </Form.Item>
                      </div>
                      <Form.Item
                        {...field}
                        name={[field.name, 'is_current']}
                        label="Current semester"
                        valuePropName="checked"
                        className="mb-0"
                        extra="Leave off for a new cycle. Set current only after applications stop accepting and admission is complete."
                      >
                        <Switch />
                      </Form.Item>
                    </div>
                  ))}
                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>

      <CrudModal
        title="semester"
        open={semesterCrud.open}
        saving={semesterCrud.saving}
        isEdit={semesterCrud.isEdit}
        form={semesterCrud.form}
        onClose={() => { setSemesterSessionId(null); semesterCrud.close(); }}
        onSubmit={submitSemester}
      >
        <Form.Item name="academic_session_id" hidden><Input /></Form.Item>
        <Form.Item name="name" label="Semester name" rules={[{ required: true }]}>
          <Input placeholder="First" />
        </Form.Item>
        <Form.Item name="starts_on" label="Starts on"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
        <Form.Item name="ends_on" label="Ends on"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
        <Form.Item name="normal_registration_closes_at" label="Normal registration closes">
          <DatePicker className="w-full" showTime format="DD/MM/YYYY HH:mm" />
        </Form.Item>
        <Form.Item name="late_registration_closes_at" label="Late registration closes">
          <DatePicker className="w-full" showTime format="DD/MM/YYYY HH:mm" />
        </Form.Item>
        <Form.Item
          name="extension_price_per_unit"
          label="Extension price per unit (₦)"
          extra="Charged only when a late-registration extension is approved. Leave blank until you are ready to accept extension requests."
        >
          <InputNumber min={0} className="w-full" placeholder="Optional" />
        </Form.Item>
        <Form.Item
          name="is_current"
          label="Set as current semester"
          extra="Only one semester can be current. Blocked while any application session on this admission session is still accepting."
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="auto_schedule"
          label="Auto-switch by dates"
          extra="When enabled, the nightly scheduler can open or close this semester based on its start and end dates."
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </CrudModal>

      <Modal
        title={closeSession ? `Close session ${closeSession.label}` : 'Close session'}
        open={!!closeSession}
        onCancel={() => { setCloseSession(null); setClosePreview(null); }}
        onOk={confirmCloseSession}
        okText="Close session and promote"
        okButtonProps={{ danger: true, loading: closeSubmitting }}
        confirmLoading={closeLoading || closeSubmitting}
        destroyOnHidden
      >
        <p className="text-sm text-slate-600">
          All active students move up one level until their programme final year. Final-year students stay unchanged and remain active.
          Confirm graduation separately on <Link to="/academic/graduation">Academic → Graduation</Link>.
        </p>
        {closeLoading && <p className="text-sm">Loading preview…</p>}
        {closePreview && (
          <ul className="text-sm space-y-1 mt-3">
            <li><strong>{closePreview.promoted_count}</strong> student(s) will be promoted</li>
            <li><strong>{closePreview.skipped_final_count}</strong> already at final year (unchanged — ready for Graduation)</li>
            <li><strong>{closePreview.skipped_inactive_count}</strong> inactive (skipped)</li>
            <li><strong>{closePreview.skipped_no_program_count}</strong> without programme (skipped)</li>
          </ul>
        )}
      </Modal>
    </ResourceShell>
  );
}

export function ProgrammesPage() {
  const { rows, loading, reload } = useResourceList<Program>('/api/academic/programs');
  const { rows: faculties } = useResourceList<Faculty>('/api/academic/faculties');
  const { rows: departments } = useResourceList<Department>('/api/academic/departments');
  const { rows: allCourses } = useResourceList<Course>('/api/academic/courses');
  const { rows: templates } = useResourceList<WorkflowTemplate>('/api/academic/workflow-templates');
  const crud = useCrudModal<Program>();
  const [modeFilter, setModeFilter] = useState<string | null>(null);
  const watchedModes = Form.useWatch('entry_modes', crud.form) || [];
  const selectedCollegeId = Form.useWatch('faculty_id', crud.form);
  const showPgEligibility = Array.isArray(watchedModes) && watchedModes.includes('pg');
  const departmentsInCollege = departments.filter((d) => Number(d.faculty_id ?? d.faculty?.id) === Number(selectedCollegeId));

  const hasMode = (row: Program, mode: string) => (row.entry_modes ?? []).includes(mode);
  const utmeCount = rows.filter((row) => hasMode(row, 'utme')).length;
  const jupebCount = rows.filter((row) => hasMode(row, 'jupeb')).length;
  const pgCount = rows.filter((row) => hasMode(row, 'pg')).length;
  const visibleRows = modeFilter ? rows.filter((row) => hasMode(row, modeFilter)) : rows;
  const toggleMode = (mode: string) => setModeFilter((current) => (current === mode ? null : mode));

  const columns: ColumnsType<Program> = [
    { title: 'Programme', dataIndex: 'name', key: 'name' },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: (v) => v || '—' },
    { title: 'Award', dataIndex: 'award_type', key: 'award_type', width: 90 },
    { title: 'Years', dataIndex: 'duration_years', key: 'duration_years', width: 70 },
    {
      title: 'School fees total',
      dataIndex: 'tuition_amount',
      key: 'tuition_amount',
      width: 140,
      render: (value?: number | string) => formatNaira(value),
    },
    { title: 'Admission categories', key: 'entry_modes', width: 180, render: (_, r) => entryModeTags(r.entry_modes) },
    { title: 'Workflow', key: 'workflow', width: 150, render: (_, r) => r.workflow_template?.name || '—' },
    { title: 'Research', key: 'research', width: 90, render: (_, r) => r.is_research_degree ? <Tag color="purple">Research</Tag> : '—' },
    { title: 'Courses', key: 'courses', width: 160, render: (_, r) => courseTags(r.courses) },
    { title: 'Department', key: 'department', render: (_, r) => r.department?.name || '—' },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90, render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
    actionColumn(
      (row) => crud.openEdit(row, {
        faculty_id: row.department?.faculty_id ?? row.department?.faculty?.id,
        department_id: row.department_id ?? row.department?.id,
        name: row.name,
        code: row.code,
        award_type: row.award_type,
        study_level: row.study_level,
        entry_modes: row.entry_modes ?? [],
        duration_years: row.duration_years,
        course_ids: row.courses?.map((c) => c.id) ?? [],
        is_active: row.is_active,
        is_research_degree: !!row.is_research_degree,
        workflow_template_id: row.workflow_template_id ?? row.workflow_template?.id,
        eligibility: {
          min_classification: row.eligibility?.min_classification || undefined,
          nysc_required: !!row.eligibility?.nysc_required,
          min_referees: row.eligibility?.min_referees ?? 2,
          min_prior_award: row.eligibility?.min_prior_award || undefined,
          qualifying_note: row.eligibility?.qualifying_note || '',
          notes: row.eligibility?.notes || '',
        },
      }),
      (row) => crud.remove(`/api/programs/${row.id}`, reload),
    ),
  ];

  const submit = async () => {
    const values = await crud.form.validateFields();
    const { faculty_id: _collegeId, eligibility = {}, ...rest } = values;
    await crud.save('/api/programs', (id) => `/api/programs/${id}`, {
      ...rest,
      is_research_degree: !!values.is_research_degree,
      workflow_template_id: values.workflow_template_id || null,
      eligibility: {
        min_classification: eligibility.min_classification || null,
        nysc_required: !!eligibility.nysc_required,
        min_referees: eligibility.min_referees ?? null,
        min_prior_award: eligibility.min_prior_award || null,
        qualifying_note: eligibility.qualifying_note || null,
        notes: eligibility.notes || null,
      },
    }, reload);
  };

  return (
    <ResourceShell
      title="Programmes"
      description="Define programmes and curriculum. School fees (tuition and related lines) are assigned under Fees & payments → Programme fees."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate({ duration_years: 4, is_active: true, entry_modes: ['utme'], course_ids: [], is_research_degree: false, eligibility: { min_referees: 2, nysc_required: false } })}
      canAdd={faculties.length > 0 && departments.length > 0}
      stats={(
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            label="Programmes"
            value={rows.length}
            hint="All programmes in the catalog"
            icon={BookOpen}
            active={!modeFilter}
            onClick={() => setModeFilter(null)}
          />
          <StatCard
            label="UTME"
            value={utmeCount}
            hint="Undergraduate UTME programmes"
            icon={GraduationCap}
            active={modeFilter === 'utme'}
            onClick={() => toggleMode('utme')}
          />
          <StatCard
            label="JUPEB"
            value={jupebCount}
            hint="JUPEB foundation programmes"
            icon={BookOpen}
            tone="amber"
            active={modeFilter === 'jupeb'}
            onClick={() => toggleMode('jupeb')}
          />
          <StatCard
            label="PG"
            value={pgCount}
            hint="Postgraduate programmes"
            icon={Award}
            tone="emerald"
            active={modeFilter === 'pg'}
            onClick={() => toggleMode('pg')}
          />
        </div>
      )}
    >
      <CatalogImportPanel
        templateUrl="/api/academic/programs/import-template"
        templateFilename="programme-import-template.xlsx"
        importUrl="/api/academic/programs/import"
        description="Upload Excel with columns: name, department_id, award_type, study_level, duration_years, entry_modes, plus optional code. Matching codes (or the same name in the same department) are skipped. Copy department_id from the Departments lookup sheet. Import departments first."
        onImported={reload}
      />
      <Table rowKey="id" columns={columns} dataSource={visibleRows} loading={loading} scroll={{ x: 1500 }} pagination={{ pageSize: 15 }} locale={{ emptyText: modeFilter ? 'No programmes in this category.' : 'No programmes yet.' }} />
      <CrudModal title="programme" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit} width={640}>
        <Form.Item name="faculty_id" label="College" rules={[{ required: true, message: 'Select a college' }]}>
          <Select
            options={faculties.map((f) => ({
              value: f.id,
              label: f.campus?.name ? `${f.name} (${f.campus.name})` : f.name,
            }))}
            placeholder="Select college"
            showSearch
            optionFilterProp="label"
            onChange={() => crud.form.setFieldValue('department_id', undefined)}
          />
        </Form.Item>
        <Form.Item name="department_id" label="Department" rules={[{ required: true, message: 'Select a department' }]}>
          <Select
            options={departmentsInCollege.map((d) => ({ value: d.id, label: d.name }))}
            placeholder={selectedCollegeId ? 'Select department' : 'Select a college first'}
            showSearch
            optionFilterProp="label"
            disabled={!selectedCollegeId}
          />
        </Form.Item>
        <Form.Item name="name" label="Programme name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="Code"><Input /></Form.Item>
        <Form.Item name="award_type" label="Award type" rules={[{ required: true }]}><Input placeholder="B.Eng" /></Form.Item>
        <Form.Item name="study_level" label="Degree type" rules={[{ required: true }]}><Select options={STUDY_LEVELS} /></Form.Item>
        <Form.Item name="duration_years" label="Number of years" rules={[{ required: true, type: 'number', min: 1, max: 10 }]}>
          <InputNumber min={1} max={10} className="w-full" />
        </Form.Item>
        <Form.Item name="entry_modes" label="Admission categories" rules={[{ required: true, type: 'array', min: 1 }]} extra="Which entry modes can select this programme on the application form.">
          <Select mode="multiple" options={ENTRY_MODES} placeholder="Select UTME, DE, JUPEB, PG…" />
        </Form.Item>
        <Form.Item name="workflow_template_id" label="Workflow" extra="Admissions and enrolment stages for this programme.">
          <Select allowClear options={templates.map((t) => ({ value: t.id, label: t.name }))} placeholder="Default from study level" />
        </Form.Item>
        <Form.Item name="is_research_degree" label="Research degree" valuePropName="checked" extra="Requires a proposed area and supervisor preference on the applicant form.">
          <Switch />
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
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admission eligibility</p>
        {showPgEligibility && (
          <>
            <Form.Item name={['eligibility', 'min_classification']} label="Minimum class">
              <Select
                allowClear
                options={[
                  { value: 'first', label: 'First Class' },
                  { value: 'second_upper', label: 'Second Class Upper' },
                  { value: 'second_lower', label: 'Second Class Lower' },
                  { value: 'third', label: 'Third Class' },
                  { value: 'pass', label: 'Pass' },
                  { value: 'distinction', label: 'Distinction' },
                  { value: 'merit', label: 'Merit' },
                ]}
              />
            </Form.Item>
            <Form.Item name={['eligibility', 'min_prior_award']} label="Minimum prior award">
              <Select allowClear options={[{ value: 'bachelor', label: 'Bachelor' }, { value: 'masters', label: 'Masters' }]} />
            </Form.Item>
            <Form.Item name={['eligibility', 'min_referees']} label="Minimum referees">
              <InputNumber min={1} max={3} className="w-full" />
            </Form.Item>
            <Form.Item name={['eligibility', 'nysc_required']} label="NYSC required" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name={['eligibility', 'qualifying_note']} label="Qualifying note">
              <Input.TextArea rows={2} placeholder="B.Sc Computer Science or related" />
            </Form.Item>
          </>
        )}
        <Form.Item name={['eligibility', 'notes']} label="Eligibility notes">
          <Input.TextArea rows={2} placeholder="Shown to applicants and staff" />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          message="School fees"
          description="Assign tuition, library, medical, and other school-fee lines per programme, level, and semester on Fees & payments → Programme fees."
        />
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
    { title: 'Degree type', dataIndex: 'study_level', key: 'study_level', width: 130, render: (v) => <Tag>{v}</Tag> },
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
    <ResourceShell title="Levels" description="Study levels such as 100, 200, or Year 1." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ sort_order: 1, is_active: true })} count={rows.length} countLabel="Levels">
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 700 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No levels yet.' }} />
      <CrudModal title="level" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="name" label="Level name" rules={[{ required: true }]}><Input placeholder="100 Level" /></Form.Item>
        <Form.Item name="code" label="Code"><Input placeholder="100" /></Form.Item>
        <Form.Item name="study_level" label="Degree type" rules={[{ required: true }]}><Select options={STUDY_LEVELS} /></Form.Item>
        <Form.Item name="sort_order" label="Sort order"><InputNumber min={0} className="w-full" /></Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}

export function CoursesPage() {
  const [level, setLevel] = useState<string | undefined>();
  const endpoint = useMemo(() => (
    level ? `/api/academic/courses?level=${encodeURIComponent(level)}` : '/api/academic/courses'
  ), [level]);
  const { rows, loading, reload } = useResourceList<Course>(endpoint);
  const { rows: departments } = useResourceList<Department>('/api/academic/departments');
  const { rows: programs } = useResourceList<Program>('/api/academic/programs');
  const crud = useCrudModal<Course>();
  const courseType = Form.useWatch('course_type', crud.form);

  const columns: ColumnsType<Course> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 110 },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Units', dataIndex: 'units', key: 'units', width: 70 },
    { title: 'Type', dataIndex: 'course_type', key: 'course_type', width: 130, render: (value) => COURSE_TYPES.find((item) => item.value === value)?.label || value || 'Departmental' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: (value) => COURSE_STATUSES.find((item) => item.value === value)?.label || value || 'Core' },
    { title: 'Programmes', key: 'programs', width: 180, render: (_, r) => programTags(r.programs) },
    { title: 'Department', key: 'department', render: (_, r) => r.department?.name || '—' },
    actionColumn(
      (row) => crud.openEdit(row, {
        department_id: row.department_id ?? row.department?.id,
        code: row.code,
        title: row.title,
        units: row.units,
        course_type: row.course_type || 'departmental',
        status: row.status || 'core',
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
    <ResourceShell
      title="Course catalog"
      description="Course catalogue — general courses are visible to all programmes; faculty and departmental courses follow the owning department."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate({ units: 3, course_type: 'departmental', status: 'core', program_ids: [] })}
      canAdd={departments.length > 0}
      count={rows.length}
      countLabel="Courses"
      eyebrow="Courses"
      extra={<SessionLevelFilters showSession={false} level={level} onLevelChange={setLevel} />}
    >
      <CatalogImportPanel
        templateUrl="/api/academic/courses/import-template"
        templateFilename="course-catalogue-template.xlsx"
        importUrl="/api/academic/courses/import"
        description="Upload Excel with columns: code, title, department_id, plus optional units, course_type, status, programme_id, and level_id. Matching course codes are skipped. Copy ids from the Departments, Programmes, and Levels lookup sheets. Import programmes first."
        onImported={reload}
      />
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No courses yet.' }} />
      <CrudModal title="course" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="department_id" label="Department" rules={[{ required: true }]}>
          <Select options={departments.map((d) => ({ value: d.id, label: d.name }))} showSearch optionFilterProp="label" />
        </Form.Item>
        <Form.Item name="code" label="Course code" rules={[{ required: true }]}><Input placeholder="CPE 201" /></Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="units" label="Credit units" rules={[{ required: true }]}><InputNumber min={1} max={12} className="w-full" /></Form.Item>
        <Form.Item name="course_type" label="Catalogue type" rules={[{ required: true }]} extra="General courses are visible to every student. Faculty and departmental courses follow the owning department.">
          <Select options={COURSE_TYPES} />
        </Form.Item>
        <Form.Item name="status" label="Status" rules={[{ required: true }]} extra="Core, elective, or required for registration.">
          <Select options={COURSE_STATUSES} />
        </Form.Item>
        <Form.Item
          name="program_ids"
          label="Programmes"
          rules={courseType === 'general' ? [] : [{ required: true, type: 'array', min: 1 }]}
          extra={courseType === 'general' ? 'Optional for general courses.' : 'Which programmes include this course in their curriculum.'}
        >
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
      key: 'application_fee_amount',
      width: 130,
      render: (_, row) => formatNaira(row.resolved_application_fee_amount ?? row.application_fee_amount, 'Fee catalog'),
    },
    {
      title: 'Default acceptance',
      key: 'acceptance_fee_amount',
      width: 150,
      render: (_, row) => formatNaira(row.resolved_acceptance_fee_amount ?? row.acceptance_fee_amount, 'Fee catalog'),
    },
    { title: 'Open', dataIndex: 'is_open', key: 'is_open', width: 90, render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? 'Open' : 'Closed'}</Tag> },
    actionColumn(
      (row) => crud.openEdit(row, {
        academic_term_id: row.academic_term_id ?? row.term?.id,
        name: row.name,
        entry_mode: row.entry_mode,
        opens_on: toDateValue(row.opens_on),
        closes_on: toDateValue(row.closes_on),
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
    <ResourceShell
      title="Application sessions"
      description="Open and close intakes after the admission session exists (not yet current). Set application and acceptance fees under Fees & payments → Fee catalog, per entry mode. After you stop accepting, run admission, then set that admission session current under Academic Sessions."
      loading={loading}
      onRefresh={reload}
      onAdd={() => crud.openCreate({ is_open: true })}
      canAdd={terms.length > 0}
      count={rows.length}
      countLabel="Sessions"
      eyebrow="Application setup"
    >
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1100 }} pagination={{ pageSize: 15 }} locale={{ emptyText: 'No application sessions yet.' }} />
      <CrudModal title="application session" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="academic_term_id" label="Semester" rules={[{ required: true }]}>
          <Select options={terms.map((t) => ({ value: t.id, label: `${t.session_label} — ${t.name}` }))} />
        </Form.Item>
        <Form.Item name="name" label="Session name" rules={[{ required: true }]}><Input placeholder="UTME 2025/2026" /></Form.Item>
        <Form.Item name="entry_mode" label="Admission category" rules={[{ required: true }]} extra="UTME, Direct Entry, JUPEB, Postgraduate, or Transfer.">
          <Select options={ENTRY_MODES} />
        </Form.Item>
        <Form.Item name="opens_on" label="Application opens" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item>
        <Form.Item name="closes_on" label="Application closes" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item>
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
    <ResourceShell title="O'level subjects" description="Subjects applicants pick when entering WAEC/NECO results." loading={loading} onRefresh={reload} onAdd={() => crud.openCreate({ is_active: true })} count={rows.length} countLabel="Subjects" eyebrow="Application setup">
      <CatalogImportPanel
        templateUrl="/api/academic/olevel-subjects/import-template"
        templateFilename="olevel-import-template.xlsx"
        importUrl="/api/academic/olevel-subjects/import"
        description="Upload Excel with columns: name, plus optional code and is_active. Matching codes are skipped, or matching names when code is blank."
        onImported={reload}
      />
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 600 }} pagination={{ pageSize: 20 }} locale={{ emptyText: "No O'level subjects yet." }} />
      <CrudModal title="O'level subject" open={crud.open} saving={crud.saving} isEdit={crud.isEdit} form={crud.form} onClose={crud.close} onSubmit={submit}>
        <Form.Item name="name" label="Subject name" rules={[{ required: true }]}><Input placeholder="English Language" /></Form.Item>
        <Form.Item name="code" label="Code"><Input placeholder="ENG" /></Form.Item>
        <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
      </CrudModal>
    </ResourceShell>
  );
}
