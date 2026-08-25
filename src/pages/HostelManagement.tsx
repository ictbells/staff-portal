import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Dropdown, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BedDouble, Building2, ClipboardList, Download, FileSpreadsheet, FileText, Layers, Plus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { RefreshButton } from '../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../components/ui';
import { formatNaira } from '../lib/money';
import { CatalogImportPanel } from './academic/CatalogImportPanel';

type HostelBlockRow = {
  id: number;
  name: string;
  rooms_count?: number;
  rooms?: { id: number; number: string; beds: { id: number; label: string; status: string }[] }[];
};

type HostelCategory = 'undergraduate' | 'jupeb' | 'postgraduate';

type HostelRow = {
  id: number;
  name: string;
  gender: string;
  category: HostelCategory;
  is_active: boolean;
  due_required?: boolean;
  due_amount?: number | null;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  blocks?: HostelBlockRow[];
};

type LevelWindow = {
  academic_level_id: number;
  level_name: string;
  level_code: string;
  sort_order: number;
  is_active: boolean;
};

type QueueStudent = {
  id: number;
  name: string;
  matric_number?: string;
  current_level: number;
  priority: string;
  gender?: string;
  program?: string;
};

type AllocationRow = {
  id: number;
  status: string;
  student_name?: string;
  matric_number?: string;
  student_level?: number;
  program?: string;
  hostel_name?: string;
  hostel_category?: string;
  block_name?: string;
  bed_label?: string;
  room_number?: string;
  allocated_at?: string;
};

type RoomRow = {
  id: number;
  number: string;
  capacity: number;
  gender?: string | null;
  is_active: boolean;
  is_reserved: boolean;
  reserve_note?: string | null;
  hostel_id?: number;
  hostel_name?: string;
  hostel_gender?: string;
  hostel_category?: string;
  block_name?: string;
  bed_count: number;
  occupied_beds: number;
  available_beds: number;
  effective_gender?: string | null;
  gender_label?: string;
  beds?: { id: number; label: string; status: string }[];
};

const categoryLabels: Record<string, string> = {
  undergraduate: 'Undergraduate',
  jupeb: 'JUPEB',
  postgraduate: 'Postgraduate',
};

const categoryColors: Record<string, string> = {
  undergraduate: 'blue',
  jupeb: 'purple',
  postgraduate: 'geekblue',
};

const categoryOptions = [
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'jupeb', label: 'JUPEB' },
  { value: 'postgraduate', label: 'Postgraduate' },
];

const hostelTabs: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'hostels', label: 'Hostels', icon: Building2 },
  { key: 'rooms', label: 'Rooms', icon: BedDouble },
  { key: 'levels', label: 'Level activation', icon: Layers },
  { key: 'queue', label: 'Priority queue', icon: Users },
  { key: 'allocations', label: 'Allocations', icon: ClipboardList },
];

function CategoryTag({ category }: { category: string }) {
  return <Tag color={categoryColors[category] || 'default'}>{categoryLabels[category] || category}</Tag>;
}

function firstApiError(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (first) return String(first);
  }
  return data?.message || fallback;
}

