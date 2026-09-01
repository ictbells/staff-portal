import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, InputNumber, Radio, Select, Switch, message } from 'antd';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  ClipboardCheck,
  Clock,
  FileText,
  GraduationCap,
  Mail,
  PenLine,
  Phone,
  Save,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import api, { isPendingApproval } from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import {
  Badge,
  Card,
  fieldHelpClass,
  fieldLabelClass,
  inputClass,
  Spinner,
  StatCard,
  WorkspaceHero,
} from '../components/ui';

type ExamClearanceSettings = {
  tuition_paid: boolean;
  tuition_percent: number;
  courses_registered: boolean;
  no_outstanding_invoices: boolean;
  hostel_if_allocated: boolean;
  clinic_bills_cleared: boolean;
};

type PaymentGatewayKey = 'paystack' | 'wema';

type PaymentGatewayInfo = {
  key: PaymentGatewayKey;
  label: string;
  configured: boolean;
};

type SecuritySettings = {
  two_factor_enabled: boolean;
  password_rotation_days: number;
  inactivity_logout_minutes: number;
  exam_clearance: ExamClearanceSettings;
  admissions_email: string;
  admissions_phone: string;
  staff_support_label: string;
  staff_support_email: string;
  staff_support_phone: string;
  studentship_years_after_graduation: number;
  transcript_requests_enabled: boolean;
  transcript_delivery_collect: boolean;
  transcript_delivery_generated_pdf: boolean;
  transcript_delivery_uploaded_pdf: boolean;
  transcript_collect_instructions: string;
  registrar_name: string;
  registrar_title: string;
  pg_research_interest_min_words: number;
  pg_research_interest_max_words: number;
  pg_statement_of_purpose_min_words: number;
  pg_statement_of_purpose_max_words: number;
  payment_gateway: PaymentGatewayKey;
  payment_gateways: Record<PaymentGatewayKey, PaymentGatewayInfo>;
};

const DEFAULT_EXAM_CLEARANCE: ExamClearanceSettings = {
  tuition_paid: true,
  tuition_percent: 100,
  courses_registered: true,
  no_outstanding_invoices: true,
  hostel_if_allocated: false,
  clinic_bills_cleared: false,
};

const PASSWORD_ROTATION_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 30, label: 'Every 30 days' },
  { value: 60, label: 'Every 60 days' },
  { value: 90, label: 'Every 90 days' },
  { value: 180, label: 'Every 180 days' },
];

const INACTIVITY_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
];

const EMPTY_SETTINGS: SecuritySettings = {
  two_factor_enabled: false,
  password_rotation_days: 0,
  inactivity_logout_minutes: 0,
  exam_clearance: DEFAULT_EXAM_CLEARANCE,
  admissions_email: '',
  admissions_phone: '',
  staff_support_label: 'ICT & Registry support',
  staff_support_email: '',
  staff_support_phone: '',
  studentship_years_after_graduation: 2,
  transcript_requests_enabled: false,
  transcript_delivery_collect: true,
  transcript_delivery_generated_pdf: true,
  transcript_delivery_uploaded_pdf: true,
  transcript_collect_instructions:
    'Please collect your official transcript from the Registry during office hours. Bring a valid ID and your request reference.',
  registrar_name: '',
  registrar_title: 'Registrar',
  pg_research_interest_min_words: 0,
  pg_research_interest_max_words: 150,
  pg_statement_of_purpose_min_words: 0,
  pg_statement_of_purpose_max_words: 500,
  payment_gateway: 'paystack',
  payment_gateways: {
    paystack: { key: 'paystack', label: 'Paystack', configured: false },
    wema: { key: 'wema', label: 'Wema Bank', configured: false },
  },
};

