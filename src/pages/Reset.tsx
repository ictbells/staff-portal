import { FormEvent, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
  const [loading, setLoading] = useState(false);
  const ok = useMemo(
    () => checks.every((c) => c.test(password)) && password === password_confirmation,
    [password, password_confirmation],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/reset-password', { email, token, password, password_confirmation });
      setMsg(data.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a strong password for your staff account.">
      <form onSubmit={submit} className="space-y-4">
        {msg && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{msg}</p>
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
            />
          </div>
        </label>
        <PasswordHints password={password} email={email} />
        <button
          type="submit"
          disabled={!ok || loading}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:hover:bg-sky-600 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? <Spinner label="Saving…" /> : 'Reset password'}
        </button>
      </form>
      <AuthLink to="/login" className="block mt-4">
        Back to sign in
      </AuthLink>
    </AuthLayout>
  );
}
