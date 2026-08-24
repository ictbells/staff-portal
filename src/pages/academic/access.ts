import type { AcademicResource } from './constants';

const LEGACY_CATALOG_KEYS = new Set(['programmes', 'courses']);
const LEGACY_INSTITUTION_KEYS = new Set([
  'campuses',
  'colleges',
  'departments',
  'sessions',
  'levels',
  'intakes',
  'olevel',
]);

export function hasAcademicResourcePermission(
  resource: AcademicResource,
  has: (key: string) => boolean,
): boolean {
  if (has(resource.perm)) {
    return true;
  }
  if (LEGACY_CATALOG_KEYS.has(resource.key) && has('academic.catalog.manage')) {
    return true;
  }
  if (LEGACY_INSTITUTION_KEYS.has(resource.key) && has('institution.manage')) {
    return true;
  }
  if (resource.key === 'results-approvals' && (has('results.submit') || has('results.faculty_approve'))) {
    return true;
  }
  if (resource.key === 'import-students' && has('students.manage')) {
    return true;
  }

  return false;
}

export function canAccessAcademicResource(
  resource: AcademicResource,
  has: (key: string) => boolean,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
): boolean {
  if (!hasAcademicResourcePermission(resource, has)) {
    return false;
  }
  if (navUnrestricted) {
    return true;
  }

  return (navLinkKeys ?? []).includes(resource.key);
}

export function accessibleAcademicResources(
  resources: AcademicResource[],
  has: (key: string) => boolean,
  navUnrestricted?: boolean,
  navLinkKeys?: string[] | null,
): AcademicResource[] {
  return resources.filter((resource) =>
    canAccessAcademicResource(resource, has, navUnrestricted, navLinkKeys),
  );
}
