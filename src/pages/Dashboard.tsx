import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, GraduationCap, Home, Receipt, TrendingUp, Wallet } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { PortalAccessNotice } from '../components/PortalAccessNotice';
import { StatCard, WorkspaceHero } from '../components/ui';
import { canShowNavItem, flattenNavForQuickAccess, type QuickNavItem } from '../layout/navConfig';
import { formatNaira } from '../lib/money';

export default function Dashboard() {
  const { auth, has } = useAuth();
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const reportsItem: QuickNavItem = { key: 'reports', to: '/reports', label: 'Reports', hint: 'System', perm: 'reports.view', icon: Home };
    if (canShowNavItem(reportsItem, has, auth?.nav_unrestricted, auth?.nav_link_keys)) {
      api.get('/api/reports/summary').then((r) => setSummary(r.data)).catch(() => {});
    }
  }, [auth?.nav_link_keys, auth?.nav_unrestricted, has]);

  const quickLinks: QuickNavItem[] = flattenNavForQuickAccess()
    .filter((item) => item.to !== '/' && canShowNavItem(item, has, auth?.nav_unrestricted, auth?.nav_link_keys))
    .slice(0, 8);

  const firstName = auth?.user?.name?.split(/\s+/)[0] || 'there';

  const welcomeDescription = (() => {
    if (auth?.nav_unrestricted) {
      return 'Manage applications, student records, finance, and campus services from one place.';
    }
    if (quickLinks.length > 0) {
      const labels = quickLinks.map((item) => (
        item.hint && item.hint !== 'Open' ? `${item.label} (${item.hint})` : item.label
      ));
      if (labels.length === 1) {
        return `You have access to ${labels[0]}. Use the sidebar or quick access below to get started.`;
      }
      return `You have access to ${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}. Use the sidebar or quick access below to get started.`;
    }
    return 'No portal links have been assigned to your office yet. Contact an administrator to configure your access.';
  })();

  const hero = (
    <WorkspaceHero
      eyebrow="Staff portal"
      title={`Welcome back, ${firstName}`}
      description={welcomeDescription}
      icon={Home}
    />
  );

  if (!auth?.nav_unrestricted && quickLinks.length === 0) {
    return <div className="space-y-6">{hero}</div>;
  }

  return (
    <div className="space-y-6">
      {!auth?.nav_unrestricted && quickLinks.length > 0 && <PortalAccessNotice />}
      {hero}

      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Students" value={summary.students ?? '—'} icon={GraduationCap} />
          <StatCard label="Collected" value={formatNaira(summary.payments_collected)} icon={TrendingUp} tone="emerald" />
          <StatCard label="Outstanding" value={formatNaira(summary.invoices_outstanding)} icon={Receipt} tone="amber" />
          <StatCard label="Wallet total" value={formatNaira(summary.wallet_total)} icon={Wallet} />
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
                  aria-label={`${item.label}, ${item.hint}`}
                  className="group flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-300 hover:shadow-md transition-all"
                >
                  <div className="rounded-lg bg-sky-50 p-2 text-sky-600 group-hover:bg-sky-100 transition-colors">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{item.label}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      {item.hint}
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
