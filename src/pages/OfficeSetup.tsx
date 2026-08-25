import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Checkbox,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Building2, GitBranch, Layers, Link2, Pencil, Plus, Settings2 } from 'lucide-react';
import api from '../api';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { RefreshButton } from '../components/RefreshButton';
import OfficeStructureCards from '../components/OfficeStructureCards';
import { PageHeader } from '../components/ui';

type ApprovalChain = 'unit_head' | 'department_head' | 'both';

type NavLinkConfig = {
  key: string;
  require_create: boolean;
  require_update: boolean;
  require_delete: boolean;
  approval_chain: ApprovalChain;
};

type HeadStaff = { id: number; name: string; staff_number?: string } | null;
type Subunit = {
  id: number;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  nav_keys?: string[];
  nav_links?: NavLinkConfig[];
  inherited_nav_keys?: string[];
};
type Unit = {
  id: number;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  nav_keys?: string[];
  nav_links?: NavLinkConfig[];
  inherited_nav_keys?: string[];
  subunits: Subunit[];
  head_staff?: HeadStaff;
  needs_unit_head?: boolean;
};
type Department = {
  id: number;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  nav_keys?: string[];
  nav_links?: NavLinkConfig[];
  inherited_nav_keys?: string[];
  units: Unit[];
  head_staff?: HeadStaff;
  needs_hod?: boolean;
};

type NavCatalogItem = {
  key: string;
  section: string;
  label: string;
  perm: string | null;
  has_approval_actions?: boolean;
};

type ModalKind = 'department' | 'unit' | 'subunit';

type TreeRow = {
  key: string;
  id: number;
  kind: ModalKind;
  level: 'Department' | 'Unit' | 'Subunit';
  name: string;
  code: string;
  description?: string;
  active: boolean;
  office_department_id?: number;
  office_unit_id?: number;
  updateUrl: string;
  deleteUrl: string;
  deleteMessage: string;
  nav_keys: string[];
  nav_links: NavLinkConfig[];
  inherited_nav_keys: string[];
  navLinksUrl: string;
  head_staff_id?: number | null;
  head_label?: string;
  needs_head?: boolean;
  children?: TreeRow[];
};

type FormValues = {
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  office_department_id?: number;
  office_unit_id?: number;
  head_staff_id?: number | null;
};

const defaultLinkConfig = (key: string): NavLinkConfig => ({
  key,
  require_create: true,
  require_update: true,
  require_delete: true,
  approval_chain: 'both',
});

/** Assign portal access without gating mutations until staff opt in. */
const ungatedLinkConfig = (key: string): NavLinkConfig => ({
  key,
  require_create: false,
  require_update: false,
  require_delete: false,
  approval_chain: 'both',
});

const chainLabel: Record<ApprovalChain, string> = {
  unit_head: 'unit',
  department_head: 'HOD',
  both: 'unit→HOD',
};

function linkRequiresApproval(cfg: NavLinkConfig): boolean {
  return cfg.require_create || cfg.require_update || cfg.require_delete;
}

function configsFromNode(navKeys: string[] = [], navLinks: NavLinkConfig[] = []): NavLinkConfig[] {
  const byKey = new Map(navLinks.map((l) => [l.key, { ...ungatedLinkConfig(l.key), ...l }]));
  return navKeys.map((key) => byKey.get(key) || ungatedLinkConfig(key));
}

function methodHint(cfg: NavLinkConfig): string {
  if (!linkRequiresApproval(cfg)) return 'no approval';
  const parts = [
    cfg.require_create ? 'C' : null,
    cfg.require_update ? 'U' : null,
    cfg.require_delete ? 'D' : null,
  ].filter(Boolean);
  return `${parts.join('·')} · ${chainLabel[cfg.approval_chain]}`;
}

const levelColors: Record<TreeRow['level'], string> = {
  Department: 'blue',
  Unit: 'purple',
  Subunit: 'default',
};

const createCopy: Record<ModalKind, { title: string; description: string }> = {
  department: {
    title: 'New department',
    description: 'Top-level office such as Registry, Bursary, or ICT.',
  },
  unit: {
    title: 'New unit',
    description: 'Division within a department.',
  },
  subunit: {
    title: 'New subunit',
    description: 'Team or desk within a unit.',
  },
};

