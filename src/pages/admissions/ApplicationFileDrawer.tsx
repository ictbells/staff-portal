import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Input, Select, Space, Tag, message } from 'antd';
import { Eye, FileText, Printer, RefreshCw, Save } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { isValidPhone, PHONE_ERROR, PHONE_HINT, phoneIssue } from '../../lib/phone';
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
  exam_year: string;
  subjects: { subject: string; score: string }[];
};
type DirectEntry = {
  jamb_de_number: string;
  previous_institution: string;
  qualification_type: string;
  qualification_title: string;
  qualification_class: string;
  qualification_year: string;
  programme: string;
  requested_entry_level: string;
};
type TransferBackground = {
  previous_university: string;
  previous_programme: string;
  previous_student_id: string;
  credits_earned: string;
  cgpa: string;
  reason_for_transfer: string;
  requested_entry_level: string;
  has_transfer_approval: boolean;
  approval_reference: string;
};
type CourseMapping = {
  previous_course: string;
  equivalent_course: string;
  credits: string;
  decision: string;
};
type CreditAssessment = {
  decision: string;
  approved_entry_level: string;
  credits_accepted: string;
  credits_waived: string;
  assessor_notes: string;
  course_mappings: CourseMapping[];
};
type FileApp = {
  id: number;
  application_number?: string | null;
  jamb_registration?: string | null;
  jamb_status?: string | null;
  entry_mode?: string;
  stage?: string;
  submitted_at?: string | null;
  user?: { name?: string; email?: string; phone?: string; alternate_phone?: string; jamb_registration?: string | null };
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
  student?: {
    id?: number;
    current_level?: number | string;
    program_id?: number | null;
    matric_number?: string | null;
    student_number?: string | null;
  };
  eligibility?: { meets: boolean; failed?: { rule: string; message: string }[]; requirements?: Record<string, any> };
  referee_invites?: { id: number; name?: string; email?: string; status?: string; position?: number }[];
  pg_word_limits?: {
    pg_research_interest_min_words?: number;
    pg_research_interest_max_words?: number;
    pg_statement_of_purpose_min_words?: number;
    pg_statement_of_purpose_max_words?: number;
  };
};

type FormState = {
  email: string;
  phone: string;
  alternate_phone: string;
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
  prior_degrees: { degree_title: string; institution: string; field_of_study?: string; class: string; award_level?: string; year_awarded: string; country?: string }[];
  nysc_status: string;
  nysc_number: string;
  nysc_year: string;
  nysc_exemption_reason: string;
  professional_qualifications: { body?: string; qualification?: string; year?: string; membership_no?: string }[];
  research_interest: string;
  proposed_area: string;
  statement_of_purpose: string;
  publications: { title?: string; year?: string; venue?: string }[];
  supervisor_preferences: number[];
  referees: { name: string; email: string; institution: string; position: string; phone?: string }[];
  direct_entry: DirectEntry;
  transfer_background: TransferBackground;
  credit_assessment: CreditAssessment;
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Other'];
const GENOTYPES = ['AA', 'AS', 'AC', 'SS', 'SC', 'CC', 'Other'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
const RELIGIONS = ['Christianity', 'Islam', 'Traditional', 'Other'];
const GENDERS = ['Male', 'Female'];
const OLEVEL_EXAM_TYPES = ['WAEC', 'NECO', 'GCE', 'NABTEB', 'Other'];
const OLEVEL_GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];
const OLEVEL_YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));
const CLASS_OPTIONS = [
  { value: 'first', label: 'First Class' },
  { value: 'second_upper', label: 'Second Class Upper' },
  { value: 'second_lower', label: 'Second Class Lower' },
  { value: 'third', label: 'Third Class' },
  { value: 'pass', label: 'Pass' },
  { value: 'distinction', label: 'Distinction' },
  { value: 'merit', label: 'Merit' },
  { value: 'other', label: 'Other' },
];
const NYSC_OPTIONS = [
  { value: 'completed', label: 'Completed (discharge)' },
  { value: 'exempted', label: 'Exempted' },
  { value: 'not_applicable', label: 'Not applicable' },
];
const DE_QUALIFICATION_OPTIONS = [
  { value: 'nd', label: 'ND' },
  { value: 'hnd', label: 'HND' },
  { value: 'nce', label: 'NCE' },
  { value: 'ijmb', label: 'IJMB' },
  { value: 'a_level', label: 'A-Level' },
  { value: 'first_degree', label: 'First degree' },
  { value: 'other', label: 'Other' },
];
const DE_CLASS_OPTIONS = [
  { value: 'distinction', label: 'Distinction' },
  { value: 'upper_credit', label: 'Upper Credit' },
  { value: 'lower_credit', label: 'Lower Credit' },
  { value: 'merit', label: 'Merit' },
  ...CLASS_OPTIONS.filter((opt) => !['distinction', 'merit'].includes(opt.value)),
];
const CREDIT_DECISION_OPTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'accept_with_conditions', label: 'Accept with conditions' },
  { value: 'reject', label: 'Reject' },
];
const DE_ENTRY_LEVELS = [
  { value: '200', label: '200 Level' },
  { value: '300', label: '300 Level' },
];
const TRANSFER_ENTRY_LEVELS = [
  { value: '200', label: '200 Level' },
  { value: '300', label: '300 Level' },
  { value: '400', label: '400 Level' },
];
const AWARD_LEVEL_OPTIONS = [
  { value: 'bachelor', label: 'Bachelor' },
  { value: 'pgd', label: 'Postgraduate diploma' },
  { value: 'masters', label: 'Masters' },
  { value: 'other', label: 'Other' },
];
const MAPPING_DECISION_OPTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'reject', label: 'Reject' },
];

