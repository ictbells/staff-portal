import { ADMISSIONS_CHANNELS } from '../pages/admissions/constants';
import { REGISTRATION_CHANNELS } from '../pages/registrations/constants';
import {
  ACADEMIC_RESOURCES,
  type AcademicResource,
} from '../pages/academic/constants';
import { hasAcademicResourcePermission } from '../pages/academic/access';
import {
  flattenNavEntries,
  navSections,
  type NavItem,
} from '../layout/navConfig';

export type AccessLevel = 'full' | 'limited' | 'none';

export type AccessReason =
  | 'ok'
  | 'missing_permission'
  | 'missing_portal_link'
  | 'missing_both';

export type PortalAccessState = {
  level: AccessLevel;
  canAccess: boolean;
  reason: AccessReason;
};

function hasNavPermission(
  perm: string | null,
  permAny: string[] | undefined,
  has: (key: string) => boolean,
): boolean {
  if (permAny?.length) {
    return permAny.some((key) => has(key));
  }
  if (perm) {
    return has(perm);
  }
  return true;
}

function hasPortalLink(
  navKey: string,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
): boolean {
  if (navUnrestricted) {
    return true;
  }

  return (navLinkKeys ?? []).includes(navKey);
}

export function buildPortalAccessState(
  hasPermission: boolean,
  inPortalLinks: boolean,
  navUnrestricted?: boolean,
): PortalAccessState {
  if (hasPermission && inPortalLinks) {
    return {
      canAccess: true,
      level: navUnrestricted ? 'full' : 'limited',
      reason: 'ok',
    };
  }

  let reason: AccessReason = 'missing_both';
  if (hasPermission && !inPortalLinks) {
    reason = 'missing_portal_link';
  } else if (!hasPermission && inPortalLinks) {
    reason = 'missing_permission';
  }

  return {
    canAccess: false,
    level: 'none',
    reason,
  };
}

export function getNavItemAccess(
  item: Pick<NavItem, 'key' | 'perm' | 'permAny'>,
  has: (key: string) => boolean,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
): PortalAccessState {
  const resource = ACADEMIC_RESOURCES.find((entry) => entry.key === item.key);
  if (resource) {
    return getAcademicResourceAccess(resource, has, navUnrestricted, navLinkKeys);
  }

  return buildPortalAccessState(
    hasNavPermission(item.perm, item.permAny, has),
    hasPortalLink(item.key, navUnrestricted, navLinkKeys),
    navUnrestricted,
  );
}

export function getAcademicResourceAccess(
  resource: AcademicResource,
  has: (key: string) => boolean,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
): PortalAccessState {
  return buildPortalAccessState(
    hasAcademicResourcePermission(resource, has),
    hasPortalLink(resource.key, navUnrestricted, navLinkKeys),
    navUnrestricted,
  );
}

export function accessDeniedTitle(reason: AccessReason, resourceLabel?: string): string {
  const label = resourceLabel ? ` to ${resourceLabel}` : '';
  switch (reason) {
    case 'missing_permission':
      return `You do not have permission${label}`;
    case 'missing_portal_link':
      return `This module is not enabled for your office${label}`;
    default:
      return `You do not have access${label}`;
  }
}

export function accessDeniedDescription(reason: AccessReason): string {
  switch (reason) {
    case 'missing_permission':
      return 'Your role does not include the required permission. Ask an administrator to update your role permissions.';
    case 'missing_portal_link':
      return 'Your office portal link does not include this module. Ask an administrator to add it under Office setup → Portal links.';
    default:
      return 'You need both the correct role permission and an office portal link for this module. Ask an administrator to review your access.';
  }
}

export function limitedAccessDescription(): string {
  return 'Limited access — your office portal link controls which modules you can open. Contact an administrator if you need additional access.';
}

export function findNavItemForPath(pathname: string): NavItem | null {
  if (pathname === '/' || pathname === '/profile') {
    return null;
  }

  const admissionsChannel = ADMISSIONS_CHANNELS.find((channel) => pathname.startsWith(channel.path));
  if (admissionsChannel) {
    return {
      key: admissionsChannel.navKey,
      to: admissionsChannel.path,
      label: admissionsChannel.label,
      perm: 'admissions.view',
      icon: navSections[0].items[0].icon,
    };
  }

  const registrationChannel = REGISTRATION_CHANNELS.find((channel) => pathname.startsWith(channel.path));
  if (registrationChannel) {
    return {
      key: registrationChannel.navKey,
      to: registrationChannel.path,
      label: registrationChannel.label,
      perm: 'registrations.view',
      icon: navSections[0].items[0].icon,
    };
  }

  const academicResource = ACADEMIC_RESOURCES.find((resource) => pathname.startsWith(resource.path));
  if (academicResource) {
    return {
      key: academicResource.key,
      to: academicResource.path,
      label: academicResource.label,
      perm: academicResource.perm,
      icon: navSections[0].items[0].icon,
    };
  }

  if (pathname.startsWith('/academic')) {
    return null;
  }

  const items = flattenNavEntries(navSections.flatMap((section) => section.items));
  const matches = items
    .filter((item) => item.to !== '/' && pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length);

  return matches[0] ?? null;
}
