import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Switch, message } from 'antd';
import api from '../api';
import { useAuth } from '../auth';
import { Btn, Card, PageHeader, Spinner } from '../components/ui';

type ExamClearanceSettings = {
  tuition_paid: boolean;
  tuition_percent: number;
  courses_registered: boolean;
  no_outstanding_invoices: boolean;
  hostel_if_allocated: boolean;
  clinic_bills_cleared: boolean;
};

type SecuritySettings = {
  two_factor_enabled: boolean;
  password_rotation_days: number;
  inactivity_logout_minutes: number;
  exam_clearance: ExamClearanceSettings;
  admissions_email: string;
  admissions_phone: string;
  studentship_years_after_graduation: number;
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

export default function ApplicationSettings() {
  const { has, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>({
    two_factor_enabled: false,
    password_rotation_days: 0,
    inactivity_logout_minutes: 0,
    exam_clearance: DEFAULT_EXAM_CLEARANCE,
    admissions_email: '',
    admissions_phone: '',
    studentship_years_after_graduation: 2,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/api/security-settings')
      .then(({ data }) => setSettings({
        ...data,
        exam_clearance: { ...DEFAULT_EXAM_CLEARANCE, ...(data.exam_clearance || {}) },
        admissions_email: data.admissions_email || '',
        admissions_phone: data.admissions_phone || '',
        studentship_years_after_graduation: data.studentship_years_after_graduation || 2,
      }))
      .catch(() => message.error('Unable to load security settings.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/api/security-settings', settings);
      setSettings({
        ...data,
        exam_clearance: { ...DEFAULT_EXAM_CLEARANCE, ...(data.exam_clearance || {}) },
        admissions_email: data.admissions_email || '',
        admissions_phone: data.admissions_phone || '',
        studentship_years_after_graduation: data.studentship_years_after_graduation || 2,
      });
      message.success('Settings saved. Admissions contact is shown on the student login and signup pages.');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="text-slate-500">Loading…</div>;
  }
  if (!has('settings.manage')) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div className="text-slate-500">Loading settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Application settings"
        description="Staff security policies, student exam clearance, admissions contact, and studentship duration."
      />

      <form onSubmit={submit} className="space-y-6">
        <Card
          title="Admissions contact"
          description="This email and phone number appear on the student login and signup pages."
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                value={settings.admissions_email}
                onChange={(e) => setSettings((s) => ({ ...s, admissions_email: e.target.value }))}
                placeholder="admissions@bellsuniversity.edu.ng"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Phone
              <input
                type="tel"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                value={settings.admissions_phone}
                onChange={(e) => setSettings((s) => ({ ...s, admissions_phone: e.target.value }))}
                placeholder="+234 801 000 0000"
              />
            </label>
          </div>
        </Card>

        <Card
          title="Studentship after graduation"
          description="Graduates keep student-portal access until this many years after the registrar conferment date. After that they are marked alumni and cannot sign in."
        >
          <label className="block text-sm font-medium text-slate-700">
            Years of studentship after conferment
            <input
              type="number"
              min={1}
              max={10}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              value={settings.studentship_years_after_graduation}
              onChange={(e) => setSettings((s) => ({ ...s, studentship_years_after_graduation: Number(e.target.value) }))}
            />
          </label>
        </Card>

        <Card
          title="Two-factor authentication (2FA)"
          description="When enabled, every staff member must set up an authenticator app and enter a code at sign-in."
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-slate-800">Require 2FA for staff</div>
              <p className="text-sm text-slate-500 mt-0.5">Uses TOTP apps such as Google Authenticator or Microsoft Authenticator.</p>
            </div>
            <Switch
              checked={settings.two_factor_enabled}
              onChange={(checked) => setSettings((s) => ({ ...s, two_factor_enabled: checked }))}
            />
          </div>
        </Card>

        <Card
          title="Password change frequency"
          description="Staff must change their password after the selected period. Set to disabled to turn this off."
        >
          <label className="block text-sm font-medium text-slate-700">
            Rotation interval
            <select
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              value={settings.password_rotation_days}
              onChange={(e) => setSettings((s) => ({ ...s, password_rotation_days: Number(e.target.value) }))}
            >
              {PASSWORD_ROTATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </Card>

        <Card
          title="Inactivity logout"
          description="Staff are signed out automatically after this period without activity. Applies across all open tabs."
        >
          <label className="block text-sm font-medium text-slate-700">
            Idle timeout
            <select
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              value={settings.inactivity_logout_minutes}
              onChange={(e) => setSettings((s) => ({ ...s, inactivity_logout_minutes: Number(e.target.value) }))}
            >
              {INACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </Card>

        <Card
          title="Exam clearance"
          description="Choose which conditions a student must meet before they are cleared to sit exams. Only enabled checks are enforced."
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-800">Tuition paid</div>
                <p className="text-sm text-slate-500 mt-0.5">Require the selected percentage of billed tuition to be paid.</p>
              </div>
              <Switch
                checked={settings.exam_clearance.tuition_paid}
                onChange={(checked) => setSettings((s) => ({ ...s, exam_clearance: { ...s.exam_clearance, tuition_paid: checked } }))}
              />
            </div>
            {settings.exam_clearance.tuition_paid && (
              <label className="block text-sm font-medium text-slate-700">
                Minimum tuition paid (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  value={settings.exam_clearance.tuition_percent}
                  onChange={(e) => setSettings((s) => ({
                    ...s,
                    exam_clearance: { ...s.exam_clearance, tuition_percent: Number(e.target.value) },
                  }))}
                />
              </label>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-800">Course registration complete</div>
                <p className="text-sm text-slate-500 mt-0.5">Student must finish registration for the current semester.</p>
              </div>
              <Switch
                checked={settings.exam_clearance.courses_registered}
                onChange={(checked) => setSettings((s) => ({ ...s, exam_clearance: { ...s.exam_clearance, courses_registered: checked } }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-800">No outstanding invoices</div>
                <p className="text-sm text-slate-500 mt-0.5">All billed school charges (except application/acceptance fees) must be settled.</p>
              </div>
              <Switch
                checked={settings.exam_clearance.no_outstanding_invoices}
                onChange={(checked) => setSettings((s) => ({ ...s, exam_clearance: { ...s.exam_clearance, no_outstanding_invoices: checked } }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-800">Hostel fees if allocated</div>
                <p className="text-sm text-slate-500 mt-0.5">If the student has a hostel bed, hostel invoices must be paid.</p>
              </div>
              <Switch
                checked={settings.exam_clearance.hostel_if_allocated}
                onChange={(checked) => setSettings((s) => ({ ...s, exam_clearance: { ...s.exam_clearance, hostel_if_allocated: checked } }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-800">Clinic bills cleared</div>
                <p className="text-sm text-slate-500 mt-0.5">Unpaid clinic bills block exam clearance.</p>
              </div>
              <Switch
                checked={settings.exam_clearance.clinic_bills_cleared}
                onChange={(checked) => setSettings((s) => ({ ...s, exam_clearance: { ...s.exam_clearance, clinic_bills_cleared: checked } }))}
              />
            </div>
          </div>
        </Card>

        <Btn type="submit" disabled={saving}>
          {saving ? <Spinner label="Saving…" /> : 'Save settings'}
        </Btn>
      </form>
    </div>
  );
}