export function StaffPassportPhoto({
  applicationId,
  className = 'h-28 w-24 rounded-lg object-cover border border-slate-200 shadow-sm',
  placeholder = null,
}: {
  applicationId: number;
  className?: string;
  placeholder?: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api.get(`/api/applications/${applicationId}/passport`, { responseType: 'blob' })
      .then(({ data, headers }) => {
        if (cancelled || !data || data.size < 32) return;
        const type = String(headers['content-type'] || data.type || '');
        if (type.includes('json') || type.includes('text/html')) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicationId]);

  if (!url) return <>{placeholder}</>;

  return (
    <img
      src={url}
      alt="Passport photograph"
      className={className}
    />
  );
}

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

const OLEVEL_SUBJECT_CAP = 9;

function emptySitting(): Sitting {
  return { exam_type: '', exam_center: '', exam_year: '', exam_number: '', results: [{ subject_id: 0, subject_name: '', grade: '' }] };
}

function emptyUtme(): Utme {
  return {
    aggregate: '',
    exam_year: '',
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
  const subjects = (Array.isArray(raw.subjects) ? raw.subjects : [])
    .slice(0, 4)
    .map((row: any) => ({
      subject: row.subject || '',
      score: row.score != null ? String(row.score) : '',
    }));
  while (subjects.length < 4) subjects.push({ subject: '', score: '' });
  return {
    aggregate: raw.aggregate != null ? String(raw.aggregate) : '',
    exam_year: raw.exam_year != null ? String(raw.exam_year) : '',
    subjects,
  };
}

function utmeSubjectTotal(utme: Utme): number {
  return utme.subjects.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
}

function utmeAggregateMatches(utme: Utme): boolean {
  const aggregate = Number(utme.aggregate);
  if (!Number.isFinite(aggregate) || utme.subjects.some((row) => String(row.score).trim() === '' || !Number.isFinite(Number(row.score)))) {
    return false;
  }
  return Math.abs(utmeSubjectTotal(utme) - aggregate) < 0.005;
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
  if (!utme.aggregate && !utme.exam_year && subjects.length === 0) return null;
  return { aggregate: utme.aggregate, exam_year: utme.exam_year, subjects };
}

function emptyDirectEntry(jamb?: string): DirectEntry {
  return {
    jamb_de_number: jamb || '',
    previous_institution: '',
    qualification_type: 'nd',
    qualification_title: '',
    qualification_class: 'upper_credit',
    qualification_year: '',
    programme: '',
    requested_entry_level: '200',
  };
}

function asDirectEntry(raw: any, jamb?: string): DirectEntry {
  const base = emptyDirectEntry(jamb);
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    jamb_de_number: raw.jamb_de_number || jamb || '',
    requested_entry_level: String(raw.requested_entry_level || base.requested_entry_level),
  };
}

function emptyTransferBackground(): TransferBackground {
  return {
    previous_university: '',
    previous_programme: '',
    previous_student_id: '',
    credits_earned: '',
    cgpa: '',
    reason_for_transfer: '',
    requested_entry_level: '200',
    has_transfer_approval: false,
    approval_reference: '',
  };
}

function asTransferBackground(raw: any): TransferBackground {
  const base = emptyTransferBackground();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    credits_earned: raw.credits_earned != null ? String(raw.credits_earned) : '',
    cgpa: raw.cgpa != null ? String(raw.cgpa) : '',
    requested_entry_level: String(raw.requested_entry_level || '200'),
    has_transfer_approval: Boolean(raw.has_transfer_approval),
  };
}

function emptyCreditAssessment(): CreditAssessment {
  return {
    decision: '',
    approved_entry_level: '',
    credits_accepted: '',
    credits_waived: '',
    assessor_notes: '',
    course_mappings: [{ previous_course: '', equivalent_course: '', credits: '', decision: 'accept' }],
  };
}

function asCreditAssessment(raw: any): CreditAssessment {
  const base = emptyCreditAssessment();
  if (!raw || typeof raw !== 'object') return base;
  const mappings = Array.isArray(raw.course_mappings) && raw.course_mappings.length
    ? raw.course_mappings.map((row: any) => ({
        previous_course: row.previous_course || '',
        equivalent_course: row.equivalent_course || '',
        credits: row.credits != null ? String(row.credits) : '',
        decision: row.decision || 'accept',
      }))
    : base.course_mappings;
  return {
    decision: raw.decision || '',
    approved_entry_level: raw.approved_entry_level != null ? String(raw.approved_entry_level) : '',
    credits_accepted: raw.credits_accepted != null ? String(raw.credits_accepted) : '',
    credits_waived: raw.credits_waived != null ? String(raw.credits_waived) : '',
    assessor_notes: raw.assessor_notes || '',
    course_mappings: mappings,
  };
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
    exam_type: pick(raw, 'exam_type', 'examType') || '',
    exam_center: pick(raw, 'exam_center', 'exam_centre', 'examCenter') || '',
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
  const id = program?.department?.faculty?.id ?? (program?.department as { faculty_id?: number } | undefined)?.faculty_id;
  return id ? Number(id) : '';
}

function departmentIdOf(program?: ProgramOption) {
  const id = (program as { department_id?: number } | undefined)?.department_id ?? program?.department?.id;
  return id ? Number(id) : '';
}

function collegeNameOf(program?: ProgramOption) {
  return program?.department?.faculty?.name || '';
}

function departmentNameOf(program?: ProgramOption) {
  return program?.department?.name || '';
}

function programmeLevel(level: number | string | undefined) {
  const n = Number(level);
  if (!n) return 0;
  return n >= 100 ? n : n * 100;
}

function programmesShareCollege(from?: ProgramOption, to?: ProgramOption) {
  const a = facultyIdOf(from);
  const b = facultyIdOf(to);
  return Boolean(a && b && a === b);
}

function levelAfterProgrammeChange(
  level: number | string | undefined,
  sameCollege: boolean,
) {
  const stored = Number(level);
  if (sameCollege) return stored;
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
  const utmeStep = stepPayload(app, 'utme');
  const programme = stepPayload(app, 'programme_selection');
  const background = stepPayload(app, 'pg_background');
  const research = stepPayload(app, 'pg_research');
  const referees = stepPayload(app, 'pg_referees');
  const firstId = Number(pick(programme, 'first_choice_program_id', 'program_id') || app.program?.id || 0) || '';
  const secondId = Number(pick(programme, 'second_choice_program_id') || 0) || '';
  const first = programs.find((row) => row.id === Number(firstId));
  const second = programs.find((row) => row.id === Number(secondId));
  return {
    email: app.user?.email || pick(contact, 'email') || '',
    phone: pick(contact, 'phone') || app.user?.phone || '',
    alternate_phone: pick(contact, 'alternate_phone') || app.user?.alternate_phone || '',
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
    utme: asUtme(pick(utmeStep, 'utme') || pick(academic, 'utme')),
    first_sitting: asSitting(pick(academic, 'first_sitting') || (Array.isArray(academic.olevel_results) ? { ...academic, results: academic.olevel_results } : null)),
    second_sitting: asSitting(pick(academic, 'second_sitting')),
    first_choice_college_id: Number(pick(programme, 'first_choice_college_id') || facultyIdOf(first) || 0) || '',
    first_choice_department_id: Number(pick(programme, 'first_choice_department_id') || departmentIdOf(first) || 0) || '',
    first_choice_program_id: firstId,
    second_choice_college_id: Number(pick(programme, 'second_choice_college_id') || facultyIdOf(second) || 0) || '',
    second_choice_department_id: Number(pick(programme, 'second_choice_department_id') || departmentIdOf(second) || 0) || '',
    second_choice_program_id: secondId,
    prior_degrees: Array.isArray(background.prior_degrees) && background.prior_degrees.length
      ? background.prior_degrees
      : [{ degree_title: '', institution: '', field_of_study: '', class: 'second_lower', award_level: 'bachelor', year_awarded: '', country: 'Nigeria' }],
    nysc_status: pick(background, 'nysc_status') || 'completed',
    nysc_number: pick(background, 'nysc_number') || '',
    nysc_year: String(pick(background, 'nysc_year') || ''),
    nysc_exemption_reason: pick(background, 'nysc_exemption_reason') || '',
    professional_qualifications: Array.isArray(background.professional_qualifications) ? background.professional_qualifications : [],
    research_interest: pick(research, 'research_interest') || '',
    proposed_area: pick(research, 'proposed_area') || '',
    statement_of_purpose: pick(research, 'statement_of_purpose') || '',
    publications: Array.isArray(research.publications) ? research.publications : [],
    supervisor_preferences: Array.isArray(research.supervisor_preferences) ? research.supervisor_preferences.map(Number).filter(Boolean) : [],
    referees: Array.isArray(referees.referees) && referees.referees.length
      ? referees.referees
      : [{ name: '', email: '', institution: '', position: '' }, { name: '', email: '', institution: '', position: '' }],
    direct_entry: asDirectEntry(stepPayload(app, 'direct_entry'), app.jamb_registration || app.user?.jamb_registration || ''),
    transfer_background: asTransferBackground(stepPayload(app, 'transfer_background')),
    credit_assessment: asCreditAssessment(stepPayload(app, 'credit_assessment')),
  };
}

