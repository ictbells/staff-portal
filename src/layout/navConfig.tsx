import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  FolderOpen,
  ClipboardList,
  GraduationCap,
  History,
  Home,
  KeyRound,
  Megaphone,
  Network,
  Plug,
  School,
  Settings2,
  Shield,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react';
import { canAccessAcademicResource } from '../pages/academic/access';
import {
  ACADEMIC_RESOURCES,
  ADMISSION_SETUP_RESOURCES,
  APPLICATION_SETUP_RESOURCES,
  ENROLMENT_RESOURCES,
  type AcademicResource,
} from '../pages/academic/constants';
import { ADMISSIONS_CHANNELS } from '../pages/admissions/constants';
import { REGISTRATION_CHANNELS } from '../pages/registrations/constants';

export type NavItem = {
  key: string;
  to: string;
  label: string;
  perm: string | null;
  permAny?: string[];
  icon: LucideIcon;
};

export type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

export type NavSection = {
  title: string;
  items: NavEntry[];
};

function academicNavItem(resource: AcademicResource, icon: LucideIcon = BookOpen): NavItem {
  return {
    key: resource.key,
    to: resource.path,
    label: resource.label,
    perm: resource.perm,
    icon,
  };
}

export function canShowNavItem(
  item: NavItem,
  hasPerm: (key: string) => boolean,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
) {
  const resource = ACADEMIC_RESOURCES.find((r) => r.key === item.key);
  if (resource) {
    return canAccessAcademicResource(resource, hasPerm, navUnrestricted, navLinkKeys);
  }

  if (navUnrestricted) {
    if (item.perm && !hasPerm(item.perm)) {
      return false;
    }
    return true;
  }

  if (!(navLinkKeys ?? []).includes(item.key)) return false;

  if (item.perm) {
    return hasPerm(item.perm);
  }
  return true;
}

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { key: 'home', to: '/', label: 'Home', perm: null, icon: Home },
      { key: 'students', to: '/students', label: 'Students', perm: 'students.view_any', icon: GraduationCap },
    ],
  },
  {
    title: 'Applications',
    items: ADMISSIONS_CHANNELS.map((channel) => ({
      key: channel.navKey,
      to: channel.path,
      label: channel.label,
      perm: 'admissions.view' as string | null,
      icon: channel.key === 'undergraduate' ? School : channel.key === 'jupeb' ? BookOpen : Award,
    })),
  },
  {
    title: 'Registrations',
    items: REGISTRATION_CHANNELS.map((channel) => ({
      key: channel.navKey,
      to: channel.path,
      label: channel.label,
      perm: 'registrations.view' as string | null,
      icon: channel.key === 'undergraduate' ? GraduationCap : channel.key === 'jupeb' ? BookOpen : ClipboardList,
    })),
  },
  {
    title: 'Academic',
    items: [
      {
        key: 'admission-setup',
        label: 'Admission Setup',
        icon: School,
        items: ADMISSION_SETUP_RESOURCES.map((r) => academicNavItem(r)),
      },
      {
        key: 'application-setup',
        label: 'Application Setup',
        icon: Settings2,
        items: APPLICATION_SETUP_RESOURCES.map((r) => academicNavItem(r)),
      },
      {
        key: 'enrolment',
        label: 'Enrolment',
        icon: ClipboardList,
        items: ENROLMENT_RESOURCES.map((r) => academicNavItem(r)),
      },
      { key: 'pg', to: '/pg', label: 'PG research', perm: 'pg.view', icon: Award },
      { key: 'exam-clearance', to: '/exam-clearance', label: 'Exam clearance', perm: 'exam_clearance.view', icon: ClipboardList },
    ],
  },
  {
    title: 'Services',
    items: [
      {
        key: 'finance',
        label: 'Fees & payments',
        icon: Wallet,
        items: [
          { key: 'finance', to: '/finance', label: 'Fee catalog', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/sundry', label: 'Sundry fees', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/rebates', label: 'Rebates', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/programme-fees', label: 'Programme fees', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/generate', label: 'Generate invoice', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/invoices', label: 'Invoices', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/student-status', label: 'Students Financial Status', perm: 'finance.invoices.manage', icon: Wallet },
        ],
      },
      { key: 'medical', to: '/medical', label: 'Clinic', perm: 'medical.view_any', icon: Stethoscope },
      { key: 'hostel', to: '/hostel', label: 'Hostel', perm: 'hostel.view', icon: Building2 },
      { key: 'documents', to: '/documents', label: 'Documents', perm: 'documents.issue', icon: FileText },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        key: 'administration',
        label: 'Administration',
        icon: Users,
        items: [
          { key: 'users', to: '/users', label: 'Users', perm: 'users.manage', icon: Users },
          { key: 'roles', to: '/roles', label: 'Roles', perm: 'roles.manage', icon: Shield },
          { key: 'permissions', to: '/permissions', label: 'Permissions', perm: 'roles.manage', icon: KeyRound },
          { key: 'office-setup', to: '/office-setup', label: 'Department Setup', perm: 'institution.manage', icon: Network },
        ],
      },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'audit', to: '/audit', label: 'Audit', perm: 'audit.view', icon: History },
      { key: 'reports', to: '/reports', label: 'Reports', perm: 'reports.view', icon: BarChart3 },
      { key: 'announcements', to: '/announcements', label: 'Announcements', perm: null, icon: Megaphone },
      { key: 'integrations', to: '/integrations', label: 'Integrations', perm: 'integrations.view', icon: Plug },
      { key: 'application-settings', to: '/application-settings', label: 'Application settings', perm: 'settings.manage', icon: Settings2 },
      { key: 'resources', to: '/resources', label: 'Resources', perm: 'resources.view', icon: FolderOpen },
    ],
  },
];

export function canShowNavGroup(
  group: NavGroup,
  hasPerm: (key: string) => boolean,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
) {
  return group.items.some((item) => canShowNavItem(item, hasPerm, navUnrestricted, navLinkKeys));
}

export function flattenNavEntries(entries: NavEntry[]): NavItem[] {
  return entries.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]));
}
