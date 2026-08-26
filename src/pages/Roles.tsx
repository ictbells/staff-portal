import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Space, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pencil, Plus, Search, Shield, X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { RefreshButton } from '../components/RefreshButton';
import { fieldHelpClass, fieldLabelClass, formStackClass, inputClass, StatCard, WorkspaceHero } from '../components/ui';

type Permission = { id: number; key: string; label: string; module: string };

type RoleRow = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: Permission[];
  users_count?: number;
};

type RoleForm = {
  name: string;
  description: string;
  is_active: boolean;
  permission_ids: number[];
};

const emptyForm = (): RoleForm => ({
  name: '',
  description: '',
  is_active: true,
  permission_ids: [],
});

function formFromRole(role: RoleRow): RoleForm {
  return {
    name: role.name,
    description: role.description || '',
    is_active: role.is_active,
    permission_ids: role.permissions?.map((p) => p.id) || [],
  };
}

function PermissionPicker({
  grouped,
  selected,
  onChange,
}: {
  grouped: Record<string, Permission[]>;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number, checked: boolean) => {
    onChange(checked ? [...selected, id] : selected.filter((value) => value !== id));
  };

  return (
    <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
      {Object.entries(grouped).map(([mod, perms]) => (
        <div key={mod} className="border border-slate-100 rounded-lg p-3">
          <div className="font-medium text-sky-700 capitalize mb-2 text-sm">{mod}</div>
          <div className="grid md:grid-cols-2 gap-1.5 text-sm">
            {perms.map((p) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={selected.includes(p.id)}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleFormFields({
  form,
  setForm,
  grouped,
  isSystem,
}: {
  form: RoleForm;
  setForm: (next: RoleForm) => void;
  grouped: Record<string, Permission[]>;
  isSystem?: boolean;
}) {
  return (
    <div className={formStackClass}>
      <label className={fieldLabelClass}>
        Role name
        <input
          className={`${inputClass} mt-1.5 ${isSystem ? 'bg-slate-50 text-slate-500' : ''}`}
          placeholder="e.g. Admissions Officer"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          readOnly={isSystem}
          required
        />
      </label>
      {isSystem && <p className={fieldHelpClass}>System role names cannot be changed.</p>}

      <label className={fieldLabelClass}>
        Description
        <textarea
          className={`${inputClass} mt-1.5`}
          rows={2}
          placeholder="Optional description for this role"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-slate-700">Active</div>
          <p className="text-xs text-slate-500">Inactive roles no longer grant permissions to assigned users.</p>
        </div>
        <Switch checked={form.is_active} onChange={(checked) => setForm({ ...form, is_active: checked })} />
      </div>

      <div>
        <p className={fieldLabelClass}>Permissions</p>
        <p className={fieldHelpClass}>Tick capabilities this role should grant.</p>
        <PermissionPicker
          grouped={grouped}
          selected={form.permission_ids}
          onChange={(permission_ids) => setForm({ ...form, permission_ids })}
        />
      </div>
    </div>
  );
}

export default function Roles() {
  const { auth } = useAuth();
  const isSuperAdmin = auth?.roles?.some((role) => role.slug === 'super-admin') ?? false;
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RoleForm>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [editForm, setEditForm] = useState<RoleForm>(emptyForm());
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRoles = useCallback((page = 1, nextSearch = search) => {
    setLoading(true);
    api
      .get('/api/roles', { params: { page, search: nextSearch || undefined } })
      .then(({ data }) => {
        setRoles(data.data ?? []);
        setPagination({
          current: data.current_page ?? page,
          pageSize: data.per_page ?? 15,
          total: data.total ?? 0,
        });
      })
      .catch(() => message.error('Unable to load roles.'))
      .finally(() => setLoading(false));
  }, [search]);

  const loadPermissions = useCallback(() => {
    api
      .get('/api/permissions', { params: { grouped: 1 } })
      .then(({ data }) => setGrouped(data))
      .catch(() => message.error('Unable to load permissions.'));
  }, []);

  useEffect(() => {
    loadRoles(1, '');
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch((current) => {
        const trimmed = searchInput.trim();
        if (current === trimmed) return current;
        loadRoles(1, trimmed);
        return trimmed;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, loadRoles]);

  const openCreate = () => {
    setCreateForm(emptyForm());
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm(emptyForm());
  };

    const submitCreate = async () => {
    if (!createForm.name.trim()) {
      message.error('Role name is required.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/api/roles', {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        permission_ids: createForm.permission_ids,
      });
      if (res.status !== 202 && res.data?.status !== 'pending_approval') {
        message.success('Role created.');
      }
      closeCreate();
      loadRoles(1, search);
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      message.error(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Unable to create role.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (role: RoleRow) => {
    setEditing(role);
    setEditForm(formFromRole(role));
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(emptyForm());
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      message.error('Role name is required.');
      return;
    }

    setSavingEdit(true);
    try {
      const patchPayload: Record<string, unknown> = {
        description: editForm.description.trim() || null,
        is_active: editForm.is_active,
      };
      if (!editing.is_system) {
        patchPayload.name = editForm.name.trim();
      }
      const patchRes = await api.patch(`/api/roles/${editing.id}`, patchPayload);
      if (patchRes.status === 202 || patchRes.data?.status === 'pending_approval') {
        closeEdit();
        loadRoles(pagination.current, search);
        return;
      }
      const permRes = await api.put(`/api/roles/${editing.id}/permissions`, {
        permission_ids: editForm.permission_ids,
        reason: 'Updated via roles screen',
      });
      if (permRes.status !== 202 && permRes.data?.status !== 'pending_approval') {
        message.success('Role updated.');
      }
      closeEdit();
      loadRoles(pagination.current, search);
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      message.error(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Unable to update role.');
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (role: RoleRow) => {
    try {
      const res = await api.delete(`/api/roles/${role.id}`, { data: { reason: 'Removed via roles screen' } });
      if (res.status !== 202 && res.data?.status !== 'pending_approval') {
        message.success('Role deleted.');
      }
      loadRoles(pagination.current, search);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to delete role.');
    }
  };

  const canDeleteRole = (role: RoleRow) => {
    if (role.slug === 'super-admin') return false;
    if (role.is_system && !isSuperAdmin) return false;
    if ((role.users_count ?? 0) > 0) return false;
    return true;
  };

  const deleteBlockReason = (role: RoleRow) => {
    if (role.slug === 'super-admin') return 'The Super Admin role cannot be deleted.';
    if (role.is_system && !isSuperAdmin) return 'Only Super Admin can delete system roles.';
    if ((role.users_count ?? 0) > 0) {
      return `Assigned to ${role.users_count} user(s). Remove the role from those accounts first.`;
    }
    return '';
  };

  const columns: ColumnsType<RoleRow> = [
    {
      title: 'Role',
      key: 'name',
      render: (_, role) => (
        <div>
          <div className="font-medium text-slate-800 flex items-center gap-2">
            <Shield size={14} className="text-sky-600 shrink-0" aria-hidden />
            {role.name}
            {role.is_system && <Tag>System</Tag>}
          </div>
          {role.description && <p className="text-xs text-slate-500 mt-0.5 max-w-md">{role.description}</p>}
        </div>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      width: 180,
      render: (slug: string) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{slug}</code>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, role) => (
        role.is_active ? <Tag color="success">Active</Tag> : <Tag color="default">Inactive</Tag>
      ),
    },
    {
      title: 'Users',
      key: 'users',
      width: 90,
      render: (_, role) => (
        <span className="text-slate-600 text-sm">{role.users_count ?? 0}</span>
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      width: 120,
      render: (_, role) => (
        <span className="text-slate-600 text-sm">{role.permissions?.length ?? 0} assigned</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, role) => (
        <Space size={4}>
          <Button type="text" icon={<Pencil size={14} />} size="small" onClick={() => openEdit(role)}>
            Edit
          </Button>
          {canDeleteRole(role) ? (
            <ConfirmDeleteButton onConfirm={() => remove(role)} />
          ) : (
            <Button type="text" size="small" disabled title={deleteBlockReason(role)}>
              Delete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const systemCount = roles.filter((r) => r.is_system).length;
  const activeCount = roles.filter((r) => r.is_active).length;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Administration"
        title="Roles"
        description="Create roles and assign permissions from the catalog."
        icon={Shield}
      >
        <RefreshButton onClick={() => loadRoles(pagination.current, search)} loading={loading} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
          Create role
        </Button>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Roles" value={pagination.total} hint="Matching current search" icon={Shield} />
        <StatCard label="This page" value={roles.length} icon={Shield} />
        <StatCard label="Active" value={activeCount} hint="On this page" icon={Shield} tone="emerald" />
        <StatCard label="System" value={systemCount} hint="Built-in roles" icon={Shield} tone="amber" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="relative w-72 max-w-full">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className={`${inputClass} pl-9`}
            placeholder="Search role name or slug"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = searchInput.trim();
                setSearch(trimmed);
                loadRoles(1, trimmed);
              }
            }}
          />
        </div>
        {search && (
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              loadRoles(1, '');
            }}
          >
            <X size={14} aria-hidden />
            Clear search
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table<RoleRow>
          rowKey="id"
          columns={columns}
          dataSource={roles}
          loading={loading}
          scroll={{ x: 900 }}
          size="middle"
          locale={{ emptyText: 'No roles defined yet.' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: false,
            onChange: (page) => loadRoles(page, search),
          }}
        />
      </div>

      <Modal
        title="Create role"
        open={createOpen}
        onCancel={closeCreate}
        onOk={submitCreate}
        okText="Create role"
        confirmLoading={creating}
        destroyOnHidden
        width={640}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        <p className="text-slate-500 text-sm mb-5">
          Permissions are defined by the application. Assign only what this role needs.
        </p>
        <RoleFormFields form={createForm} setForm={setCreateForm} grouped={grouped} />
      </Modal>

      <Modal
        title="Edit role"
        open={editing !== null}
        onCancel={closeEdit}
        onOk={submitEdit}
        okText="Save changes"
        confirmLoading={savingEdit}
        destroyOnHidden
        width={640}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        {editing && (
          <>
            <p className="text-slate-500 text-sm mb-5">
              {editing.is_system ? 'System role — name is locked, but permissions can be adjusted.' : `Editing ${editing.slug}`}
            </p>
            <RoleFormFields
              form={editForm}
              setForm={setEditForm}
              grouped={grouped}
              isSystem={editing.is_system}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
