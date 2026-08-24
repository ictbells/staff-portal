import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const STUDENT_PORTAL = (import.meta.env.VITE_STUDENT_URL || 'http://localhost:5174/student').replace(/\/$/, '');

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const isStaff = !!sessionStorage.getItem('bells_token');

  useEffect(() => {
    const query = window.location.search;
    if (!isStaff) {
      window.location.replace(`${STUDENT_PORTAL}/payments/callback${query}`);
      return;
    }

    const reference = params.get('reference') || params.get('trxref');
    if (!reference) {
      setError('Payment reference was not returned.');
      return;
    }

    api.get(`/api/payments/paystack/verify/${encodeURIComponent(reference)}`)
      .then((res) => {
        const purpose = res.data?.purpose || res.data?.invoice?.category;
        nav(purpose === 'wallet_topup' ? '/finance/invoices' : '/finance/invoices', { replace: true });
      })
      .catch((err: any) => {
        setError(err.response?.data?.message || 'Payment could not be confirmed.');
      });
  }, [isStaff, nav, params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-sky-50">
      <div className="bg-white border rounded-2xl p-8 max-w-md w-full text-center space-y-3">
        <h1 className="text-lg font-semibold text-slate-800">
          {error ? 'Payment confirmation failed' : 'Confirming payment'}
        </h1>
        <p className="text-sm text-slate-600">
          {error || (isStaff ? 'Please wait while we confirm this payment.' : 'Taking you back to the student portal…')}
        </p>
        {error && (
          <button
            type="button"
            onClick={() => nav(isStaff ? '/finance' : '/login', { replace: true })}
            className="inline-block bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
