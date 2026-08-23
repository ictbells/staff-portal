import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

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
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, description, children, className = '' }: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-sm sm:text-base">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
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
}: {
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  colSpan?: number;
  tableClassName?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className={`text-sm ${tableClassName}`}>
        {children}
        {empty && (
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
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    ghost: 'text-sky-600 hover:bg-sky-50',
    danger: 'text-red-600 hover:bg-red-50',
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
