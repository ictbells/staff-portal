export const ENTRY_MODES = [
  { value: 'utme', label: 'UTME' },
  { value: 'de', label: 'Direct Entry' },
  { value: 'jupeb', label: 'JUPEB' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'pg', label: 'Postgraduate' },
];

export const STUDY_LEVELS = [
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
];

export type AcademicResource = {
  key: string;
  path: string;
  label: string;
  perm: string;
};

/** Campuses, colleges, departments, sessions, levels, courses */
export const ADMISSION_SETUP_RESOURCES: AcademicResource[] = [
  { key: 'campuses', path: '/academic/campuses', label: 'Campuses', perm: 'academic.campuses.manage' },
  { key: 'colleges', path: '/academic/colleges', label: 'Colleges', perm: 'academic.colleges.manage' },
  { key: 'departments', path: '/academic/departments', label: 'Departments', perm: 'academic.departments.manage' },
  { key: 'sessions', path: '/academic/sessions', label: 'Sessions', perm: 'academic.sessions.manage' },
  { key: 'levels', path: '/academic/levels', label: 'Levels', perm: 'academic.levels.manage' },
  { key: 'courses', path: '/academic/courses', label: 'Courses', perm: 'academic.courses.manage' },
];

/** Programmes, application windows, O'level */
export const APPLICATION_SETUP_RESOURCES: AcademicResource[] = [
  { key: 'programmes', path: '/academic/programmes', label: 'Programmes', perm: 'academic.programmes.manage' },
  { key: 'intakes', path: '/academic/intakes', label: 'Application windows', perm: 'academic.intakes.manage' },
  { key: 'candidate-data', path: '/academic/candidate-data', label: 'Candidate data', perm: 'admissions.import' },
  { key: 'olevel', path: '/academic/olevel', label: "O'level", perm: 'academic.olevel.manage' },
];

export const ACADEMIC_RESOURCES: AcademicResource[] = [
  ...ADMISSION_SETUP_RESOURCES,
  ...APPLICATION_SETUP_RESOURCES,
];

export function academicResourceByKey(key: string): AcademicResource | undefined {
  return ACADEMIC_RESOURCES.find((resource) => resource.key === key);
}
