import { FormEvent, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { Btn, formStackClass, inputClass, Spinner } from './ui';
import { PasswordHints } from '../pages/Reset';

export default function PasswordChangeGate() {
  const { auth, setAuth } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!auth?.security?.password_change_required) {
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/api/me', {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setAuth(data);
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Password change required</h2>
            <p className="text-sm text-slate-500">
              Your organisation requires a password update
              {auth.security.password_rotation_days > 0
                ? ` every ${auth.security.password_rotation_days} days`
                : ''}
              . Choose a new password to continue.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className={formStackClass}>
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <input
            type="password"
            className={inputClass}
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <input
            type="password"
            className={inputClass}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            className={inputClass}
            placeholder="Confirm new password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            autoComplete="new-password"
            required
          />
          {password && <PasswordHints password={password} email={auth.user?.email} />}
          <Btn type="submit" className="w-full" disabled={saving}>
            {saving ? <Spinner label="Updating…" /> : 'Update password'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
