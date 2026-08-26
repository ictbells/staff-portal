import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Building2, Eye, EyeOff, KeyRound, Pencil, Search, Shield, UserCheck, UserPlus, UserRound, UserX, Users as UsersIcon, X, type LucideIcon } from 'lucide-react';
import api from '../api';
import { RefreshButton } from '../components/RefreshButton';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { fieldHelpClass, fieldLabelClass, inputClass, StatCard, WorkspaceHero } from '../components/ui';

type OfficeTree = {
  id: number;
  name: string;
  units: { id: number; name: string; subunits: { id: number; name: string }[] }[];
}[];

type UserRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  status?: string;
  roles?: { id: number; name: string }[];
  staff?: {
    title?: string;
    office_department_id?: number | null;
    office_unit_id?: number | null;
    office_subunit_id?: number | null;
    office_placement?: string;
    is_office_hod?: boolean;
    is_office_unit_head?: boolean;
  } | null;
  student?: unknown;
};

type UserFilters = {
  search: string;
  status: '' | 'active' | 'disabled';
  office_department_id: number | '';
  office_unit_id: number | '';
};

const emptyFilters = (): UserFilters => ({
  search: '',
  status: '',
  office_department_id: '',
  office_unit_id: '',
});

type UserForm = {
  name: string;
  staff_title: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  status: 'active' | 'disabled';
  reason: string;
  role_ids: number[];
  office_department_id: string | number;
  office_unit_id: string | number;
  office_subunit_id: string | number;
};

const emptyForm = (): UserForm => ({
  name: '',
  staff_title: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  status: 'active',
  reason: '',
  role_ids: [],
  office_department_id: '',
  office_unit_id: '',
  office_subunit_id: '',
});

function roleOptionsFromResponse(data: unknown): { id: number; name: string }[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: { id: number; name: string }[] }).data;
  }
  return [];
}

function formFromUser(user: UserRow): UserForm {
  return {
    name: user.name || '',
    staff_title: user.staff?.title || '',
    email: user.email || '',
    phone: user.phone || '',
    password: '',
    password_confirmation: '',
    status: user.status === 'disabled' ? 'disabled' : 'active',
    reason: '',
    role_ids: user.roles?.map((r) => r.id) || [],
    office_department_id: user.staff?.office_department_id ?? '',
    office_unit_id: user.staff?.office_unit_id ?? '',
    office_subunit_id: user.staff?.office_subunit_id ?? '',
  };
}

function firstError(errors: Record<string, string> | undefined, key: string): string | undefined {
  return errors?.[key] || undefined;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className={fieldLabelClass}>
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-rose-600">{message}</p>;
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 ring-1 ring-slate-200">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PasswordField({
  label,
  required,
  value,
  onChange,
  placeholder,
  visible,
  error,
  autoComplete,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={visible ? 'text' : 'password'}
        className={`${inputClass} ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      <FieldError message={error} />
    </label>
  );
}

function PasswordRulePills({ password, email }: { password: string; email?: string }) {
  const rules = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase', ok: /[a-z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Symbol', ok: /[^A-Za-z0-9]/.test(password) },
    { label: 'Not the email', ok: Boolean(password) && password !== (email || '') },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {rules.map((rule) => (
        <span
          key={rule.label}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            rule.ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-white text-slate-500 ring-1 ring-slate-200'
          }`}
        >
          {rule.ok ? '✓' : '○'} {rule.label}
        </span>
      ))}
    </div>
  );
}

