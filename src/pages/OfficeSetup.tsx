import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
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
import { Building2, GitBranch, Layers, Link2, Pencil, Plus } from 'lucide-react';
import api from '../api';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { RefreshButton } from '../components/RefreshButton';
import OfficeStructureCards from '../components/OfficeStructureCards';
import { PageHeader } from '../components/ui';

type Subunit = { id: number; name: string; code?: string; description?: string; is_active: boolean; nav_keys?: string[] };
type Unit = { id: number; name: string; code?: string; description?: string; is_active: boolean; nav_keys?: string[]; subunits: Subunit[] };
type Department = { id: number; name: string; code?: string; description?: string; is_active: boolean; nav_keys?: string[]; units: Unit[] };

type NavCatalogItem = { key: string; section: string; label: string; perm: string | null };

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
  navLinksUrl: string;
  children?: TreeRow[];
};

type FormValues = {
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  office_department_id?: number;
  office_unit_id?: number;
};

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
    navLinksUrl: `/api/office-departments/${d.id}/nav-links`,
    children: d.units.length
      ? d.units.map((u) => ({
          key: `u-${u.id}`,
          id: u.id,
          kind: 'unit',
          level: 'Unit',
          name: u.name,
          code: u.code || '—',
          description: u.description,
          active: u.is_active,
          office_department_id: d.id,
          updateUrl: `/api/office-units/${u.id}`,
          deleteUrl: `/api/office-units/${u.id}`,
          deleteMessage: 'Delete this unit and all its subunits?',
          nav_keys: u.nav_keys || [],
          navLinksUrl: `/api/office-units/${u.id}/nav-links`,
          children: u.subunits.length
            ? u.subunits.map((s) => ({
                key: `s-${s.id}`,
                id: s.id,
                kind: 'subunit',
                level: 'Subunit',
                name: s.name,
                code: s.code || '—',
                description: s.description,
                active: s.is_active,
                office_unit_id: u.id,
                updateUrl: `/api/office-subunits/${s.id}`,
                deleteUrl: `/api/office-subunits/${s.id}`,
                deleteMessage: 'Delete this subunit?',
                nav_keys: s.nav_keys || [],
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
  const [navCatalog, setNavCatalog] = useState<NavCatalogItem[]>([]);
  const [selectedNavKeys, setSelectedNavKeys] = useState<string[]>([]);
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
  };

  const closeLinksModal = () => {
    setLinksRow(null);
    setSelectedNavKeys([]);
  };

  const saveNavLinks = async () => {
    if (!linksRow) return;
    setLinksSubmitting(true);
    setError('');
    try {
      await api.put(linksRow.navLinksUrl, { nav_keys: selectedNavKeys });
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

  const columns: ColumnsType<TreeRow> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
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
      width: 90,
      render: (keys: string[]) => <Tag>{keys.length}</Tag>,
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
        width={560}
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        <p className="text-slate-500 text-sm mb-4">
          Choose which staff-portal sidebar links appear for people who <strong>work in</strong> this {linksRow?.level.toLowerCase()}. This does not assign staff — do that on Users → Works in.
          {' '}<strong>Super Admin accounts ignore office link limits</strong> and only need the matching role permission. Other staff need both the portal link ticked here and the resource permission (for example <code className="text-xs bg-slate-100 px-1 rounded">academic.departments.manage</code>).
        </p>
        {error && linksRow && (
          <Alert type="error" message={error} showIcon className="mb-4" />
        )}
        <Checkbox.Group
          className="w-full"
          value={selectedNavKeys}
          onChange={(values) => setSelectedNavKeys(values as string[])}
        >
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {Object.entries(navBySection).map(([section, items]) => (
              <div key={section}>
                <Divider orientation="left" className="!my-2 !text-xs !text-slate-500">
                  {section}
                </Divider>
                <div className="grid sm:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <Checkbox key={item.key} value={item.key}>
                      {item.label}
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Checkbox.Group>
        <p className="text-xs text-slate-500 mt-4">
          Selected: {selectedNavKeys.length} link{selectedNavKeys.length === 1 ? '' : 's'}
        </p>
      </Modal>
    </div>
  );
}
