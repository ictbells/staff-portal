import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, Users } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { RefreshButton } from '../components/RefreshButton';
import { PageHeader } from '../components/ui';

type HostelRow = {
  id: number;
  name: string;
  gender: string;
  category: 'undergraduate' | 'jupeb';
  is_active: boolean;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  blocks?: { id: number; name: string; rooms: { id: number; number: string; beds: { id: number; label: string; status: string }[] }[] }[];
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
  student_level?: number;
  hostel_name?: string;
  hostel_category?: string;
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
};

const categoryColors: Record<string, string> = {
  undergraduate: 'blue',
  jupeb: 'purple',
};

function CategoryTag({ category }: { category: string }) {
  return <Tag color={categoryColors[category] || 'default'}>{categoryLabels[category] || category}</Tag>;
}

export default function HostelManagement() {
  const { has } = useAuth();
  const canManage = has('hostel.manage');
  const canAllocate = has('hostel.allocate');

  const [overview, setOverview] = useState<any>(null);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [ugWindows, setUgWindows] = useState<LevelWindow[]>([]);
  const [jupebWindows, setJupebWindows] = useState<LevelWindow[]>([]);
  const [queue, setQueue] = useState<QueueStudent[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomHostelFilter, setRoomHostelFilter] = useState<number | undefined>();
  const [queueCategory, setQueueCategory] = useState<'undergraduate' | 'jupeb'>('undergraduate');
  const [loading, setLoading] = useState(false);
  const [savingWindows, setSavingWindows] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [editRoomOpen, setEditRoomOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, hostelsRes, ugRes, jupebRes, allocRes] = await Promise.all([
        api.get('/api/hostels/overview'),
        api.get('/api/hostels'),
        api.get('/api/hostel-level-windows', { params: { category: 'undergraduate' } }),
        api.get('/api/hostel-level-windows', { params: { category: 'jupeb' } }),
        api.get('/api/hostel-allocations'),
      ]);
      setOverview(overviewRes.data);
      setHostels(hostelsRes.data);
      setUgWindows(ugRes.data);
      setJupebWindows(jupebRes.data);
      setAllocations(allocRes.data);
      await loadRooms(roomHostelFilter);
    } finally {
      setLoading(false);
    }
  }, [loadRooms, roomHostelFilter]);

  const loadQueue = useCallback(async (category: 'undergraduate' | 'jupeb') => {
    const { data } = await api.get('/api/hostel-queue', { params: { category } });
    setQueue(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadQueue(queueCategory); }, [loadQueue, queueCategory]);

  const availableBeds = useMemo(() => {
    const beds: { id: number; label: string; hostel: string; category: string; room: string }[] = [];
    hostels.forEach((hostel) => {
      hostel.blocks?.forEach((block) => {
        block.rooms?.forEach((room) => {
          room.beds?.forEach((bed) => {
            if (bed.status === 'available') {
              beds.push({
                id: bed.id,
                label: bed.label,
                hostel: hostel.name,
                category: hostel.category,
                room: room.number,
              });
            }
          });
        });
      });
    });
    return beds;
  }, [hostels]);

  const saveWindows = async (category: 'undergraduate' | 'jupeb', levels: LevelWindow[]) => {
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
      else setJupebWindows(data);
      message.success(`${categoryLabels[category]} level settings saved.`);
      await loadQueue(queueCategory);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to save level settings.');
    } finally {
      setSavingWindows(false);
    }
  };

  const toggleLevel = (category: 'undergraduate' | 'jupeb', levelId: number, active: boolean) => {
    const setter = category === 'undergraduate' ? setUgWindows : setJupebWindows;
    const current = category === 'undergraduate' ? ugWindows : jupebWindows;
    setter(current.map((row) => (row.academic_level_id === levelId ? { ...row, is_active: active } : row)));
  };

  const allocateBed = async (studentId: number, bedId: number) => {
    try {
      await api.post('/api/hostel-allocations', { student_id: studentId, hostel_bed_id: bedId });
      message.success('Bed allocated.');
      await load();
      await loadQueue(queueCategory);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Allocation failed.');
    }
  };

  const autoAllocate = async (bedId: number, category: 'undergraduate' | 'jupeb') => {
    try {
      await api.post('/api/hostel-allocations/auto', { hostel_bed_id: bedId, category });
      message.success('Next priority student allocated.');
      await load();
      await loadQueue(queueCategory);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Auto allocation failed.');
    }
  };

  const vacate = async (allocationId: number) => {
    try {
      await api.post(`/api/hostel-allocations/${allocationId}/vacate`);
      message.success('Bed vacated.');
      await load();
      await loadQueue(queueCategory);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to vacate bed.');
    }
  };

  const createHostel = async (values: { name: string; gender: string; category: string }) => {
    setCreating(true);
    try {
      await api.post('/api/hostels', { ...values, is_active: true });
      message.success('Hostel created.');
      setCreateOpen(false);
      form.resetFields();
      await load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to create hostel.');
    } finally {
      setCreating(false);
    }
  };

  const createBlock = async (values: { name: string }) => {
    if (!selectedHostelId) return;
    setSavingRoom(true);
    try {
      await api.post(`/api/hostels/${selectedHostelId}/blocks`, values);
      message.success('Block added.');
      setBlockOpen(false);
      blockForm.resetFields();
      await load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to add block.');
    } finally {
      setSavingRoom(false);
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
      await load();
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
      await load();
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
      await load();
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
      await load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to release room.');
    }
  };

  const toggleRoomActive = async (room: RoomRow, active: boolean) => {
    try {
      await api.post(`/api/hostel-rooms/${room.id}/${active ? 'enable' : 'disable'}`);
      message.success(active ? 'Room enabled.' : 'Room disabled.');
      await load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to update room status.');
    }
  };

  const hostelColumns: ColumnsType<HostelRow> = [
    { title: 'Hostel', dataIndex: 'name', key: 'name', render: (name: string) => <span className="font-medium">{name}</span> },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c: string) => <CategoryTag category={c} /> },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', render: (g: string) => g || '—' },
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
          <Space size="small">
            <Button
              size="small"
              onClick={() => {
                setSelectedHostelId(row.id);
                blockForm.resetFields();
                setBlockOpen(true);
              }}
            >
              Add block
            </Button>
            {row.blocks && row.blocks.length > 0 && (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  setSelectedHostelId(row.id);
                  setSelectedBlockId(row.blocks![0].id);
                  roomForm.resetFields();
                  roomForm.setFieldsValue({ capacity: 4 });
                  setRoomOpen(true);
                }}
              >
                Add room
              </Button>
            )}
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
    { title: 'Level', dataIndex: 'student_level', key: 'student_level', render: (l?: number) => (l ? `${l}L` : '—') },
    { title: 'Hostel', dataIndex: 'hostel_name', key: 'hostel_name' },
    { title: 'Category', dataIndex: 'hostel_category', key: 'hostel_category', render: (c?: string) => (c ? <CategoryTag category={c} /> : '—') },
    { title: 'Room / bed', key: 'bed', render: (_, row) => `${row.room_number || '—'} / ${row.bed_label || '—'}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'allocated' ? 'success' : 'default'}>{s}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => (
        row.status === 'allocated' && canAllocate ? (
          <Popconfirm
            title="Vacate this bed?"
            description="The student will be removed from this room and the bed will become available."
            okText="Vacate"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            onConfirm={() => vacate(row.id)}
          >
            <Button size="small" danger>Vacate</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  const levelTable = (category: 'undergraduate' | 'jupeb', rows: LevelWindow[]) => (
    <div className="space-y-3">
      <Alert
        type="info"
        showIcon
        message="100 Level students are served first from the allocation queue. Activate only the levels that may apply for beds in this category."
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
              row.level_code === '100'
                ? <Tag color="gold">Highest</Tag>
                : <Tag>{row.level_code}L</Tag>
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
      <PageHeader
        title="Hostel management"
        description="Undergraduate and JUPEB hostels are managed separately. Open allocation by level — 100 Level has highest priority."
      >
        <Space wrap>
          <RefreshButton onClick={load} loading={loading} />
          {canManage && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Add hostel
            </Button>
          )}
        </Space>
      </PageHeader>

      {overview?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Hostels</div>
            <div className="text-2xl font-semibold text-slate-800">{overview.stats.hostels}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Total beds</div>
            <div className="text-2xl font-semibold text-slate-800">{overview.stats.total_beds}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Available beds</div>
            <div className="text-2xl font-semibold text-emerald-700">{overview.stats.available_beds}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Occupied</div>
            <div className="text-2xl font-semibold text-slate-800">{overview.stats.occupied_beds}</div>
          </div>
        </div>
      )}

      <Tabs
        items={[
          {
            key: 'hostels',
            label: 'Hostels',
            children: (
              <Table<HostelRow>
                rowKey="id"
                loading={loading}
                columns={hostelColumns}
                dataSource={hostels}
                pagination={false}
                locale={{ emptyText: 'No hostels configured yet.' }}
              />
            ),
          },
          {
            key: 'rooms',
            label: 'Rooms',
            children: (
              <div className="space-y-4">
                <Alert
                  type="info"
                  showIcon
                  message="Set spaces via room capacity (beds are created automatically). Reserve a room to hold it off allocation. Disable a room to block all beds. In mixed hostels, room gender locks to the first occupant and clears when the room is empty."
                />
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
                  loading={loading}
                  columns={roomColumns}
                  dataSource={rooms}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: 'No rooms yet. Add a block and room from the Hostels tab.' }}
                />
              </div>
            ),
          },
          {
            key: 'levels',
            label: 'Level activation',
            children: (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Undergraduate</h3>
                  {levelTable('undergraduate', ugWindows)}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">JUPEB</h3>
                  {levelTable('jupeb', jupebWindows)}
                </div>
              </div>
            ),
          },
          {
            key: 'queue',
            label: 'Priority queue',
            children: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={queueCategory}
                    onChange={(value) => setQueueCategory(value)}
                    options={[
                      { value: 'undergraduate', label: 'Undergraduate queue' },
                      { value: 'jupeb', label: 'JUPEB queue' },
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
                  columns={queueColumns}
                  dataSource={queue}
                  pagination={false}
                  locale={{ emptyText: 'No eligible students. Activate a level or check category match.' }}
                />
              </div>
            ),
          },
          {
            key: 'allocations',
            label: 'Allocations',
            children: (
              <Table<AllocationRow>
                rowKey="id"
                loading={loading}
                columns={allocationColumns}
                dataSource={allocations}
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'No hostel allocations yet.' }}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Add hostel"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={createHostel} className="mt-4">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Queen Hall" />
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="undergraduate" rules={[{ required: true }]}>
            <Select options={[
              { value: 'undergraduate', label: 'Undergraduate' },
              { value: 'jupeb', label: 'JUPEB' },
            ]} />
          </Form.Item>
          <Form.Item name="gender" label="Gender" initialValue="mixed" rules={[{ required: true }]}>
            <Select options={[
              { value: 'mixed', label: 'Mixed' },
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add block"
        open={blockOpen}
        onCancel={() => setBlockOpen(false)}
        onOk={() => blockForm.submit()}
        confirmLoading={savingRoom}
        destroyOnHidden
      >
        <Form form={blockForm} layout="vertical" onFinish={createBlock} className="mt-4">
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
