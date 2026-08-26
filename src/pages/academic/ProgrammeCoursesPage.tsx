import { useMemo, useState } from 'react';
import { Select, message } from 'antd';
import { BookOpen, GraduationCap } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Btn, Card, StatCard, WorkspaceHero, fieldLabelClass, inputClass,
} from '../../components/ui';
import { ENTRY_MODES, curriculumStudyLevel, studyLevelLabel } from './constants';
import { useResourceList } from './useResourceList';

type Faculty = { id: number; name: string };
type Department = { id: number; name: string; faculty_id?: number; faculty?: Faculty };
type Level = { id: number; name: string; code?: string | null; study_level: string };
type Course = {
  id: number;
  code: string;
  title: string;
  units?: number;
  course_type?: string;
  pivot?: { academic_level_id?: number | null };
  department?: { name?: string };
};
type Program = {
  id: number;
  name: string;
  code?: string | null;
  study_level?: string;
  entry_modes?: string[];
  is_active?: boolean;
  students_count?: number;
  department_id?: number;
  department?: Department;
  courses?: Course[];
};
type Term = { id: number; name: string; session_label?: string; is_current?: boolean };

const ADMISSION_CATEGORIES = ENTRY_MODES;

type AdmissionCategory = (typeof ADMISSION_CATEGORIES)[number]['value'];

type AssignedRow = { course_id: number; academic_level_id: number | null };

function hasEntryMode(program: Program, mode: string) {
  return (program.entry_modes ?? []).includes(mode);
}

function entryModeLabels(program: Program) {
  const modes = program.entry_modes ?? [];
  const labels = ADMISSION_CATEGORIES
    .filter((item) => modes.includes(item.value))
    .map((item) => item.label);
  return labels.length ? labels.join(' · ') : '—';
}

function programLabel(program: Program) {
  return program.code ? `${program.name} (${program.code})` : program.name;
}

function courseLabel(course: Course) {
  return `${course.code} — ${course.title}`;
}

function apiMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  const first = data?.errors && Object.values(data.errors).flat().find(Boolean);
  return first || data?.message || fallback;
}

function assignedFromProgram(program: Program): AssignedRow[] {
  return (program.courses || []).map((course) => ({
    course_id: course.id,
    academic_level_id: course.pivot?.academic_level_id ?? null,
  }));
}

