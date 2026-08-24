import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pencil, Search, UserCheck, UserPlus, UserX, Users as UsersIcon, X } from 'lucide-react';
import api from '../api';
import { RefreshButton } from '../components/RefreshButton';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { fieldHelpClass, fieldLabelClass, formStackClass, inputClass, StatCard, WorkspaceHero } from '../components/ui';
import { PasswordHints } from './Reset';

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

function OfficePlacementFields({
  form,
  setForm,
  officeTree,
  units,
  subunits,
}: {
  form: UserForm;
  setForm: (next: UserForm) => void;
  officeTree: OfficeTree;
  units: { id: number; name: string; departmentId: number; departmentName: string; subunits: { id: number; name: string }[] }[];
  subunits: { id: number; name: string; unitId: number; unitName: string; departmentName: string }[];
}) {
  return (
    <div className={formStackClass}>
      <div>
        <p className={fieldLabelClass}>Works in (office)</p>
        <p className={fieldHelpClass}>
          Puts this person in an administrative office (e.g. Admission, Registry). They inherit the portal menu links configured for that office in Office setup. This is not their job role, and it is not an academic faculty or programme.
        </p>
      </div>
      <label className={fieldLabelClass}>
        Office department
        <select
          className={`${inputClass} mt-1.5`}
          value={form.office_department_id}
          onChange={(e) => setForm({ ...form, office_department_id: e.target.value, office_unit_id: '', office_subunit_id: '' })}
        >
          <option value="">Optional</option>
          {officeTree.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label className={fieldLabelClass}>
        Office unit
        <select
          className={`${inputClass} mt-1.5`}
          value={form.office_unit_id}
          onChange={(e) => setForm({ ...form, office_unit_id: e.target.value, office_subunit_id: '' })}
          disabled={!form.office_department_id}
        >
          <option value="">Optional</option>
          {units.filter((u) => String(u.departmentId) === String(form.office_department_id)).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </label>
      <label className={fieldLabelClass}>
        Office subunit
        <select
          className={`${inputClass} mt-1.5`}
          value={form.office_subunit_id}
          onChange={(e) => setForm({ ...form, office_subunit_id: e.target.value })}
          disabled={!form.office_unit_id}
        >
          <option value="">Optional</option>
          {subunits.filter((s) => String(s.unitId) === String(form.office_unit_id)).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function RoleCheckboxes({
  roles,
  roleIds,
  onChange,
}: {
  roles: { id: number; name: string }[];
  roleIds: number[];
  onChange: (roleIds: number[]) => void;
}) {
  return (
    <div className="text-sm space-y-2 max-h-40 overflow-auto border border-slate-200 rounded-lg p-4 bg-slate-50/50">
      {roleOptionsFromResponse(roles).map((r) => (
        <label key={r.id} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={roleIds.includes(r.id)}
            onChange={(e) => onChange(
              e.target.checked ? [...roleIds, r.id] : roleIds.filter((id) => id !== r.id),
            )}
          />
          {r.name}
        </label>
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
}: {
  form: UserForm;
  setForm: (next: UserForm) => void;
  roles: { id: number; name: string }[];
  officeTree: OfficeTree;
  units: { id: number; name: string; departmentId: number; departmentName: string; subunits: { id: number; name: string }[] }[];
  subunits: { id: number; name: string; unitId: number; unitName: string; departmentName: string }[];
  mode: 'create' | 'edit';
}) {
  return (
    <div className={formStackClass}>
      <label className={fieldLabelClass}>
        Full name
        <input className={`${inputClass} mt-1.5`} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className={fieldLabelClass}>
        Job title
        <input className={`${inputClass} mt-1.5`} placeholder="Job title" value={form.staff_title} onChange={(e) => setForm({ ...form, staff_title: e.target.value })} />
      </label>
      {mode === 'edit' ? (
        <div>
          <label className={fieldLabelClass}>
            Email
            <input className={`${inputClass} mt-1.5 bg-slate-50 text-slate-500`} value={form.email} readOnly />
          </label>
          <p className={fieldHelpClass}>Email cannot be changed after the account is created.</p>
        </div>
      ) : (
        <label className={fieldLabelClass}>
          Work email
          <input className={`${inputClass} mt-1.5`} placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
      )}
      <label className={fieldLabelClass}>
        Phone
        <input className={`${inputClass} mt-1.5`} placeholder="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </label>
      {mode === 'edit' && (
        <>
          <label className={fieldLabelClass}>
            Status
            <select className={`${inputClass} mt-1.5`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'disabled', reason: '' })}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          {form.status === 'disabled' && (
            <label className={fieldLabelClass}>
              Disable reason
              <textarea
                className={`${inputClass} mt-1.5`}
                rows={3}
                placeholder="Reason for disabling this account"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
          )}
        </>
      )}
      <div className={mode === 'edit' ? 'border-t border-slate-100 pt-5 space-y-5' : 'space-y-5'}>
        {mode === 'edit' && <p className="text-sm font-medium text-slate-700">Reset password (optional)</p>}
        <label className={fieldLabelClass}>
          {mode === 'create' ? 'Password' : 'New password'}
          <input
            type="password"
            className={`${inputClass} mt-1.5`}
            placeholder={mode === 'create' ? 'Password' : 'New password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label className={fieldLabelClass}>
          {mode === 'create' ? 'Confirm password' : 'Confirm new password'}
          <input
            type="password"
            className={`${inputClass} mt-1.5`}
            placeholder={mode === 'create' ? 'Confirm password' : 'Confirm new password'}
            value={form.password_confirmation}
            onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
          />
        </label>
        {form.password && <PasswordHints password={form.password} email={form.email} />}
      </div>
      <OfficePlacementFields form={form} setForm={setForm} officeTree={officeTree} units={units} subunits={subunits} />
      <div>
        <p className={fieldLabelClass}>Roles</p>
        <RoleCheckboxes
          roles={roles}
          roleIds={form.role_ids}
          onChange={(role_ids) => setForm({ ...form, role_ids })}
        />
      </div>
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
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(emptyForm());
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

  const openCreate = () => {
    setCreateForm(emptyForm());
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm(emptyForm());
  };

  const submitCreate = async () => {
    if (createForm.password && createForm.password !== createForm.password_confirmation) {
      message.error('Passwords do not match.');
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
      message.error(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Unable to create user.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    setEditForm(formFromUser(user));
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(emptyForm());
  };

  const submitEdit = async () => {
    if (!editing) return;

    if (editForm.password && editForm.password !== editForm.password_confirmation) {
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
      render: (name: string) => <span className="font-medium text-slate-800">{name}</span>,
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
        title="Create user"
        open={createOpen}
        onCancel={closeCreate}
        onOk={submitCreate}
        okText="Create user"
        confirmLoading={creating}
        destroyOnHidden
        width={520}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        <p className="text-slate-500 text-sm mb-5">
          Office placement controls which sidebar links the user sees (unless Super Admin).
        </p>
        <UserFormFields
          form={createForm}
          setForm={setCreateForm}
          roles={roles}
          officeTree={officeTree}
          units={units}
          subunits={subunits}
          mode="create"
        />
      </Modal>

      <Modal
        title="Edit user"
        open={editing !== null}
        onCancel={closeEdit}
        onOk={submitEdit}
        okText="Save changes"
        confirmLoading={savingEdit}
        destroyOnHidden
        width={520}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        {editing && (
          <>
            <p className="text-slate-500 text-sm mb-5">{editing.email}</p>
            <UserFormFields
              form={editForm}
              setForm={setEditForm}
              roles={roles}
              officeTree={officeTree}
              units={units}
              subunits={subunits}
              mode="edit"
            />
          </>
        )}
      </Modal>
    </div>
  );
}