function countWords(text?: string) {
  const trimmed = String(text || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function wordLimitHint(count: number, min: number, max: number) {
  const parts: string[] = [`${count} word${count === 1 ? '' : 's'}`];
  if (min > 0) parts.push(`min ${min}`);
  if (max > 0) parts.push(`max ${max}`);
  return parts.join(' · ');
}

function wordLimitError(label: string, count: number, min: number, max: number) {
  if (count === 0) return null;
  if (min > 0 && count < min) return `${label} must be at least ${min} words (currently ${count}).`;
  if (max > 0 && count > max) return `${label} must be at most ${max} words (currently ${count}).`;
  return null;
}

function Field({ label, hint, hintTone, children }: { label: string; hint?: string; hintTone?: 'error' | 'muted'; children: ReactNode }) {
  return (
    <label className="min-w-0 block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {children}
      {hint ? <div className={`mt-1 text-xs ${hintTone === 'error' ? 'text-rose-700' : 'text-slate-500'}`}>{hint}</div> : null}
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
  excludeNabteb = false,
}: {
  title: string;
  sitting: Sitting;
  subjects: OlevelSubject[];
  onChange: (next: Sitting) => void;
  onClear?: () => void;
  excludeNabteb?: boolean;
}) {
  const examTypes = OLEVEL_EXAM_TYPES.filter((value) => !excludeNabteb || value !== 'NABTEB' || sitting.exam_type === 'NABTEB');
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Exam type">
          <Select
            className="w-full"
            allowClear
            value={sitting.exam_type || undefined}
            options={examTypes.map((value) => ({ value, label: value }))}
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
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_5.75rem_auto] gap-2 items-center">
            <Select
              className="!w-full min-w-0"
              style={{ width: '100%' }}
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Subject"
              value={row.subject_id || undefined}
              options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
              onChange={(value) => {
                const subject = subjects.find((item) => item.id === value);
                const results = sitting.results.map((item, i) => i === index
                  ? { ...item, subject_id: value || 0, subject_name: subject?.name || '' }
                  : item);
                onChange({ ...sitting, results });
              }}
            />
            <Select
              className="!w-full"
              style={{ width: '100%' }}
              placeholder="Grade"
              value={row.grade || undefined}
              options={OLEVEL_GRADES.map((value) => ({ value, label: value }))}
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
          {sitting.results.length < OLEVEL_SUBJECT_CAP && (
            <Button type="primary" onClick={() => onChange({ ...sitting, results: [...sitting.results, { subject_id: 0, subject_name: '', grade: '' }] })}>
              Add subject
            </Button>
          )}
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
  mode = 'application',
}: {
  applicationId: number | null;
  open: boolean;
  onClose: () => void;
  onPrintForm: () => void;
  onPrintLetter?: () => void;
  printing?: boolean;
  extra?: ReactNode;
  onSaved?: () => void;
  mode?: 'application' | 'student';
}) {
  const { has } = useAuth();
  const [app, setApp] = useState<FileApp | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<OlevelSubject[]>([]);
  const [states, setStates] = useState<GeoState[]>([]);
  const [lgas, setLgas] = useState<GeoLga[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jambHint, setJambHint] = useState<string | null>(null);
  const [refereeInviteEmails, setRefereeInviteEmails] = useState<Record<number, string>>({});
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  const [resyncingNin, setResyncingNin] = useState(false);

  const originalProgramId = app?.program?.id || app?.student?.program_id || null;

  useEffect(() => {
    if (!open || !applicationId) {
      setApp(null);
      setForm(null);
      return;
    }
    setLoading(true);
    api.get(`/api/applications/${applicationId}`)
      .then(({ data }) => {
        setApp(data);
        const invites = Array.isArray(data?.referee_invites) ? data.referee_invites : [];
        setRefereeInviteEmails(Object.fromEntries(invites.map((invite: { id: number; email?: string }) => [invite.id, invite.email || ''])));
      })
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

  const programSelectOptions = (excludeId?: number) => programs
    .filter((program) => !excludeId || program.id !== excludeId)
    .map((program) => {
      const title = program.code ? `${program.code} — ${program.name}` : (program.name || `#${program.id}`);
      const hint = [collegeNameOf(program), departmentNameOf(program)].filter(Boolean).join(' · ');
      return {
        value: program.id,
        label: hint ? `${title} · ${hint}` : title,
      };
    });

  const applyProgrammeChoice = (which: 'first' | 'second', programId: number | '' | undefined) => {
    const program = programs.find((row) => row.id === Number(programId));
    setForm((prev) => {
      if (!prev) return prev;
      if (which === 'first') {
        const next = {
          ...prev,
          first_choice_program_id: program?.id || ('' as const),
          first_choice_college_id: facultyIdOf(program) || ('' as const),
          first_choice_department_id: departmentIdOf(program) || ('' as const),
        };
        if (program && Number(prev.second_choice_program_id) === Number(program.id)) {
          next.second_choice_program_id = '';
          next.second_choice_college_id = '';
          next.second_choice_department_id = '';
        }
        return next;
      }
      return {
        ...prev,
        second_choice_program_id: program?.id || ('' as const),
        second_choice_college_id: facultyIdOf(program) || ('' as const),
        second_choice_department_id: departmentIdOf(program) || ('' as const),
      };
    });
  };

  const studentLevel = programmeLevel(app?.student?.current_level);
  const canChangeProgramme = !app?.student || (studentLevel >= 100 && studentLevel <= 300);
  const programmeChanging = !!(form && originalProgramId && Number(form.first_choice_program_id) !== Number(originalProgramId));
  const fromProgram = programs.find((program) => program.id === Number(originalProgramId));
  const toProgram = programs.find((program) => program.id === Number(form?.first_choice_program_id));
  const sameCollegeChange = programmeChanging && programmesShareCollege(fromProgram, toProgram);
  const nextLevel = programmeChanging
    ? levelAfterProgrammeChange(app?.student?.current_level, sameCollegeChange)
    : app?.student?.current_level;
  const biodata = stepPayload(app, 'biodata');
  const nin = pick(biodata, 'nin');
  const photoPath = pick(biodata, 'photo_path');
  const checklist = useMemo(
    () => requiredDocumentsFor(app?.entry_mode, stepPayload(app ?? null, 'pg_background').nysc_status)
      .filter((doc) => !(doc.key === 'olevel_second_sitting' && form?.first_sitting.exam_type === 'NABTEB')),
    [app, form?.first_sitting.exam_type],
  );
  const uploaded = app?.documents || [];
  const uploadedTypes = new Set(uploaded.map((doc) => pick(doc, 'doc_type')).filter(Boolean) as string[]);
  const passportPresent = uploadedTypes.has('passport') || !!photoPath;
  const jambStatus = app?.jamb_status;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const resendRefereeInvite = async (invite: NonNullable<FileApp['referee_invites']>[number]) => {
    if (!app?.id || !invite?.id) return;
    const email = (refereeInviteEmails[invite.id] ?? invite.email ?? '').trim();
    if (!email) {
      message.error('Enter a referee email.');
      return;
    }
    setResendingInviteId(invite.id);
    try {
      const { data } = await api.post(`/api/applications/${app.id}/referees/${invite.id}/resend`, { email });
      const referees = Array.isArray(data?.referees) ? data.referees : app.referee_invites;
      setApp((prev) => (prev ? { ...prev, referee_invites: referees } : prev));
      setRefereeInviteEmails(Object.fromEntries((referees || []).map((row: { id: number; email?: string }) => [row.id, row.email || ''])));
      setForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          referees: prev.referees.map((row, index) => {
            const match = (referees || []).find((item: { position?: number; email?: string; name?: string }) => Number(item.position) === index + 1)
              || (referees || []).find((item: { email?: string }) => String(item.email || '').toLowerCase() === email.toLowerCase());
            return match ? { ...row, email: match.email || row.email, name: match.name || row.name } : row;
          }),
        };
      });
      message.success(data?.message || 'Invite resent.');
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      const first = errors && typeof errors === 'object'
        ? Object.values(errors).flat().find((value) => typeof value === 'string')
        : null;
      message.error((typeof first === 'string' ? first : err?.response?.data?.message) || 'Could not update or resend this invite.');
    } finally {
      setResendingInviteId(null);
    }
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

  const openPassport = async () => {
    if (!app?.id) return;
    try {
      const { data } = await api.get(`/api/applications/${app.id}/passport`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      message.error('Unable to open the passport photograph.');
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
    if (form.alternate_phone.trim() && !isValidPhone(form.alternate_phone)) {
      message.error(PHONE_ERROR);
      return;
    }
    const kinPhoneIssue = phoneIssue(form.next_of_kin_phone);
    if (kinPhoneIssue) {
      message.error(kinPhoneIssue);
      return;
    }
    const sponsorPhoneIssue = phoneIssue(form.sponsor_phone);
    if (sponsorPhoneIssue) {
      message.error(sponsorPhoneIssue);
      return;
    }
    const refereePhoneIssue = form.referees.map((row) => phoneIssue(row.phone)).find(Boolean);
    if (refereePhoneIssue) {
      message.error(refereePhoneIssue);
      return;
    }
    {
      const utme = asUtme(form.utme);
      const scoresFilled = utme.subjects.filter((row) => String(row.score).trim() !== '').length;
      if (scoresFilled === 4 && String(utme.aggregate).trim() !== '' && !utmeAggregateMatches(utme)) {
        message.error(`The four subject scores total ${utmeSubjectTotal(utme)}, which must match the aggregate.`);
        return;
      }
    }
    if (app.entry_mode === 'pg') {
      const limits = app.pg_word_limits || {};
      const researchError = wordLimitError(
        'Research interest',
        countWords(form.research_interest),
        Number(limits.pg_research_interest_min_words || 0),
        Number(limits.pg_research_interest_max_words || 0),
      );
      const purposeError = wordLimitError(
        'Statement of purpose',
        countWords(form.statement_of_purpose),
        Number(limits.pg_statement_of_purpose_min_words || 0),
        Number(limits.pg_statement_of_purpose_max_words || 0),
      );
      if (researchError || purposeError) {
        message.error(researchError || purposeError || '');
        return;
      }
    }
    setSaving(true);
    try {
      const { data, status } = await api.patch(`/api/applications/${app.id}`, {
        ...form,
        state_id: form.state_id || null,
        lga_id: form.lga_id || null,
        first_choice_college_id: facultyIdOf(toProgram) || null,
        first_choice_department_id: departmentIdOf(toProgram) || null,
        first_choice_program_id: form.first_choice_program_id,
        second_choice_college_id: app.entry_mode === 'jupeb' ? null : (facultyIdOf(programs.find((program) => program.id === Number(form.second_choice_program_id))) || null),
        second_choice_department_id: app.entry_mode === 'jupeb' ? null : (departmentIdOf(programs.find((program) => program.id === Number(form.second_choice_program_id))) || null),
        second_choice_program_id: app.entry_mode === 'jupeb' ? null : (form.second_choice_program_id || null),
        first_sitting: sittingForSave(form.first_sitting),
        second_sitting: form.first_sitting.exam_type === 'NABTEB' || form.second_sitting.exam_type === 'NABTEB'
          ? null
          : sittingForSave(form.second_sitting),
        utme: utmeForSave(form.utme),
        jamb_registration: form.jamb_registration.replace(/\s+/g, '').toUpperCase() || null,
        prior_degrees: form.prior_degrees,
        nysc_status: form.nysc_status,
        nysc_number: form.nysc_number,
        nysc_year: form.nysc_year,
        nysc_exemption_reason: form.nysc_exemption_reason,
        professional_qualifications: form.professional_qualifications,
        research_interest: form.research_interest,
        proposed_area: form.proposed_area,
        statement_of_purpose: form.statement_of_purpose,
        publications: form.publications,
        supervisor_preferences: form.supervisor_preferences,
        referees: form.referees,
        direct_entry: form.direct_entry,
        transfer_background: {
          ...form.transfer_background,
          has_transfer_approval: !!form.transfer_background.has_transfer_approval,
          credits_earned: form.transfer_background.credits_earned === '' ? null : Number(form.transfer_background.credits_earned),
          cgpa: form.transfer_background.cgpa === '' ? null : Number(form.transfer_background.cgpa),
        },
        credit_assessment: form.credit_assessment.decision
          ? {
              ...form.credit_assessment,
              credits_accepted: form.credit_assessment.credits_accepted === '' ? null : Number(form.credit_assessment.credits_accepted),
              credits_waived: form.credit_assessment.credits_waived === '' ? null : Number(form.credit_assessment.credits_waived),
              course_mappings: form.credit_assessment.course_mappings
                .filter((row) => row.previous_course || row.equivalent_course)
                .map((row) => ({
                  ...row,
                  credits: row.credits === '' ? null : Number(row.credits),
                })),
            }
          : undefined,
      });
      if (status === 202 || data?.status === 'pending_approval') {
        message.success('Submitted for approval.');
        onSaved?.();
        return;
      }
      setApp(data);
      message.success(mode === 'student' ? 'Student record saved.' : 'Application file saved.');
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

  const resyncFromNin = async () => {
    if (!app?.id || resyncingNin) return;
    setResyncingNin(true);
    try {
      const { data } = await api.post(`/api/applications/${app.id}/nin/resync`);
      setApp(data);
      message.success('NIN biodata was refreshed from the identity service.');
      onSaved?.();
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      const first = errors && typeof errors === 'object'
        ? Object.values(errors).flat().find((value) => typeof value === 'string')
        : null;
      message.error((typeof first === 'string' ? first : err?.response?.data?.message) || 'Unable to resync NIN biodata.');
    } finally {
      setResyncingNin(false);
    }
  };

  return (
    <Drawer
      title={mode === 'student' ? (app?.user?.name ? `${app.user.name} — student record` : 'Student record') : (app?.user?.name || 'Application file')}
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
          {app.entry_mode === 'pg' && app.eligibility && (
            <Alert
              type={app.eligibility.meets ? 'success' : 'warning'}
              showIcon
              message={app.eligibility.meets ? 'Meets eligibility' : 'Does not meet eligibility'}
              description={(
                <ul className="list-disc pl-4 m-0 text-sm">
                  {(app.eligibility.failed || []).map((item) => (
                    <li key={item.rule}>{item.message}</li>
                  ))}
                  {app.eligibility.requirements?.qualifying_note && (
                    <li>{app.eligibility.requirements.qualifying_note}</li>
                  )}
                  {app.eligibility.requirements?.notes && (
                    <li>{app.eligibility.requirements.notes}</li>
                  )}
                </ul>
              )}
            />
          )}
          <Section title="Summary">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Application number">
                <Input value={app.application_number || ''} disabled />
              </Field>
              {(app.student?.matric_number || app.student?.student_number) ? (
                <Field label="Matric no.">
                  <Input value={app.student.matric_number || app.student.student_number || ''} disabled />
                </Field>
              ) : null}
              <Field label={app.entry_mode === 'de' ? 'JAMB Direct Entry no.' : 'JAMB registration'}>
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
              <Field label="Application session">
                <Input value={app.intake?.name || app.intake?.term?.session_label || ''} disabled />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </Field>
              <Field label="Phone from NIN">
                <Input value={form.phone} disabled />
              </Field>
              <Field label="Alternate phone">
                <Input
                  value={form.alternate_phone}
                  onChange={(e) => setField('alternate_phone', e.target.value)}
                  placeholder="0803 123 4567 or +1 202 555 0100"
                />
                <p className="text-xs text-slate-500 mt-1">{PHONE_HINT}</p>
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
                {sameCollegeChange
                  ? `Changing programme within the same college keeps the student at ${studentLevel}L. Outstanding courses of the new programme will be available for registration. CGPA is unchanged.`
                  : `Changing programme will set the student level to ${nextLevel}L${studentLevel === 100 ? ' (100L remains 100L). The transcript and CGPA will not keep the old 100L.' : ` (currently ${studentLevel}L). The transcript and CGPA will keep only old-programme courses below ${nextLevel}L, then add the new programme.`}`}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {app.student
                ? 'Pick a programme. College and department are filled from that programme.'
                : 'New applicants pick a programme only. College and department are filled from that programme and cannot be edited.'}
            </p>
            <p className="text-xs font-medium text-slate-500">{app.entry_mode === 'jupeb' ? 'Programme' : 'First choice'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Programme">
                <Select
                  className="w-full"
                  showSearch
                  optionFilterProp="label"
                  disabled={!!app.student && !canChangeProgramme}
                  value={form.first_choice_program_id || undefined}
                  options={programSelectOptions()}
                  onChange={(value) => applyProgrammeChoice('first', value)}
                />
              </Field>
              <Field label="College">
                <Input disabled value={collegeNameOf(toProgram)} placeholder="Filled from programme" />
              </Field>
              <Field label="Department">
                <Input disabled value={departmentNameOf(toProgram)} placeholder="Filled from programme" />
              </Field>
            </div>
            {app.entry_mode !== 'jupeb' && (
            <>
            <p className="text-xs font-medium text-slate-500 pt-2">Second choice</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Programme">
                <Select
                  className="w-full"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={form.second_choice_program_id || undefined}
                  options={programSelectOptions(Number(form.first_choice_program_id) || undefined)}
                  onChange={(value) => applyProgrammeChoice('second', value || '')}
                />
              </Field>
              <Field label="College">
                <Input
                  disabled
                  value={collegeNameOf(programs.find((program) => program.id === Number(form.second_choice_program_id)))}
                  placeholder="Filled from programme"
                />
              </Field>
              <Field label="Department">
                <Input
                  disabled
                  value={departmentNameOf(programs.find((program) => program.id === Number(form.second_choice_program_id)))}
                  placeholder="Filled from programme"
                />
              </Field>
            </div>
            </>
            )}
          </Section>

          <Section title="Personal details">
            {app.id ? (
              <div className="mb-3">
                <StaffPassportPhoto applicationId={app.id} />
              </div>
            ) : null}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">NIN identity fields are locked. Staff with Re-verify NIN can refresh them from the NIN portal.</p>
              {has('identity.verify_nin') && (
                <Button icon={<RefreshCw size={14} />} loading={resyncingNin} onClick={resyncFromNin} disabled={!nin}>
                  Resync from NIN
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><Input value={form.first_name} disabled /></Field>
              <Field label="Middle name"><Input value={form.middle_name} disabled /></Field>
              <Field label="Surname"><Input value={form.last_name} disabled /></Field>
              <Field label="NIN"><Input value={nin || ''} disabled /></Field>
              <Field label="Date of birth"><Input type="date" value={form.date_of_birth} disabled /></Field>
              <Field label="Gender">
                <Select className="w-full" disabled value={form.gender || undefined} options={GENDERS.map((value) => ({ value, label: value }))} />
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
              <Field label="Phone" hint={PHONE_HINT}><Input value={form.next_of_kin_phone} onChange={(e) => setField('next_of_kin_phone', e.target.value)} /></Field>
              <Field label="Email"><Input value={form.next_of_kin_email} onChange={(e) => setField('next_of_kin_email', e.target.value)} /></Field>
              <Field label="Address"><Input.TextArea rows={2} value={form.next_of_kin_address} onChange={(e) => setField('next_of_kin_address', e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Sponsor">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><Input value={form.sponsor_name} onChange={(e) => setField('sponsor_name', e.target.value)} /></Field>
              <Field label="Relationship"><Input value={form.sponsor_relationship} onChange={(e) => setField('sponsor_relationship', e.target.value)} /></Field>
              <Field label="Phone" hint={PHONE_HINT}><Input value={form.sponsor_phone} onChange={(e) => setField('sponsor_phone', e.target.value)} /></Field>
              <Field label="Email"><Input value={form.sponsor_email} onChange={(e) => setField('sponsor_email', e.target.value)} /></Field>
              <Field label="Address"><Input.TextArea rows={2} value={form.sponsor_address} onChange={(e) => setField('sponsor_address', e.target.value)} /></Field>
            </div>
          </Section>

          {(app.entry_mode === 'utme' || form.utme.aggregate || form.utme.exam_year || form.utme.subjects.some((row) => row.subject || row.score)) && (
            <Section title="JAMB information">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Examination year">
                  <Select
                    className="w-full"
                    allowClear
                    value={form.utme.exam_year || undefined}
                    options={OLEVEL_YEARS.map((value) => ({ value, label: value }))}
                    onChange={(value) => setField('utme', { ...form.utme, exam_year: value || '' })}
                  />
                </Field>
                <Field label="Aggregate">
                  <Input value={form.utme.aggregate} onChange={(e) => setField('utme', { ...form.utme, aggregate: e.target.value })} />
                </Field>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">Subject scores (4) — total must match aggregate</p>
                {asUtme(form.utme).subjects.map((row, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2 items-center">
                    <Select
                      className="!w-full min-w-0"
                      style={{ width: '100%' }}
                      showSearch
                      allowClear
                      optionFilterProp="label"
                      placeholder="Subject"
                      value={row.subject || undefined}
                      options={utmeSubjectOptions(subjects, row.subject)}
                      onChange={(value) => {
                        const next = asUtme(form.utme).subjects.map((item, i) => i === index ? { ...item, subject: value || '' } : item);
                        setField('utme', { ...form.utme, subjects: next });
                      }}
                    />
                    <Input
                      placeholder="Score"
                      value={row.score}
                      onChange={(e) => {
                        const next = asUtme(form.utme).subjects.map((item, i) => i === index ? { ...item, score: e.target.value } : item);
                        setField('utme', { ...form.utme, subjects: next });
                      }}
                    />
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  Subject total: {utmeSubjectTotal(asUtme(form.utme))}
                  {form.utme.aggregate ? ` · aggregate ${form.utme.aggregate}` : ''}
                </p>
              </div>
            </Section>
          )}

          <SittingEditor
            title="O'Level — first sitting"
            sitting={form.first_sitting}
            subjects={subjects}
            onChange={(sitting) => {
              setField('first_sitting', sitting);
              if (sitting.exam_type === 'NABTEB') {
                setField('second_sitting', emptySitting());
              }
            }}
          />
          {form.first_sitting.exam_type !== 'NABTEB' && (
          <SittingEditor
            title="O'Level — second sitting"
            sitting={form.second_sitting}
            subjects={subjects}
            excludeNabteb
            onChange={(sitting) => {
              if (sitting.exam_type === 'NABTEB') {
                setField('second_sitting', emptySitting());
                return;
              }
              setField('second_sitting', sitting);
            }}
            onClear={() => setField('second_sitting', emptySitting())}
          />
          )}

          <Section title="Other qualifications">
            <Input.TextArea rows={3} value={form.other_qualifications} onChange={(e) => setField('other_qualifications', e.target.value)} />
          </Section>

          {app.entry_mode === 'de' && (
            <Section title="Direct Entry">
              <div className="grid grid-cols-2 gap-3">
                <Field label="JAMB DE number">
                  <Input value={form.direct_entry.jamb_de_number} onChange={(e) => setField('direct_entry', { ...form.direct_entry, jamb_de_number: e.target.value })} />
                </Field>
                <Field label="Previous institution">
                  <Input value={form.direct_entry.previous_institution} onChange={(e) => setField('direct_entry', { ...form.direct_entry, previous_institution: e.target.value })} />
                </Field>
                <Field label="Qualification type">
                  <Select className="w-full" value={form.direct_entry.qualification_type} options={DE_QUALIFICATION_OPTIONS} onChange={(value) => setField('direct_entry', { ...form.direct_entry, qualification_type: value })} />
                </Field>
                <Field label="Qualification title">
                  <Input value={form.direct_entry.qualification_title} onChange={(e) => setField('direct_entry', { ...form.direct_entry, qualification_title: e.target.value })} />
                </Field>
                <Field label="Class">
                  <Select className="w-full" value={form.direct_entry.qualification_class} options={DE_CLASS_OPTIONS} onChange={(value) => setField('direct_entry', { ...form.direct_entry, qualification_class: value })} />
                </Field>
                <Field label="Year awarded">
                  <Select className="w-full" allowClear value={form.direct_entry.qualification_year || undefined} options={OLEVEL_YEARS.map((value) => ({ value, label: value }))} onChange={(value) => setField('direct_entry', { ...form.direct_entry, qualification_year: value || '' })} />
                </Field>
                <Field label="Programme">
                  <Input value={form.direct_entry.programme} onChange={(e) => setField('direct_entry', { ...form.direct_entry, programme: e.target.value })} />
                </Field>
                <Field label="Requested entry level">
                  <Select className="w-full" value={form.direct_entry.requested_entry_level} options={DE_ENTRY_LEVELS} onChange={(value) => setField('direct_entry', { ...form.direct_entry, requested_entry_level: value })} />
                </Field>
              </div>
            </Section>
          )}

          {app.entry_mode === 'transfer' && (
            <>
              <Section title="Transfer background">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Previous university">
                    <Input value={form.transfer_background.previous_university} onChange={(e) => setField('transfer_background', { ...form.transfer_background, previous_university: e.target.value })} />
                  </Field>
                  <Field label="Previous programme">
                    <Input value={form.transfer_background.previous_programme} onChange={(e) => setField('transfer_background', { ...form.transfer_background, previous_programme: e.target.value })} />
                  </Field>
                  <Field label="Previous student ID">
                    <Input value={form.transfer_background.previous_student_id} onChange={(e) => setField('transfer_background', { ...form.transfer_background, previous_student_id: e.target.value })} />
                  </Field>
                  <Field label="Credits earned">
                    <Input value={form.transfer_background.credits_earned} onChange={(e) => setField('transfer_background', { ...form.transfer_background, credits_earned: e.target.value })} />
                  </Field>
                  <Field label="CGPA">
                    <Input value={form.transfer_background.cgpa} onChange={(e) => setField('transfer_background', { ...form.transfer_background, cgpa: e.target.value })} />
                  </Field>
                  <Field label="Requested entry level">
                    <Select className="w-full" value={form.transfer_background.requested_entry_level} options={TRANSFER_ENTRY_LEVELS} onChange={(value) => setField('transfer_background', { ...form.transfer_background, requested_entry_level: value })} />
                  </Field>
                  <Field label="Transfer approval">
                    <Select
                      className="w-full"
                      value={form.transfer_background.has_transfer_approval ? 'yes' : 'no'}
                      options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
                      onChange={(value) => setField('transfer_background', { ...form.transfer_background, has_transfer_approval: value === 'yes' })}
                    />
                  </Field>
                  <Field label="Approval reference">
                    <Input value={form.transfer_background.approval_reference} onChange={(e) => setField('transfer_background', { ...form.transfer_background, approval_reference: e.target.value })} />
                  </Field>
                  <Field label="Reason for transfer">
                    <Input.TextArea rows={3} value={form.transfer_background.reason_for_transfer} onChange={(e) => setField('transfer_background', { ...form.transfer_background, reason_for_transfer: e.target.value })} />
                  </Field>
                </div>
              </Section>
              <Section title="Credit transfer assessment">
                {app.stage !== 'credit_assessment' && (
                  <p className="text-xs text-slate-500">Save the assessment here. Transfer files cannot move past credit assessment until a decision and approved entry level are recorded.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Decision">
                    <Select className="w-full" allowClear value={form.credit_assessment.decision || undefined} options={CREDIT_DECISION_OPTIONS} onChange={(value) => setField('credit_assessment', { ...form.credit_assessment, decision: value || '' })} />
                  </Field>
                  <Field label="Approved entry level">
                    <Select className="w-full" allowClear value={form.credit_assessment.approved_entry_level || undefined} options={TRANSFER_ENTRY_LEVELS} onChange={(value) => setField('credit_assessment', { ...form.credit_assessment, approved_entry_level: value || '' })} />
                  </Field>
                  <Field label="Credits accepted">
                    <Input value={form.credit_assessment.credits_accepted} onChange={(e) => setField('credit_assessment', { ...form.credit_assessment, credits_accepted: e.target.value })} />
                  </Field>
                  <Field label="Credits waived">
                    <Input value={form.credit_assessment.credits_waived} onChange={(e) => setField('credit_assessment', { ...form.credit_assessment, credits_waived: e.target.value })} />
                  </Field>
                  <Field label="Assessor notes">
                    <Input.TextArea rows={3} value={form.credit_assessment.assessor_notes} onChange={(e) => setField('credit_assessment', { ...form.credit_assessment, assessor_notes: e.target.value })} />
                  </Field>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Course mapping</p>
                  {form.credit_assessment.course_mappings.map((row, index) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_7rem_auto] gap-2 items-center">
                      <Input placeholder="Previous course" value={row.previous_course} onChange={(e) => {
                        const course_mappings = form.credit_assessment.course_mappings.map((item, i) => i === index ? { ...item, previous_course: e.target.value } : item);
                        setField('credit_assessment', { ...form.credit_assessment, course_mappings });
                      }} />
                      <Input placeholder="Equivalent course" value={row.equivalent_course} onChange={(e) => {
                        const course_mappings = form.credit_assessment.course_mappings.map((item, i) => i === index ? { ...item, equivalent_course: e.target.value } : item);
                        setField('credit_assessment', { ...form.credit_assessment, course_mappings });
                      }} />
                      <Input placeholder="Cr." value={row.credits} onChange={(e) => {
                        const course_mappings = form.credit_assessment.course_mappings.map((item, i) => i === index ? { ...item, credits: e.target.value } : item);
                        setField('credit_assessment', { ...form.credit_assessment, course_mappings });
                      }} />
                      <Select value={row.decision} options={MAPPING_DECISION_OPTIONS} onChange={(value) => {
                        const course_mappings = form.credit_assessment.course_mappings.map((item, i) => i === index ? { ...item, decision: value } : item);
                        setField('credit_assessment', { ...form.credit_assessment, course_mappings });
                      }} />
                      <Button onClick={() => setField('credit_assessment', {
                        ...form.credit_assessment,
                        course_mappings: form.credit_assessment.course_mappings.filter((_, i) => i !== index),
                      })}>Remove</Button>
                    </div>
                  ))}
                  <Button onClick={() => setField('credit_assessment', {
                    ...form.credit_assessment,
                    course_mappings: [...form.credit_assessment.course_mappings, { previous_course: '', equivalent_course: '', credits: '', decision: 'accept' }],
                  })}>Add course</Button>
                </div>
              </Section>
            </>
          )}

          {app.entry_mode === 'pg' && (
            <>
              <Section title="Prior degrees">
                <div className="space-y-3">
                  {form.prior_degrees.map((row, index) => (
                    <div key={index} className="rounded-lg border border-slate-100 p-3 grid grid-cols-2 gap-2">
                      <Field label="Degree"><Input value={row.degree_title} onChange={(e) => {
                        const prior_degrees = form.prior_degrees.map((item, i) => i === index ? { ...item, degree_title: e.target.value } : item);
                        setField('prior_degrees', prior_degrees);
                      }} /></Field>
                      <Field label="Institution"><Input value={row.institution} onChange={(e) => {
                        const prior_degrees = form.prior_degrees.map((item, i) => i === index ? { ...item, institution: e.target.value } : item);
                        setField('prior_degrees', prior_degrees);
                      }} /></Field>
                      <Field label="Class">
                        <Select className="w-full" value={row.class} options={CLASS_OPTIONS} onChange={(value) => {
                          const prior_degrees = form.prior_degrees.map((item, i) => i === index ? { ...item, class: value } : item);
                          setField('prior_degrees', prior_degrees);
                        }} />
                      </Field>
                      <Field label="Award level">
                        <Select className="w-full" value={row.award_level || 'bachelor'} options={AWARD_LEVEL_OPTIONS} onChange={(value) => {
                          const prior_degrees = form.prior_degrees.map((item, i) => i === index ? { ...item, award_level: value } : item);
                          setField('prior_degrees', prior_degrees);
                        }} />
                      </Field>
                      <Field label="Year"><Input value={row.year_awarded} onChange={(e) => {
                        const prior_degrees = form.prior_degrees.map((item, i) => i === index ? { ...item, year_awarded: e.target.value } : item);
                        setField('prior_degrees', prior_degrees);
                      }} /></Field>
                      <Field label="Field of study"><Input value={row.field_of_study || ''} onChange={(e) => {
                        const prior_degrees = form.prior_degrees.map((item, i) => i === index ? { ...item, field_of_study: e.target.value } : item);
                        setField('prior_degrees', prior_degrees);
                      }} /></Field>
                      {form.prior_degrees.length > 1 && (
                        <div className="col-span-2">
                          <Button onClick={() => setField('prior_degrees', form.prior_degrees.filter((_, i) => i !== index))}>Remove</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button onClick={() => setField('prior_degrees', [...form.prior_degrees, { degree_title: '', institution: '', field_of_study: '', class: 'second_lower', award_level: 'bachelor', year_awarded: '', country: 'Nigeria' }])}>Add degree</Button>
                </div>
              </Section>
              <Section title="NYSC">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status">
                    <Select className="w-full" value={form.nysc_status} options={NYSC_OPTIONS} onChange={(value) => setField('nysc_status', value)} />
                  </Field>
                  <Field label="Number">
                    <Input
                      maxLength={12}
                      placeholder="Max 12 characters"
                      value={form.nysc_number}
                      onChange={(e) => setField('nysc_number', e.target.value.slice(0, 12))}
                    />
                  </Field>
                  <Field label="Year">
                    <Select
                      className="w-full"
                      allowClear
                      placeholder="Select year"
                      value={form.nysc_year || undefined}
                      options={[
                        ...(form.nysc_year && !OLEVEL_YEARS.includes(form.nysc_year)
                          ? [{ value: form.nysc_year, label: form.nysc_year }]
                          : []),
                        ...OLEVEL_YEARS.map((value) => ({ value, label: value })),
                      ]}
                      onChange={(value) => setField('nysc_year', value || '')}
                    />
                  </Field>
                  <Field label="Exemption / N/A reason"><Input value={form.nysc_exemption_reason} onChange={(e) => setField('nysc_exemption_reason', e.target.value)} /></Field>
                </div>
              </Section>
              <Section title="Research and purpose">
                <div className="space-y-3">
                  {(() => {
                    const limits = app.pg_word_limits || {};
                    const researchMin = Number(limits.pg_research_interest_min_words || 0);
                    const researchMax = Number(limits.pg_research_interest_max_words || 0);
                    const purposeMin = Number(limits.pg_statement_of_purpose_min_words || 0);
                    const purposeMax = Number(limits.pg_statement_of_purpose_max_words || 0);
                    const researchCount = countWords(form.research_interest);
                    const purposeCount = countWords(form.statement_of_purpose);
                    return (
                      <>
                        <Field
                          label="Research interest"
                          hint={wordLimitHint(researchCount, researchMin, researchMax)}
                          hintTone={wordLimitError('Research interest', researchCount, researchMin, researchMax) ? 'error' : 'muted'}
                        >
                          <Input.TextArea rows={2} value={form.research_interest} onChange={(e) => setField('research_interest', e.target.value)} />
                        </Field>
                        <Field label="Proposed area"><Input value={form.proposed_area} onChange={(e) => setField('proposed_area', e.target.value)} /></Field>
                        <Field
                          label="Statement of purpose"
                          hint={wordLimitHint(purposeCount, purposeMin, purposeMax)}
                          hintTone={wordLimitError('Statement of purpose', purposeCount, purposeMin, purposeMax) ? 'error' : 'muted'}
                        >
                          <Input.TextArea rows={4} value={form.statement_of_purpose} onChange={(e) => setField('statement_of_purpose', e.target.value)} />
                        </Field>
                      </>
                    );
                  })()}
                </div>
              </Section>
              <Section title="Referees">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 m-0">
                    Change a referee email below and resend the recommendation request. The previous link stops working when you resend.
                  </p>
                  {form.referees.map((row, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-3">
                      <Field label="Name"><Input value={row.name} onChange={(e) => {
                        const referees = form.referees.map((item, i) => i === index ? { ...item, name: e.target.value } : item);
                        setField('referees', referees);
                      }} /></Field>
                      <Field label="Email"><Input value={row.email} onChange={(e) => {
                        const referees = form.referees.map((item, i) => i === index ? { ...item, email: e.target.value } : item);
                        setField('referees', referees);
                      }} /></Field>
                      <Field label="Institution"><Input value={row.institution} onChange={(e) => {
                        const referees = form.referees.map((item, i) => i === index ? { ...item, institution: e.target.value } : item);
                        setField('referees', referees);
                      }} /></Field>
                      <Field label="Position"><Input value={row.position} onChange={(e) => {
                        const referees = form.referees.map((item, i) => i === index ? { ...item, position: e.target.value } : item);
                        setField('referees', referees);
                      }} /></Field>
                      <Field label="Phone" hint={PHONE_HINT}><Input value={row.phone || ''} onChange={(e) => {
                        const referees = form.referees.map((item, i) => i === index ? { ...item, phone: e.target.value } : item);
                        setField('referees', referees);
                      }} /></Field>
                    </div>
                  ))}
                  {(app.referee_invites || []).map((invite) => {
                    const draft = refereeInviteEmails[invite.id] ?? invite.email ?? '';
                    const submitted = invite.status === 'submitted';
                    const emailChanged = draft.trim().toLowerCase() !== String(invite.email || '').trim().toLowerCase();
                    return (
                      <div key={invite.id} className="rounded-lg border border-slate-100 px-3 py-2 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-800">{invite.name || 'Referee'}</span>
                          <Tag color={invite.status === 'submitted' ? 'success' : invite.status === 'expired' ? 'error' : 'warning'}>
                            {invite.status}
                          </Tag>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                          <div className="min-w-0 flex-1">
                            <Field label="Invite email">
                              <Input
                                type="email"
                                value={draft}
                                disabled={submitted}
                                onChange={(e) => setRefereeInviteEmails((current) => ({ ...current, [invite.id]: e.target.value }))}
                              />
                            </Field>
                          </div>
                          {!submitted && (
                            <Button
                              size="small"
                              type={emailChanged ? 'primary' : 'default'}
                              loading={resendingInviteId === invite.id}
                              onClick={() => void resendRefereeInvite(invite)}
                            >
                              {emailChanged ? 'Save email & resend' : 'Resend invite'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </>
          )}

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
                      {(file || (item.key === 'passport' && passportPresent)) && (
                        <Button
                          size="small"
                          icon={<Eye size={14} />}
                          onClick={() => (item.key === 'passport' ? openPassport() : file && openDocument(file))}
                        >
                          View
                        </Button>
                      )}
                    </Space>
                  </div>
                );
              })}
              {uploaded.filter((doc) => String(pick(doc, 'doc_type') || '').startsWith('recommendation')).map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">Recommendation letter</div>
                    <div className="text-xs text-slate-500 truncate">{pick(file, 'original_name') || pick(file, 'doc_type')}</div>
                  </div>
                  <Space>
                    <Tag color="success">On file</Tag>
                    <Button size="small" icon={<Eye size={14} />} onClick={() => openDocument(file)}>View</Button>
                  </Space>
                </div>
              ))}
            </div>
          </Section>

          {extra ? <div className="pt-1">{extra}</div> : null}
        </div>
      )}
    </Drawer>
  );
}