function UserFormFields({
  form,
  setForm,
  roles,
  officeTree,
  units,
  subunits,
  mode,
  errors,
}: {
  form: UserForm;
  setForm: (next: UserForm) => void;
  roles: { id: number; name: string }[];
  officeTree: OfficeTree;
  units: { id: number; name: string; departmentId: number; departmentName: string; subunits: { id: number; name: string }[] }[];
  subunits: { id: number; name: string; unitId: number; unitName: string; departmentName: string }[];
  mode: 'create' | 'edit';
  errors?: Record<string, string>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const availableRoles = roleOptionsFromResponse(roles);
  const departmentUnits = units.filter((u) => String(u.departmentId) === String(form.office_department_id));
  const unitSubunits = subunits.filter((s) => String(s.unitId) === String(form.office_unit_id));
  const passwordMismatch = Boolean(form.password_confirmation) && form.password !== form.password_confirmation;

  const patch = (next: Partial<UserForm>) => setForm({ ...form, ...next });

  return (
    <div className="space-y-4">
      <FormSection icon={UserRound} title="Profile" description="How this person appears on staff lists and in the audit trail.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel required>Full name</FieldLabel>
            <input
              className={`${inputClass} ${firstError(errors, 'name') ? 'border-rose-300' : ''}`}
              placeholder="Adaeze Okoye"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              autoComplete="name"
            />
            <FieldError message={firstError(errors, 'name')} />
          </label>
          <label className="block">
            <FieldLabel>Job title</FieldLabel>
            <input
              className={inputClass}
              placeholder="Admissions officer"
              value={form.staff_title}
              onChange={(e) => patch({ staff_title: e.target.value })}
            />
          </label>
          {mode === 'edit' ? (
            <div>
              <FieldLabel>Work email</FieldLabel>
              <input className={`${inputClass} bg-slate-50 text-slate-500`} value={form.email} readOnly />
              <p className={fieldHelpClass}>Email cannot be changed after the account is created.</p>
            </div>
          ) : (
            <label className="block">
              <FieldLabel required>Work email</FieldLabel>
              <input
                className={`${inputClass} ${firstError(errors, 'email') ? 'border-rose-300' : ''}`}
                type="email"
                placeholder="adaeze.okoye@bellsuniversity.edu.ng"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                autoComplete="email"
              />
              <FieldError message={firstError(errors, 'email')} />
            </label>
          )}
          <label className="block">
            <FieldLabel>Phone</FieldLabel>
            <input
              className={inputClass}
              placeholder="0803 000 0000"
              type="tel"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              autoComplete="tel"
            />
            <FieldError message={firstError(errors, 'phone')} />
          </label>
        </div>
        {mode === 'edit' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Status</FieldLabel>
              <Select
                className="w-full"
                value={form.status}
                onChange={(status) => patch({ status, reason: '' })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
              />
            </label>
            {form.status === 'disabled' && (
              <label className="block sm:col-span-2">
                <FieldLabel required>Disable reason</FieldLabel>
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="Why this account is being disabled"
                  value={form.reason}
                  onChange={(e) => patch({ reason: e.target.value })}
                />
              </label>
            )}
          </div>
        )}
      </FormSection>

      <FormSection
        icon={KeyRound}
        title={mode === 'create' ? 'Sign-in password' : 'Reset password'}
        description={mode === 'create'
          ? 'They will use this password on the staff portal. It must meet the checks below.'
          : 'Leave blank to keep the current password.'}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            label={mode === 'create' ? 'Password' : 'New password'}
            required={mode === 'create'}
            value={form.password}
            onChange={(password) => patch({ password })}
            placeholder={mode === 'create' ? 'Create a password' : 'Optional new password'}
            visible={showPassword}
            error={firstError(errors, 'password')}
            autoComplete="new-password"
          />
          <PasswordField
            label={mode === 'create' ? 'Confirm password' : 'Confirm new password'}
            required={mode === 'create'}
            value={form.password_confirmation}
            onChange={(password_confirmation) => patch({ password_confirmation })}
            placeholder="Repeat password"
            visible={showPassword}
            error={passwordMismatch ? 'Passwords do not match.' : firstError(errors, 'password_confirmation')}
            autoComplete="new-password"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {(form.password || mode === 'create') ? <PasswordRulePills password={form.password} email={form.email} /> : <span />}
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {showPassword ? 'Hide passwords' : 'Show passwords'}
          </button>
        </div>
      </FormSection>

      <FormSection
        icon={Building2}
        title="Office placement"
        description="Optional. Places them in an administrative office so they inherit that office’s portal links. This is not a job role, faculty, or programme."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <FieldLabel>Office</FieldLabel>
            <Select
              allowClear
              className="w-full"
              placeholder="Select office"
              value={form.office_department_id || undefined}
              onChange={(value) => patch({ office_department_id: value ?? '', office_unit_id: '', office_subunit_id: '' })}
              options={officeTree.map((d) => ({ value: d.id, label: d.name }))}
            />
          </label>
          <label className="block">
            <FieldLabel>Unit</FieldLabel>
            <Select
              allowClear
              className="w-full"
              placeholder="Optional"
              disabled={!form.office_department_id}
              value={form.office_unit_id || undefined}
              onChange={(value) => patch({ office_unit_id: value ?? '', office_subunit_id: '' })}
              options={departmentUnits.map((u) => ({ value: u.id, label: u.name }))}
            />
          </label>
          <label className="block">
            <FieldLabel>Subunit</FieldLabel>
            <Select
              allowClear
              className="w-full"
              placeholder="Optional"
              disabled={!form.office_unit_id}
              value={form.office_subunit_id || undefined}
              onChange={(value) => patch({ office_subunit_id: value ?? '' })}
              options={unitSubunits.map((s) => ({ value: s.id, label: s.name }))}
            />
          </label>
        </div>
      </FormSection>

      <FormSection icon={Shield} title="Roles" description="What they can do. Super Admin bypasses office menu limits.">
        {availableRoles.length ? (
          <label className="block">
            <FieldLabel required={mode === 'create'}>{mode === 'create' ? 'Role' : 'Roles'}</FieldLabel>
            {mode === 'create' ? (
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                placeholder="Select role"
                value={form.role_ids[0]}
                onChange={(value) => patch({ role_ids: value != null ? [value] : [] })}
                options={availableRoles.map((role) => ({ value: role.id, label: role.name }))}
              />
            ) : (
              <Select
                className="w-full"
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Select roles"
                value={form.role_ids}
                onChange={(value) => patch({ role_ids: value })}
                options={availableRoles.map((role) => ({ value: role.id, label: role.name }))}
              />
            )}
          </label>
        ) : (
          <p className="text-sm text-slate-500">No roles are available yet. Create roles first, then assign them here.</p>
        )}
        <FieldError message={firstError(errors, 'role_ids')} />
      </FormSection>
    </div>
  );
}

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [officeTree, setOfficeTree] = useState<OfficeTree>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 });
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [searchInput, setSearchInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<UserForm>(emptyForm());
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(emptyForm());
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const filterParams = useCallback((next: UserFilters) => {
    const params: Record<string, string | number> = {};
    const search = next.search.trim();
    if (search) params.search = search;
    if (next.status) params.status = next.status;
    if (next.office_department_id) params.office_department_id = next.office_department_id;
    if (next.office_unit_id) params.office_unit_id = next.office_unit_id;
    return params;
  }, []);

  const load = useCallback((page = 1, nextFilters: UserFilters = filters) => {
    setLoading(true);
    Promise.all([
      api.get('/api/users', { params: { page, ...filterParams(nextFilters) } }),
      api.get('/api/roles', { params: { per_page: 100 } }),
      api.get('/api/office-structure').catch(() => ({ data: [] })),
    ])
      .then(([usersRes, rolesRes, officeRes]) => {
        const body = usersRes.data;
        if (Array.isArray(body?.data)) {
          setRows(body.data);
          setPagination({
            current: body.current_page ?? page,
            pageSize: body.per_page ?? 30,
            total: body.total ?? body.data.length,
          });
        } else {
          setRows(Array.isArray(body) ? body : []);
        }
        setRoles(roleOptionsFromResponse(rolesRes.data));
        setOfficeTree(officeRes.data);
      })
      .finally(() => setLoading(false));
  }, [filterParams]);

  useEffect(() => { load(1, emptyFilters()); }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => {
        const trimmed = searchInput.trim();
        if (current.search === trimmed) return current;
        const next = { ...current, search: trimmed };
        load(1, next);
        return next;
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput, load]);

  const units = useMemo(
    () => officeTree.flatMap((d) => d.units.map((u) => ({ ...u, departmentId: d.id, departmentName: d.name }))),
    [officeTree],
  );

  const subunits = useMemo(
    () => units.flatMap((u) => u.subunits.map((s) => ({ ...s, unitId: u.id, unitName: u.name, departmentName: u.departmentName }))),
    [units],
  );

  const filterUnits = useMemo(
    () => (filters.office_department_id
      ? units.filter((u) => u.departmentId === filters.office_department_id)
      : units),
    [units, filters.office_department_id],
  );

  const hasActiveFilters = useMemo(
    () => Boolean(
      filters.search
      || filters.status
      || filters.office_department_id
      || filters.office_unit_id,
    ),
    [filters],
  );

  const applyFilters = (patch: Partial<UserFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(1, next);
  };

  const clearFilters = () => {
    const next = emptyFilters();
    setSearchInput('');
    setFilters(next);
    load(1, next);
  };

  const buildPayload = (form: UserForm, options: { includeStaffFields?: boolean; includeEmail?: boolean } = {}) => {
    const { includeStaffFields = true, includeEmail = true } = options;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      role_ids: form.role_ids,
    };
    if (includeEmail) {
      payload.email = form.email.trim();
    }
    if (includeStaffFields) {
      payload.staff_title = form.staff_title.trim() || null;
      payload.office_department_id = form.office_department_id || null;
      payload.office_unit_id = form.office_unit_id || null;
      payload.office_subunit_id = form.office_subunit_id || null;
    }
    if (form.password) {
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }
    return payload;
  };

  const flattenErrors = (payload: unknown): Record<string, string> => {
    if (!payload || typeof payload !== 'object') return {};
    const next: Record<string, string> = {};
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      if (Array.isArray(value) && value[0]) next[key] = String(value[0]);
      else if (typeof value === 'string') next[key] = value;
    });
    return next;
  };

  const openCreate = () => {
    setCreateForm(emptyForm());
    setCreateErrors({});
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm(emptyForm());
    setCreateErrors({});
  };

  const submitCreate = async () => {
    const nextErrors: Record<string, string> = {};
    if (!createForm.name.trim()) nextErrors.name = 'Full name is required.';
    if (!createForm.email.trim()) nextErrors.email = 'Work email is required.';
    if (!createForm.password) nextErrors.password = 'Password is required.';
    if (createForm.password && createForm.password !== createForm.password_confirmation) {
      nextErrors.password_confirmation = 'Passwords do not match.';
    }
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      message.error(Object.values(nextErrors)[0]);
      return;
    }

    setCreating(true);
    try {
      await api.post('/api/users', buildPayload(createForm));
      message.success('User created.');
      closeCreate();
      load(pagination.current, filters);
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      setCreateErrors(flattenErrors(errors));
      message.error(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Unable to create user.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    setEditForm(formFromUser(user));
    setEditErrors({});
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(emptyForm());
    setEditErrors({});
  };

  const submitEdit = async () => {
    if (!editing) return;

    if (editForm.password && editForm.password !== editForm.password_confirmation) {
      setEditErrors({ password_confirmation: 'Passwords do not match.' });
      message.error('Passwords do not match.');
      return;
    }
    if (editForm.status === 'disabled' && editing.status !== 'disabled' && !editForm.reason.trim()) {
      message.error('A reason is required to disable a user.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = buildPayload(editForm, {
        includeStaffFields: true,
        includeEmail: false,
      });
      if (editForm.status !== (editing.status === 'disabled' ? 'disabled' : 'active')) {
        payload.status = editForm.status;
        if (editForm.status === 'disabled') payload.reason = editForm.reason.trim();
      }
      await api.patch(`/api/users/${editing.id}`, payload);
      message.success('User updated.');
      closeEdit();
      load(pagination.current, filters);
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      setEditErrors(flattenErrors(errors));
      message.error(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Unable to update user.');
    } finally {
      setSavingEdit(false);
    }
  };

  const clearPlacement = async (user: UserRow) => {
    try {
      await api.patch(`/api/users/${user.id}`, { clear_office_placement: true });
      message.success('Office placement cleared.');
      load(pagination.current, filters);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to clear office placement.');
    }
  };

  const removeUser = async (user: UserRow) => {
    try {
      await api.delete(`/api/users/${user.id}`, { data: { reason: 'Removed via users screen' } });
      message.success('User deleted.');
      load(pagination.current, filters);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to delete user.');
    }
  };

  const columns: ColumnsType<UserRow> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, u) => (
        <span className="font-medium text-slate-800">
          {name}
          {u.staff?.is_office_hod && <Tag className="ml-2" color="blue">HOD</Tag>}
          {u.staff?.is_office_unit_head && <Tag className="ml-2" color="purple">Unit head</Tag>}
        </span>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => <span className="text-slate-600">{email}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, u) => (
        u.status === 'disabled'
          ? <Tag color="warning">Disabled</Tag>
          : <Tag color="success">Active</Tag>
      ),
    },
    {
      title: 'Works in',
      key: 'placement',
      render: (_, u) => (
        <div>
          {u.staff?.office_placement ? (
            <div className="text-sm text-slate-700">{u.staff.office_placement}</div>
          ) : u.staff?.office_department_id || u.staff?.office_unit_id || u.staff?.office_subunit_id ? (
            <div className="text-xs text-amber-700">Invalid placement</div>
          ) : (
            <span className="text-slate-400 text-xs">Not assigned</span>
          )}
          {u.staff && (u.staff.office_department_id || u.staff.office_unit_id || u.staff.office_subunit_id) && (
            <button
              type="button"
              className="block mt-1 text-xs text-red-600 hover:underline"
              onClick={() => clearPlacement(u)}
            >
              Clear placement
            </button>
          )}
        </div>
      ),
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_, u) => (
        u.roles?.length
          ? (
            <Space size={[4, 4]} wrap>
              {u.roles.map((r) => <Tag key={r.id} color="processing">{r.name}</Tag>)}
            </Space>
          )
          : <span className="text-slate-400 text-xs">No roles</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, u) => (
        <Space size={4}>
          <Button type="text" icon={<Pencil size={14} />} size="small" onClick={() => openEdit(u)}>
            Edit
          </Button>
          <ConfirmDeleteButton onConfirm={() => removeUser(u)} />
        </Space>
      ),
    },
  ];

  const activeOnPage = rows.filter((u) => u.status !== 'disabled').length;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Administration"
        title="Users"
        description="Create staff accounts, assign roles (what they can do), and place them in an office (where they work and which portal links they see)."
        icon={UsersIcon}
      >
        <RefreshButton onClick={() => load(pagination.current, filters)} loading={loading} />
        <Button type="primary" icon={<UserPlus size={14} />} onClick={openCreate}>
          Create user
        </Button>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Accounts" value={pagination.total} hint="Matching current filters" icon={UsersIcon} />
        <StatCard label="This page" value={rows.length} hint="Visible in the table" icon={UsersIcon} />
        <StatCard label="Active" value={activeOnPage} hint="On this page" icon={UserCheck} tone="emerald" />
        <StatCard label="Disabled" value={rows.length - activeOnPage} hint="On this page" icon={UserX} tone="rose" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72 max-w-full shrink-0">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className={`${inputClass} pl-9`}
              placeholder="Search name, email, or phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const next = { ...filters, search: searchInput.trim() };
                  setFilters(next);
                  load(1, next);
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              allowClear
              placeholder="Status"
              value={filters.status || undefined}
              onChange={(value) => applyFilters({ status: value ?? '' })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              className="min-w-[120px]"
            />
            <Select
              allowClear
              placeholder="Office department"
              value={filters.office_department_id || undefined}
              onChange={(value) => applyFilters({
                office_department_id: value ?? '',
                office_unit_id: '',
              })}
              options={officeTree.map((d) => ({ value: d.id, label: d.name }))}
              className="min-w-[180px]"
            />
            <Select
              allowClear
              placeholder="Office unit"
              value={filters.office_unit_id || undefined}
              onChange={(value) => applyFilters({ office_unit_id: value ?? '' })}
              disabled={!filters.office_department_id}
              options={filterUnits.map((u) => ({ value: u.id, label: u.name }))}
              className="min-w-[160px]"
            />
            {hasActiveFilters && (
              <Button icon={<X size={14} />} onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table<UserRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 900 }}
          size="middle"
          locale={{ emptyText: 'No staff users yet.' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: false,
            onChange: (page) => load(page, filters),
          }}
        />
      </div>

      <Modal
        title={(
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
              <UserPlus className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900">Create user</div>
              <p className="mt-0.5 text-sm font-normal text-slate-500">
                Add a staff account, assign what they can do, and place them in an office.
              </p>
            </div>
          </div>
        )}
        open={createOpen}
        onCancel={closeCreate}
        onOk={submitCreate}
        okText="Create user"
        cancelText="Cancel"
        confirmLoading={creating}
        destroyOnHidden
        centered
        width={760}
        styles={{ body: { paddingTop: 12, maxHeight: 'min(72vh, 680px)', overflowY: 'auto' } }}
      >
        <UserFormFields
          form={createForm}
          setForm={(next) => {
            setCreateForm(next);
            setCreateErrors({});
          }}
          roles={roles}
          officeTree={officeTree}
          units={units}
          subunits={subunits}
          mode="create"
          errors={createErrors}
        />
      </Modal>

      <Modal
        title={(
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <Pencil className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900">Edit user</div>
              <p className="mt-0.5 text-sm font-normal text-slate-500">{editing?.email}</p>
            </div>
          </div>
        )}
        open={editing !== null}
        onCancel={closeEdit}
        onOk={submitEdit}
        okText="Save changes"
        cancelText="Cancel"
        confirmLoading={savingEdit}
        destroyOnHidden
        centered
        width={760}
        styles={{ body: { paddingTop: 12, maxHeight: 'min(72vh, 680px)', overflowY: 'auto' } }}
      >
        {editing && (
          <UserFormFields
            form={editForm}
            setForm={(next) => {
              setEditForm(next);
              setEditErrors({});
            }}
            roles={roles}
            officeTree={officeTree}
            units={units}
            subunits={subunits}
            mode="edit"
            errors={editErrors}
          />
        )}
      </Modal>
    </div>
  );
}
