import { FormEvent, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import AuthLayout, { AuthLink } from '../layout/AuthLayout';
import { Spinner } from '../components/ui';

const checks = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
  { label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordHints({ password, email }: { password: string; email?: string }) {
  return (
    <ul className="text-xs space-y-1">
      {checks.map((c) => (
        <li key={c.label} className={c.test(password) ? 'text-green-700' : 'text-slate-500'}>
          {c.test(password) ? '✓' : '○'} {c.label}
        </li>
      ))}
      {email && (
        <li className={password && password !== email ? 'text-green-700' : 'text-slate-500'}>
          {password && password !== email ? '✓' : '○'} Not the same as email
        </li>
      )}
    </ul>
  );
}

export default function Reset() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [password_confirmation, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const ok = useMemo(
    () => checks.every((c) => c.test(password)) && password === password_confirmation,
    [password, password_confirmation],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/reset-password', { email, token, password, password_confirmation });
      const success = data?.message || 'Password has been reset. You may sign in.';
      setMsg(success);
      window.setTimeout(() => nav('/login?reset=1'), 1200);
    } catch (err: any) {
      setError(
        err.response?.data?.message
        || err.response?.data?.errors?.email?.[0]
        || err.response?.data?.errors?.password?.[0]
        || 'Could not reset password. Request a new link and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <AuthLayout title="Invalid link" subtitle="This reset link is missing required details.">
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          Request a new password reset link.
        </p>
        <AuthLink to="/forgot-password" className="block mt-4">
          Forgot password
        </AuthLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password for your staff account.">
      <form onSubmit={submit} className="space-y-4">
        {msg && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2" role="status">
            {msg} Redirecting to sign in…
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          New password
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading || Boolean(msg)}
            />
          </div>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Confirm password
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              placeholder="Confirm password"
              value={password_confirmation}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={loading || Boolean(msg)}
            />
          </div>
        </label>
        <PasswordHints password={password} email={email} />
        <button
          type="submit"
          disabled={!ok || loading || Boolean(msg)}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:hover:bg-sky-600 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? <Spinner label="Saving…" /> : msg ? 'Password saved' : 'Reset password'}
        </button>
      </form>
      <AuthLink to="/login" className="block mt-4">
        Back to sign in
      </AuthLink>
    </AuthLayout>
  );
}
