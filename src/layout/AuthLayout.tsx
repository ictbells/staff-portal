import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, Phone } from 'lucide-react';
import api from '../api';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

type PortalInfo = {
  staff_support_label: string;
  staff_support_email: string;
  staff_support_phone: string;
};

const DEFAULT_SUPPORT: PortalInfo = {
  staff_support_label: 'ICT & Registry support',
  staff_support_email: '',
  staff_support_phone: '',
};

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  const [support, setSupport] = useState<PortalInfo | null>(null);

  useEffect(() => {
    api
      .get<PortalInfo>('/api/portal-info')
      .then(({ data }) => setSupport({
        staff_support_label: (data.staff_support_label || '').trim() || DEFAULT_SUPPORT.staff_support_label,
        staff_support_email: (data.staff_support_email || '').trim(),
        staff_support_phone: (data.staff_support_phone || '').trim(),
      }))
      .catch(() => setSupport(DEFAULT_SUPPORT));
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-sky-600 via-sky-700 to-sky-900 text-white p-10">
        <div>
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Bells crest"
            className="h-24 w-24 rounded-full bg-white p-1 shadow-lg"
          />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Bells University of Technology</h1>
          <p className="mt-3 text-sky-100 max-w-md leading-relaxed">
            Staff portal for admissions, academic records, finance, and campus operations.
          </p>
          <p className="mt-5 text-green-200 font-medium">Chords of Knowledge</p>
        </div>
        <StaffSupportCard support={support} />
      </div>
      <div className="flex items-center justify-center p-4 sm:p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-5 sm:mb-6">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Bells crest"
              className="h-16 w-16 mx-auto rounded-full bg-white shadow-md"
            />
            <p className="mt-3 text-sm font-medium text-slate-600">Staff portal</p>
            <StaffSupportCard support={support} compact />
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-5 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffSupportCard({ support, compact = false }: { support: PortalInfo | null; compact?: boolean }) {
  if (!support) return null;
  const email = support.staff_support_email;
  const phone = support.staff_support_phone;
  if (!email && !phone) return null;

  if (compact) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        {email && (
          <a href={`mailto:${email}`} className="font-medium text-sky-700 hover:underline">
            {email}
          </a>
        )}
        {email && phone ? <span className="mx-1.5 text-slate-300">·</span> : null}
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-sky-700">
            {phone}
          </a>
        )}
      </p>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-sm space-y-3 border border-white/10">
      <p className="font-semibold flex items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0" aria-hidden />
        {support.staff_support_label}
      </p>
      {email && (
        <p className="flex items-center gap-2 text-sky-100">
          <Mail className="h-4 w-4 shrink-0" aria-hidden />
          <a href={`mailto:${email}`} className="hover:text-white hover:underline">
            {email}
          </a>
        </p>
      )}
      {phone && (
        <p className="flex items-center gap-2 text-sky-100">
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-white hover:underline">
            {phone}
          </a>
        </p>
      )}
    </div>
  );
}

export function AuthLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`text-sky-600 font-medium hover:text-sky-700 hover:underline ${className}`}>
      {children}
    </Link>
  );
}