const editCopy: Record<ModalKind, { title: string; description: string }> = {
  department: {
    title: 'Edit department',
    description: 'Update department details or deactivate it.',
  },
  unit: {
    title: 'Edit unit',
    description: 'Update unit details or move it to another department.',
  },
  subunit: {
    title: 'Edit subunit',
    description: 'Update subunit details or move it to another unit.',
  },
};

function buildTreeRows(tree: Department[]): TreeRow[] {
  return tree.map((d) => ({
    key: `d-${d.id}`,
    id: d.id,
    kind: 'department',
    level: 'Department',
    name: d.name,
    code: d.code || '—',
    description: d.description,
    active: d.is_active,
    updateUrl: `/api/office-departments/${d.id}`,
    deleteUrl: `/api/office-departments/${d.id}`,
    deleteMessage: 'Delete this department and all its units?',
    nav_keys: d.nav_keys || [],
    nav_links: configsFromNode(d.nav_keys, d.nav_links),
    inherited_nav_keys: d.inherited_nav_keys || [],
    navLinksUrl: `/api/office-departments/${d.id}/nav-links`,
    head_staff_id: d.head_staff?.id ?? null,
    head_label: d.head_staff?.name,
    needs_head: !!d.needs_hod,
    children: d.units.length
      ? d.units.map((u) => ({
          key: `u-${u.id}`,
          id: u.id,
          kind: 'unit' as const,
          level: 'Unit' as const,
          name: u.name,
          code: u.code || '—',
          description: u.description,
          active: u.is_active,
          office_department_id: d.id,
          updateUrl: `/api/office-units/${u.id}`,
          deleteUrl: `/api/office-units/${u.id}`,
          deleteMessage: 'Delete this unit and all its subunits?',
          nav_keys: u.nav_keys || [],
          nav_links: configsFromNode(u.nav_keys, u.nav_links),
          inherited_nav_keys: u.inherited_nav_keys || [],
          navLinksUrl: `/api/office-units/${u.id}/nav-links`,
          head_staff_id: u.head_staff?.id ?? null,
          head_label: u.head_staff?.name,
          needs_head: !!u.needs_unit_head,
          children: u.subunits.length
            ? u.subunits.map((s) => ({
                key: `s-${s.id}`,
                id: s.id,
                kind: 'subunit' as const,
                level: 'Subunit' as const,
                name: s.name,
                code: s.code || '—',
                description: s.description,
                active: s.is_active,
                office_unit_id: u.id,
                updateUrl: `/api/office-subunits/${s.id}`,
                deleteUrl: `/api/office-subunits/${s.id}`,
                deleteMessage: 'Delete this subunit?',
                nav_keys: s.nav_keys || [],
                nav_links: configsFromNode(s.nav_keys, s.nav_links),
                inherited_nav_keys: s.inherited_nav_keys || [],
                navLinksUrl: `/api/office-subunits/${s.id}/nav-links`,
              }))
            : undefined,
        }))
      : undefined,
  }));
}

