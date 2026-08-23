import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Input, Popconfirm, Select, Space, Table, Tag, message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { ArrowRight } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { PageHeader } from '../../components/ui';
import type { AdmissionsChannel } from './constants';
import { ENTRY_MODES } from '../academic/constants';

const NEXT_STAGE: Record<string, string> = {
  submitted: 'screening',
  screening: 'verification',
  verification: 'shortlisting',
  shortlisting: 'recommended',
  recommended: 'approved',
  approved: 'offer_issued',
};

const STAGE_PERMISSION: Record<string, string> = {
  screening: 'admissions.screen',
  verification: 'admissions.verify',
  shortlisting: 'admissions.shortlist',
  recommended: 'admissions.recommend',
  approved: 'admissions.approve',
  offer_issued: 'admissions.offer',
  matriculated: 'admissions.matriculate',
};

const STAGE_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'screening', label: 'Screening' },
  { value: 'verification', label: 'Verification' },
  { value: 'shortlisting', label: 'Shortlisting' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'approved', label: 'Approved' },
  { value: 'offer_issued', label: 'Offer issued' },
  { value: 'awaiting_acceptance_fee', label: 'Awaiting acceptance fee' },
  { value: 'rejected', label: 'Rejected' },
];

type ApplicationRow = {
  id: number;
  application_number?: string | null;
  entry_mode: string;
  stage: string;
  submitted_at?: string | null;
  user?: { name?: string; email?: string };
  program?: { name?: string; code?: string };
  intake?: { name?: string; term?: { session_label?: string } };
  application_fee_invoice?: { status?: string };
};

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((m) => m.value === mode)?.label ?? mode.toUpperCase();
}

function stageTagColor(stage: string): string {
  const map: Record<string, string> = {
    submitted: 'default',
    screening: 'processing',
    verification: 'processing',
    shortlisting: 'purple',
    recommended: 'gold',
    approved: 'success',
    offer_issued: 'success',
    awaiting_acceptance_fee: 'warning',
    rejected: 'error',
    matriculated: 'success',
  };
  return map[stage] || 'default';
}

function formatStage(stage?: string) {
  return (stage || '—').replace(/_/g, ' ');
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

type Props = {
  channel: AdmissionsChannel;
};

export function AdmissionsPipeline({ channel }: Props) {
  const { has } = useAuth();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/applications', {
        params: {
          entry_modes: channel.entryModes.join(','),
          stage: stageFilter || undefined,
          page,
        },
      });
      const list = Array.isArray(data) ? data : data.data ?? [];
      setRows(list);
      setPagination((prev) => ({
        ...prev,
        current: data.current_page ?? page,
        total: data.total ?? list.length,
        pageSize: data.per_page ?? prev.pageSize,
      }));
    } catch {
      message.error('Unable to load applications.');
    } finally {
      setLoading(false);
    }
  }, [channel.entryModes, stageFilter]);

  useEffect(() => {
    load(1);
  }, [channel.key, stageFilter, load]);

  const move = useCallback(async (id: number, to: string, decision?: string) => {
    try {
      await api.post(`/api/applications/${id}/transition`, {
        to_stage: to,
        decision,
        reason: reason || undefined,
      });
      message.success(decision === 'rejected' ? 'Application rejected.' : 'Application advanced.');
      setReason('');
      await load(pagination.current);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to update application.');
    }
  }, [load, pagination.current, reason]);

  const canAdvanceTo = useCallback((stage: string) => {
    const next = NEXT_STAGE[stage];
    if (!next) return false;
    const permission = STAGE_PERMISSION[next] ?? 'admissions.view';
    return has(permission);
  }, [has]);

  const columns: ColumnsType<ApplicationRow> = useMemo(() => {
    const cols: ColumnsType<ApplicationRow> = [
      {
        title: 'Applicant',
        key: 'applicant',
        render: (_, row) => (
          <div>
            <div className="font-medium text-slate-800">{row.user?.name || '—'}</div>
            <div className="text-xs text-slate-500">{row.user?.email || '—'}</div>
            {row.application_number && (
              <div className="text-xs font-mono text-slate-400">{row.application_number}</div>
            )}
          </div>
        ),
      },
      {
        title: 'Programme',
        key: 'program',
        render: (_, row) => row.program?.name || row.program?.code || '—',
      },
      {
        title: 'Application window',
        key: 'intake',
        render: (_, row) => {
          const session = row.intake?.term?.session_label;
          const name = row.intake?.name;
          if (session && name) return `${session} · ${name}`;
          return name || session || '—';
        },
      },
    ];

    if (channel.showEntryMode) {
      cols.push({
        title: 'Entry mode',
        dataIndex: 'entry_mode',
        key: 'entry_mode',
        width: 120,
        render: (mode: string) => <Tag>{entryModeLabel(mode)}</Tag>,
      });
    }

    cols.push(
      {
        title: 'Submitted',
        dataIndex: 'submitted_at',
        key: 'submitted_at',
        width: 110,
        render: (value?: string | null) => formatDate(value),
      },
      {
        title: 'App. fee',
        key: 'application_fee',
        width: 100,
        render: (_, row) => {
          const status = row.application_fee_invoice?.status;
          if (!status) return '—';
          return <Tag color={status === 'paid' ? 'success' : status === 'partial' ? 'warning' : 'default'}>{status}</Tag>;
        },
      },
      {
        title: 'Stage',
        dataIndex: 'stage',
        key: 'stage',
        width: 150,
        render: (stage: string) => <Tag color={stageTagColor(stage)}>{formatStage(stage)}</Tag>,
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 200,
        render: (_, row) => {
          const next = NEXT_STAGE[row.stage];
          return (
            <Space size="small" wrap>
              {next && canAdvanceTo(row.stage) && (
                <Button size="small" type="primary" icon={<ArrowRight size={14} />} onClick={() => move(row.id, next)}>
                  Advance
                </Button>
              )}
              {row.stage !== 'rejected' && has('admissions.view') && (
                <Popconfirm
                  title="Reject this application?"
                  description="Provide a rejection reason above before confirming."
                  okText="Reject"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => move(row.id, 'rejected', 'rejected')}
                >
                  <Button size="small" danger>Reject</Button>
                </Popconfirm>
              )}
            </Space>
          );
        },
      },
    );

    return cols;
  }, [canAdvanceTo, channel.showEntryMode, has, move]);

  const onTableChange = (next: TablePaginationConfig) => {
    const page = next.current ?? 1;
    setPagination((prev) => ({ ...prev, current: page, pageSize: next.pageSize ?? prev.pageSize }));
    load(page);
  };

  return (
    <div className="space-y-5">
      <PageHeader title={channel.title} description={channel.description}>
        <RefreshButton onClick={() => load()} loading={loading} />
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Stage filter</label>
          <Select
            className="w-full"
            value={stageFilter}
            onChange={(value) => setStageFilter(value)}
            options={STAGE_OPTIONS}
          />
        </div>
        <div className="flex-1 min-w-[240px] max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-1">Rejection reason</label>
          <Input
            placeholder="Required when rejecting an applicant"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>

      <Table<ApplicationRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1100 }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (total) => `${total} application${total === 1 ? '' : 's'}`,
        }}
        onChange={onTableChange}
        locale={{ emptyText: 'No applications in the pipeline.' }}
      />
    </div>
  );
}
