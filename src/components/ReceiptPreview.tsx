import { useEffect } from 'react';
import api from '../api';

type ReceiptTarget = {
  invoiceId?: number;
  paymentId?: number;
  receiptNo?: string | number;
};

export async function fetchReceiptHtml(target: ReceiptTarget): Promise<{ html: string; title: string }> {
  const title = `Receipt ${target.receiptNo || target.invoiceId || target.paymentId || ''}`.trim();
  if (target.paymentId) {
    const { data } = await api.get(`/api/payments/${target.paymentId}/receipt`, { responseType: 'text' });
    return { html: data, title };
  }
  if (target.invoiceId) {
    const { data } = await api.get(`/api/invoices/${target.invoiceId}/receipt`, { responseType: 'text' });
    return { html: data, title };
  }
  throw new Error('Missing receipt target.');
}

export function ReceiptPreview({
  html,
  title,
  loading,
  onClose,
}: {
  html: string | null;
  title: string;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!html && !loading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [html, loading, onClose]);

  if (!loading && !html) return null;

  const print = () => {
    const frame = document.getElementById('staff-receipt-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const download = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'receipt'}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-[1px]"
      onClick={() => !loading && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sky-900/20 px-4 py-3 bg-[#0c4a6e] text-white">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-200">Official bursary receipt</p>
            <h3 className="font-semibold truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {html && (
              <>
                <button type="button" onClick={print} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
                  Print
                </button>
                <button type="button" onClick={download} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
                  Download
                </button>
              </>
            )}
            <button type="button" onClick={onClose} disabled={loading} className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-[60vh] bg-slate-100">
          {loading || !html ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading receipt…</div>
          ) : (
            <iframe id="staff-receipt-frame" title={title} srcDoc={html} className="w-full h-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}

export function receiptErrorMessage(err: unknown, fallback = 'Could not open receipt.') {
  const data = (err as { response?: { data?: Blob | { message?: string } } })?.response?.data;
  if (data instanceof Blob) return fallback;
  return (data && typeof data === 'object' && 'message' in data && data.message) || fallback;
}