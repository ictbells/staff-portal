import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Input, Select, Space, Tag, message } from 'antd';
import { Eye, FileText, Printer, Save } from 'lucide-react';
import api from '../../api';
import { requiredDocumentsFor } from './requiredDocuments';

type Step = { step_key?: string; payload?: Record<string, any> };
type UploadedDoc = {
  id: number;
  doc_type?: string;
  path?: string;
  original_name?: string;
};
type ProgramOption = {
  id: number;
  name?: string;
  code?: string | null;
  department?: { id?: number; name?: string; faculty?: { id?: number; name?: string } };
};
type GeoState = { state_id: number; state_title: string };
type GeoLga = { lga_id: number; lga_title: string; state_id: number };
type OlevelSubject = { id: number; name: string };
type Sitting = {
  exam_type: string;
  exam_center: string;
  exam_year: string;
  exam_number: string;
  results: { subject_id: number; subject_name: string; grade: string }[];
};
type Utme = {
  aggregate: string;
  course_choice: string;
  subjects: { subject: string; score: string }[];
};
type FileApp = {
  id: number;
  application_number?: string | null;
  jamb_registration?: string | null;
  jamb_status?: string | null;
  entry_mode?: string;
  stage?: string;
  submitted_at?: string | null;
  user?: { name?: string; email?: string; phone?: string; jamb_registration?: string | null };
  program?: {
    id?: number;
    name?: string;
    code?: string;
    department?: { id?: number; name?: string; faculty?: { id?: number; name?: string } };
  };
  intake?: { name?: string; term?: { session_label?: string } };
  application_fee_invoice?: { status?: string };
  offer_reference?: string | null;
  steps?: Step[];
  documents?: UploadedDoc[];
  student?: { id?: number; current_level?: number | string; program_id?: number | null };
};

type FormState = {
  email: string;
  phone: string;
  jamb_registration: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  religion: string;
  country: string;
  state: string;
  state_id: number | '';
  lga: string;
  lga_id: number | '';
  address: string;
  blood_group: string;
  genotype: string;
  has_medical_condition: boolean;
  medical_condition_details: string;
  next_of_kin: string;
  next_of_kin_relationship: string;
  next_of_kin_phone: string;
  next_of_kin_email: string;
  next_of_kin_address: string;
  sponsor_name: string;
  sponsor_relationship: string;
  sponsor_phone: string;
  sponsor_email: string;
  sponsor_address: string;
  other_qualifications: string;
  utme: Utme;
  first_sitting: Sitting;
  second_sitting: Sitting;
  first_choice_college_id: number | '';
  first_choice_department_id: number | '';
  first_choice_program_id: number | '';
  second_choice_college_id: number | '';
  second_choice_department_id: number | '';
  second_choice_program_id: number | '';
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES = ['AA', 'AS', 'AC', 'SS', 'SC', 'CC'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const RELIGIONS = ['Christianity', 'Islam', 'Traditional', 'Other'];
const GENDERS = ['Male', 'Female'];
const OLEVEL_EXAM_TYPES = ['WAEC', 'NECO', 'GCE', 'NABTEB', 'Other'];
const OLEVEL_GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];
const OLEVEL_YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

function pick(source: Record<string, any> | undefined | null, ...keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stepPayload(app: FileApp | null, key: string): Record<string, any> {
  const step = app?.steps?.find((row) => row.step_key === key);
  const payload = step?.payload;
  return payload && typeof payload === 'object' ? payload : {};
}

function emptySitting(): Sitting {
  return { exam_type: '', exam_center: '', exam_year: '', exam_number: '', results: [{ subject_id: 0, subject_name: '', grade: '' }] };
}

function emptyUtme(): Utme {
  return {
    aggregate: '',
    course_choice: '',
    subjects: [
      { subject: '', score: '' },
      { subject: '', score: '' },
      { subject: '', score: '' },
      { subject: '', score: '' },
    ],
  };
}

function asUtme(raw: any): Utme {
  const base = emptyUtme();
  if (!raw || typeof raw !== 'object') return base;
  const subjects = Array.isArray(raw.subjects) && raw.subjects.length
    ? raw.subjects.map((row: any) => ({
        subject: row.subject || '',
        score: row.score != null ? String(row.score) : '',
      }))
    : base.subjects;
  while (subjects.length < 4) subjects.push({ subject: '', score: '' });
  return {
    aggregate: raw.aggregate != null ? String(raw.aggregate) : '',
    course_choice: raw.course_choice || '',
    subjects,
  };
}

function utmeSubjectOptions(subjects: OlevelSubject[], current?: string) {
  const options = subjects.map((subject) => ({ value: subject.name, label: subject.name }));
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: current });
  }
  return options;
}

