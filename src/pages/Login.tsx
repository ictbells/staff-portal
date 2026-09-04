import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import AuthLayout from '../layout/AuthLayout';
import TwoFactorPrompt from '../components/TwoFactorPrompt';
import { Spinner } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactor, setTwoFactor] = useState<{ challengeId: string; setupRequired: boolean } | null>(null);
  const { setAuth } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const timeoutNotice = searchParams.get('timeout') === '1';
  const expiredNotice = searchParams.get('expired') === '1';

  const finishLogin = (data: any) => {
    if (data.token) sessionStorage.setItem('bells_token', data.token);
    setAuth(data);
    nav('/');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/login', { email, password, portal: 'staff' });
      if (data.two_factor_required) {
        setTwoFactor({ challengeId: data.challenge_id, setupRequired: data.two_factor_setup_required });
        return;
      }
      finishLogin(data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {twoFactor && (
        <TwoFactorPrompt
          challengeId={twoFactor.challengeId}
          setupRequired={twoFactor.setupRequired}
          onComplete={finishLogin}
          onCancel={() => setTwoFactor(null)}
        />
      )}
      <AuthLayout title="Staff sign in" subtitle="Use your work email and password to access the portal.">
        <form onSubmit={submit} className="space-y-4">
          {timeoutNotice && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              You were signed out due to inactivity.
            </p>
          )}
          {expiredNotice && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Your session ended after 8 hours. Please sign in again.
            </p>
          )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          Email
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type={showPass ? 'text' : 'password'}
              className="w-full border border-slate-200 rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? <Spinner label="Signing in…" className="text-white" /> : <span className="text-white">Sign in</span>}
        </button>
        <Link to="/forgot-password" className="block text-center text-sm text-sky-600 hover:text-sky-700 hover:underline">
          Forgot password?
        </Link>
      </form>
    </AuthLayout>
    </>
  );
}
