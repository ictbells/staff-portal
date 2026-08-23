const METADATA_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'last_activity_at',
  'email_verified_at',
  'password_changed_at',
  'two_factor_confirmed_at',
  'jamb_registration',
  'two_factor_secret',
  'remember_token',
  'password',
  'pivot',
  'is_system',
  'is_active',
  'slug',
  'description',
]);

const USER_FIELDS = [
  'name',
  'email',
  'phone',
  'status',
  'staff_title',
  'department_id',
  'office_department_id',
  'office_unit_id',
  'office_subunit_id',
  'roles',
] as const;

const ROLE_FIELDS = ['name', 'slug', 'description', 'is_active', 'permissions'] as const;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function labelList(values: unknown): string {
  if (!Array.isArray(values) || values.length === 0) return '—';
  const labels = values
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        if (typeof record.name === 'string') return record.name;
        if (typeof record.key === 'string') return record.key;
        if (typeof record.label === 'string') return record.label;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value))
    .sort();
  return labels.length ? labels.join(', ') : '—';
}

function formatScalar(value: unknown): string {
  if (isBlank(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeUserState(state: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const field of USER_FIELDS) {
    if (!(field in state)) continue;
    if (field === 'roles') {
      out.roles = labelList(state.roles);
      continue;
    }
    out[field] = formatScalar(state[field]);
  }

  if (state.staff && typeof state.staff === 'object' && !Array.isArray(state.staff)) {
    const staff = state.staff as Record<string, unknown>;
    if ('title' in staff) out.staff_title = formatScalar(staff.title);
    if ('department_id' in staff) out.department_id = formatScalar(staff.department_id);
    if ('office_department_id' in staff) out.office_department_id = formatScalar(staff.office_department_id);
    if ('office_unit_id' in staff) out.office_unit_id = formatScalar(staff.office_unit_id);
    if ('office_subunit_id' in staff) out.office_subunit_id = formatScalar(staff.office_subunit_id);
  }

  return out;
}

function normalizeRoleState(state: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of ROLE_FIELDS) {
    if (!(field in state)) continue;
    if (field === 'permissions') {
      out.permissions = labelList(state.permissions);
      continue;
    }
    out[field] = formatScalar(state[field]);
  }
  return out;
}

function normalizeGenericState(state: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(state)) {
    if (!prefix && METADATA_FIELDS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (path.split('.').some((part) => METADATA_FIELDS.has(part))) continue;

    if (Array.isArray(value)) {
      out[path] = labelList(value);
      continue;
    }
    if (value !== null && typeof value === 'object') {
      Object.assign(out, normalizeGenericState(value as Record<string, unknown>, path));
      continue;
    }
    out[path] = formatScalar(value);
  }

  return out;
}

function normalizeAuditState(state: unknown): Record<string, string> {
  if (state == null) return {};
  if (typeof state !== 'object' || Array.isArray(state)) {
    return { value: formatScalar(state) };
  }

  const record = state as Record<string, unknown>;

  if ('permissions' in record && Object.keys(record).length <= 2) {
    return { permissions: labelList(record.permissions) };
  }

  if ('email' in record || ('name' in record && 'status' in record)) {
    return normalizeUserState(record);
  }

  if ('slug' in record && ('permissions' in record || 'is_system' in record)) {
    return normalizeRoleState(record);
  }

  return normalizeGenericState(record);
}

export type AuditChange = {
  field: string;
  before: string;
  after: string;
};

export function auditChanges(before: unknown, after: unknown): AuditChange[] {
  const beforeFlat = normalizeAuditState(before);
  const afterFlat = normalizeAuditState(after);
  const keys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
  const legacyBeforeWithoutRoles = isLegacyUserSnapshotWithoutRoles(before);

  return [...keys]
    .sort()
    .map((field) => ({
      field,
      before: beforeFlat[field] ?? '—',
      after: afterFlat[field] ?? '—',
    }))
    .filter((row) => row.before !== row.after)
    .filter((row) => !(legacyBeforeWithoutRoles && row.field === 'roles'));
}

function isLegacyUserSnapshotWithoutRoles(state: unknown): boolean {
  if (state == null || typeof state !== 'object' || Array.isArray(state)) return false;
  const record = state as Record<string, unknown>;
  return ('email' in record || ('name' in record && 'status' in record)) && !('roles' in record);
}

export function formatAuditPreview(value: string, maxLength = 80): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function auditStateLines(state: unknown): [string, string][] {
  return Object.entries(normalizeAuditState(state)).sort(([a], [b]) => a.localeCompare(b));
}