export default function OfficeSetup() {
  const [form] = Form.useForm<FormValues>();
  const [tree, setTree] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modalKind, setModalKind] = useState<ModalKind | null>(null);
  const [editingRow, setEditingRow] = useState<TreeRow | null>(null);
  const [linksRow, setLinksRow] = useState<TreeRow | null>(null);
  const [staffOptions, setStaffOptions] = useState<{ value: number; label: string }[]>([]);
  const [navCatalog, setNavCatalog] = useState<NavCatalogItem[]>([]);
  const [selectedNavKeys, setSelectedNavKeys] = useState<string[]>([]);
  const [navLinkConfigs, setNavLinkConfigs] = useState<Record<string, NavLinkConfig>>({});
  const [approvalDraftKey, setApprovalDraftKey] = useState<string | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<NavLinkConfig | null>(null);
  const [linksSubmitting, setLinksSubmitting] = useState(false);

  const isEdit = editingRow !== null;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/office-structure');
      setTree(data);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.get('/api/staff-nav/catalog').then((r) => setNavCatalog(r.data)).catch(() => setNavCatalog([]));
  }, []);

  useEffect(() => {
    if (modalKind !== 'department' && modalKind !== 'unit') {
      setStaffOptions([]);
      return;
    }
    const params: Record<string, number> = {};
    if (modalKind === 'department' && editingRow) {
      params.office_department_id = editingRow.id;
    }
    if (modalKind === 'unit') {
      const departmentId = form.getFieldValue('office_department_id') || editingRow?.office_department_id;
      if (departmentId) params.office_department_id = departmentId;
      if (editingRow) params.office_unit_id = editingRow.id;
    }
    api.get('/api/office-staff-options', { params })
      .then(({ data }) => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setStaffOptions(list.map((row: { id: number; name?: string; email?: string; staff_number?: string }) => ({
          value: row.id,
          label: [row.name, row.staff_number, row.email].filter(Boolean).join(' · '),
        })));
      })
      .catch(() => setStaffOptions([]));
  }, [modalKind, editingRow]);

  const units = useMemo(
    () => tree.flatMap((d) => d.units.map((u) => ({ ...u, departmentName: d.name, departmentId: d.id }))),
    [tree],
  );

  const tableData = useMemo(() => buildTreeRows(tree), [tree]);

  const openCreateModal = (kind: ModalKind) => {
    setError('');
    setEditingRow(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalKind(kind);
  };

  const openEditModal = (row: TreeRow) => {
    setError('');
    setEditingRow(row);
    setModalKind(row.kind);
    form.setFieldsValue({
      name: row.name,
      code: row.code === '—' ? '' : row.code,
      description: row.description || '',
      is_active: row.active,
      office_department_id: row.office_department_id,
      office_unit_id: row.office_unit_id,
      head_staff_id: row.head_staff_id ?? null,
    });
  };

  const closeModal = () => {
    setModalKind(null);
    setEditingRow(null);
    form.resetFields();
  };

  const submit = async (values: FormValues) => {
    if (!modalKind) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...values,
        code: values.code || null,
        description: values.description || null,
      };
      if (isEdit && editingRow) {
        await api.patch(editingRow.updateUrl, payload);
      } else if (modalKind === 'department') {
        await api.post('/api/office-departments', payload);
      } else if (modalKind === 'unit') {
        await api.post('/api/office-units', payload);
      } else {
        await api.post('/api/office-subunits', payload);
      }
      closeModal();
      await load();
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      const firstError = errors && typeof errors === 'object'
        ? Object.values(errors as Record<string, string[]>)[0]?.[0]
        : undefined;
      setError(err.response?.data?.message || firstError || 'Unable to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (url: string) => {
    setError('');
    try {
      await api.delete(url);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to delete.');
    }
  };

  const openLinksModal = (row: TreeRow) => {
    setError('');
    setLinksRow(row);
    setSelectedNavKeys(row.nav_keys);
    const map: Record<string, NavLinkConfig> = {};
    row.nav_links.forEach((cfg) => {
      map[cfg.key] = { ...defaultLinkConfig(cfg.key), ...cfg };
    });
    setNavLinkConfigs(map);
    setApprovalDraftKey(null);
    setApprovalDraft(null);
  };

  const closeLinksModal = () => {
    setLinksRow(null);
    setSelectedNavKeys([]);
    setNavLinkConfigs({});
    setApprovalDraftKey(null);
    setApprovalDraft(null);
  };

  const catalogItem = (key: string) => navCatalog.find((item) => item.key === key);

  const openApprovalConfig = (key: string) => {
    setApprovalDraftKey(key);
    setApprovalDraft(navLinkConfigs[key] || defaultLinkConfig(key));
  };

  const confirmApprovalConfig = () => {
    if (!approvalDraftKey || !approvalDraft) return;
    setNavLinkConfigs((prev) => ({ ...prev, [approvalDraftKey]: { ...approvalDraft, key: approvalDraftKey } }));
    setSelectedNavKeys((prev) => (prev.includes(approvalDraftKey) ? prev : [...prev, approvalDraftKey]));
    setApprovalDraftKey(null);
    setApprovalDraft(null);
  };

  const cancelApprovalConfig = () => {
    // If the key was never confirmed into selection, leave it unchecked
    setApprovalDraftKey(null);
    setApprovalDraft(null);
  };

  const toggleNavKey = (key: string, checked: boolean) => {
    if (checked) {
      const item = catalogItem(key);
      setSelectedNavKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setNavLinkConfigs((prev) => ({
        ...prev,
        // Gated modules start without approval; use the gear to turn gates on.
        [key]: prev[key] || (item?.has_approval_actions ? ungatedLinkConfig(key) : defaultLinkConfig(key)),
      }));
      return;
    }
    setSelectedNavKeys((prev) => prev.filter((k) => k !== key));
    setNavLinkConfigs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const saveNavLinks = async () => {
    if (!linksRow) return;
    setLinksSubmitting(true);
    setError('');
    try {
      const nav_links = selectedNavKeys.map((key) => navLinkConfigs[key] || ungatedLinkConfig(key));
      await api.put(linksRow.navLinksUrl, { nav_links });
      closeLinksModal();
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to save navigation links.');
    } finally {
      setLinksSubmitting(false);
    }
  };

  const navBySection = useMemo(() => {
    const grouped: Record<string, NavCatalogItem[]> = {};
    navCatalog.forEach((item) => {
      if (!grouped[item.section]) grouped[item.section] = [];
      grouped[item.section].push(item);
    });
    return grouped;
  }, [navCatalog]);

  const modalCopy = isEdit && modalKind ? editCopy[modalKind] : modalKind ? createCopy[modalKind] : null;

  const counts = useMemo(() => {
    let unitCount = 0;
    let subunitCount = 0;
    tree.forEach((d) => {
      unitCount += d.units.length;
      d.units.forEach((u) => { subunitCount += u.subunits.length; });
    });
    return { departments: tree.length, units: unitCount, subunits: subunitCount };
  }, [tree]);

  const missingHeads = useMemo(() => {
    const missing: string[] = [];
    tree.forEach((d) => {
      if (d.needs_hod) missing.push(`${d.name} needs a head of department`);
      d.units.forEach((u) => {
        if (u.needs_unit_head) missing.push(`${d.name} › ${u.name} has subunits and needs a unit head`);
      });
    });
    return missing;
  }, [tree]);

  const columns: ColumnsType<TreeRow> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Head',
      key: 'head',
      width: 200,
      render: (_, row) => {
        if (row.kind === 'subunit') return <span className="text-slate-400">—</span>;
        if (row.needs_head) return <Tag color="warning">Unassigned</Tag>;
        return row.head_label || <span className="text-slate-400">—</span>;
      },
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 130,
      filters: [
        { text: 'Department', value: 'Department' },
        { text: 'Unit', value: 'Unit' },
        { text: 'Subunit', value: 'Subunit' },
      ],
      onFilter: (value, record) => record.level === value,
      render: (level: TreeRow['level']) => <Tag color={levelColors[level]}>{level}</Tag>,
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Links',
      dataIndex: 'nav_keys',
      key: 'nav_keys',
      width: 120,
      render: (keys: string[], row) => {
        const inherited = row.inherited_nav_keys?.length || 0;
        if (!inherited) return <Tag>{keys.length}</Tag>;
        return <Tag>{keys.length} +{inherited}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 110,
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.active === value,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      align: 'right',
      render: (_, row) => (
        <Space size="small" wrap>
          <Button type="text" icon={<Link2 size={14} />} size="small" onClick={() => openLinksModal(row)}>
            Links
          </Button>
          <Button type="text" icon={<Pencil size={14} />} size="small" onClick={() => openEditModal(row)}>
            Edit
          </Button>
          <ConfirmDeleteButton onConfirm={() => remove(row.deleteUrl)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Office setup"
        description="Build the administrative org chart (departments, units, subunits). Use Links on each row to choose which staff-portal menu items people in that office see — then assign staff to an office on the Users page."
      >
        <Space wrap>
          <RefreshButton onClick={load} loading={loading} />
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openCreateModal('department')}>
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={14} />
              Department
            </span>
          </Button>
          <Button icon={<Plus size={14} />} onClick={() => openCreateModal('unit')} disabled={!tree.length}>
            <span className="inline-flex items-center gap-1.5">
              <Layers size={14} />
              Unit
            </span>
          </Button>
          <Button icon={<Plus size={14} />} onClick={() => openCreateModal('subunit')} disabled={!units.length}>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch size={14} />
              Subunit
            </span>
          </Button>
        </Space>
      </PageHeader>

      {error && !modalKind && !linksRow && (
        <Alert type="error" message={error} showIcon closable onClose={() => setError('')} />
      )}
      {missingHeads.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Heads still needed"
          description={
            <ul className="list-disc pl-4 mt-1 text-sm">
              {missingHeads.map((item) => <li key={item}>{item}</li>)}
            </ul>
          }
        />
      )}

      <OfficeStructureCards
        departments={counts.departments}
        units={counts.units}
        subunits={counts.subunits}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table<TreeRow>
          rowKey="key"
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={false}
          defaultExpandAllRows
          indentSize={20}
          scroll={{ x: 720 }}
          locale={{ emptyText: 'No office structure yet. Create a department to get started.' }}
          size="middle"
        />
      </div>

      <Modal
        title={modalCopy?.title}
        open={modalKind !== null}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText={isEdit ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnHidden
        width={480}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        {modalCopy && (
          <p className="text-slate-500 text-sm mb-4">{modalCopy.description}</p>
        )}
        {error && modalKind && (
          <Alert type="error" message={error} showIcon className="mb-4" />
        )}
        <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
          {modalKind === 'unit' && (
            <Form.Item
              name="office_department_id"
              label="Department"
              rules={[{ required: true, message: 'Select a department' }]}
            >
              <Select
                placeholder="Select department"
                options={tree.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          )}
          {modalKind === 'subunit' && (
            <Form.Item
              name="office_unit_id"
              label="Unit"
              rules={[{ required: true, message: 'Select a unit' }]}
            >
              <Select
                placeholder="Select unit"
                options={units.map((u) => ({
                  value: u.id,
                  label: `${u.departmentName} › ${u.name}`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Enter name" />
          </Form.Item>
          {(modalKind === 'department' || modalKind === 'unit') && (
            <Form.Item
              name="head_staff_id"
              label={modalKind === 'department' ? 'Head of department' : 'Unit head'}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select staff (must already work in this office)"
                options={staffOptions}
              />
            </Form.Item>
          )}
          <Form.Item name="code" label="Code">
            <Input placeholder="Optional code" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          {isEdit && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={linksRow ? `Portal links — ${linksRow.name}` : 'Portal links'}
        open={linksRow !== null}
        onCancel={closeLinksModal}
        onOk={saveNavLinks}
        okText="Save links"
        confirmLoading={linksSubmitting}
        destroyOnHidden
        width={640}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        <p className="text-slate-500 text-sm mb-4">
          Choose which staff-portal sidebar links appear for people who <strong>work in</strong> this {linksRow?.level.toLowerCase()}.
          Units and subunits automatically inherit links assigned on the parent department (and subunits inherit unit links). Role permissions still control what they can do.
          Modules with gated actions start as <strong>no approval</strong> — tick the gear to require Create/Update/Delete approval when needed.
          {' '}<strong>Super Admin accounts ignore office link limits</strong> and only need the matching role permission.
        </p>
        {error && linksRow && (
          <Alert type="error" message={error} showIcon className="mb-4" />
        )}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {Object.entries(navBySection).map(([section, items]) => (
            <div key={section}>
              <Divider orientation="left" className="!my-2 !text-xs !text-slate-500">
                {section}
              </Divider>
              <div className="grid sm:grid-cols-2 gap-2">
                {items.map((item) => {
                  const inherited = !!linksRow?.inherited_nav_keys.includes(item.key)
                    && !selectedNavKeys.includes(item.key);
                  const checked = selectedNavKeys.includes(item.key) || inherited;
                  const cfg = navLinkConfigs[item.key];
                  return (
                    <div key={item.key} className="flex items-start gap-1">
                      <Checkbox
                        checked={checked}
                        disabled={inherited}
                        onChange={(e) => toggleNavKey(item.key, e.target.checked)}
                      >
                        <span className="inline-flex flex-col">
                          <span>
                            {item.label}
                            {inherited && (
                              <Typography.Text type="secondary" className="text-[11px] ml-1">
                                (inherited)
                              </Typography.Text>
                            )}
                          </span>
                          {checked && !inherited && item.has_approval_actions && cfg && (
                            <span className="text-[11px] text-slate-500 font-normal">{methodHint(cfg)}</span>
                          )}
                        </span>
                      </Checkbox>
                      {checked && !inherited && item.has_approval_actions && (
                        <Button
                          type="text"
                          size="small"
                          className="!px-1"
                          icon={<Settings2 size={14} />}
                          onClick={() => openApprovalConfig(item.key)}
                          aria-label={`Configure approval for ${item.label}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Assigned here: {selectedNavKeys.length}
          {linksRow && linksRow.inherited_nav_keys.length > 0
            ? ` · Inherited: ${linksRow.inherited_nav_keys.filter((k) => !selectedNavKeys.includes(k)).length}`
            : ''}
        </p>
      </Modal>

      <Modal
        title={approvalDraftKey ? `Approval — ${catalogItem(approvalDraftKey)?.label || approvalDraftKey}` : 'Approval settings'}
        open={!!approvalDraftKey && !!approvalDraft}
        onCancel={cancelApprovalConfig}
        onOk={confirmApprovalConfig}
        okText="Apply"
        destroyOnHidden
        width={480}
      >
        {approvalDraft && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Typography.Text strong className="block">Require office approval</Typography.Text>
                  <p className="text-xs text-slate-500 mt-1 mb-0">
                    Off = staff with permission act immediately. On = pick which mutations need a reviewer.
                  </p>
                </div>
                <Switch
                  checked={linkRequiresApproval(approvalDraft)}
                  onChange={(checked) => {
                    if (checked) {
                      setApprovalDraft({
                        ...approvalDraft,
                        require_create: true,
                        require_update: true,
                        require_delete: true,
                      });
                      return;
                    }
                    setApprovalDraft({
                      ...approvalDraft,
                      require_create: false,
                      require_update: false,
                      require_delete: false,
                    });
                  }}
                />
              </div>
            </div>

            {linkRequiresApproval(approvalDraft) ? (
              <>
                <div>
                  <Typography.Text strong className="block mb-2">Require approval for</Typography.Text>
                  <Space direction="vertical">
                    <Checkbox
                      checked={approvalDraft.require_create}
                      onChange={(e) => setApprovalDraft({ ...approvalDraft, require_create: e.target.checked })}
                    >
                      Create (POST)
                    </Checkbox>
                    <Checkbox
                      checked={approvalDraft.require_update}
                      onChange={(e) => setApprovalDraft({ ...approvalDraft, require_update: e.target.checked })}
                    >
                      Update (includes workflow actions)
                    </Checkbox>
                    <Checkbox
                      checked={approvalDraft.require_delete}
                      onChange={(e) => setApprovalDraft({ ...approvalDraft, require_delete: e.target.checked })}
                    >
                      Delete
                    </Checkbox>
                  </Space>
                </div>
                <div>
                  <Typography.Text strong className="block mb-2">Who must approve?</Typography.Text>
                  <Radio.Group
                    value={approvalDraft.approval_chain}
                    onChange={(e) => setApprovalDraft({ ...approvalDraft, approval_chain: e.target.value })}
                    className="flex flex-col gap-2"
                  >
                    <Radio value="unit_head">Unit head only</Radio>
                    <Radio value="department_head">Department head only</Radio>
                    <Radio value="both">Both (unit head → department head)</Radio>
                  </Radio.Group>
                  <p className="text-xs text-slate-500 mt-2 mb-0">
                    When both are required, the department head may still approve earlier by seniority.
                  </p>
                </div>
              </>
            ) : (
              <Alert
                type="info"
                showIcon
                message="No approval required"
                description="People in this office can use the module immediately when their role has the matching permission."
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
