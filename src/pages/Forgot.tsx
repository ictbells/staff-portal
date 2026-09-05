import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import api from '../api';
import AuthLayout, { AuthLink } from '../layout/AuthLayout';
import { Spinner } from '../components/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/forgot-password', { email: email.trim(), portal: 'staff' });
      setDone(data?.message || 'If that email exists, a reset link was sent.');
    } catch (err: any) {
      setError(
        err.response?.data?.message
        || err.response?.data?.errors?.email?.[0]
        || 'Could not send a reset link. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Enter your work email and we will send a reset link.">
      <form onSubmit={submit} className="space-y-4">
        {done && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2" role="status">
            {done}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          Work email
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="email"
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              placeholder="you@bellsuniversity.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading || Boolean(done)}
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={loading || Boolean(done) || !email.trim()}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? <Spinner label="Sending…" /> : done ? 'Link sent' : 'Send reset link'}
        </button>
      </form>
      <AuthLink to="/login" className="block mt-4">
        Back to sign in
      </AuthLink>
    </AuthLayout>
  );
}
