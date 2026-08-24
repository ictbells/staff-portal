import { useCallback, useEffect, useState } from 'react';
import { Button, Drawer, Input, Table, Tabs, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Check, ClipboardCheck, X } from 'lucide-react';
import api from '../api';
import { RefreshButton } from '../components/RefreshButton';
import { PageHeader, StatCard } from '../components/ui';

type ApprovalRow = {
  id: number;
  action_key: string;
  action_label: string;
  nav_key: string;
  summary: string;
  status: string;
  payload?: Record<string, unknown> | null;
  office_department?: { id: number; name: string } | null;
  office_unit?: { id: number; name: string } | null;
  requester?: { id: number; name: string; email: string } | null;
  unit_comment?: string | null;
  hod_comment?: string | null;
  error_message?: string | null;
  created_at?: string;
  executed_at?: string | null;
  can_review?: boolean;
};

const statusMeta: Record<string, { color: string; label: string }> = {
  pending_unit_head: { color: 'gold', label: 'Awaiting unit head' },
  pending_hod: { color: 'blue', label: 'Awaiting HOD' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

export default function OfficeApprovals() {
  const [scope, setScope] = useState('review');
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selected, setSelected] = useState<ApprovalRow | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback((page = 1, nextScope = scope) => {
    setLoading(true);
    api.get('/api/office-approvals', { params: { scope: nextScope, page } })
      .then(({ data }) => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setRows(list);
        setPagination({
          current: data.current_page ?? page,
          pageSize: data.per_page ?? 20,
          total: data.total ?? list.length,
        });
      })
      .catch((err) => {
        message.error(err.response?.data?.message || 'Unable to load approvals.');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [scope]);

  useEffect(() => { load(1, scope); }, [load, scope]);

  const decide = async (decision: 'approve' | 'reject') => {
    if (!selected) return;
    setActing(true);
    try {
      await api.post(`/api/office-approvals/${selected.id}/${decision}`, { comment: comment.trim() || null });
      message.success(decision === 'approve' ? 'Request approved.' : 'Request rejected.');
      setSelected(null);
      setComment('');
      load(pagination.current, scope);
    } catch (err: any) {
      message.error(err.response?.data?.message || `Unable to ${decision} this request.`);
    } finally {
      setActing(false);
    }
  };

  const columns: ColumnsType<ApprovalRow> = [
    {
      title: 'Request',
      key: 'summary',
      render: (_, row) => (
        <div>
          <div className="font-medium text-slate-800">{row.summary}</div>
          <div className="text-xs text-slate-500">{row.action_label}</div>
        </div>
      ),
    },
    {
      title: 'Office',
      key: 'office',
      width: 220,
      render: (_, row) => (
        <div className="text-sm text-slate-700">
          <div>{row.office_department?.name || '—'}</div>
          {row.office_unit?.name && <div className="text-xs text-slate-500">{row.office_unit.name}</div>}
        </div>
      ),
    },
    {
      title: 'Requester',
      key: 'requester',
      width: 180,
      render: (_, row) => (
        <div className="text-sm">
          <div>{row.requester?.name || '—'}</div>
          <div className="text-xs text-slate-500">{row.requester?.email}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 160,
      render: (status: string) => {
        const meta = statusMeta[status] ?? { color: 'default', label: status };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Requested',
      dataIndex: 'created_at',
      width: 170,
      render: (value?: string) => value ? new Date(value).toLocaleString() : '—',
    },
  ];

  const pendingCount = rows.filter((row) => row.status === 'pending_unit_head' || row.status === 'pending_hod').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        description="Review staff actions that need a unit head and/or head of department before they take effect. Super Admin can decide any open request."
      >
        <RefreshButton onClick={() => load(pagination.current, scope)} loading={loading} />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="In this list" value={pagination.total} hint="Matching the selected tab" icon={ClipboardCheck} />
        <StatCard label="Open on this page" value={pendingCount} hint="Still waiting for a decision" icon={ClipboardCheck} />
        <StatCard label="Tab" value={scope === 'review' ? 'My queue' : scope === 'submitted' ? 'Mine' : 'Decided'} hint="Inbox filter" icon={ClipboardCheck} />
      </div>

      <Tabs
        activeKey={scope}
        onChange={(key) => { setScope(key); load(1, key); }}
        items={[
          { key: 'review', label: 'Needs my review' },
          { key: 'submitted', label: 'Submitted by me' },
          { key: 'decided', label: 'Decided' },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table<ApprovalRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => load(page, scope),
          }}
          onRow={(row) => ({ onClick: () => { setSelected(row); setComment(''); } })}
          locale={{ emptyText: scope === 'review' ? 'No requests waiting for you.' : 'No approval requests here.' }}
        />
      </div>

      <Drawer
        title={selected?.summary || 'Approval request'}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={480}
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Action</p>
              <p className="text-sm text-slate-800">{selected.action_label}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <Tag color={(statusMeta[selected.status] ?? { color: 'default' }).color}>
                {(statusMeta[selected.status] ?? { label: selected.status }).label}
              </Tag>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Office</p>
              <p className="text-sm text-slate-800">
                {selected.office_department?.name || '—'}
                {selected.office_unit?.name ? ` › ${selected.office_unit.name}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Requester</p>
              <p className="text-sm text-slate-800">{selected.requester?.name}</p>
              <p className="text-xs text-slate-500">{selected.requester?.email}</p>
            </div>
            {selected.unit_comment && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Unit head comment</p>
                <p className="text-sm text-slate-700">{selected.unit_comment}</p>
              </div>
            )}
            {selected.hod_comment && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">HOD comment</p>
                <p className="text-sm text-slate-700">{selected.hod_comment}</p>
              </div>
            )}
            {selected.error_message && (
              <p className="text-sm text-red-600">{selected.error_message}</p>
            )}
            {selected.can_review && (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Comment (optional)</p>
                  <Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button type="primary" icon={<Check size={14} />} loading={acting} onClick={() => decide('approve')}>
                    Approve
                  </Button>
                  <Button danger icon={<X size={14} />} loading={acting} onClick={() => decide('reject')}>
                    Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
