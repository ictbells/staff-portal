import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, GraduationCap, Receipt, TrendingUp, Wallet } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { PortalAccessNotice } from '../components/PortalAccessNotice';
import { navSections, canShowNavItem, flattenNavEntries, type NavItem } from '../layout/navConfig';

const statIcons: Record<string, LucideIcon> = {
  Students: GraduationCap,
  Collected: TrendingUp,
  Outstanding: Receipt,
  'Wallet total': Wallet,
};

export default function Dashboard() {
  const { auth, has } = useAuth();
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (has('reports.view')) api.get('/api/reports/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, [has]);

  const quickLinks: NavItem[] = navSections
    .flatMap((s) => flattenNavEntries(s.items))
    .filter((item) => item.to !== '/' && canShowNavItem(item, has, auth?.nav_unrestricted, auth?.nav_link_keys))
    .slice(0, 8);

  const firstName = auth?.user?.name?.split(/\s+/)[0] || 'there';

  const welcomeDescription = (() => {
    if (auth?.nav_unrestricted) {
      return 'Manage applications, student records, finance, and campus services from one place.';
    }
    if (quickLinks.length > 0) {
      const labels = quickLinks.map((item) => item.label);
      if (labels.length === 1) {
        return `You have access to ${labels[0]}. Use the sidebar or quick access below to get started.`;
      }
      return `You have access to ${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}. Use the sidebar or quick access below to get started.`;
    }
    return 'No portal links have been assigned to your office yet. Contact an administrator to configure your access.';
  })();

  if (!auth?.nav_unrestricted && quickLinks.length === 0) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 text-white p-5 sm:p-6 md:p-8 shadow-sm">
          <p className="text-sky-100 text-sm font-medium">Staff portal</p>
          <h1 className="mt-1 text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="mt-2 text-sky-100 max-w-2xl text-sm md:text-base">{welcomeDescription}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!auth?.nav_unrestricted && quickLinks.length > 0 && <PortalAccessNotice />}
      <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-700 text-white p-5 sm:p-6 md:p-8 shadow-sm">
        <p className="text-sky-100 text-sm font-medium">Staff portal</p>
        <h1 className="mt-1 text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-2 text-sky-100 max-w-2xl text-sm md:text-base">
          {welcomeDescription}
        </p>
      </section>

      {summary && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            ['Students', summary.students],
            ['Collected', summary.payments_collected],
            ['Outstanding', summary.invoices_outstanding],
            ['Wallet total', summary.wallet_total],
          ].map(([label, value]) => {
            const Icon = statIcons[String(label)] || TrendingUp;
            return (
              <div key={String(label)} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-800">{value}</div>
                  </div>
                  <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quickLinks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Quick access</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-300 hover:shadow-md transition-all"
                >
                  <div className="rounded-lg bg-sky-50 p-2 text-sky-600 group-hover:bg-sky-100 transition-colors">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{item.label}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      Open
                      <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" aria-hidden />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