function utmeForSave(utme: Utme): Utme | null {
  const subjects = utme.subjects.filter((row) => row.subject || row.score);
  if (!utme.aggregate && !utme.course_choice && subjects.length === 0) return null;
  return { ...utme, subjects };
}

function asSitting(raw: any): Sitting {
  const base = emptySitting();
  if (!raw || typeof raw !== 'object') return base;
  const results = Array.isArray(raw.results) && raw.results.length
    ? raw.results.map((row: any) => ({
        subject_id: Number(row.subject_id || 0),
        subject_name: row.subject_name || row.subject || '',
        grade: row.grade || '',
      }))
    : base.results;
  return {
    exam_type: pick(raw, 'exam_type', 'exam_type') || '',
    exam_center: pick(raw, 'exam_center', 'exam_center') || '',
    exam_year: String(pick(raw, 'exam_year') || ''),
    exam_number: String(pick(raw, 'exam_number') || ''),
    results,
  };
}

function sittingForSave(sitting: Sitting): Sitting | null {
  const results = sitting.results.filter((row) => Number(row.subject_id) > 0 && row.grade);
  const hasMeta = !!(sitting.exam_type || sitting.exam_center || sitting.exam_year || sitting.exam_number);
  if (!hasMeta && results.length === 0) return null;
  return { ...sitting, results };
}

function facultyIdOf(program?: ProgramOption) {
  const id = program?.department?.faculty?.id;
  return id ? Number(id) : '';
}

function departmentIdOf(program?: ProgramOption) {
  const id = program?.department?.id;
  return id ? Number(id) : '';
}

