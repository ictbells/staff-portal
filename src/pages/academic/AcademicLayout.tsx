import { useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../auth';
import { AccessDeniedPanel } from '../../components/AccessDeniedPanel';
import { PortalAccessNotice } from '../../components/PortalAccessNotice';
import { accessibleAcademicResources } from './access';
import {
  ADMISSION_SETUP_RESOURCES,
  APPLICATION_SETUP_RESOURCES,
  COURSES_RESOURCES,
  RESULTS_RESOURCES,
  ACADEMIC_RESOURCES,
  type AcademicResource,
} from './constants';

function SetupDropdown({
  label,
  links,
  pathname,
  open,
  onOpenChange,
}: {
  label: string;
  links: AcademicResource[];
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!links.length) return null;

  const active = links.some((link) => pathname.startsWith(link.path));
  const activeLabel = links.find((link) => pathname.startsWith(link.path))?.label;
  const selectedKey = links.find((l) => pathname.startsWith(l.path))?.key ?? '';

  const menuItems: MenuProps['items'] = links.map((link) => ({
    key: link.key,
    label: <Link to={link.path} onClick={() => onOpenChange(false)}>{link.label}</Link>,
  }));

  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      menu={{ items: menuItems, selectedKeys: active ? [selectedKey] : [] }}
      trigger={['click']}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
          active
            ? 'bg-sky-500 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {active && activeLabel ? `${label} · ${activeLabel}` : label}
        <ChevronDown className="h-4 w-4 opacity-80" aria-hidden />
      </button>
    </Dropdown>
  );
}

export default function AcademicLayout() {
  const { auth, has } = useAuth();
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const admissionLinks = useMemo(
    () => accessibleAcademicResources(
      ADMISSION_SETUP_RESOURCES,
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );
  const applicationLinks = useMemo(
    () => accessibleAcademicResources(
      APPLICATION_SETUP_RESOURCES,
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );
  const coursesLinks = useMemo(
    () => accessibleAcademicResources(
      COURSES_RESOURCES,
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );
  const resultsLinks = useMemo(
    () => accessibleAcademicResources(
      RESULTS_RESOURCES,
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );
  const allLinks = useMemo(
    () => [...admissionLinks, ...applicationLinks, ...coursesLinks, ...resultsLinks],
    [admissionLinks, applicationLinks, coursesLinks, resultsLinks],
  );

  if (!allLinks.length) {
    const hasAnyPermission = ACADEMIC_RESOURCES.some((resource) => {
      if (has(resource.perm)) return true;
      if (has('academic.catalog.manage') && ['programmes', 'courses'].includes(resource.key)) return true;
      if (has('institution.manage') && !['programmes', 'courses'].includes(resource.key)) return true;
      return false;
    });
    const hasPortalLinks = (auth?.nav_link_keys ?? []).some((key) =>
      ACADEMIC_RESOURCES.some((resource) => resource.key === key),
    );

    const reason = hasAnyPermission && !hasPortalLinks
      ? 'missing_portal_link'
      : !hasAnyPermission && hasPortalLinks
        ? 'missing_permission'
        : 'missing_both';

    return <AccessDeniedPanel reason={reason} resourceLabel="academic setup" />;
  }

  const onResourceRoot = location.pathname === '/academic' || location.pathname === '/academic/';
  if (onResourceRoot) {
    return <Navigate to={allLinks[0].path} replace />;
  }

  return (
    <div className="space-y-5">
      {!auth?.nav_unrestricted && <PortalAccessNotice />}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-2">
        <nav className="flex flex-wrap items-center gap-1" aria-label="Academic resources">
          <SetupDropdown
            label="Admission Setup"
            links={admissionLinks}
            pathname={location.pathname}
            open={openDropdown === 'admission-setup'}
            onOpenChange={(next) => setOpenDropdown(next ? 'admission-setup' : null)}
          />
          <SetupDropdown
            label="Application Setup"
            links={applicationLinks}
            pathname={location.pathname}
            open={openDropdown === 'application-setup'}
            onOpenChange={(next) => setOpenDropdown(next ? 'application-setup' : null)}
          />
          <SetupDropdown
            label="Courses"
            links={coursesLinks}
            pathname={location.pathname}
            open={openDropdown === 'courses'}
            onOpenChange={(next) => setOpenDropdown(next ? 'courses' : null)}
          />
          <SetupDropdown
            label="Results"
            links={resultsLinks}
            pathname={location.pathname}
            open={openDropdown === 'results'}
            onOpenChange={(next) => setOpenDropdown(next ? 'results' : null)}
          />
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
