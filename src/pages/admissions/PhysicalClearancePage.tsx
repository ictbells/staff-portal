import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BadgeCheck, ClipboardCheck, Search } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { ENTRY_MODES } from '../academic/constants';
import type { ClearanceChannel } from './constants';

type ClearanceRow = {
  id: number;
  application_number?: string | null;
  jamb_registration?: string | null;
  entry_mode: string;
  stage: string;
  offer_reference?: string | null;
  physically_cleared_at?: string | null;
  physically_cleared_by?: { id: number; name?: string } | null;
  user?: { name?: string; email?: string; jamb_registration?: string | null };
  program?: { name?: string; code?: string | null };
  academic_session?: { id: number; label?: string } | null;
  intake?: { name?: string };
  acceptance_fee_invoice?: { status?: string; amount?: number | string };
  student?: { id: number; matric_number?: string | null; student_number?: string | null } | null;
};

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((item) => item.value === mode)?.label ?? mode.toUpperCase();
}

type Props = {
  channel: ClearanceChannel;
};

export function PhysicalClearancePage({ channel }: Props) {
  const { has } = useAuth();
  const canClear = has('admissions.clear');
  const [rows, setRows] = useState<ClearanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'pending' | 'cleared'>('pending');
  const [entryModeFilter, setEntryModeFilter] = useState('');
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [singleId, setSingleId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [summary, setSummary] = useState({ pending: 0, cleared: 0 });
  const [sessions, setSessions] = useState<{ id: number; session_label: string }[]>([]);

  const entryModes = channel.entryModes.join(',');

  const load = useCallback(async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/applications/clearance', {
        params: {
          status,
          search: search || undefined,
          entry_mode: entryModeFilter || undefined,
          entry_modes: entryModes,
          academic_session_id: sessionId,
          page,
          per_page: pageSize,
        },
      });
      setRows(Array.isArray(data.data) ? data.data : []);
      setPagination({
        current: data.current_page ?? page,
        pageSize: data.per_page ?? pageSize,
        total: data.total ?? 0,
      });
      setSummary({
        pending: Number(data.summary?.pending || 0),
        cleared: Number(data.summary?.cleared || 0),
      });
    } catch {
      message.error('Unable to load applicants for clearance.');
    } finally {
      setLoading(false);
    }
  }, [entryModeFilter, entryModes, pagination.pageSize, search, sessionId, status]);

  useEffect(() => {
    api.get('/api/applications/sessions', { params: { entry_modes: entryModes } }).then(({ data }) => {
      setSessions(Array.isArray(data) ? data : data.data ?? []);
    }).catch(() => undefined);
  }, [entryModes]);

  useEffect(() => {
    setSearchInput('');
    setSearch('');
    setStatus('pending');
    setEntryModeFilter('');
    setSessionId(undefined);
    setSelected([]);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [channel.key]);

  useEffect(() => {
    setSelected([]);
    load(1);
  }, [load]);

  const clearApplicants = async (ids: number[]) => {
    if (!ids.length || !canClear) return;
    setClearing(true);
    try {
      const res = ids.length === 1
        ? await api.post(`/api/applications/${ids[0]}/clear`)
        : await api.post('/api/applications/clearance/bulk', { ids });
      if (isPendingApproval(res)) {
        setConfirmOpen(false);
        setSingleId(null);
        return;
      }
      const skipped = res.data.skipped ?? [];
      const count = res.data.cleared_count ?? ids.length;
      message.success(res.data.message || `${count} applicant(s) cleared.`);
      if (skipped.length) {
        message.warning(`${skipped.length} could not be cleared.`);
      }
      setConfirmOpen(false);
      setSingleId(null);
      setSelected([]);
      load(pagination.current);
    } catch (err: unknown) {
      const payload = (err as { response?: { data?: { message?: string } } })?.response?.data;
      message.error(payload?.message || 'Unable to clear the selected applicants.');
    } finally {
      setClearing(false);
    }
  };

  const columns: ColumnsType<ClearanceRow> = useMemo(() => {
    const cols: ColumnsType<ClearanceRow> = [
      {
        title: 'Applicant',
        key: 'applicant',
        render: (_, row) => (
          <div>
            <div className="font-medium text-slate-800">{row.user?.name || '—'}</div>
            <div className="text-xs text-slate-500">{row.user?.email || '—'}</div>
          </div>
        ),
      },
      {
        title: channel.referenceColumn === 'jamb' ? 'JAMB / previous school' : 'Application no.',
        key: 'reference',
        width: 170,
        render: (_, row) => (channel.referenceColumn === 'jamb'
          ? (row.jamb_registration || '—')
          : (row.application_number || '—')),
      },
    ];
    if (channel.showEntryMode) {
      cols.push({
        title: 'Category',
        dataIndex: 'entry_mode',
        width: 120,
        render: (value) => entryModeLabel(value),
      });
    }
    cols.push(
      {
        title: 'Programme',
        key: 'program',
        render: (_, row) => row.program?.name || '—',
      },
      {
        title: 'Session',
        key: 'session',
        width: 130,
        render: (_, row) => row.academic_session?.label || row.intake?.name || '—',
      },
      {
        title: 'Acceptance',
        key: 'acceptance',
        width: 110,
        render: (_, row) => (
          <Tag color={row.acceptance_fee_invoice?.status === 'paid' ? 'success' : 'warning'}>
            {row.acceptance_fee_invoice?.status || '—'}
          </Tag>
        ),
      },
    );
    if (status === 'cleared') {
      cols.push({
        title: 'Cleared',
        key: 'cleared',
        width: 180,
        render: (_, row) => (
          <div>
            <div>{row.physically_cleared_at ? new Date(row.physically_cleared_at).toLocaleString() : '—'}</div>
            <div className="text-xs text-slate-500">{row.physically_cleared_by?.name || ''}</div>
          </div>
        ),
      });
    } else {
      cols.push({
        title: '',
        key: 'clear',
        width: 110,
        render: (_, row) => canClear ? (
          <Button
            size="small"
            type="primary"
            icon={<BadgeCheck size={14} />}
            onClick={() => { setSingleId(row.id); setConfirmOpen(true); }}
          >
            Clear
          </Button>
        ) : null,
      });
    }
    return cols;
  }, [canClear, channel.referenceColumn, channel.showEntryMode, status]);

  const idsToClear = singleId ? [singleId] : selected;
  if (!has('admissions.view') && !canClear) {
    return <p className="text-slate-500">You do not have access to physical clearance.</p>;
  }

  return (
    <div className="space-y-4">
      <WorkspaceHero
        eyebrow="Physical clearance"
        title={channel.title}
        description={channel.description}
        icon={ClipboardCheck}
      >
        <RefreshButton onClick={() => load(pagination.current)} loading={loading} />
        {canClear && status === 'pending' && (
          <Button type="primary" disabled={!selected.length} onClick={() => { setSingleId(null); setConfirmOpen(true); }}>
            Clear selected ({selected.length})
          </Button>
        )}
      </WorkspaceHero>


      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard
          label="Awaiting clearance"
          value={summary.pending}
          hint="Paid acceptance, not yet cleared"
          icon={ClipboardCheck}
          tone="amber"
          active={status === 'pending'}
          onClick={() => setStatus('pending')}
        />
        <StatCard
          label="Cleared"
          value={summary.cleared}
          hint="Physical clearance recorded"
          icon={BadgeCheck}
          tone="emerald"
          active={status === 'cleared'}
          onClick={() => setStatus('cleared')}
        />
        <StatCard
          label="Selected"
          value={selected.length}
          hint="Will be cleared together"
          icon={BadgeCheck}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100">
          <Input
            allowClear
            prefix={<Search size={14} className="text-slate-400" />}
            placeholder={channel.referenceColumn === 'jamb' ? 'Search name, application no., or JAMB' : 'Search name or application no.'}
            className="w-full sm:w-72"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={() => setSearch(searchInput.trim())}
            onClear={() => { setSearchInput(''); setSearch(''); }}
          />
          {channel.showEntryMode && (
            <Select
              allowClear
              placeholder="Category"
              className="min-w-[160px]"
              value={entryModeFilter || undefined}
              onChange={(value) => setEntryModeFilter(value || '')}
              options={channel.entryModes.map((mode) => ({ value: mode, label: entryModeLabel(mode) }))}
            />
          )}
          <Select
            allowClear
            placeholder="Admission session"
            className="min-w-[180px]"
            value={sessionId}
            onChange={setSessionId}
            options={sessions.map((session) => ({ value: session.id, label: session.session_label }))}
          />
        </div>
        <Table<ClearanceRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={status === 'pending' && canClear ? {
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys.map((key) => Number(key))),
          } : undefined}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            onChange: (page, pageSize) => load(page, pageSize),
          }}
          locale={{ emptyText: status === 'cleared' ? 'No cleared applicants match these filters.' : 'No applicants are waiting for physical clearance.' }}
        />
      </div>

      <Modal
        title={idsToClear.length > 1 ? 'Clear selected applicants' : 'Clear applicant'}
        open={confirmOpen}
        onCancel={() => { setConfirmOpen(false); setSingleId(null); }}
        onOk={() => clearApplicants(idsToClear)}
        okText={idsToClear.length > 1 ? `Clear ${idsToClear.length} applicants` : 'Clear applicant'}
        confirmLoading={clearing}
        destroyOnHidden
      >
        <p className="text-sm text-slate-600">
          Confirm that the applicant{idsToClear.length > 1 ? 's have' : ' has'} paid acceptance and presented original documents. Clearing creates the student record.
        </p>
      </Modal>
    </div>
  );
}