function uniqueOptions(items: { value: number; label: string }[]) {
  const map = new Map<number, string>();
  items.forEach(({ value, label }) => {
    if (value && label) map.set(value, label);
  });
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function programmeLevel(level: number | string | undefined) {
  const n = Number(level);
  if (!n) return 0;
  return n >= 100 ? n : n * 100;
}

function levelAfterProgrammeChange(level: number | string | undefined) {
  const stored = Number(level);
  const band = programmeLevel(level);
  if (!band) return stored;
  if (band === 100) return stored;
  return stored >= 100 ? stored - 100 : Math.max(1, stored - 1);
}

function formFromApp(app: FileApp, programs: ProgramOption[]): FormState {
  const biodata = stepPayload(app, 'biodata');
  const personal = { ...biodata, ...stepPayload(app, 'personal_details') };
  const health = { ...personal, ...stepPayload(app, 'health_information') };
  const kin = { ...health, ...stepPayload(app, 'next_of_kin') };
  const sponsor = { ...kin, ...stepPayload(app, 'sponsor') };
  const contact = { ...sponsor, ...stepPayload(app, 'application_form') };
  const academic = stepPayload(app, 'academic_qualifications');
  const programme = stepPayload(app, 'programme_selection');
  const firstId = Number(pick(programme, 'first_choice_program_id', 'program_id') || app.program?.id || 0) || '';
  const secondId = Number(pick(programme, 'second_choice_program_id') || 0) || '';
  const first = programs.find((row) => row.id === Number(firstId));
  const second = programs.find((row) => row.id === Number(secondId));
  return {
    email: app.user?.email || pick(contact, 'email') || '',
    phone: pick(contact, 'phone') || app.user?.phone || '',
    jamb_registration: app.jamb_registration || app.user?.jamb_registration || '',
    first_name: pick(personal, 'first_name') || '',
    middle_name: pick(personal, 'middle_name') || '',
    last_name: pick(personal, 'last_name') || '',
    date_of_birth: String(pick(personal, 'date_of_birth') || '').slice(0, 10),
    gender: pick(personal, 'gender') || '',
    marital_status: pick(personal, 'marital_status') || '',
    religion: pick(personal, 'religion') || '',
    country: pick(personal, 'country') || 'Nigeria',
    state: pick(personal, 'state') || '',
    state_id: Number(pick(personal, 'state_id') || 0) || '',
    lga: pick(personal, 'lga') || '',
    lga_id: Number(pick(personal, 'lga_id') || 0) || '',
    address: pick(contact, 'address') || '',
    blood_group: pick(health, 'blood_group') || '',
    genotype: pick(health, 'genotype') || '',
    has_medical_condition: Boolean(pick(health, 'has_medical_condition')),
    medical_condition_details: pick(health, 'medical_condition_details') || '',
    next_of_kin: pick(kin, 'next_of_kin') || '',
    next_of_kin_relationship: pick(kin, 'next_of_kin_relationship') || '',
    next_of_kin_phone: pick(kin, 'next_of_kin_phone') || '',
    next_of_kin_email: pick(kin, 'next_of_kin_email') || '',
    next_of_kin_address: pick(kin, 'next_of_kin_address') || '',
    sponsor_name: pick(sponsor, 'sponsor_name') || '',
    sponsor_relationship: pick(sponsor, 'sponsor_relationship') || '',
    sponsor_phone: pick(sponsor, 'sponsor_phone') || '',
    sponsor_email: pick(sponsor, 'sponsor_email') || '',
    sponsor_address: pick(sponsor, 'sponsor_address') || '',
    other_qualifications: pick(academic, 'other_qualifications') || '',
    utme: asUtme(pick(academic, 'utme')),
    first_sitting: asSitting(pick(academic, 'first_sitting') || (Array.isArray(academic.olevel_results) ? { ...academic, results: academic.olevel_results } : null)),
    second_sitting: asSitting(pick(academic, 'second_sitting')),
    first_choice_college_id: Number(pick(programme, 'first_choice_college_id') || facultyIdOf(first) || 0) || '',
    first_choice_department_id: Number(pick(programme, 'first_choice_department_id') || departmentIdOf(first) || 0) || '',
    first_choice_program_id: firstId,
    second_choice_college_id: Number(pick(programme, 'second_choice_college_id') || facultyIdOf(second) || 0) || '',
    second_choice_department_id: Number(pick(programme, 'second_choice_department_id') || departmentIdOf(second) || 0) || '',
    second_choice_program_id: secondId,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0 block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-800">{title}</h3>
      {children}
    </section>
  );
}

function SittingEditor({
  title,
  sitting,
  subjects,
  onChange,
  onClear,
}: {
  title: string;
  sitting: Sitting;
  subjects: OlevelSubject[];
  onChange: (next: Sitting) => void;
  onClear?: () => void;
}) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Exam type">
          <Select
            className="w-full"
            allowClear
            value={sitting.exam_type || undefined}
            options={OLEVEL_EXAM_TYPES.map((value) => ({ value, label: value }))}
            onChange={(value) => onChange({ ...sitting, exam_type: value || '' })}
          />
        </Field>
        <Field label="Year">
          <Select
            className="w-full"
            allowClear
            value={sitting.exam_year || undefined}
            options={OLEVEL_YEARS.map((value) => ({ value, label: value }))}
            onChange={(value) => onChange({ ...sitting, exam_year: value || '' })}
          />
        </Field>
        <Field label="Exam number">
          <Input value={sitting.exam_number} onChange={(e) => onChange({ ...sitting, exam_number: e.target.value })} />
        </Field>
        <Field label="Centre">
          <Input value={sitting.exam_center} onChange={(e) => onChange({ ...sitting, exam_center: e.target.value })} />
        </Field>
      </div>
      <div className="space-y-2">
        {sitting.results.map((row, index) => (
          <div key={index} className="flex gap-2 items-center">
            <div className="min-w-0 flex-1">
              <Select
                className="w-full"
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="Subject"
                value={row.subject_id || undefined}
                options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
                getPopupContainer={() => document.body}
                onChange={(value) => {
                  const subject = subjects.find((item) => item.id === value);
                  const results = sitting.results.map((item, i) => i === index
                    ? { ...item, subject_id: value || 0, subject_name: subject?.name || '' }
                    : item);
                  onChange({ ...sitting, results });
                }}
              />
            </div>
            <Select
              className="w-24"
              placeholder="Grade"
              value={row.grade || undefined}
              options={OLEVEL_GRADES.map((value) => ({ value, label: value }))}
              getPopupContainer={() => document.body}
              onChange={(value) => {
                const results = sitting.results.map((item, i) => i === index ? { ...item, grade: value } : item);
                onChange({ ...sitting, results });
              }}
            />
            <Button onClick={() => onChange({ ...sitting, results: sitting.results.filter((_, i) => i !== index) })}>
              Remove
            </Button>
          </div>
        ))}
        <Space>
          <Button onClick={() => onChange({ ...sitting, results: [...sitting.results, { subject_id: 0, subject_name: '', grade: '' }] })}>
            Add subject
          </Button>
          {onClear && <Button onClick={onClear}>Clear sitting</Button>}
        </Space>
      </div>
    </Section>
  );
}

