import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  FolderOpen,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  History,
  Home,
  KeyRound,
  Megaphone,
  Network,
  Plug,
  School,
  ScrollText,
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
  COURSES_RESOURCES,
  RESULTS_RESOURCES,
  type AcademicResource,
} from '../pages/academic/constants';
import { ADMISSIONS_CHANNELS, CLEARANCE_CHANNELS } from '../pages/admissions/constants';
import { REGISTRATION_CHANNELS } from '../pages/registrations/constants';
import { TRANSCRIPT_CHANNELS } from '../pages/transcripts/constants';

export type NavItem = {
  key: string;
  to: string;
  label: string;
  /** Short destination context for dashboard cards (e.g. Applications vs Registrations). */
  hint?: string;
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
    return itemIsPermitted(item, hasPerm);
  }

  if (!(navLinkKeys ?? []).includes(item.key)) return false;

  return itemIsPermitted(item, hasPerm);
}

function itemIsPermitted(item: NavItem, hasPerm: (key: string) => boolean): boolean {
  if (item.permAny?.length) {
    return item.permAny.some((key) => hasPerm(key));
  }
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
      { key: 'approvals', to: '/approvals', label: 'Approvals', hint: 'Pending office requests', perm: null, icon: ClipboardCheck },
      { key: 'students', to: '/students', label: 'Students', hint: 'Student records', perm: 'students.view_any', icon: GraduationCap },
    ],
  },
  {
    title: 'Applications',
    items: [
      ...ADMISSIONS_CHANNELS.map((channel) => ({
        key: channel.navKey,
        to: channel.path,
        label: channel.label,
        hint: 'Applications',
        perm: 'admissions.view' as string | null,
        icon: channel.key === 'undergraduate' ? School : channel.key === 'jupeb' ? BookOpen : Award,
      })),
      {
        key: 'physical-clearance',
        label: 'Physical clearance',
        icon: ClipboardCheck,
        items: CLEARANCE_CHANNELS.map((channel) => ({
          key: channel.navKey,
          to: channel.path,
          label: channel.label,
          hint: 'Physical clearance',
          perm: 'admissions.clear' as string | null,
          icon: ClipboardCheck,
        })),
      },
      {
        key: 'admission-guide',
        to: '/applications/guide',
        label: 'Admission guide',
        hint: 'Publish the student portal guide',
        perm: 'admissions.guide' as string | null,
        icon: BookOpen,
      },
    ],
  },
  {
    title: 'Registrations',
    items: REGISTRATION_CHANNELS.map((channel) => ({
      key: channel.navKey,
      to: channel.path,
      label: channel.label,
      hint: 'Registrations',
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
        key: 'courses',
        label: 'Courses',
        icon: ClipboardList,
        items: COURSES_RESOURCES.map((r) => academicNavItem(r)),
      },
      {
        key: 'results',
        label: 'Results',
        icon: ClipboardCheck,
        items: RESULTS_RESOURCES.map((r) => academicNavItem(r, ClipboardCheck)),
      },
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
          { key: 'finance', to: '/finance/dashboard', label: 'Payment dashboard', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/categories', label: 'Fee categories', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance', label: 'Fee items', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/rebates', label: 'Rebates', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/programme-fees', label: 'Programme fees', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/generate', label: 'Generate invoice', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/invoices', label: 'Payments', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'finance', to: '/finance/student-status', label: 'Students Financial Status', perm: 'finance.invoices.manage', icon: Wallet },
          { key: 'import-invoices', to: '/finance/import-invoices', label: 'Import invoices', perm: 'finance.invoices.manage', permAny: ['finance.invoices.manage', 'finance.invoices.import'], icon: Wallet },
          { key: 'import-wallet', to: '/finance/import-wallet', label: 'Import wallet history', perm: 'finance.invoices.manage', permAny: ['finance.invoices.manage', 'finance.invoices.import'], icon: Wallet },
        ],
      },
      { key: 'medical', to: '/medical', label: 'Clinic', perm: 'medical.view_any', icon: Stethoscope },
      { key: 'hostel', to: '/hostel', label: 'Hostel', perm: 'hostel.view', icon: Building2 },
      { key: 'documents', to: '/documents', label: 'Documents', perm: 'documents.issue', icon: FileText },
      {
        key: 'transcript-requests',
        label: 'Transcript Requests',
        icon: ScrollText,
        items: TRANSCRIPT_CHANNELS.map((channel) => ({
          key: channel.navKey,
          to: channel.path,
          label: channel.label,
          hint: 'Transcript requests',
          perm: 'transcripts.view' as string | null,
          icon: ScrollText,
        })),
      },
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

export type QuickNavItem = NavItem & { hint: string };

/** Flatten nav with a destination hint so dashboard cards are not ambiguous. */
export function flattenNavForQuickAccess(): QuickNavItem[] {
  return navSections.flatMap((section) =>
    section.items.flatMap((entry) => {
      if (isNavGroup(entry)) {
        return entry.items.map((item) => ({
          ...item,
          hint: item.hint ?? entry.label,
        }));
      }
      return [{
        ...entry,
        hint: entry.hint ?? (section.title === 'Overview' ? 'Open' : section.title),
      }];
    }),
  );
}
