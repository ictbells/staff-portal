import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, Phone } from 'lucide-react';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
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
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-sm space-y-3 border border-white/10">
          <p className="font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
            ICT &amp; Registry support
          </p>
          <p className="flex items-center gap-2 text-sky-100">
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            ict@bellsuniversity.edu.ng
          </p>
          <p className="flex items-center gap-2 text-sky-100">
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            +234 801 000 0000
          </p>
        </div>
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

export function AuthLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`text-sky-600 font-medium hover:text-sky-700 hover:underline ${className}`}>
      {children}
    </Link>
  );
}
