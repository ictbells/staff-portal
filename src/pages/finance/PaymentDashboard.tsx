import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, DatePicker, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  ArrowRight, BadgeCheck, Download, FileSpreadsheet, FileText, Landmark, Receipt, TrendingUp, Wallet,
} from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Card, DataTable, fieldLabelClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';

type DateRange = [Dayjs, Dayjs] | null;

type StatementLine = {
  category?: string;
  label: string;
  invoiced?: number;
  collected?: number;
  outstanding?: number;
  invoices?: number;
  method?: string;
  amount?: number;
  payments?: number;
  month?: string;
};

type RecentPayment = {
  id: number;
  receipt_no?: string | null;
  reference?: string | null;
  payer: string;
  matric?: string | null;
  category_label: string;
  method_label: string;
  amount: number;
  invoice_number?: string | null;
  created_at?: string | null;
};

type DashboardPayload = {
  institution: { name: string; motto?: string; address?: string };
  period: { from: string | null; to: string | null; label: string };
  generated_at: string;
  totals: {
    invoiced: number;
    collected: number;
    receipts: number;
    cash_received: number;
    wallet_inflows: number;
    wallet_applied: number;
    rebates: number;
    outstanding: number;
    wallet_liability: number;
  };
  today: { collected: number; receipts: number; payments: number };
  this_month: { collected: number; receipts: number; payments: number };
  invoice_counts: { issued: number; unpaid: number; partial: number; paid: number };
  payment_counts: { successful: number; pending: number; failed: number };
  by_category: StatementLine[];
  by_method: StatementLine[];
  monthly: StatementLine[];
  recent_payments: RecentPayment[];
};