function normalizeSettings(data: Partial<SecuritySettings> = {}): SecuritySettings {
  return {
    ...EMPTY_SETTINGS,
    ...data,
    exam_clearance: { ...DEFAULT_EXAM_CLEARANCE, ...(data.exam_clearance || {}) },
    admissions_email: data.admissions_email || '',
    admissions_phone: data.admissions_phone || '',
    staff_support_label: data.staff_support_label || 'ICT & Registry support',
    staff_support_email: data.staff_support_email || '',
    staff_support_phone: data.staff_support_phone || '',
    studentship_years_after_graduation: data.studentship_years_after_graduation || 2,
    transcript_requests_enabled: data.transcript_requests_enabled === true,
    transcript_delivery_collect: data.transcript_delivery_collect !== false,
    transcript_delivery_generated_pdf: data.transcript_delivery_generated_pdf !== false,
    transcript_delivery_uploaded_pdf: data.transcript_delivery_uploaded_pdf !== false,
    transcript_collect_instructions:
      data.transcript_collect_instructions
      || EMPTY_SETTINGS.transcript_collect_instructions,
    registrar_name: data.registrar_name || '',
    registrar_title: data.registrar_title || EMPTY_SETTINGS.registrar_title,
    pg_research_interest_min_words: Number(data.pg_research_interest_min_words ?? EMPTY_SETTINGS.pg_research_interest_min_words),
    pg_research_interest_max_words: Number(data.pg_research_interest_max_words ?? EMPTY_SETTINGS.pg_research_interest_max_words),
    pg_statement_of_purpose_min_words: Number(data.pg_statement_of_purpose_min_words ?? EMPTY_SETTINGS.pg_statement_of_purpose_min_words),
    pg_statement_of_purpose_max_words: Number(data.pg_statement_of_purpose_max_words ?? EMPTY_SETTINGS.pg_statement_of_purpose_max_words),
    payment_gateway: data.payment_gateway === 'wema' ? 'wema' : 'paystack',
    payment_gateways: {
      paystack: {
        ...EMPTY_SETTINGS.payment_gateways.paystack,
        ...(data.payment_gateways?.paystack || {}),
      },
      wema: {
        ...EMPTY_SETTINGS.payment_gateways.wema,
        ...(data.payment_gateways?.wema || {}),
      },
    },
  };
}

function optionLabel(options: { value: number; label: string }[], value: number) {
  return options.find((option) => option.value === value)?.label || 'Disabled';
}

function Field({
  label,
  icon: Icon,
  hint,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="block min-w-0">
      <span className={fieldLabelClass}>{label}</span>
      {Icon ? (
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          {children}
        </div>
      ) : (
        children
      )}
      {hint ? <p className={fieldHelpClass}>{hint}</p> : null}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3.5 transition ${checked ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium text-slate-800">{title}</div>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
        <Switch checked={checked} onChange={onChange} />
      </div>
      {checked && children ? <div className="mt-3 border-t border-sky-100 pt-3">{children}</div> : null}
    </div>
  );
}

function ContactPreview({
  eyebrow,
  title,
  email,
  phone,
}: {
  eyebrow: string;
  title: string;
  email: string;
  phone: string;
}) {
  if (!email && !phone) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {title} will stay hidden until an email or phone number is saved.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-sky-700 to-sky-900 p-4 text-white shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">{eyebrow}</p>
      <p className="mt-1.5 flex items-start gap-2 text-sm font-semibold">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 break-words">{title}</span>
      </p>
      {email ? (
        <p className="mt-2 flex items-start gap-2 text-sm text-sky-100">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 break-all">{email}</span>
        </p>
      ) : null}
      {phone ? (
        <p className="mt-1.5 flex items-start gap-2 text-sm text-sky-100">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 break-words">{phone}</span>
        </p>
      ) : null}
    </div>
  );
}

