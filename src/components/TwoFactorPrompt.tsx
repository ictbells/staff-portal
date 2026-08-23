import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import api from '../api';
import { Btn, inputClass, Spinner } from '../components/ui';

type Props = {
  challengeId: string;
  setupRequired: boolean;
  onComplete: (data: any) => void;
  onCancel: () => void;
};

export default function TwoFactorPrompt({ challengeId, setupRequired, onComplete, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [loading, setLoading] = useState(setupRequired);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!setupRequired) return;
    setLoading(true);
    api
      .post('/api/two-factor/setup', { challenge_id: challengeId })
      .then(({ data }) => {
        setSecret(data.secret);
        setOtpauthUrl(data.otpauth_url);
      })
      .catch(() => setError('Unable to start two-factor setup. Try signing in again.'))
      .finally(() => setLoading(false));
  }, [challengeId, setupRequired]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const endpoint = setupRequired ? '/api/two-factor/confirm' : '/api/two-factor/verify';
      const { data } = await api.post(endpoint, { challenge_id: challengeId, code });
      onComplete(data);
    } catch (err: any) {
      setError(err.response?.data?.errors?.code?.[0] || err.response?.data?.message || 'Invalid code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">
              {setupRequired ? 'Set up two-factor authentication' : 'Two-factor verification'}
            </h2>
            <p className="text-sm text-slate-500">
              {setupRequired
                ? 'Scan the secret below with your authenticator app, then enter the 6-digit code.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>
          </div>
        </div>

        {setupRequired && !loading && secret && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
            <div>
              <span className="text-slate-500">Secret key: </span>
              <code className="font-mono text-slate-800 break-all">{secret}</code>
            </div>
            {otpauthUrl && (
              <a href={otpauthUrl} className="text-sky-600 hover:underline text-xs">
                Open in authenticator app
              </a>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500"><Spinner label="Preparing setup…" /></p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <label className="block text-sm font-medium text-slate-700">
              Verification code
              <input
                className={`${inputClass} mt-1 text-center tracking-[0.3em] font-mono`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
              />
            </label>
            <div className="flex gap-2">
              <Btn type="button" variant="secondary" className="flex-1" onClick={onCancel}>
                Back
              </Btn>
              <Btn type="submit" className="flex-1" disabled={submitting || code.length !== 6}>
                {submitting ? <Spinner label="Verifying…" /> : 'Continue'}
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
