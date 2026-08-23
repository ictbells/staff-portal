import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth';

const modes = ['utme', 'de', 'jupeb', 'transfer', 'pg'] as const;

export default function Apply() {
  const [mode, setMode] = useState<(typeof modes)[number]>('utme');
  const [app, setApp] = useState<any>(null);
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    api.get('/api/applications').then((r) => {
      const first = r.data.data?.[0] || r.data[0];
      if (first) setApp(first);
    });
  }, []);

  const start = async () => {
    setErr('');
    try {
      const { data } = await api.post('/api/applications', { entry_mode: mode });
      setApp(data);
      await refresh();
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Could not start application');
    }
  };

  const pay = async () => {
    const invoiceId = app.application_fee_invoice_id || app.application_fee_invoice?.id;
    const { data } = await api.post('/api/payments/paystack/initialize', { invoice_id: invoiceId });
    if (data.demo) {
      await api.get(`/api/payments/paystack/verify/${data.reference}`);
      await refresh();
      nav('/wizard');
    } else if (data.authorization_url) {
      window.location.href = data.authorization_url;
    }
  };

  return (
    <div className="max-w-xl bg-white border rounded-xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Start application</h1>
      <p className="text-sm text-slate-600">Choose UTME, DE, JUPEB, Transfer or PG. The application fee is paid online with Paystack (or at the cashier). It is never taken from a student wallet.</p>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <select className="border rounded-lg px-3 py-2 w-full" value={mode} onChange={(e) => setMode(e.target.value as any)}>
        {modes.map((m) => (
          <option key={m} value={m}>{m.toUpperCase()}</option>
        ))}
      </select>
      <button onClick={start} className="bg-sky-500 text-white px-4 py-2 rounded-lg">Create application</button>
      {app && (
        <div className="border rounded-lg p-4 space-y-2">
          <div>Stage: {app.stage}</div>
          {app.application_fee_invoice && <div>Fee: ₦{app.application_fee_invoice.amount} · {app.application_fee_invoice.status}</div>}
          {app.application_fee_invoice?.status !== 'paid' ? (
            <button onClick={pay} className="bg-green-700 text-white px-4 py-2 rounded-lg">Pay application fee (Paystack)</button>
          ) : (
            <button onClick={() => nav('/wizard')} className="bg-sky-500 text-white px-4 py-2 rounded-lg">Continue form</button>
          )}
        </div>
      )}
    </div>
  );
}
