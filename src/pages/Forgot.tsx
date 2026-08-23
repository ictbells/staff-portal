import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import api from '../api';
import AuthLayout, { AuthLink } from '../layout/AuthLayout';
import { Spinner } from '../components/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/forgot-password', { email });
      setDone(data.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Enter your work email and we will send a reset link.">
      <form onSubmit={submit} className="space-y-4">
        {done && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{done}</p>
        )}
        <label className="block text-sm font-medium text-slate-700">
          Work email
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              placeholder="you@bellsuniversity.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? <Spinner label="Sending…" /> : 'Send reset link'}
        </button>
      </form>
      <AuthLink to="/login" className="block mt-4">
        Back to sign in
      </AuthLink>
    </AuthLayout>
  );
}
