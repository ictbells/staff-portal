import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Switch, message } from 'antd';
import api from '../api';
import { useAuth } from '../auth';
import { Btn, Card, PageHeader, Spinner } from '../components/ui';

type SecuritySettings = {
  two_factor_enabled: boolean;
  password_rotation_days: number;
  inactivity_logout_minutes: number;
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/api/security-settings')
      .then(({ data }) => setSettings(data))
      .catch(() => message.error('Unable to load security settings.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/api/security-settings', settings);
      setSettings(data);
      message.success('Security settings saved. Changes apply to all staff immediately.');
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
        description="Global security policies for all staff accounts. Students and applicants are not affected."
      />

      <form onSubmit={submit} className="space-y-6">
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

        <Btn type="submit" disabled={saving}>
          {saving ? <Spinner label="Saving…" /> : 'Save settings'}
        </Btn>
      </form>
    </div>
  );
}
