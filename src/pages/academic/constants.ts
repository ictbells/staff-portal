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

/** Campuses, colleges, departments, academic sessions, levels, graduation, import students */
export const ADMISSION_SETUP_RESOURCES: AcademicResource[] = [
  { key: 'campuses', path: '/academic/campuses', label: 'Campuses', perm: 'academic.campuses.manage' },
  { key: 'colleges', path: '/academic/colleges', label: 'Colleges', perm: 'academic.colleges.manage' },
  { key: 'departments', path: '/academic/departments', label: 'Departments', perm: 'academic.departments.manage' },
  { key: 'sessions', path: '/academic/sessions', label: 'Academic Sessions', perm: 'academic.sessions.manage' },
  { key: 'levels', path: '/academic/levels', label: 'Levels', perm: 'academic.levels.manage' },
  { key: 'graduation', path: '/academic/graduation', label: 'Graduation', perm: 'academic.graduate' },
  { key: 'import-students', path: '/academic/import-students', label: 'Import students', perm: 'students.import' },
];

/** Application sessions, programmes, O'level, candidate data, import applicants */
export const APPLICATION_SETUP_RESOURCES: AcademicResource[] = [
  { key: 'intakes', path: '/academic/intakes', label: 'Application sessions', perm: 'academic.intakes.manage' },
  { key: 'programmes', path: '/academic/programmes', label: 'Programmes', perm: 'academic.programmes.manage' },
  { key: 'olevel', path: '/academic/olevel', label: "O'level", perm: 'academic.olevel.manage' },
  { key: 'candidate-data', path: '/academic/candidate-data', label: 'Candidate data', perm: 'admissions.import' },
  { key: 'import-applicants', path: '/academic/import-applicants', label: 'Import applicants', perm: 'admissions.import' },
];

/** Course catalog, offerings, registration, unit limits, extensions */
export const COURSES_RESOURCES: AcademicResource[] = [
  { key: 'courses', path: '/academic/courses', label: 'Course catalog', perm: 'academic.courses.manage' },
  { key: 'programme-courses', path: '/academic/programme-courses', label: 'Programme courses', perm: 'academic.programmes.manage' },
  { key: 'offerings', path: '/academic/offerings', label: 'Offerings', perm: 'academic.offerings.manage' },
  { key: 'course-registration', path: '/academic/course-registration', label: 'Course registration', perm: 'academic.enrollments.manage' },
  { key: 'unit-limits', path: '/academic/unit-limits', label: 'Unit limits', perm: 'academic.enrollments.manage' },
  { key: 'registration-extensions', path: '/academic/registration-extensions', label: 'Registration extensions', perm: 'academic.extensions.review' },
];

/** Result processing */
export const RESULTS_RESOURCES: AcademicResource[] = [
  { key: 'results', path: '/academic/results', label: 'Results dashboard', perm: 'results.read' },
  { key: 'results-students', path: '/academic/results/students', label: 'Result entry', perm: 'results.read' },
  { key: 'results-import', path: '/academic/results/import', label: 'CSV import', perm: 'results.import' },
  { key: 'results-department', path: '/academic/results/department', label: 'Department uploads', perm: 'results.submit' },
  { key: 'results-approvals', path: '/academic/results/approvals', label: 'Faculty Approval', perm: 'results.faculty_approve' },
  { key: 'results-board', path: '/academic/results/board', label: 'Board', perm: 'results.board' },
  { key: 'results-release', path: '/academic/results/release', label: 'Release', perm: 'results.release' },
  { key: 'results-grading-scale', path: '/academic/results/grading-scale', label: 'Grading scale', perm: 'scales.manage' },
];

export const ACADEMIC_RESOURCES: AcademicResource[] = [
  ...ADMISSION_SETUP_RESOURCES,
  ...APPLICATION_SETUP_RESOURCES,
  ...COURSES_RESOURCES,
  ...RESULTS_RESOURCES,
];

export function academicResourceByKey(key: string): AcademicResource | undefined {
  return ACADEMIC_RESOURCES.find((resource) => resource.key === key);
}