export function ProgrammeCoursesPage() {
  const { rows: programs, loading, reload } = useResourceList<Program>('/api/academic/programs');
  const { rows: courses } = useResourceList<Course>('/api/academic/courses');
  const { rows: levels } = useResourceList<Level>('/api/academic/levels');
  const [collegeId, setCollegeId] = useState<number | undefined>();
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [category, setCategory] = useState<AdmissionCategory | undefined>();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assigned, setAssigned] = useState<AssignedRow[]>([]);
  const [saving, setSaving] = useState(false);

  const colleges = useMemo(() => {
    const map = new Map<number, string>();
    for (const program of programs) {
      const faculty = program.department?.faculty;
      if (faculty?.id) map.set(faculty.id, faculty.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [programs]);

  const departments = useMemo(() => {
    const map = new Map<number, { id: number; name: string; faculty_id?: number }>();
    for (const program of programs) {
      const department = program.department;
      if (!department?.id) continue;
      const facultyId = department.faculty_id ?? department.faculty?.id;
      if (collegeId && Number(facultyId) !== Number(collegeId)) continue;
      map.set(department.id, { id: department.id, name: department.name, faculty_id: facultyId });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [programs, collegeId]);

  const visiblePrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((program) => {
      if (category && !hasEntryMode(program, category)) return false;
      const facultyId = program.department?.faculty_id ?? program.department?.faculty?.id;
      if (collegeId && Number(facultyId) !== Number(collegeId)) return false;
      const deptId = program.department_id ?? program.department?.id;
      if (departmentId && Number(deptId) !== Number(departmentId)) return false;
      if (q) {
        const hay = `${program.name} ${program.code || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [programs, category, collegeId, departmentId, search]);

  const selected = programs.find((program) => program.id === selectedId) || null;
  const assignedIds = assigned.map((row) => row.course_id);
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const track = curriculumStudyLevel(selected);
  const trackLevels = useMemo(
    () => (selected ? levels.filter((level) => level.study_level === track) : []),
    [levels, selected, track],
  );

  const selectProgram = (program: Program) => {
    setSelectedId(program.id);
    setAssigned(assignedFromProgram(program));
  };

  const setCourseIds = (ids: number[]) => {
    setAssigned((current) => {
      const keep = new Map(current.map((row) => [row.course_id, row.academic_level_id]));
      return ids.map((id) => ({ course_id: id, academic_level_id: keep.get(id) ?? null }));
    });
  };

  const setLevel = (courseId: number, academicLevelId: number | null) => {
    setAssigned((current) => current.map((row) => (
      row.course_id === courseId ? { ...row, academic_level_id: academicLevelId } : row
    )));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/academic/programs/${selected.id}/courses`, { courses: assigned });
      if (!isPendingApproval(res)) {
        message.success(`Mapped ${assigned.length} course${assigned.length === 1 ? '' : 's'} to ${programLabel(selected)} students.`);
        setAssigned(assignedFromProgram(res.data));
        await reload();
      }
    } catch (err) {
      message.error(apiMessage(err, 'Could not assign courses to this programme.'));
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = programs.filter((program) => (program.courses?.length || 0) > 0).length;
  const studentCount = selected?.students_count ?? 0;

  return (
    <div className="space-y-4">
      <WorkspaceHero
        eyebrow="Courses"
        title="Programme courses"
        description="Assign catalog courses to a programme. JUPEB programmes use JUPEB levels only — they do not share undergraduate 100–500. Saving here also shows on Course catalog. Students on that programme can register only from current-term offerings of these courses."
        icon={GraduationCap}
      >
        <RefreshButton onClick={reload} loading={loading} />
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Programmes" value={visiblePrograms.length} hint="Matching current filters" icon={BookOpen} />
        <StatCard label="With courses" value={mappedCount} hint="Programmes that already have a curriculum" icon={GraduationCap} />
        <StatCard label="Catalog" value={courses.length} hint="Courses available to assign" icon={BookOpen} />
        <StatCard label="Selected students" value={selected ? studentCount : '—'} hint={selected ? 'Students on this programme' : 'Pick a programme'} icon={GraduationCap} />
      </div>

      <Card title="Filters" description="Narrow programmes by college, department, and admission category.">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block min-w-[200px] flex-1">
            <span className={fieldLabelClass}>Search</span>
            <input
              className={inputClass}
              placeholder="Programme name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>College</span>
            <Select
              allowClear
              className="w-full min-w-[180px]"
              placeholder="All colleges"
              value={collegeId}
              onChange={(value) => { setCollegeId(value); setDepartmentId(undefined); }}
              options={colleges.map((college) => ({ value: college.id, label: college.name }))}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>Department</span>
            <Select
              allowClear
              className="w-full min-w-[180px]"
              placeholder="All departments"
              value={departmentId}
              onChange={setDepartmentId}
              options={departments.map((department) => ({ value: department.id, label: department.name }))}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>Admission category</span>
            <Select
              allowClear
              className="w-full min-w-[180px]"
              placeholder="UTME, Direct Entry, JUPEB…"
              value={category}
              onChange={setCategory}
              options={ADMISSION_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))}
            />
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Programmes</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select one, then assign its courses.</p>
          </div>
          <ul className="max-h-[34rem] overflow-y-auto divide-y divide-slate-100">
            {visiblePrograms.length === 0 && (
              <li className="px-4 py-8 text-sm text-slate-500">No programmes match these filters.</li>
            )}
            {visiblePrograms.map((program) => {
              const active = program.id === selectedId;
              return (
                <li key={program.id}>
                  <button
                    type="button"
                    onClick={() => selectProgram(program)}
                    className={`w-full text-left px-4 py-3 ${active ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="text-sm font-medium text-slate-900">{programLabel(program)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {program.department?.faculty?.name || '—'} · {program.department?.name || '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {entryModeLabels(program)}
                      {' · '}
                      {studyLevelLabel(curriculumStudyLevel(program))}
                      {' · '}
                      {program.courses?.length || 0} courses
                      {' · '}
                      {program.students_count || 0} students
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
          {!selected ? (
            <p className="text-sm text-slate-500 py-10 text-center">Choose a programme to assign courses. Those courses map to students registered on that programme.</p>
          ) : (
            <>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{programLabel(selected)}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {entryModeLabels(selected)}
                  {' · '}
                  {studyLevelLabel(track)}
                  {selected.department?.name ? ` · ${selected.department.name}` : ''}
                  {selected.department?.faculty?.name ? ` · ${selected.department.faculty.name}` : ''}
                  {`. ${studentCount} student${studentCount === 1 ? '' : 's'} will see these courses at registration.`}
                </p>
                {track === 'jupeb' && trackLevels.length === 0 && (
                  <p className="text-sm text-amber-800 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    Create a JUPEB level under Academic → Levels before assigning a year to these courses. Undergraduate 100–500 cannot be used here.
                  </p>
                )}
              </div>
              <label className="block">
                <span className={fieldLabelClass}>Courses</span>
                <Select
                  className="w-full"
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select courses from the catalog"
                  value={assignedIds}
                  onChange={(ids) => setCourseIds(ids as number[])}
                  options={courses.map((course) => ({
                    value: course.id,
                    label: `${courseLabel(course)}${course.department?.name ? ` · ${course.department.name}` : ''}`,
                  }))}
                />
              </label>
              {assigned.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Course</th>
                        <th className="px-3 py-2 font-medium w-48">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.map((row) => {
                        const course = courseById.get(row.course_id) || selected.courses?.find((item) => item.id === row.course_id);
                        return (
                          <tr key={row.course_id} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800">{course ? courseLabel(course) : `Course #${row.course_id}`}</div>
                              <div className="text-xs text-slate-500">{course?.course_type || 'departmental'}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                className="w-full"
                                allowClear
                                placeholder={track === 'jupeb' ? 'JUPEB level' : 'All levels'}
                                value={row.academic_level_id || undefined}
                                onChange={(value) => setLevel(row.course_id, value ?? null)}
                                options={trackLevels.map((level) => ({
                                  value: level.id,
                                  label: level.code ? `${level.name} (${level.code})` : level.name,
                                }))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end">
                <Btn onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save curriculum'}
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