const DATE_FORMAT = 'DD MMM YYYY';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function PaymentDashboard() {
  const yearRange: [Dayjs, Dayjs] = [dayjs().startOf('year'), dayjs()];
  const [range, setRange] = useState<DateRange>(yearRange);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const req = useRef(0);

  const params = () => ({
    from: range?.[0]?.format('YYYY-MM-DD'),
    to: range?.[1]?.format('YYYY-MM-DD'),
  });

  const load = () => {
    const id = ++req.current;
    setLoading(true);
    api.get('/api/finance/dashboard', { params: params() })
      .then((res) => {
        if (id !== req.current) return;
        setData(res.data);
      })
      .catch(() => {
        if (id !== req.current) return;
        setData(null);
        message.error('Could not load the payment dashboard.');
      })
      .finally(() => {
        if (id === req.current) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.[0]?.format('YYYY-MM-DD'), range?.[1]?.format('YYYY-MM-DD')]);

  const download = async (format: 'pdf' | 'excel' | 'word') => {
    setExporting(true);
    try {
      const { data: blob } = await api.get('/api/finance/dashboard/export', {
        params: { format, ...params() },
        responseType: 'blob',
      });
      const mime = format === 'pdf'
        ? 'application/pdf'
        : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx';
      const url = window.URL.createObjectURL(new Blob([blob], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `university-financial-statement-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Download started (${format === 'word' ? 'Word' : format.toUpperCase()}).`);
    } catch (err: any) {
      const body = err.response?.data;
      if (body instanceof Blob) {
        try {
          message.error(JSON.parse(await body.text()).message || 'Unable to download the statement.');
        } catch {
          message.error('Unable to download the statement.');
        }
      } else {
        message.error(err.response?.data?.message || 'Unable to download the statement.');
      }
    } finally {
      setExporting(false);
    }
  };

  const downloadMenu: MenuProps['items'] = [
    { key: 'pdf', icon: <FileText size={14} />, label: 'PDF', onClick: () => download('pdf') },
    { key: 'excel', icon: <FileSpreadsheet size={14} />, label: 'Excel (.xlsx)', onClick: () => download('excel') },
    { key: 'word', icon: <FileText size={14} />, label: 'MS Word (.docx)', onClick: () => download('word') },
  ];

  const totals = data?.totals;
  const monthlyMax = useMemo(
    () => Math.max(1, ...(data?.monthly || []).map((row) => Number(row.collected || 0))),
    [data?.monthly],
  );

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Payment dashboard"
        description={data
          ? `${data.institution.name} · ${data.period.label}. Fee collections exclude wallet top-ups.`
          : 'University receipts, invoices issued, receivables, and student wallet liability.'}
        icon={Landmark}
      >
        <Dropdown menu={{ items: downloadMenu }} trigger={['click']} disabled={exporting || loading || !data}>
          <Button icon={<Download size={16} />} loading={exporting}>Download statement</Button>
        </Dropdown>
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>

      <Card title="Reporting period" description="Defaults to this calendar year. Clear the dates for all recorded activity.">
        <label className="block max-w-md">
          <span className={fieldLabelClass}>Period</span>
          <DatePicker.RangePicker
            allowClear
            className="w-full"
            format={DATE_FORMAT}
            placeholder={['From', 'To']}
            value={range}
            disabledDate={(current) => !!current && current.isAfter(dayjs(), 'day')}
            presets={[
              { label: 'Today', value: [dayjs(), dayjs()] },
              { label: 'This month', value: [dayjs().startOf('month'), dayjs()] },
              { label: 'This year', value: yearRange },
              { label: 'Last 12 months', value: [dayjs().subtract(11, 'month').startOf('month'), dayjs()] },
            ]}
            onChange={(value) => setRange(value && value[0] && value[1] ? [value[0], value[1]] : null)}
          />
        </label>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Collected" value={formatNaira(totals?.collected)} hint={data?.period.label || 'Fee income'} icon={TrendingUp} tone="emerald" />
        <StatCard label="Invoiced" value={formatNaira(totals?.invoiced)} hint="Invoices issued in period" icon={Receipt} />
        <StatCard label="Outstanding" value={formatNaira(totals?.outstanding)} hint="Open invoice balances now" icon={Receipt} tone="rose" />
        <StatCard label="Wallet liability" value={formatNaira(totals?.wallet_liability)} hint="Student wallet balances now" icon={Wallet} />
        <StatCard label="Rebates" value={formatNaira(totals?.rebates)} hint="Granted in period" icon={BadgeCheck} tone="amber" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Today" value={formatNaira(data?.today.collected)} hint={`${data?.today.payments ?? 0} fee payments`} icon={TrendingUp} tone="emerald" />
        <StatCard label="This month" value={formatNaira(data?.this_month.collected)} hint={`${data?.this_month.payments ?? 0} fee payments`} icon={TrendingUp} />
        <StatCard label="Cash received" value={formatNaira(totals?.cash_received)} hint="Paystack, Wema, import, bank" icon={Landmark} />
        <StatCard label="Wallet top-ups" value={formatNaira(totals?.wallet_inflows)} hint="Not counted as fee income" icon={Wallet} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Statement of receipts" description="Money received in the selected period.">
          <StatementRows
            rows={[
              ['Fee collections', totals?.collected],
              ['Wallet top-ups', totals?.wallet_inflows],
              ['Cash received (Paystack / Wema / import / bank)', totals?.cash_received],
              ['Wallet applied to invoices', totals?.wallet_applied],
            ]}
            totalLabel="Total receipts"
            total={totals?.receipts}
          />
        </Card>
        <Card title="Financial position" description="Invoices in the period, balances as they stand now.">
          <StatementRows
            rows={[
              ['Invoices issued (period)', totals?.invoiced],
              ['Rebates granted (period)', totals?.rebates],
              ['Outstanding receivables (now)', totals?.outstanding],
            ]}
            totalLabel="Student wallet liability (now)"
            total={totals?.wallet_liability}
          />
          <p className="mt-3 text-xs text-slate-500">
            Open invoices: {data?.invoice_counts.unpaid ?? 0} unpaid, {data?.invoice_counts.partial ?? 0} partial, {data?.invoice_counts.paid ?? 0} paid.
            Payments in period: {data?.payment_counts.successful ?? 0} successful
            {(data?.payment_counts.pending || 0) > 0 ? `, ${data?.payment_counts.pending} pending` : ''}
            {(data?.payment_counts.failed || 0) > 0 ? `, ${data?.payment_counts.failed} failed` : ''}.
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Income by fee category" description="Invoiced and collected in the period. Outstanding is the current open balance for that category.">
          <DataTable empty={!data?.by_category.length} emptyMessage="No fee activity in this period." colSpan={4} loading={loading && !data}>
            <thead>
              <tr>
                <th className={thClass}>Category</th>
                <th className={`${thClass} text-right`}>Invoiced</th>
                <th className={`${thClass} text-right`}>Collected</th>
                <th className={`${thClass} text-right`}>Outstanding</th>
              </tr>
            </thead>
            {data?.by_category.length ? (
              <tbody>
                {data.by_category.map((row) => (
                  <tr key={row.category || row.label} className={trClass}>
                    <td className={tdClass}>{row.label}</td>
                    <td className={`${tdClass} text-right`}>{formatNaira(row.invoiced)}</td>
                    <td className={`${tdClass} text-right`}>{formatNaira(row.collected)}</td>
                    <td className={`${tdClass} text-right`}>{formatNaira(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            ) : null}
          </DataTable>
        </Card>
        <Card title="Receipts by method" description="Successful payments in the period, including wallet top-ups.">
          <DataTable empty={!data?.by_method.length} emptyMessage="No receipts in this period." colSpan={3} loading={loading && !data}>
            <thead>
              <tr>
                <th className={thClass}>Method</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>Payments</th>
              </tr>
            </thead>
            {data?.by_method.length ? (
              <tbody>
                {data.by_method.map((row) => (
                  <tr key={row.method || row.label} className={trClass}>
                    <td className={tdClass}>{row.label}</td>
                    <td className={`${tdClass} text-right`}>{formatNaira(row.amount)}</td>
                    <td className={`${tdClass} text-right`}>{row.payments ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            ) : null}
          </DataTable>
        </Card>
      </div>

      <Card title="Monthly collections" description="Fee income by month in the selected period.">
        {(data?.monthly || []).length ? (
          <div className="space-y-3">
            {data?.monthly.map((row) => {
              const pct = Math.round((Number(row.collected || 0) / monthlyMax) * 100);
              return (
                <div key={row.month}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">{row.label}</span>
                    <span className="text-slate-600">{formatNaira(row.collected)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.max(pct, row.collected ? 4 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No fee collections in this period.</p>
        )}
      </Card>

      <Card
        title="Recent payments"
        description="Latest successful receipts in the selected period."
        actions={(
          <Link to="/finance/invoices" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky-800">
            Open invoices <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      >
        <DataTable empty={!data?.recent_payments.length} emptyMessage="No payments in this period." colSpan={6} loading={loading && !data}>
            <thead>
              <tr>
                <th className={thClass}>Receipt</th>
                <th className={thClass}>Payer</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Method</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass}>When</th>
              </tr>
            </thead>
            {data?.recent_payments.length ? (
              <tbody>
                {data.recent_payments.map((row) => (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>{row.receipt_no || row.reference || row.invoice_number || '—'}</td>
                    <td className={tdClass}>
                      <div>{row.payer}</div>
                      {row.matric ? (
                        <Link to={`/finance/student-status?matric=${encodeURIComponent(row.matric)}`} className="text-xs text-sky-700 hover:underline">
                          {row.matric}
                        </Link>
                      ) : null}
                    </td>
                    <td className={tdClass}>{row.category_label}</td>
                    <td className={tdClass}>{row.method_label}</td>
                    <td className={`${tdClass} text-right`}>{formatNaira(row.amount)}</td>
                    <td className={tdClass}>{formatWhen(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            ) : null}
        </DataTable>
      </Card>
    </div>
  );
}

function StatementRows({
  rows,
  totalLabel,
  total,
}: {
  rows: Array<[string, number | undefined]>;
  totalLabel: string;
  total?: number;
}) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-2">
          <dt className="text-sm text-slate-600">{label}</dt>
          <dd className="text-sm font-medium text-slate-800">{formatNaira(value)}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 py-2">
        <dt className="text-sm font-semibold text-slate-800">{totalLabel}</dt>
        <dd className="text-sm font-semibold text-slate-900">{formatNaira(total)}</dd>
      </div>
    </dl>
  );
}