export function ApplicationFileDrawer({
  applicationId,
  open,
  onClose,
  onPrintForm,
  onPrintLetter,
  printing,
  extra,
  onSaved,
}: {
  applicationId: number | null;
  open: boolean;
  onClose: () => void;
  onPrintForm: () => void;
  onPrintLetter?: () => void;
  printing?: boolean;
  extra?: ReactNode;
  onSaved?: () => void;
}) {
  const [app, setApp] = useState<FileApp | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<OlevelSubject[]>([]);
  const [states, setStates] = useState<GeoState[]>([]);
  const [lgas, setLgas] = useState<GeoLga[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jambHint, setJambHint] = useState<string | null>(null);

  const originalProgramId = app?.program?.id || app?.student?.program_id || null;

  useEffect(() => {
    if (!open || !applicationId) {
      setApp(null);
      setForm(null);
      return;
    }
    setLoading(true);
    api.get(`/api/applications/${applicationId}`)
      .then(({ data }) => setApp(data))
      .catch(() => {
        message.error('Unable to load the application file.');
        setApp(null);
      })
      .finally(() => setLoading(false));
  }, [applicationId, open]);

  useEffect(() => {
    if (!open) return;
    const mode = app?.entry_mode;
    api.get('/api/programs', { params: mode ? { entry_modes: mode } : undefined })
      .then(({ data }) => setPrograms(Array.isArray(data) ? data : []))
      .catch(() => setPrograms([]));
  }, [app?.entry_mode, open]);

  useEffect(() => {
    if (!open) return;
    api.get('/api/olevel-subjects').then(({ data }) => setSubjects(Array.isArray(data) ? data : [])).catch(() => setSubjects([]));
    api.get('/api/states').then(({ data }) => setStates(Array.isArray(data) ? data : [])).catch(() => setStates([]));
  }, [open]);

  useEffect(() => {
    if (app) setForm(formFromApp(app, programs));
  }, [app, programs]);

  useEffect(() => {
    if (!form?.state_id) {
      setLgas([]);
      return;
    }
    api.get('/api/lgas', { params: { state_id: form.state_id } })
      .then(({ data }) => setLgas(Array.isArray(data) ? data : []))
      .catch(() => setLgas([]));
  }, [form?.state_id]);

  const collegeOptions = useMemo(
    () => uniqueOptions(programs.map((program) => ({
      value: Number(facultyIdOf(program) || 0),
      label: program.department?.faculty?.name || '',
    }))),
    [programs],
  );

  const departmentsFor = (collegeId: number | '') => uniqueOptions(
    programs
      .filter((program) => !collegeId || facultyIdOf(program) === Number(collegeId))
      .map((program) => ({
        value: Number(departmentIdOf(program) || 0),
        label: program.department?.name || '',
      })),
  );

  const programsFor = (departmentId: number | '', excludeId?: number) => programs
    .filter((program) => !departmentId || departmentIdOf(program) === Number(departmentId))
    .filter((program) => !excludeId || program.id !== excludeId)
    .map((program) => ({
      value: program.id,
      label: program.code ? `${program.code} — ${program.name}` : (program.name || `#${program.id}`),
    }));

  const studentLevel = programmeLevel(app?.student?.current_level);
  const canChangeProgramme = !app?.student || (studentLevel >= 100 && studentLevel <= 300);
  const programmeChanging = !!(form && originalProgramId && Number(form.first_choice_program_id) !== Number(originalProgramId));
  const nextLevel = programmeChanging ? levelAfterProgrammeChange(app?.student?.current_level) : app?.student?.current_level;
  const biodata = stepPayload(app, 'biodata');
  const nin = pick(biodata, 'nin');
  const photoPath = pick(biodata, 'photo_path');
  const checklist = useMemo(() => requiredDocumentsFor(app?.entry_mode), [app?.entry_mode]);
  const uploaded = app?.documents || [];
  const uploadedTypes = new Set(uploaded.map((doc) => pick(doc, 'doc_type')).filter(Boolean) as string[]);
  const passportPresent = uploadedTypes.has('passport') || !!photoPath;
  const jambStatus = app?.jamb_status;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const checkJamb = async (value: string) => {
    const jamb = value.replace(/\s+/g, '').toUpperCase();
    if (!jamb) {
      setJambHint(null);
      return;
    }
    try {
      await api.get(`/api/candidate-data/${encodeURIComponent(jamb)}`);
      setJambHint('validated');
    } catch {
      setJambHint('pending');
    }
  };

  const openDocument = async (doc: UploadedDoc) => {
    try {
      const { data } = await api.get(`/api/applications/${app?.id}/documents/${doc.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      message.error('Unable to open this document.');
    }
  };

  const save = async () => {
    if (!app || !form) return;
    if (!form.first_choice_program_id) {
      message.error('Select a first-choice programme.');
      return;
    }
    if (app.student && programmeChanging && !canChangeProgramme) {
      message.error('Change of programme is only allowed for 100L to 300L students.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/api/applications/${app.id}`, {
        ...form,
        state_id: form.state_id || null,
        lga_id: form.lga_id || null,
        first_choice_college_id: form.first_choice_college_id || null,
        first_choice_department_id: form.first_choice_department_id || null,
        first_choice_program_id: form.first_choice_program_id,
        second_choice_college_id: form.second_choice_college_id || null,
        second_choice_department_id: form.second_choice_department_id || null,
        second_choice_program_id: form.second_choice_program_id || null,
        first_sitting: sittingForSave(form.first_sitting),
        second_sitting: sittingForSave(form.second_sitting),
        utme: utmeForSave(form.utme),
        jamb_registration: form.jamb_registration.replace(/\s+/g, '').toUpperCase() || null,
      });
      setApp(data);
      message.success('Application file saved.');
      onSaved?.();
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      const first = errors && typeof errors === 'object'
        ? Object.values(errors).flat().find((value) => typeof value === 'string')
        : null;
      message.error((typeof first === 'string' ? first : err?.response?.data?.message) || 'Unable to save the application file.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={app?.user?.name || 'Application file'}
      open={open}
      onClose={onClose}
      width={760}
      destroyOnHidden
      extra={(
        <Space wrap>
          <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={save} disabled={!form}>Save</Button>
          <Button icon={<Printer size={14} />} loading={printing} onClick={onPrintForm}>Form</Button>
          {onPrintLetter && app?.offer_reference && (
            <Button icon={<FileText size={14} />} loading={printing} onClick={onPrintLetter}>Letter</Button>
          )}
        </Space>
      )}
    >
      {loading && <p className="text-sm text-slate-500">Loading file…</p>}
      {!loading && app && form && (
        <div className="space-y-4">
          <Section title="Summary">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Application number">
                <Input value={app.application_number || ''} disabled />
              </Field>
              <Field label="JAMB registration">
                <Input
                  value={form.jamb_registration}
                  onChange={(e) => setField('jamb_registration', e.target.value)}
                  onBlur={(e) => checkJamb(e.target.value)}
                />
              </Field>
              <Field label="JAMB status">
                <div>
                  <Tag color={(jambHint || jambStatus) === 'validated' ? 'success' : (jambHint || jambStatus) === 'pending' ? 'warning' : 'default'}>
                    {(jambHint || jambStatus || 'not checked').replace(/_/g, ' ')}
                  </Tag>
                </div>
              </Field>
              <Field label="Category">
                <Input value={(app.entry_mode || '').toUpperCase()} disabled />
              </Field>
              <Field label="Stage">
                <Input value={(app.stage || '').replace(/_/g, ' ')} disabled />
              </Field>
              <Field label="Session">
                <Input value={app.intake?.term?.session_label || ''} disabled />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
              </Field>
              {app.student && (
                <Field label="Current level">
                  <Input value={`${app.student.current_level || '—'}L`} disabled />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Programme">
            {app.student && !canChangeProgramme && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Change of programme is only allowed for 100L to 300L. This student is {studentLevel}L.
              </p>
            )}
            {app.student && canChangeProgramme && programmeChanging && (
              <p className="text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                Changing programme will set the student level to {nextLevel}L
                {studentLevel === 100 ? ' (100L remains 100L).' : ` (currently ${studentLevel}L).`}
              </p>
            )}
            <p className="text-xs font-medium text-slate-500">First choice</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="College">
                <Select
                  className="w-full"
                  showSearch
                  optionFilterProp="label"
                  disabled={!!app.student && !canChangeProgramme}
                  value={form.first_choice_college_id || undefined}
                  options={collegeOptions}
                  onChange={(value) => setForm((prev) => prev ? {
                    ...prev,
                    first_choice_college_id: value,
                    first_choice_department_id: '',
                    first_choice_program_id: '',
                  } : prev)}
                />
              </Field>
              <Field label="Department">
                <Select
                  className="w-full"
                  showSearch
                  optionFilterProp="label"
                  disabled={!form.first_choice_college_id || (!!app.student && !canChangeProgramme)}
                  value={form.first_choice_department_id || undefined}
                  options={departmentsFor(form.first_choice_college_id)}
                  onChange={(value) => setForm((prev) => prev ? {
                    ...prev,
                    first_choice_department_id: value,
                    first_choice_program_id: '',
                  } : prev)}
                />
              </Field>
              <Field label="Programme">
                <Select
                  className="w-full"
                  showSearch
                  optionFilterProp="label"
                  disabled={!form.first_choice_department_id || (!!app.student && !canChangeProgramme)}
                  value={form.first_choice_program_id || undefined}
                  options={programsFor(form.first_choice_department_id)}
                  onChange={(value) => setField('first_choice_program_id', value)}
                />
              </Field>
            </div>
            <p className="text-xs font-medium text-slate-500 pt-2">Second choice</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="College">
                <Select
                  className="w-full"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={form.second_choice_college_id || undefined}
                  options={collegeOptions}
                  onChange={(value) => setForm((prev) => prev ? {
                    ...prev,
                    second_choice_college_id: value || '',
                    second_choice_department_id: '',
                    second_choice_program_id: '',
                  } : prev)}
                />
              </Field>
              <Field label="Department">
                <Select
                  className="w-full"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={!form.second_choice_college_id}
                  value={form.second_choice_department_id || undefined}
                  options={departmentsFor(form.second_choice_college_id)}
                  onChange={(value) => setForm((prev) => prev ? {
                    ...prev,
                    second_choice_department_id: value || '',
                    second_choice_program_id: '',
                  } : prev)}
                />
              </Field>
              <Field label="Programme">
                <Select
                  className="w-full"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={!form.second_choice_department_id}
                  value={form.second_choice_program_id || undefined}
                  options={programsFor(form.second_choice_department_id, Number(form.first_choice_program_id) || undefined)}
                  onChange={(value) => setField('second_choice_program_id', value || '')}
                />
              </Field>
            </div>
          </Section>

          <Section title="Personal details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><Input value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} /></Field>
              <Field label="Middle name"><Input value={form.middle_name} onChange={(e) => setField('middle_name', e.target.value)} /></Field>
              <Field label="Surname"><Input value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} /></Field>
              <Field label="NIN"><Input value={nin || ''} disabled /></Field>
              <Field label="Date of birth"><Input type="date" value={form.date_of_birth} onChange={(e) => setField('date_of_birth', e.target.value)} /></Field>
              <Field label="Gender">
                <Select className="w-full" allowClear value={form.gender || undefined} options={GENDERS.map((value) => ({ value, label: value }))} onChange={(value) => setField('gender', value || '')} />
              </Field>
              <Field label="Marital status">
                <Select className="w-full" allowClear value={form.marital_status || undefined} options={MARITAL_STATUSES.map((value) => ({ value, label: value }))} onChange={(value) => setField('marital_status', value || '')} />
              </Field>
              <Field label="Religion">
                <Select className="w-full" allowClear value={form.religion || undefined} options={RELIGIONS.map((value) => ({ value, label: value }))} onChange={(value) => setField('religion', value || '')} />
              </Field>
              <Field label="Country">
                <Select
                  className="w-full"
                  value={form.country || undefined}
                  options={[{ value: 'Nigeria', label: 'Nigeria' }, { value: 'Non-Nigeria', label: 'Non-Nigeria' }]}
                  onChange={(value) => setForm((prev) => prev ? { ...prev, country: value, state_id: value === 'Nigeria' ? prev.state_id : '', lga_id: value === 'Nigeria' ? prev.lga_id : '' } : prev)}
                />
              </Field>
              <Field label="State">
                {form.country === 'Nigeria' ? (
                  <Select
                    className="w-full"
                    showSearch
                    optionFilterProp="label"
                    value={form.state_id || undefined}
                    options={states.map((state) => ({ value: state.state_id, label: state.state_title }))}
                    onChange={(value) => {
                      const selected = states.find((state) => state.state_id === value);
                      setForm((prev) => prev ? { ...prev, state_id: value, state: selected?.state_title || '', lga_id: '', lga: '' } : prev);
                    }}
                  />
                ) : (
                  <Input value={form.state} onChange={(e) => setField('state', e.target.value)} />
                )}
              </Field>
              <Field label="LGA">
                {form.country === 'Nigeria' ? (
                  <Select
                    className="w-full"
                    showSearch
                    optionFilterProp="label"
                    disabled={!form.state_id}
                    value={form.lga_id || undefined}
                    options={lgas.map((lga) => ({ value: lga.lga_id, label: lga.lga_title }))}
                    onChange={(value) => {
                      const selected = lgas.find((lga) => lga.lga_id === value);
                      setForm((prev) => prev ? { ...prev, lga_id: value, lga: selected?.lga_title || '' } : prev);
                    }}
                  />
                ) : (
                  <Input value={form.lga} onChange={(e) => setField('lga', e.target.value)} />
                )}
              </Field>
              <Field label="Address">
                <Input.TextArea rows={2} value={form.address} onChange={(e) => setField('address', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Health">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Blood group">
                <Select className="w-full" allowClear value={form.blood_group || undefined} options={BLOOD_GROUPS.map((value) => ({ value, label: value }))} onChange={(value) => setField('blood_group', value || '')} />
              </Field>
              <Field label="Genotype">
                <Select className="w-full" allowClear value={form.genotype || undefined} options={GENOTYPES.map((value) => ({ value, label: value }))} onChange={(value) => setField('genotype', value || '')} />
              </Field>
              <Field label="Medical condition">
                <Select
                  className="w-full"
                  value={form.has_medical_condition ? 'yes' : 'no'}
                  options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
                  onChange={(value) => setField('has_medical_condition', value === 'yes')}
                />
              </Field>
              <Field label="Details">
                <Input.TextArea rows={2} value={form.medical_condition_details} onChange={(e) => setField('medical_condition_details', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Next of kin">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><Input value={form.next_of_kin} onChange={(e) => setField('next_of_kin', e.target.value)} /></Field>
              <Field label="Relationship"><Input value={form.next_of_kin_relationship} onChange={(e) => setField('next_of_kin_relationship', e.target.value)} /></Field>
              <Field label="Phone"><Input value={form.next_of_kin_phone} onChange={(e) => setField('next_of_kin_phone', e.target.value)} /></Field>
              <Field label="Email"><Input value={form.next_of_kin_email} onChange={(e) => setField('next_of_kin_email', e.target.value)} /></Field>
              <Field label="Address"><Input.TextArea rows={2} value={form.next_of_kin_address} onChange={(e) => setField('next_of_kin_address', e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Sponsor">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><Input value={form.sponsor_name} onChange={(e) => setField('sponsor_name', e.target.value)} /></Field>
              <Field label="Relationship"><Input value={form.sponsor_relationship} onChange={(e) => setField('sponsor_relationship', e.target.value)} /></Field>
              <Field label="Phone"><Input value={form.sponsor_phone} onChange={(e) => setField('sponsor_phone', e.target.value)} /></Field>
              <Field label="Email"><Input value={form.sponsor_email} onChange={(e) => setField('sponsor_email', e.target.value)} /></Field>
              <Field label="Address"><Input.TextArea rows={2} value={form.sponsor_address} onChange={(e) => setField('sponsor_address', e.target.value)} /></Field>
            </div>
          </Section>

          {(app.entry_mode === 'utme' || form.utme.aggregate || form.utme.course_choice || form.utme.subjects.some((row) => row.subject || row.score)) && (
            <Section title="JAMB information">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aggregate">
                  <Input value={form.utme.aggregate} onChange={(e) => setField('utme', { ...form.utme, aggregate: e.target.value })} />
                </Field>
                <Field label="Course choice">
                  <Input value={form.utme.course_choice} onChange={(e) => setField('utme', { ...form.utme, course_choice: e.target.value })} />
                </Field>
              </div>
              <div className="space-y-2">
                {form.utme.subjects.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="min-w-0 flex-1">
                      <Select
                        className="w-full"
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        placeholder="Subject"
                        value={row.subject || undefined}
                        options={utmeSubjectOptions(subjects, row.subject)}
                        getPopupContainer={() => document.body}
                        onChange={(value) => {
                          const next = form.utme.subjects.map((item, i) => i === index ? { ...item, subject: value || '' } : item);
                          setField('utme', { ...form.utme, subjects: next });
                        }}
                      />
                    </div>
                    <Input
                      className="w-28"
                      placeholder="Score"
                      value={row.score}
                      onChange={(e) => {
                        const next = form.utme.subjects.map((item, i) => i === index ? { ...item, score: e.target.value } : item);
                        setField('utme', { ...form.utme, subjects: next });
                      }}
                    />
                    <Button onClick={() => setField('utme', { ...form.utme, subjects: form.utme.subjects.filter((_, i) => i !== index) })}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button onClick={() => setField('utme', { ...form.utme, subjects: [...form.utme.subjects, { subject: '', score: '' }] })}>
                  Add subject
                </Button>
              </div>
            </Section>
          )}

          <SittingEditor
            title="O'Level — first sitting"
            sitting={form.first_sitting}
            subjects={subjects}
            onChange={(sitting) => setField('first_sitting', sitting)}
          />
          <SittingEditor
            title="O'Level — second sitting"
            sitting={form.second_sitting}
            subjects={subjects}
            onChange={(sitting) => setField('second_sitting', sitting)}
            onClear={() => setField('second_sitting', emptySitting())}
          />

          <Section title="Other qualifications">
            <Input.TextArea rows={3} value={form.other_qualifications} onChange={(e) => setField('other_qualifications', e.target.value)} />
          </Section>

          <Section title="Documents">
            <div className="space-y-2">
              {checklist.map((item) => {
                const file = uploaded.find((doc) => pick(doc, 'doc_type') === item.key);
                const present = item.key === 'passport' ? passportPresent : !!file;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">
                        {item.label}
                        {item.required ? <span className="text-rose-600"> *</span> : null}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{pick(file, 'original_name') || item.description}</div>
                    </div>
                    <Space>
                      <Tag color={present ? 'success' : item.required ? 'error' : 'default'}>
                        {present ? 'On file' : 'Missing'}
                      </Tag>
                      {file && (
                        <Button size="small" icon={<Eye size={14} />} onClick={() => openDocument(file)}>
                          View
                        </Button>
                      )}
                    </Space>
                  </div>
                );
              })}
            </div>
          </Section>

          {extra ? <div className="pt-1">{extra}</div> : null}
        </div>
      )}
    </Drawer>
  );
}
