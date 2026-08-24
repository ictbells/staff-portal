import { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {children ? (
        <div className="flex flex-row flex-nowrap items-center gap-2 shrink-0">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  icon: Icon = Inbox,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="relative bg-gradient-to-br from-sky-600 via-sky-700 to-sky-800 px-5 py-6 sm:px-7 sm:py-7 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(186,230,253,0.22),transparent_46%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sky-50 ring-4 ring-white/10">
              <Icon className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-sky-100/90 text-xs font-semibold uppercase tracking-wider">{eyebrow}</p>
              )}
              <h1 className={`${eyebrow ? 'mt-1' : ''} text-2xl font-semibold tracking-tight`}>{title}</h1>
              {description && (
                <p className="mt-1.5 text-sm text-slate-200 max-w-2xl">{description}</p>
              )}
            </div>
          </div>
          {children ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon = Inbox,
  tone = 'sky',
  active = false,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'sky' | 'amber' | 'emerald' | 'rose';
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-800',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  const className = `rounded-xl border bg-white p-4 shadow-sm text-left transition ${
    active ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'
  } ${onClick ? 'cursor-pointer hover:border-sky-300' : ''}`;
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-1.5 text-2xl font-semibold text-slate-800">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </div>
      <div className={`rounded-lg p-2 ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full ${className}`}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

export function Card({ title, description, children, className = '', actions }: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800 text-sm sm:text-base">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
        {actions ? (
          <div className="flex flex-row flex-nowrap items-center gap-2 shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function DataTable({
  children,
  empty,
  emptyMessage = 'No records found.',
  colSpan = 1,
  tableClassName = 'min-w-full',
  loading = false,
  loadingLabel = 'Loading…',
}: {
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  colSpan?: number;
  tableClassName?: string;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <div className={`relative overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm ${loading ? 'min-h-[8rem]' : ''}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75">
          <Spinner label={loadingLabel} className="text-sky-700" />
        </div>
      )}
      <table className={`text-sm ${tableClassName}`}>
        {children}
        {empty && !loading && (
          <tbody>
            <tr>
              <td colSpan={colSpan} className="px-4 py-12 text-center text-slate-500">
                <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300" aria-hidden />
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

export function TablePager({
  page,
  lastPage,
  total,
  from,
  to,
  onChange,
  disabled,
}: {
  page: number;
  lastPage: number;
  total: number;
  from?: number | null;
  to?: number | null;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (!total && lastPage <= 1) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>{total ? `${from ?? 0}–${to ?? 0} of ${total}` : 'No records'}</span>
      {lastPage > 1 && (
        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
            Previous
          </Btn>
          <span>Page {page} of {lastPage}</span>
          <Btn variant="secondary" size="sm" disabled={disabled || page >= lastPage} onClick={() => onChange(page + 1)}>
            Next
          </Btn>
        </div>
      )}
    </div>
  );
}

export const thClass =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200';
export const tdClass = 'px-4 py-3 text-slate-700 align-middle';
export const trClass = 'border-t border-slate-100 hover:bg-slate-50/80 transition-colors';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  purple: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
};

export function Badge({ variant = 'default', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}

export function stageBadge(stage: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    submitted: 'default',
    screening: 'info',
    verification: 'info',
    shortlisting: 'purple',
    recommended: 'warning',
    approved: 'success',
    offer_issued: 'success',
    rejected: 'danger',
    paid: 'success',
    pending: 'warning',
    partial: 'warning',
    overdue: 'danger',
  };
  return map[stage] || 'default';
}

export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  const sizes = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const variants = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    secondary: 'bg-slate-600 hover:bg-slate-700 text-white !text-white',
    ghost: 'bg-sky-600 hover:bg-sky-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 ${sizes} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500';

/** Vertical spacing between stacked form fields */
export const formStackClass = 'space-y-5';

export const fieldLabelClass = 'block text-sm font-medium text-slate-700 mb-1.5';

export const fieldHelpClass = 'text-xs text-slate-500 mt-1.5';

export function Spinner({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center gap-2 ${className}`}>
      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
      {label}
    </span>
  );
}