export default function HostelManagement() {
  const { has } = useAuth();
  const canManage = has('hostel.manage');
  const canAllocate = has('hostel.allocate');

  const [overview, setOverview] = useState<any>(null);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [ugWindows, setUgWindows] = useState<LevelWindow[]>([]);
  const [jupebWindows, setJupebWindows] = useState<LevelWindow[]>([]);
  const [pgWindows, setPgWindows] = useState<LevelWindow[]>([]);
  const [queue, setQueue] = useState<QueueStudent[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [allocSearch, setAllocSearch] = useState('');
  const [allocHostelId, setAllocHostelId] = useState<number | undefined>();
  const [allocCategory, setAllocCategory] = useState<string | undefined>();
  const [allocStatus, setAllocStatus] = useState<string | undefined>();
  const [exportingAllocations, setExportingAllocations] = useState(false);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomHostelFilter, setRoomHostelFilter] = useState<number | undefined>();
  const [queueCategory, setQueueCategory] = useState<HostelCategory>('undergraduate');
  const [tab, setTab] = useState('hostels');
  const [availableBeds, setAvailableBeds] = useState<{ id: number; label: string; hostel: string; category: string; room: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [savingWindows, setSavingWindows] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [editRoomOpen, setEditRoomOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [editingHostel, setEditingHostel] = useState<HostelRow | null>(null);
  const [editingBlock, setEditingBlock] = useState<HostelBlockRow | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [reservingRoom, setReservingRoom] = useState<RoomRow | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);
  const [form] = Form.useForm();
  const [blockForm] = Form.useForm();
  const [roomForm] = Form.useForm();
  const [editRoomForm] = Form.useForm();
  const [reserveForm] = Form.useForm();

  const loadRooms = useCallback(async (hostelId?: number) => {
    const { data } = await api.get('/api/hostel-rooms', {
      params: hostelId ? { hostel_id: hostelId } : undefined,
    });
    setRooms(data);
  }, []);

  const loadHostelsAndStats = useCallback(async () => {
    const [overviewRes, hostelsRes] = await Promise.all([
      api.get('/api/hostels/overview'),
      api.get('/api/hostels'),
    ]);
    setOverview(overviewRes.data);
    setHostels(hostelsRes.data);
  }, []);

  const loadWindows = useCallback(async () => {
    const [ugRes, jupebRes, pgRes] = await Promise.all([
      api.get('/api/hostel-level-windows', { params: { category: 'undergraduate' } }),
      api.get('/api/hostel-level-windows', { params: { category: 'jupeb' } }),
      api.get('/api/hostel-level-windows', { params: { category: 'postgraduate' } }),
    ]);
    setUgWindows(ugRes.data);
    setJupebWindows(jupebRes.data);
    setPgWindows(pgRes.data);
  }, []);

  const allocationParams = useCallback(() => ({
    search: allocSearch.trim() || undefined,
    hostel_id: allocHostelId,
    category: allocCategory,
    status: allocStatus,
  }), [allocSearch, allocHostelId, allocCategory, allocStatus]);

  const loadAllocations = useCallback(async () => {
    const { data } = await api.get('/api/hostel-allocations', { params: allocationParams() });
    setAllocations(data);
  }, [allocationParams]);

  const loadAvailableBeds = useCallback(async (category?: HostelCategory) => {
    const { data } = await api.get('/api/hostel-beds', {
      params: category ? { category } : undefined,
    });
    setAvailableBeds(data);
  }, []);

  const loadQueue = useCallback(async (category: HostelCategory) => {
    const { data } = await api.get('/api/hostel-queue', { params: { category } });
    setQueue(data);
  }, []);

  const loadTabData = useCallback(async (key: string) => {
    if (key === 'rooms') {
      await loadRooms(roomHostelFilter);
      return;
    }
    if (key === 'levels') {
      await loadWindows();
      return;
    }
    if (key === 'queue') {
      await Promise.all([loadQueue(queueCategory), loadAvailableBeds(queueCategory)]);
      return;
    }
    if (key === 'allocations') {
      await loadAllocations();
    }
  }, [loadAllocations, loadAvailableBeds, loadQueue, loadRooms, loadWindows, queueCategory, roomHostelFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadHostelsAndStats();
      await loadTabData(tab);
    } finally {
      setLoading(false);
    }
  }, [loadHostelsAndStats, loadTabData, tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadHostelsAndStats().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadHostelsAndStats]);

  useEffect(() => {
    let cancelled = false;
    setTabLoading(true);
    loadTabData(tab).finally(() => {
      if (!cancelled) setTabLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadTabData, tab]);

  const refreshAfterChange = useCallback(async () => {
    await loadHostelsAndStats();
    await loadTabData(tab);
  }, [loadHostelsAndStats, loadTabData, tab]);

  const saveWindows = async (category: HostelCategory, levels: LevelWindow[]) => {
    setSavingWindows(true);
    try {
      const { data } = await api.put('/api/hostel-level-windows', {
        category,
        levels: levels.map((row) => ({
          academic_level_id: row.academic_level_id,
          is_active: row.is_active,
        })),
      });
      if (category === 'undergraduate') setUgWindows(data);
      else if (category === 'jupeb') setJupebWindows(data);
      else setPgWindows(data);
      message.success(`${categoryLabels[category]} level settings saved.`);
      await loadQueue(queueCategory);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to save level settings.');
    } finally {
      setSavingWindows(false);
    }
  };

  const toggleLevel = (category: HostelCategory, levelId: number, active: boolean) => {
    const setter = category === 'undergraduate'
      ? setUgWindows
      : category === 'jupeb'
        ? setJupebWindows
        : setPgWindows;
    const current = category === 'undergraduate'
      ? ugWindows
      : category === 'jupeb'
        ? jupebWindows
        : pgWindows;
    setter(current.map((row) => (row.academic_level_id === levelId ? { ...row, is_active: active } : row)));
  };

  const allocateBed = async (studentId: number, bedId: number) => {
    try {
      await api.post('/api/hostel-allocations', { student_id: studentId, hostel_bed_id: bedId });
      message.success('Bed allocated.');
      await refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Allocation failed.');
    }
  };

  const autoAllocate = async (bedId: number, category: HostelCategory) => {
    try {
      await api.post('/api/hostel-allocations/auto', { hostel_bed_id: bedId, category });
      message.success('Next priority student allocated.');
      await refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Auto allocation failed.');
    }
  };

  const vacate = async (allocationId: number) => {
    try {
      await api.post(`/api/hostel-allocations/${allocationId}/vacate`);
      message.success('Bed vacated.');
      setAllocations((prev) => prev.map((row) => (
        row.id === allocationId ? { ...row, status: 'vacated' } : row
      )));
      void refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to vacate bed.');
    }
  };

  const approveAllocation = async (allocationId: number) => {
    try {
      const { data } = await api.post(`/api/hostel-allocations/${allocationId}/approve`);
      message.success('Bed request approved.');
      setAllocations((prev) => prev.map((row) => (row.id === allocationId ? { ...row, ...data } : row)));
      void refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to approve request.');
    }
  };

  const rejectAllocation = async (allocationId: number) => {
    try {
      const { data } = await api.post(`/api/hostel-allocations/${allocationId}/reject`);
      message.success('Bed request rejected.');
      setAllocations((prev) => prev.map((row) => (row.id === allocationId ? { ...row, ...data } : row)));
      void refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to reject request.');
    }
  };

  const downloadAllocations = async (format: 'pdf' | 'excel' | 'word') => {
    setExportingAllocations(true);
    try {
      const { data } = await api.get('/api/hostel-allocations/export', {
        params: { format, ...allocationParams() },
        responseType: 'blob',
      });
      const mime = format === 'pdf'
        ? 'application/pdf'
        : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx';
      const blob = new Blob([data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hostel-allocations-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Download started (${format === 'word' ? 'Word' : format.toUpperCase()}).`);
    } catch (err: any) {
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try {
          message.error(JSON.parse(await blob.text()).message || 'Unable to download allocations.');
        } catch {
          message.error('Unable to download allocations.');
        }
      } else {
        message.error(err.response?.data?.message || 'Unable to download allocations.');
      }
    } finally {
      setExportingAllocations(false);
    }
  };

  const downloadMenu: MenuProps['items'] = [
    { key: 'pdf', icon: <FileText size={14} />, label: 'PDF', onClick: () => downloadAllocations('pdf') },
    { key: 'excel', icon: <FileSpreadsheet size={14} />, label: 'Excel (.xlsx)', onClick: () => downloadAllocations('excel') },
    { key: 'word', icon: <FileText size={14} />, label: 'MS Word (.docx)', onClick: () => downloadAllocations('word') },
  ];

  const openCreateHostel = () => {
    setEditingHostel(null);
    form.resetFields();
    form.setFieldsValue({ category: 'undergraduate', gender: 'mixed', is_active: true, due_required: false });
    setCreateOpen(true);
  };

  const openEditHostel = (row: HostelRow) => {
    setEditingHostel(row);
    form.setFieldsValue({
      name: row.name,
      category: row.category,
      gender: row.gender || 'mixed',
      is_active: row.is_active,
      due_required: !!row.due_required,
      due_amount: row.due_amount ?? undefined,
    });
    setCreateOpen(true);
  };

  const saveHostel = async (values: {
    name: string;
    gender: string;
    category: string;
    is_active?: boolean;
    due_required?: boolean;
    due_amount?: number;
  }) => {
    setCreating(true);
    const payload = {
      ...values,
      due_required: !!values.due_required,
      due_amount: values.due_required ? values.due_amount : null,
    };
    try {
      if (editingHostel) {
        await api.patch(`/api/hostels/${editingHostel.id}`, payload);
        message.success('Hostel updated.');
      } else {
        await api.post('/api/hostels', { ...payload, is_active: values.is_active ?? true });
        message.success('Hostel created.');
      }
      setCreateOpen(false);
      setEditingHostel(null);
      form.resetFields();
      await refreshAfterChange();
    } catch (err: unknown) {
      message.error(firstApiError(err, editingHostel ? 'Unable to update hostel.' : 'Unable to create hostel.'));
    } finally {
      setCreating(false);
    }
  };

  const removeHostel = async (row: HostelRow) => {
    try {
      await api.delete(`/api/hostels/${row.id}`);
      message.success('Hostel deleted.');
      setHostels((prev) => prev.filter((hostel) => hostel.id !== row.id));
      void refreshAfterChange();
    } catch (err: unknown) {
      message.error(firstApiError(err, 'Unable to delete hostel.'));
    }
  };

  const openCreateBlock = (hostelId: number) => {
    setSelectedHostelId(hostelId);
    setEditingBlock(null);
    blockForm.resetFields();
    setBlockOpen(true);
  };

  const openEditBlock = (block: HostelBlockRow, hostelId: number) => {
    setSelectedHostelId(hostelId);
    setEditingBlock(block);
    blockForm.setFieldsValue({ name: block.name });
    setBlockOpen(true);
  };

  const saveBlock = async (values: { name: string }) => {
    if (!editingBlock && !selectedHostelId) return;
    setSavingRoom(true);
    try {
      if (editingBlock) {
        await api.patch(`/api/hostel-blocks/${editingBlock.id}`, values);
        message.success('Block updated.');
      } else {
        await api.post(`/api/hostels/${selectedHostelId}/blocks`, values);
        message.success('Block added.');
      }
      setBlockOpen(false);
      setEditingBlock(null);
      blockForm.resetFields();
      await refreshAfterChange();
    } catch (err: unknown) {
      message.error(firstApiError(err, editingBlock ? 'Unable to update block.' : 'Unable to add block.'));
    } finally {
      setSavingRoom(false);
    }
  };

  const removeBlock = async (block: HostelBlockRow) => {
    try {
      await api.delete(`/api/hostel-blocks/${block.id}`);
      message.success('Block deleted.');
      setHostels((prev) => prev.map((hostel) => ({
        ...hostel,
        blocks: hostel.blocks?.filter((item) => item.id !== block.id),
      })));
      void refreshAfterChange();
    } catch (err: unknown) {
      message.error(firstApiError(err, 'Unable to delete block.'));
    }
  };

  const removeRoom = async (room: RoomRow) => {
    try {
      await api.delete(`/api/hostel-rooms/${room.id}`);
      message.success('Room deleted.');
      setRooms((prev) => prev.filter((item) => item.id !== room.id));
      void refreshAfterChange();
    } catch (err: unknown) {
      message.error(firstApiError(err, 'Unable to delete room.'));
    }
  };

  const createRoom = async (values: { number: string; capacity: number; gender?: string; hostel_block_id?: number }) => {
    const blockId = values.hostel_block_id || selectedBlockId;
    if (!blockId) return;
    setSavingRoom(true);
    try {
      await api.post(`/api/hostel-blocks/${blockId}/rooms`, {
        number: values.number,
        capacity: values.capacity,
        gender: values.gender,
      });
      message.success('Room added.');
      setRoomOpen(false);
      roomForm.resetFields();
      await refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to add room.');
    } finally {
      setSavingRoom(false);
    }
  };

  const openEditRoom = (room: RoomRow) => {
    setEditingRoom(room);
    editRoomForm.setFieldsValue({
      number: room.number,
      capacity: room.capacity,
      gender: room.gender || undefined,
    });
    setEditRoomOpen(true);
  };

  const saveRoomEdit = async (values: { number: string; capacity: number; gender?: string }) => {
    if (!editingRoom) return;
    setSavingRoom(true);
    try {
      await api.patch(`/api/hostel-rooms/${editingRoom.id}`, {
        ...values,
        gender: values.gender || null,
      });
      message.success('Room updated.');
      setEditRoomOpen(false);
      setEditingRoom(null);
      await refreshAfterChange();
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      const firstError = errors ? Object.values(errors).flat()[0] : null;
      message.error(firstError || err.response?.data?.message || 'Unable to update room.');
    } finally {
      setSavingRoom(false);
    }
  };

  const reserveRoom = async (values: { reserve_note?: string }) => {
    if (!reservingRoom) return;
    setSavingRoom(true);
    try {
      await api.post(`/api/hostel-rooms/${reservingRoom.id}/reserve`, values);
      message.success('Room reserved.');
      setReserveOpen(false);
      setReservingRoom(null);
      reserveForm.resetFields();
      await refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to reserve room.');
    } finally {
      setSavingRoom(false);
    }
  };

  const releaseRoom = async (roomId: number) => {
    try {
      await api.post(`/api/hostel-rooms/${roomId}/release`);
      message.success('Reservation released.');
      await refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to release room.');
    }
  };

  const toggleRoomActive = async (room: RoomRow, active: boolean) => {
    try {
      await api.post(`/api/hostel-rooms/${room.id}/${active ? 'enable' : 'disable'}`);
      message.success(active ? 'Room enabled.' : 'Room disabled.');
      await refreshAfterChange();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to update room status.');
    }
  };

  const hostelColumns: ColumnsType<HostelRow> = [
    { title: 'Hostel', dataIndex: 'name', key: 'name', render: (name: string) => <span className="font-medium">{name}</span> },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c: string) => <CategoryTag category={c} /> },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', render: (g: string) => g || '—' },
    {
      title: 'Due',
      key: 'due',
      render: (_, row) => (
        row.due_required && Number(row.due_amount) > 0
          ? formatNaira(row.due_amount)
          : 'In tuition'
      ),
    },
    { title: 'Beds', key: 'beds', render: (_, row) => `${row.available_beds} free / ${row.total_beds} total` },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => (
        canManage ? (
          <Space size="small" wrap>
            <Button size="small" onClick={() => openEditHostel(row)}>Edit</Button>
            <Button size="small" onClick={() => openCreateBlock(row.id)}>Add block</Button>
            {row.blocks && row.blocks.length > 0 && (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  setSelectedHostelId(row.id);
                  setSelectedBlockId(row.blocks![0].id);
                  roomForm.resetFields();
                  roomForm.setFieldsValue({ capacity: 4, hostel_block_id: row.blocks![0].id });
                  setRoomOpen(true);
                }}
              >
                Add room
              </Button>
            )}
            <ConfirmDeleteButton
              title={`Delete ${row.name}?`}
              description="Empty blocks, rooms, and beds will also be removed. Occupied hostels cannot be deleted."
              onConfirm={() => removeHostel(row)}
            />
          </Space>
        ) : null
      ),
    },
  ];

  const roomColumns: ColumnsType<RoomRow> = [
    { title: 'Hostel', dataIndex: 'hostel_name', key: 'hostel_name' },
    { title: 'Block', dataIndex: 'block_name', key: 'block_name', render: (v?: string) => v || '—' },
    { title: 'Room', dataIndex: 'number', key: 'number', render: (n: string) => <span className="font-medium">{n}</span> },
    {
      title: 'Spaces',
      key: 'capacity',
      render: (_, row) => `${row.occupied_beds} occupied / ${row.capacity} spaces`,
    },
    {
      title: 'Room gender',
      key: 'gender',
      render: (_, row) => (
        row.hostel_gender === 'mixed'
          ? <Tag color={row.effective_gender ? (row.effective_gender === 'female' ? 'magenta' : 'blue') : 'default'}>{row.gender_label}</Tag>
          : <Tag>{row.hostel_gender || '—'}</Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, row) => (
        <Space size={[4, 4]} wrap>
          {!row.is_active && <Tag color="default">Disabled</Tag>}
          {row.is_reserved && <Tag color="orange">Reserved</Tag>}
          {row.is_active && !row.is_reserved && <Tag color="success">Open</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => (
        canManage ? (
          <Space size="small" wrap>
            <Button size="small" onClick={() => openEditRoom(row)}>Edit</Button>
            {row.is_reserved ? (
              <Button size="small" onClick={() => releaseRoom(row.id)}>Release</Button>
            ) : (
              <Button size="small" onClick={() => { setReservingRoom(row); reserveForm.resetFields(); setReserveOpen(true); }}>Reserve</Button>
            )}
            <Switch
              size="small"
              checked={row.is_active}
              checkedChildren="On"
              unCheckedChildren="Off"
              onChange={(checked) => toggleRoomActive(row, checked)}
            />
            <ConfirmDeleteButton
              title={`Delete room ${row.number}?`}
              description="Empty beds will also be removed. Occupied rooms cannot be deleted."
              onConfirm={() => removeRoom(row)}
            />
          </Space>
        ) : null
      ),
    },
  ];

  const queueColumns: ColumnsType<QueueStudent> = [
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (p: string, row) => (
      <Tag color={row.current_level === 100 ? 'gold' : 'default'}>{p}</Tag>
    ) },
    { title: 'Student', dataIndex: 'name', key: 'name' },
    { title: 'Matric', dataIndex: 'matric_number', key: 'matric_number', render: (v?: string) => v || '—' },
    { title: 'Programme', dataIndex: 'program', key: 'program', render: (v?: string) => v || '—' },
    {
      title: 'Allocate',
      key: 'actions',
      render: (_, row) => (
        canAllocate ? (
          <Select
            placeholder="Pick bed"
            className="min-w-[220px]"
            options={availableBeds
              .filter((bed) => bed.category === queueCategory)
              .map((bed) => ({
                value: bed.id,
                label: `${bed.hostel} · ${bed.room} · bed ${bed.label}`,
              }))}
            onChange={(bedId) => allocateBed(row.id, bedId)}
          />
        ) : null
      ),
    },
  ];

  const allocationColumns: ColumnsType<AllocationRow> = [
    { title: 'Student', dataIndex: 'student_name', key: 'student_name' },
    { title: 'Matric', dataIndex: 'matric_number', key: 'matric_number', render: (v?: string) => v || '—' },
    { title: 'Level', dataIndex: 'student_level', key: 'student_level', render: (l?: number) => (l ? `${l}L` : '—') },
    { title: 'Hostel', dataIndex: 'hostel_name', key: 'hostel_name' },
    { title: 'Category', dataIndex: 'hostel_category', key: 'hostel_category', render: (c?: string) => (c ? <CategoryTag category={c} /> : '—') },
    { title: 'Room / bed', key: 'bed', render: (_, row) => `${row.room_number || '—'} / ${row.bed_label || '—'}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'allocated' ? 'success' : s === 'pending' ? 'processing' : s === 'rejected' ? 'error' : 'default'}>
        {s}
      </Tag>
    ) },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => {
        if (!canAllocate) return null;
        if (row.status === 'pending') {
          return (
            <Space size="small">
              <Popconfirm
                title="Approve this bed request?"
                description="The student will be allocated this bed. A hostel due invoice is raised only if this hostel charges due."
                okText="Approve"
                cancelText="Cancel"
                onConfirm={() => { void approveAllocation(row.id); }}
              >
                <Button size="small" type="primary">Approve</Button>
              </Popconfirm>
              <Popconfirm
                title="Reject this bed request?"
                description="The bed will become available again and the student can pick another."
                okText="Reject"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => { void rejectAllocation(row.id); }}
              >
                <Button size="small" danger>Reject</Button>
              </Popconfirm>
            </Space>
          );
        }
        if (row.status === 'allocated') {
          return (
            <Popconfirm
              title="Vacate this bed?"
              description="The student will be removed from this room and the bed will become available."
              okText="Vacate"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={() => { void vacate(row.id); }}
            >
              <Button size="small" danger>Vacate</Button>
            </Popconfirm>
          );
        }
        return null;
      },
    },
  ];

  const levelTable = (category: HostelCategory, rows: LevelWindow[]) => (
    <div className="space-y-3">
      <Alert
        type="info"
        showIcon
        message={category === 'postgraduate'
          ? 'Year 1 postgraduate students are served first from the allocation queue. Activate only the levels that may apply for beds in this category.'
          : '100 Level students are served first from the allocation queue. Activate only the levels that may apply for beds in this category.'}
      />
      <Table
        rowKey="academic_level_id"
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
          { title: 'Level', dataIndex: 'level_name', key: 'level_name' },
          {
            title: 'Priority',
            key: 'priority',
            render: (_, row) => (
              row.level_code === '100' || row.level_code === 'Y1'
                ? <Tag color="gold">Highest</Tag>
                : <Tag>{row.level_code}</Tag>
            ),
          },
          {
            title: 'Open for allocation',
            key: 'active',
            render: (_, row) => (
              canManage ? (
                <Switch
                  checked={row.is_active}
                  onChange={(checked) => toggleLevel(category, row.academic_level_id, checked)}
                />
              ) : (
                <Tag color={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Open' : 'Closed'}</Tag>
              )
            ),
          },
        ]}
      />
      {canManage && (
        <Button type="primary" loading={savingWindows} onClick={() => saveWindows(category, rows)}>
          Save {categoryLabels[category]} levels
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Campus services"
        title="Hostel management"
        description="Undergraduate, JUPEB, and postgraduate hostels are managed separately. Student bed picks wait for staff approval. Open allocation by level — 100 Level / Year 1 has highest priority."
        icon={Building2}
      >
        <RefreshButton onClick={load} loading={loading || tabLoading} />
        {canManage && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreateHostel}>
            Add hostel
          </Button>
        )}
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Hostels"
          value={overview?.stats?.hostels ?? 0}
          hint="Undergraduate, JUPEB, and PG"
          icon={Building2}
          tone="sky"
          active={tab === 'hostels'}
          onClick={() => setTab('hostels')}
        />
        <StatCard
          label="Total beds"
          value={overview?.stats?.total_beds ?? 0}
          hint="All rooms combined"
          icon={BedDouble}
          tone="sky"
          active={tab === 'rooms'}
          onClick={() => setTab('rooms')}
        />
        <StatCard
          label="Available"
          value={overview?.stats?.available_beds ?? 0}
          hint="Free beds ready to assign"
          icon={BedDouble}
          tone="emerald"
          active={tab === 'queue'}
          onClick={() => setTab('queue')}
        />
        <StatCard
          label="Occupied"
          value={overview?.stats?.occupied_beds ?? 0}
          hint="Currently allocated"
          icon={Users}
          tone="amber"
          active={tab === 'allocations'}
          onClick={() => setTab('allocations')}
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {hostelTabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                active ? 'bg-sky-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'hostels' && (
              <Table<HostelRow>
                rowKey="id"
                loading={loading || (tab === 'hostels' && tabLoading)}
                columns={hostelColumns}
                dataSource={hostels}
                pagination={false}
                expandable={{
                  defaultExpandAllRows: true,
                  expandedRowRender: (hostel) => (
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={hostel.blocks || []}
                      locale={{ emptyText: 'No blocks yet. Add a block to this hostel.' }}
                      columns={[
                        { title: 'Block', dataIndex: 'name', key: 'name' },
                        { title: 'Rooms', key: 'rooms', render: (_: unknown, block: HostelBlockRow) => block.rooms_count ?? block.rooms?.length ?? 0 },
                        {
                          title: 'Actions',
                          key: 'actions',
                          render: (_: unknown, block: HostelBlockRow) => (
                            canManage ? (
                              <Space size="small">
                                <Button size="small" onClick={() => openEditBlock(block, hostel.id)}>Edit</Button>
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => {
                                    setSelectedHostelId(hostel.id);
                                    setSelectedBlockId(block.id);
                                    roomForm.resetFields();
                                    roomForm.setFieldsValue({ capacity: 4, hostel_block_id: block.id });
                                    setRoomOpen(true);
                                  }}
                                >
                                  Add room
                                </Button>
                                <ConfirmDeleteButton
                                  title={`Delete block ${block.name}?`}
                                  description="Empty rooms and beds in this block will also be removed. Occupied blocks cannot be deleted."
                                  onConfirm={() => removeBlock(block)}
                                />
                              </Space>
                            ) : null
                          ),
                        },
                      ]}
                    />
                  ),
                }}
                locale={{ emptyText: 'No hostels configured yet.' }}
              />
      )}

      {tab === 'rooms' && (
              <div className="space-y-4">
                <Alert
                  type="info"
                  showIcon
                  message="Set spaces via room capacity (beds are created automatically). Reserve a room to hold it off allocation. Disable a room to block all beds. In mixed hostels, room gender locks to the first occupant and clears when the room is empty."
                />
                {canManage && (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <CatalogImportPanel
                      templateUrl="/api/hostel-rooms/import-template"
                      templateFilename="hostel-room-import-template.xlsx"
                      importUrl="/api/hostel-rooms/import"
                      description="Upload Excel with columns: hostel_id, block_id, number, capacity, plus optional gender and is_active. Copy ids from the Hostels and Blocks lookup sheets. The block must belong to that hostel. Matching room numbers in the same block are skipped."
                      onImported={() => {
                        loadRooms(roomHostelFilter);
                        loadHostelsAndStats();
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    allowClear
                    placeholder="Filter by hostel"
                    className="min-w-[220px]"
                    value={roomHostelFilter}
                    onChange={(value) => setRoomHostelFilter(value)}
                    options={hostels.map((hostel) => ({
                      value: hostel.id,
                      label: hostel.name,
                    }))}
                  />
                </div>
                <Table<RoomRow>
                  rowKey="id"
                  loading={loading || (tab === 'rooms' && tabLoading)}
                  columns={roomColumns}
                  dataSource={rooms}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: 'No rooms yet. Add a block and room from the Hostels tab.' }}
                />
              </div>
      )}

      {tab === 'levels' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Undergraduate</h3>
                  {levelTable('undergraduate', ugWindows)}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">JUPEB</h3>
                  {levelTable('jupeb', jupebWindows)}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Postgraduate</h3>
                  {levelTable('postgraduate', pgWindows)}
                </div>
              </div>
      )}

      {tab === 'queue' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={queueCategory}
                    onChange={(value) => setQueueCategory(value)}
                    options={[
                      { value: 'undergraduate', label: 'Undergraduate queue' },
                      { value: 'jupeb', label: 'JUPEB queue' },
                      { value: 'postgraduate', label: 'Postgraduate queue' },
                    ]}
                    className="min-w-[200px]"
                  />
                  {canAllocate && availableBeds.filter((b) => b.category === queueCategory).length > 0 && (
                    <Select
                      placeholder="Auto-allocate next student to bed"
                      className="min-w-[280px]"
                      options={availableBeds
                        .filter((bed) => bed.category === queueCategory)
                        .map((bed) => ({
                          value: bed.id,
                          label: `${bed.hostel} · ${bed.room} · bed ${bed.label}`,
                        }))}
                      onChange={(bedId) => autoAllocate(bedId, queueCategory)}
                    />
                  )}
                </div>
                <Alert
                  type="warning"
                  showIcon
                  icon={<Users size={16} />}
                  message="Students are listed by level (100L first), then by registration order. Only students whose level is activated appear here."
                />
                <Table<QueueStudent>
                  rowKey="id"
                  loading={tab === 'queue' && tabLoading}
                  columns={queueColumns}
                  dataSource={queue}
                  pagination={false}
                  locale={{ emptyText: 'No eligible students. Activate a level or check category match.' }}
                />
              </div>
      )}

      {tab === 'allocations' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Input.Search
                    allowClear
                    className="min-w-[220px] max-w-xs flex-1"
                    placeholder="Name, matric, room, or hostel"
                    onSearch={(value) => setAllocSearch(value.trim())}
                  />
                  <Select
                    allowClear
                    placeholder="Hostel"
                    className="min-w-[180px]"
                    value={allocHostelId}
                    onChange={setAllocHostelId}
                    options={hostels.map((hostel) => ({ value: hostel.id, label: hostel.name }))}
                  />
                  <Select
                    allowClear
                    placeholder="Category"
                    className="min-w-[150px]"
                    value={allocCategory}
                    onChange={setAllocCategory}
                    options={categoryOptions}
                  />
                  <Select
                    allowClear
                    placeholder="Status"
                    className="min-w-[140px]"
                    value={allocStatus}
                    onChange={setAllocStatus}
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'allocated', label: 'Allocated' },
                      { value: 'vacated', label: 'Vacated' },
                      { value: 'rejected', label: 'Rejected' },
                    ]}
                  />
                  <Dropdown menu={{ items: downloadMenu }} trigger={['click']} disabled={exportingAllocations || loading}>
                    <Button icon={<Download size={14} />} loading={exportingAllocations}>
                      Download
                    </Button>
                  </Dropdown>
                </div>
                <Table<AllocationRow>
                  rowKey="id"
                  loading={loading || (tab === 'allocations' && tabLoading)}
                  columns={allocationColumns}
                  dataSource={allocations}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: 'No hostel allocations yet.' }}
                />
              </div>
      )}

      <Modal
        title={editingHostel ? 'Edit hostel' : 'Add hostel'}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); setEditingHostel(null); }}
        onOk={() => form.submit()}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={saveHostel} className="mt-4">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Queen Hall" />
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="undergraduate" rules={[{ required: true }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="gender" label="Gender" initialValue="mixed" rules={[{ required: true }]}>
            <Select options={[
              { value: 'mixed', label: 'Mixed' },
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
            ]} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
          <Form.Item
            name="due_required"
            label="Due required"
            valuePropName="checked"
            extra="Turn on only if students pay a separate hostel charge. Leave off when hostel is covered by tuition."
          >
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.due_required !== cur.due_required}>
            {({ getFieldValue }) => getFieldValue('due_required') ? (
              <Form.Item
                name="due_amount"
                label="Due amount (₦)"
                rules={[{ required: true, message: 'Enter the hostel due amount' }]}
              >
                <InputNumber min={1} precision={2} className="w-full" />
              </Form.Item>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingBlock ? 'Edit block' : 'Add block'}
        open={blockOpen}
        onCancel={() => { setBlockOpen(false); setEditingBlock(null); }}
        onOk={() => blockForm.submit()}
        confirmLoading={savingRoom}
        destroyOnHidden
      >
        <Form form={blockForm} layout="vertical" onFinish={saveBlock} className="mt-4">
          <Form.Item name="name" label="Block name" rules={[{ required: true, message: 'Block name is required' }]}>
            <Input placeholder="e.g. Block A" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add room"
        open={roomOpen}
        onCancel={() => setRoomOpen(false)}
        onOk={() => roomForm.submit()}
        confirmLoading={savingRoom}
        destroyOnHidden
      >
        <Form form={roomForm} layout="vertical" onFinish={createRoom} className="mt-4">
          {selectedHostelId && (
            <Form.Item name="hostel_block_id" label="Block" initialValue={selectedBlockId} rules={[{ required: true }]}>
              <Select
                options={hostels
                  .find((h) => h.id === selectedHostelId)
                  ?.blocks?.map((block) => ({ value: block.id, label: block.name })) || []}
                onChange={(value) => setSelectedBlockId(value)}
              />
            </Form.Item>
          )}
          <Form.Item name="number" label="Room number" rules={[{ required: true, message: 'Room number is required' }]}>
            <Input placeholder="e.g. 101" />
          </Form.Item>
          <Form.Item
            name="capacity"
            label="Spaces (bed capacity)"
            initialValue={4}
            rules={[{ required: true, message: 'Capacity is required' }]}
            extra="Each space becomes one bed. Changing capacity later adds or removes empty beds."
          >
            <InputNumber min={1} max={20} className="w-full" />
          </Form.Item>
          {hostels.find((h) => h.id === selectedHostelId)?.gender === 'mixed' && (
            <Form.Item name="gender" label="Fixed room gender (optional)" extra="Leave blank to lock gender when the first student is allocated.">
              <Select
                allowClear
                placeholder="Unassigned until first allocation"
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={`Edit room ${editingRoom?.number || ''}`}
        open={editRoomOpen}
        onCancel={() => { setEditRoomOpen(false); setEditingRoom(null); }}
        onOk={() => editRoomForm.submit()}
        confirmLoading={savingRoom}
        destroyOnHidden
      >
        <Form form={editRoomForm} layout="vertical" onFinish={saveRoomEdit} className="mt-4">
          <Form.Item name="number" label="Room number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="capacity"
            label="Spaces (bed capacity)"
            rules={[{ required: true }]}
            extra="Cannot be set below the number of occupied beds."
          >
            <InputNumber min={1} max={20} className="w-full" />
          </Form.Item>
          {editingRoom?.hostel_gender === 'mixed' && (
            <Form.Item name="gender" label="Fixed room gender (optional)">
              <Select
                allowClear
                placeholder="Unassigned until first allocation"
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={`Reserve room ${reservingRoom?.number || ''}`}
        open={reserveOpen}
        onCancel={() => { setReserveOpen(false); setReservingRoom(null); }}
        onOk={() => reserveForm.submit()}
        confirmLoading={savingRoom}
        destroyOnHidden
      >
        <Form form={reserveForm} layout="vertical" onFinish={reserveRoom} className="mt-4">
          <Alert
            type="warning"
            showIcon
            className="mb-4"
            message="Reserved rooms cannot receive new allocations. Existing occupants are not removed."
          />
          <Form.Item name="reserve_note" label="Reason (optional)">
            <Input.TextArea rows={3} placeholder="e.g. Reserved for staff inspection" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