export default function ApplicationSettings() {
  const { has, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>(EMPTY_SETTINGS);
  const [saved, setSaved] = useState<SecuritySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyPayload = (data: Partial<SecuritySettings>) => {
    const next = normalizeSettings(data);
    setSettings(next);
    setSaved(next);
  };

  useEffect(() => {
    api
      .get('/api/security-settings')
      .then(({ data }) => applyPayload(data))
      .catch(() => message.error('Unable to load security settings.'))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [saved, settings]);
  const examEnabledCount = useMemo(
    () => Object.entries(settings.exam_clearance).filter(([key, value]) => key !== 'tuition_percent' && value).length,
    [settings.exam_clearance],
  );

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/api/security-settings', settings);
      if (isPendingApproval(res)) {
        return;
      }
      applyPayload(res.data);
      message.success('Settings saved. Contact details are shown on the student and staff login pages.');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        <Spinner label="Loading settings…" />
      </div>
    );
  }

  if (!has('settings.manage')) {
    return <AccessDeniedPanel reason="missing_permission" resourceLabel="Application settings" />;
  }

  const saveButton = (key: string) => (
    <Button
      key={key}
      type="primary"
      htmlType="submit"
      icon={<Save className="h-4 w-4" />}
      loading={saving}
      disabled={!dirty && !saving}
    >
      {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
    </Button>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <WorkspaceHero
        eyebrow="System"
        title="Application settings"
        description="Policies that apply across staff security, login contact cards, studentship, online payments, postgraduate essay length, and exam clearance."
        icon={Settings}
      >
        {saveButton('hero')}
      </WorkspaceHero>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Staff 2FA"
          value={settings.two_factor_enabled ? 'Required' : 'Optional'}
          hint="Authenticator app at sign-in"
          icon={ShieldCheck}
          tone={settings.two_factor_enabled ? 'emerald' : 'sky'}
        />
        <StatCard
          label="Idle timeout"
          value={settings.inactivity_logout_minutes ? `${settings.inactivity_logout_minutes} min` : 'Off'}
          hint={optionLabel(INACTIVITY_OPTIONS, settings.inactivity_logout_minutes)}
          icon={Clock}
          tone={settings.inactivity_logout_minutes ? 'amber' : 'sky'}
        />
        <StatCard
          label="Studentship"
          value={`${settings.studentship_years_after_graduation} yr`}
          hint="Portal access after conferment"
          icon={GraduationCap}
        />
        <StatCard
          label="Exam checks"
          value={`${examEnabledCount} on`}
          hint="Conditions students must meet"
          icon={ClipboardCheck}
          tone="emerald"
        />
      </div>

      <Card
        title="Login contact"
        description="These details appear on public sign-in pages. Leave a field blank to hide it."
      >
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" aria-hidden />
                <h3 className="text-sm font-semibold text-slate-800">Student portal</h3>
              </div>
              <Field label="Email" icon={Mail} hint="Shown on student login and signup.">
                <input
                  className={`${inputClass} pl-10`}
                  type="email"
                  value={settings.admissions_email}
                  onChange={(e) => setSettings((s) => ({ ...s, admissions_email: e.target.value }))}
                  placeholder="admissions@bellsuniversity.edu.ng"
                />
              </Field>
              <Field label="Phone" icon={Phone}>
                <input
                  className={`${inputClass} pl-10`}
                  type="tel"
                  value={settings.admissions_phone}
                  onChange={(e) => setSettings((s) => ({ ...s, admissions_phone: e.target.value }))}
                  placeholder="+234 801 000 0000"
                />
              </Field>
              <ContactPreview
                eyebrow="Student login"
                title="Admissions contact"
                email={settings.admissions_email}
                phone={settings.admissions_phone}
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-600" aria-hidden />
                <h3 className="text-sm font-semibold text-slate-800">Staff portal</h3>
              </div>
              <Field label="Label">
                <input
                  className={inputClass}
                  value={settings.staff_support_label}
                  onChange={(e) => setSettings((s) => ({ ...s, staff_support_label: e.target.value }))}
                  placeholder="ICT & Registry support"
                />
              </Field>
              <Field label="Email" icon={Mail}>
                <input
                  className={`${inputClass} pl-10`}
                  type="email"
                  value={settings.staff_support_email}
                  onChange={(e) => setSettings((s) => ({ ...s, staff_support_email: e.target.value }))}
                  placeholder="ict@bellsuniversity.edu.ng"
                />
              </Field>
              <Field label="Phone" icon={Phone}>
                <input
                  className={`${inputClass} pl-10`}
                  type="tel"
                  value={settings.staff_support_phone}
                  onChange={(e) => setSettings((s) => ({ ...s, staff_support_phone: e.target.value }))}
                  placeholder="+234 801 000 0000"
                />
              </Field>
              <ContactPreview
                eyebrow="Staff login"
                title={settings.staff_support_label || 'ICT & Registry support'}
                email={settings.staff_support_email}
                phone={settings.staff_support_phone}
              />
            </div>
          </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
          <Card
            title="Staff security"
            description="These policies apply to every staff account on the next sign-in."
          >
            <div className="space-y-3">
              <ToggleRow
                title="Require two-factor authentication"
                description="Staff must set up an authenticator app and enter a code at sign-in."
                checked={settings.two_factor_enabled}
                onChange={(checked) => setSettings((s) => ({ ...s, two_factor_enabled: checked }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password rotation" hint="Staff must change passwords when this interval expires.">
                  <Select
                    className="w-full"
                    size="large"
                    value={settings.password_rotation_days}
                    onChange={(value) => setSettings((s) => ({ ...s, password_rotation_days: value }))}
                    options={PASSWORD_ROTATION_OPTIONS}
                  />
                </Field>
                <Field label="Inactivity logout" hint="Signs staff out across all open tabs.">
                  <Select
                    className="w-full"
                    size="large"
                    value={settings.inactivity_logout_minutes}
                    onChange={(value) => setSettings((s) => ({ ...s, inactivity_logout_minutes: value }))}
                    options={INACTIVITY_OPTIONS}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card
            title="Studentship after graduation"
            description="Graduates keep student-portal access until this many years after registrar conferment. Then they become alumni and cannot sign in."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Field label="Years after conferment" hint="Allowed range is 1 to 10 years. Default is 2.">
                  <InputNumber
                    className="w-full"
                    size="large"
                    min={1}
                    max={10}
                    value={settings.studentship_years_after_graduation}
                    onChange={(value) => setSettings((s) => ({
                      ...s,
                      studentship_years_after_graduation: Number(value || 2),
                    }))}
                  />
                </Field>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:max-w-xs">
                Conferment date plus <span className="font-semibold text-slate-800">{settings.studentship_years_after_graduation}</span>
                {' '}year{settings.studentship_years_after_graduation === 1 ? '' : 's'} becomes the studentship end date.
              </div>
            </div>
          </Card>
      </div>

      <Card
        title="Postgraduate research and purpose"
        description="Word limits for postgraduate applicants on Research interest and Statement of purpose. Minimum 0 means no floor. Maximum 0 means no word cap (character limits still apply)."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-600" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-800">Research interest</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum words">
                <InputNumber
                  className="w-full"
                  size="large"
                  min={0}
                  max={5000}
                  value={settings.pg_research_interest_min_words}
                  onChange={(value) => setSettings((s) => ({ ...s, pg_research_interest_min_words: Number(value || 0) }))}
                />
              </Field>
              <Field label="Maximum words">
                <InputNumber
                  className="w-full"
                  size="large"
                  min={0}
                  max={5000}
                  value={settings.pg_research_interest_max_words}
                  onChange={(value) => setSettings((s) => ({ ...s, pg_research_interest_max_words: Number(value || 0) }))}
                />
              </Field>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-600" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-800">Statement of purpose</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum words">
                <InputNumber
                  className="w-full"
                  size="large"
                  min={0}
                  max={5000}
                  value={settings.pg_statement_of_purpose_min_words}
                  onChange={(value) => setSettings((s) => ({ ...s, pg_statement_of_purpose_min_words: Number(value || 0) }))}
                />
              </Field>
              <Field label="Maximum words">
                <InputNumber
                  className="w-full"
                  size="large"
                  min={0}
                  max={5000}
                  value={settings.pg_statement_of_purpose_max_words}
                  onChange={(value) => setSettings((s) => ({ ...s, pg_statement_of_purpose_max_words: Number(value || 0) }))}
                />
              </Field>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Online payments"
        description="Only the selected gateway is used for new application, acceptance, transcript, and wallet payments. Keys stay in the server environment."
      >
        <Radio.Group
          className="w-full"
          value={settings.payment_gateway}
          onChange={(e) => setSettings((s) => ({ ...s, payment_gateway: e.target.value as PaymentGatewayKey }))}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(['paystack', 'wema'] as const).map((key) => {
              const meta = settings.payment_gateways[key];
              const selected = settings.payment_gateway === key;
              const blocked = key === 'wema' && !meta.configured;
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition ${
                    selected ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'
                  } ${blocked ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <Radio value={key} disabled={blocked} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{meta.label}</span>
                      <Badge variant={meta.configured ? 'success' : 'default'}>
                        {meta.configured ? 'Configured' : 'Missing keys'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {key === 'paystack'
                        ? 'Card and transfer checkout via Paystack.'
                        : 'ALATPay checkout (Wema Bank). Add public key, secret key, and business ID in .env.'}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </Radio.Group>
        <p className={`${fieldHelpClass} mt-3`}>
          Active gateway: {settings.payment_gateways[settings.payment_gateway]?.label || 'Paystack'}.
          Pending payments still confirm with the provider that started them.
        </p>
      </Card>

      <Card
        title="Official transcript requests"
        description="Public school-website form on the student portal. Finance sets the fee under Fee items (category Official transcript). Registry processes paid requests."
      >
        <div className="space-y-3">
          <ToggleRow
            title="Accept public transcript requests"
            description="When on, /transcript-request on the student portal accepts NIN requests and online payment."
            checked={settings.transcript_requests_enabled}
            onChange={(checked) => setSettings((s) => ({ ...s, transcript_requests_enabled: checked }))}
          />
          <ToggleRow
            title="Collect at Registry"
            description="Staff can mark a request ready for collection; the email includes the collection instructions below."
            checked={settings.transcript_delivery_collect}
            onChange={(checked) => setSettings((s) => ({ ...s, transcript_delivery_collect: checked }))}
          />
          <ToggleRow
            title="System-generated PDF"
            description="Staff can issue a system official PDF (with signature block) and email a download link."
            checked={settings.transcript_delivery_generated_pdf}
            onChange={(checked) => setSettings((s) => ({ ...s, transcript_delivery_generated_pdf: checked }))}
          />
          <ToggleRow
            title="Staff-uploaded PDF"
            description="Staff can upload a scanned/signed PDF and email a download link."
            checked={settings.transcript_delivery_uploaded_pdf}
            onChange={(checked) => setSettings((s) => ({ ...s, transcript_delivery_uploaded_pdf: checked }))}
          />
          <Field
            label="Registrar name"
            icon={PenLine}
            hint="Printed on system-generated official transcripts. Leave blank to use the officer who marks the request ready."
          >
            <input
              className={`${inputClass} pl-10`}
              value={settings.registrar_name}
              onChange={(e) => setSettings((s) => ({ ...s, registrar_name: e.target.value }))}
              placeholder="Lamidi S. Tafa (Mr.)"
            />
          </Field>
          <Field label="Signatory title" hint="Appears under the registrar name on the transcript.">
            <input
              className={inputClass}
              value={settings.registrar_title}
              onChange={(e) => setSettings((s) => ({ ...s, registrar_title: e.target.value }))}
              placeholder="Registrar"
            />
          </Field>
          <Field label="Collection instructions" hint="Included in ready emails when delivery is collect at Registry.">
            <textarea
              className={`${inputClass} min-h-[96px]`}
              value={settings.transcript_collect_instructions}
              onChange={(e) => setSettings((s) => ({ ...s, transcript_collect_instructions: e.target.value }))}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Exam clearance"
        description="Only enabled checks are enforced when a student is cleared to sit exams."
        actions={<Badge variant={examEnabledCount ? 'success' : 'default'}>{examEnabledCount} active</Badge>}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <ToggleRow
            title="Tuition paid"
            description="Require the selected percentage of billed tuition to be paid."
            checked={settings.exam_clearance.tuition_paid}
            onChange={(checked) => setSettings((s) => ({
              ...s,
              exam_clearance: { ...s.exam_clearance, tuition_paid: checked },
            }))}
          >
            <Field label="Minimum tuition paid (%)">
              <InputNumber
                className="w-full"
                size="large"
                min={0}
                max={100}
                value={settings.exam_clearance.tuition_percent}
                onChange={(value) => setSettings((s) => ({
                  ...s,
                  exam_clearance: { ...s.exam_clearance, tuition_percent: Number(value || 0) },
                }))}
              />
            </Field>
          </ToggleRow>
          <ToggleRow
            title="Course registration complete"
            description="Student must finish registration for the current semester."
            checked={settings.exam_clearance.courses_registered}
            onChange={(checked) => setSettings((s) => ({
              ...s,
              exam_clearance: { ...s.exam_clearance, courses_registered: checked },
            }))}
          />
          <ToggleRow
            title="No outstanding invoices"
            description="All billed school charges except application and acceptance fees must be settled."
            checked={settings.exam_clearance.no_outstanding_invoices}
            onChange={(checked) => setSettings((s) => ({
              ...s,
              exam_clearance: { ...s.exam_clearance, no_outstanding_invoices: checked },
            }))}
          />
          <ToggleRow
            title="Hostel fees if allocated"
            description="If the student has a hostel bed, hostel invoices must be paid."
            checked={settings.exam_clearance.hostel_if_allocated}
            onChange={(checked) => setSettings((s) => ({
              ...s,
              exam_clearance: { ...s.exam_clearance, hostel_if_allocated: checked },
            }))}
          />
          <ToggleRow
            title="Clinic bills cleared"
            description="Unpaid clinic bills block exam clearance."
            checked={settings.exam_clearance.clinic_bills_cleared}
            onChange={(checked) => setSettings((s) => ({
              ...s,
              exam_clearance: { ...s.exam_clearance, clinic_bills_cleared: checked },
            }))}
          />
        </div>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur">
        <p className="text-sm text-slate-500">
          {dirty ? 'You have unsaved changes.' : 'All application settings are saved.'}
        </p>
        {saveButton('footer')}
      </div>
    </form>
  );
}
