import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Dropdown, Input, Modal, Select, Space, Table, Tag, message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  Award,
  BadgeCheck,
  BookOpen,
  CircleX,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Eye,
  Printer,
  School,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { ApplicationDecisionModal } from './ApplicationDecisionModal';
import { ApplicationFileDrawer, StaffPassportPhoto } from './ApplicationFileDrawer';
import type { AdmissionsChannel, AdmissionsChannelKey, AdmissionsReferenceColumn } from './constants';
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
  credit_assessment: 'admissions.credit_assess',
  shortlisting: 'admissions.shortlist',
  recommended: 'admissions.recommend',
  approved: 'admissions.approve',
  offer_issued: 'admissions.offer',
  proposal_review: 'admissions.pg.proposal',
  supervisor: 'admissions.pg.supervisor',
  panel: 'admissions.pg.panel',
  recommendation: 'admissions.recommend',
  approval: 'admissions.approve',
  admission: 'admissions.offer',
  matriculated: 'admissions.matriculate',
};

const PG_STAGE_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'screening', label: 'Screening' },
  { value: 'proposal_review', label: 'Proposal review' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'panel', label: 'Panel' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'approval', label: 'Approval' },
  { value: 'admission', label: 'Admission' },
  { value: 'offer_issued', label: 'Offer issued' },
  { value: 'awaiting_acceptance_fee', label: 'Awaiting acceptance fee' },
  { value: 'rejected', label: 'Rejected' },
];

function nextFor(row: { stage: string; entry_mode?: string; workflow?: { next_stage?: string; next_permission?: string } }) {
  if (row.workflow?.next_stage) return row.workflow.next_stage;
  if (row.entry_mode === 'transfer' && row.stage === 'verification') return 'credit_assessment';
  if (row.entry_mode === 'transfer' && row.stage === 'credit_assessment') return 'shortlisting';
  return NEXT_STAGE[row.stage];
}

function permissionForNext(row: { stage: string; workflow?: { next_stage?: string; next_permission?: string } }) {
  const next = nextFor(row);
  return row.workflow?.next_permission || STAGE_PERMISSION[next || ''] || 'admissions.view';
}

const STAGE_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'screening', label: 'Screening' },
  { value: 'verification', label: 'Verification' },
  { value: 'credit_assessment', label: 'Credit assessment' },
  { value: 'shortlisting', label: 'Shortlisting' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'approved', label: 'Approved' },
  { value: 'offer_issued', label: 'Offer issued' },
  { value: 'awaiting_acceptance_fee', label: 'Awaiting acceptance fee' },
  { value: 'rejected', label: 'Rejected' },
];

const FEE_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
];

const REVIEW_STAGES = ['submitted', 'screening', 'verification', 'credit_assessment', 'shortlisting', 'recommended', 'proposal_review', 'supervisor', 'panel', 'recommendation'];
const OFFER_STAGES = ['approved', 'approval', 'offer_issued', 'admission', 'awaiting_acceptance_fee'];
const REJECTED_STAGES = ['rejected'];

const CHANNEL_ICON: Record<AdmissionsChannelKey, LucideIcon> = {
  undergraduate: School,
  jupeb: BookOpen,
  postgraduate: Award,
};

function countStages(byStage: Record<string, number> | undefined, stages: string[]) {
  if (!byStage) return 0;
  return stages.reduce((sum, stage) => sum + Number(byStage[stage] || 0), 0);
}

function stagesKey(stages: string[]) {
  return [...stages].sort().join(',');
}

function isStageGroupActive(filter: string, stages: string[]) {
  const current = filter.split(',').map((item) => item.trim()).filter(Boolean).sort().join(',');
  return current === stagesKey(stages);
}

type ApplicationRow = {
  id: number;
  application_number?: string | null;
  jamb_registration?: string | null;
  offer_reference?: string | null;
  entry_mode: string;
  stage: string;
  submitted_at?: string | null;
  user?: { name?: string; email?: string; jamb_registration?: string | null };
  program?: {
    name?: string;
    code?: string;
    department?: { id?: number; name?: string; faculty?: { id?: number; name?: string } };
  };
  intake?: { name?: string; acceptance_fee_amount?: number | string; term?: { session_label?: string } };
  academic_session?: { id?: number; label?: string } | null;
  application_fee_invoice?: { status?: string };
  eligibility?: { meets: boolean; failed?: { rule: string; message: string }[] };
  workflow?: {
    next_stage?: string;
    next_label?: string;
    next_permission?: string;
    template_code?: string;
    can_revert?: boolean;
    revert?: { restore_stage: string; restore_label: string; last_decision?: string | null; last_to_stage?: string } | null;
  };
  previous_university?: string | null;
  credit_assessment_complete?: boolean;
};

function referenceColumnTitle(kind: AdmissionsReferenceColumn) {
  return kind === 'jamb' ? 'JAMB / previous school' : 'Application number';
}

function referenceColumnValue(row: ApplicationRow, kind: AdmissionsReferenceColumn) {
  if (kind === 'jamb') {
    if (row.entry_mode === 'transfer') {
      return row.previous_university || '—';
    }
    return row.jamb_registration || row.user?.jamb_registration || '—';
  }
  return row.application_number || '—';
}

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((m) => m.value === mode)?.label ?? mode.toUpperCase();
}

function stageTagColor(stage: string): string {
  const map: Record<string, string> = {
    submitted: 'default',
    screening: 'processing',
    verification: 'processing',
    credit_assessment: 'cyan',
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

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

type Props = {
  channel: AdmissionsChannel;
};

export function AdmissionsPipeline({ channel }: Props) {
  const { has } = useAuth();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [entryModeFilter, setEntryModeFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState<number | undefined>(undefined);
  const [programFilter, setProgramFilter] = useState<number | undefined>(undefined);
  const [collegeFilter, setCollegeFilter] = useState<number | undefined>(undefined);
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>(undefined);
  const [fileId, setFileId] = useState<number | null>(null);
  const [decisionRow, setDecisionRow] = useState<ApplicationRow | null>(null);
  const [moving, setMoving] = useState(false);
  const [feeStatusFilter, setFeeStatusFilter] = useState('');
  const [sessions, setSessions] = useState<{
    id: number;
    session_label: string;
    name?: string;
    entry_mode?: string;
    is_open?: boolean;
    is_current?: boolean;
  }[]>([]);
  const [programs, setPrograms] = useState<{
    id: number;
    name: string;
    code?: string | null;
    department?: { id?: number; name?: string; faculty?: { id?: number; name?: string } };
  }[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [exporting, setExporting] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [docModal, setDocModal] = useState<{ title: string; html: string } | null>(null);
  const [summary, setSummary] = useState<{ by_stage?: Record<string, number>; total?: number } | null>(null);

  const entryModeOptions = useMemo(
    () => channel.entryModes.map((mode) => ({
      value: mode,
      label: entryModeLabel(mode),
    })),
    [channel.entryModes],
  );

  const sessionOptions = useMemo(
    () => sessions.map((session) => ({
      value: session.id,
      label: (session.is_open || session.is_current) ? `${session.session_label} (open)` : session.session_label,
    })),
    [sessions],
  );

  const collegeOptions = useMemo(() => {
    const map = new Map<number, string>();
    programs.forEach((program) => {
      const faculty = program.department?.faculty;
      if (faculty?.id && faculty.name) map.set(faculty.id, faculty.name);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [programs]);

  const departmentOptions = useMemo(() => {
    const map = new Map<number, string>();
    programs.forEach((program) => {
      const department = program.department;
      if (!department?.id || !department.name) return;
      if (collegeFilter && department.faculty?.id !== collegeFilter) return;
      map.set(department.id, department.name);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [collegeFilter, programs]);

  const programOptions = useMemo(
    () => programs
      .filter((program) => {
        if (departmentFilter && program.department?.id !== departmentFilter) return false;
        if (collegeFilter && program.department?.faculty?.id !== collegeFilter) return false;
        return true;
      })
      .map((program) => ({
        value: program.id,
        label: program.code ? `${program.code} — ${program.name}` : program.name,
      })),
    [collegeFilter, departmentFilter, programs],
  );

  const searchPlaceholder = channel.referenceColumn === 'jamb'
    ? 'Search name, email, JAMB number…'
    : 'Search name, email, application number…';

  const hasActiveFilters = !!(search || stageFilter || entryModeFilter || sessionFilter || programFilter || collegeFilter || departmentFilter || feeStatusFilter);
  const fileRow = rows.find((row) => row.id === fileId) ?? null;

  const load = useCallback(async (
    page = 1,
    pageSize = pagination.pageSize,
    overrides?: {
      search?: string;
      stage?: string;
      entryMode?: string;
      session?: number | undefined;
      program?: number | undefined;
      college?: number | undefined;
      department?: number | undefined;
      feeStatus?: string;
    },
  ) => {
    setLoading(true);
    try {
      const nextSearch = overrides && 'search' in overrides ? overrides.search ?? '' : search;
      const nextStage = overrides && 'stage' in overrides ? overrides.stage ?? '' : stageFilter;
      const nextEntryMode = overrides && 'entryMode' in overrides ? overrides.entryMode ?? '' : entryModeFilter;
      const nextSession = overrides && 'session' in overrides ? overrides.session : sessionFilter;
      const nextProgram = overrides && 'program' in overrides ? overrides.program : programFilter;
      const nextCollege = overrides && 'college' in overrides ? overrides.college : collegeFilter;
      const nextDepartment = overrides && 'department' in overrides ? overrides.department : departmentFilter;
      const nextFeeStatus = overrides && 'feeStatus' in overrides ? overrides.feeStatus ?? '' : feeStatusFilter;
      const { data } = await api.get('/api/applications', {
        params: {
          entry_modes: channel.entryModes.join(','),
          entry_mode: nextEntryMode || undefined,
          academic_session_id: nextSession || undefined,
          faculty_id: nextCollege || undefined,
          department_id: nextDepartment || undefined,
          program_id: nextProgram || undefined,
          stage: nextStage || undefined,
          fee_status: nextFeeStatus || undefined,
          search: nextSearch || undefined,
          page,
          per_page: pageSize,
        },
      });
      const list = Array.isArray(data) ? data : data.data ?? [];
      setRows(list);
      setSummary(Array.isArray(data) ? null : data.summary ?? null);
      setPagination({
        current: data.current_page ?? page,
        total: data.total ?? list.length,
        pageSize: data.per_page ?? pageSize,
      });
    } catch {
      message.error('Unable to load applications.');
    } finally {
      setLoading(false);
    }
  }, [channel.entryModes, collegeFilter, departmentFilter, entryModeFilter, feeStatusFilter, pagination.pageSize, programFilter, search, sessionFilter, stageFilter]);

  useEffect(() => {
    let cancelled = false;
    const modes = entryModeFilter ? [entryModeFilter] : channel.entryModes;
    api.get('/api/applications/sessions', { params: { entry_modes: modes.join(',') } })
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setSessions(list);
        setSessionFilter((current) => {
          if (current && list.some((item: { id: number }) => item.id === current)) {
            return current;
          }
          return undefined;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSessions([]);
        setSessionFilter(undefined);
      });
    return () => { cancelled = true; };
  }, [channel.entryModes, channel.key, entryModeFilter]);

  useEffect(() => {
    setProgramFilter(undefined);
    setCollegeFilter(undefined);
    setDepartmentFilter(undefined);
    const modes = entryModeFilter
      ? [entryModeFilter]
      : channel.entryModes;
    api.get('/api/programs', { params: { entry_modes: modes.join(',') } })
      .then(({ data }) => setPrograms(Array.isArray(data) ? data : []))
      .catch(() => setPrograms([]));
  }, [channel.entryModes, channel.key, entryModeFilter]);

  useEffect(() => {
    setSearchInput('');
    setSearch('');
    setStageFilter('');
    setEntryModeFilter('');
    setSessionFilter(undefined);
    setProgramFilter(undefined);
    setCollegeFilter(undefined);
    setDepartmentFilter(undefined);
    setFileId(null);
    setDecisionRow(null);
    setFeeStatusFilter('');
    load(1, pagination.pageSize, {
      search: '',
      stage: '',
      entryMode: '',
      session: undefined,
      program: undefined,
      college: undefined,
      department: undefined,
      feeStatus: '',
    });
  }, [channel.key]);

  useEffect(() => {
    load(1);
  }, [search, stageFilter, entryModeFilter, sessionFilter, programFilter, collegeFilter, departmentFilter, feeStatusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearch((prev) => (prev === next ? prev : next));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const move = useCallback(async (id: number, to: string, decision?: string, acceptanceFeeAmount?: number, reason?: string) => {
    setMoving(true);
    try {
      await api.post(`/api/applications/${id}/transition`, {
        to_stage: to,
        decision,
        reason: reason || undefined,
        acceptance_fee_amount: acceptanceFeeAmount,
      });
      message.success(decision === 'rejected' ? 'Application rejected.' : 'Decision updated.');
      await load(pagination.current);
      return true;
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to update application.');
      return false;
    } finally {
      setMoving(false);
    }
  }, [load, pagination.current]);

  const canAdvanceTo = useCallback((row: ApplicationRow | string) => {
    if (typeof row === 'string') {
      const next = NEXT_STAGE[row];
      if (!next) return false;
      return has(STAGE_PERMISSION[next] ?? 'admissions.view');
    }
    const next = nextFor(row);
    if (!next) return false;
    return has(permissionForNext(row));
  }, [has]);

  const openDocument = useCallback(async (id: number, kind: 'form' | 'offer') => {
    if (!has('admissions.view')) {
      message.error('You do not have permission to print this document.');
      return;
    }
    setPrintingId(id);
    try {
      const path = kind === 'form' ? 'form-print' : 'offer-letter';
      const { data } = await api.get(`/api/applications/${id}/${path}`, { responseType: 'text' });
      setDocModal({
        title: kind === 'form' ? 'Application form' : 'Admission letter',
        html: data,
      });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to open document.');
    } finally {
      setPrintingId(null);
    }
  }, [has]);

  const printDocModal = () => {
    const frame = document.getElementById('admissions-doc-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadDocModal = () => {
    if (!docModal) return;
    const blob = new Blob([docModal.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docModal.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterParams = useMemo(() => ({
    entry_modes: channel.entryModes.join(','),
    entry_mode: entryModeFilter || undefined,
    academic_session_id: sessionFilter || undefined,
    faculty_id: collegeFilter || undefined,
    department_id: departmentFilter || undefined,
    program_id: programFilter || undefined,
    stage: stageFilter || undefined,
    fee_status: feeStatusFilter || undefined,
    search: search || undefined,
  }), [channel.entryModes, collegeFilter, departmentFilter, entryModeFilter, feeStatusFilter, programFilter, search, sessionFilter, stageFilter]);

  const download = useCallback(async (format: 'pdf' | 'excel' | 'word') => {
    if (!has('admissions.view')) {
      message.error('You do not have permission to download applications.');
      return;
    }
    setExporting(true);
    try {
      const { data } = await api.get('/api/applications/export', {
        params: {
          ...filterParams,
          format,
          title: channel.title,
          reference_kind: channel.referenceColumn,
        },
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
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `${channel.key}-applications-${stamp}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Download started (${format.toUpperCase()}).`);
    } catch (err: any) {
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          message.error(parsed.message || 'Unable to download report.');
        } catch {
          message.error('Unable to download report.');
        }
      } else {
        message.error(err.response?.data?.message || 'Unable to download report.');
      }
    } finally {
      setExporting(false);
    }
  }, [channel.key, channel.referenceColumn, channel.title, filterParams, has]);

  const downloadMenu: MenuProps['items'] = [
    {
      key: 'pdf',
      icon: <FileText size={14} />,
      label: 'PDF',
      onClick: () => download('pdf'),
    },
    {
      key: 'excel',
      icon: <FileSpreadsheet size={14} />,
      label: 'Excel (.xlsx)',
      onClick: () => download('excel'),
    },
    {
      key: 'word',
      icon: <FileText size={14} />,
      label: 'MS Word (.docx)',
      onClick: () => download('word'),
    },
  ];

  const columns: ColumnsType<ApplicationRow> = useMemo(() => {
    const cols: ColumnsType<ApplicationRow> = [
      {
        title: 'Applicant',
        key: 'applicant',
        width: 200,
        ellipsis: true,
        render: (_, row) => (
          <div className="flex items-center gap-2 overflow-hidden">
            <StaffPassportPhoto
              applicationId={row.id}
              className="h-10 w-8 rounded object-cover border border-slate-200 bg-slate-100 shrink-0"
              placeholder={<div className="h-10 w-8 rounded bg-slate-100 border border-slate-200 shrink-0" />}
            />
            <div className="overflow-hidden min-w-0">
              <button
                type="button"
                className="font-medium text-sky-700 hover:underline truncate block max-w-full text-left"
                onClick={() => setDecisionRow(row)}
              >
                {row.user?.name || '—'}
              </button>
              <div className="text-xs text-slate-500 truncate">{row.user?.email || '—'}</div>
            </div>
          </div>
        ),
      },
      {
        title: referenceColumnTitle(channel.referenceColumn),
        key: 'reference',
        width: 150,
        ellipsis: true,
        render: (_, row) => (
          <span className="font-mono text-xs text-slate-700">
            {referenceColumnValue(row, channel.referenceColumn)}
          </span>
        ),
      },
      {
        title: 'College',
        key: 'college',
        width: 160,
        ellipsis: true,
        render: (_, row) => row.program?.department?.faculty?.name || '—',
      },
      {
        title: 'Department',
        key: 'department',
        width: 160,
        ellipsis: true,
        render: (_, row) => row.program?.department?.name || '—',
      },
      {
        title: 'Programme',
        key: 'program',
        width: 180,
        ellipsis: true,
        render: (_, row) => (
          <div className="overflow-hidden">
            <div className="text-slate-800 truncate">{row.program?.name || '—'}</div>
            {row.program?.code && <div className="text-xs text-slate-400 truncate">{row.program.code}</div>}
          </div>
        ),
      },
      {
        title: 'Admission session',
        key: 'intake',
        width: 160,
        ellipsis: true,
        render: (_, row) => {
          const name = row.intake?.name;
          const year = row.academic_session?.label || row.intake?.term?.session_label;
          return (
            <div className="overflow-hidden text-sm">
              <div className="text-slate-800 truncate">{year || name || '—'}</div>
              {name && year && <div className="text-xs text-slate-400 truncate">{name}</div>}
            </div>
          );
        },
      },
    ];

    if (channel.showEntryMode) {
      cols.push({
        title: 'Category',
        dataIndex: 'entry_mode',
        key: 'entry_mode',
        width: 110,
        render: (mode: string) => <Tag color="blue">{entryModeLabel(mode)}</Tag>,
      });
    }

    cols.push(
      {
        title: 'Submitted',
        dataIndex: 'submitted_at',
        key: 'submitted_at',
        width: 160,
        render: (value?: string | null) => (
          <span className="text-xs text-slate-700 whitespace-nowrap">{formatDateTime(value)}</span>
        ),
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
        width: 140,
        render: (stage: string, row: ApplicationRow) => (
          <Space size={4} wrap>
            <Tag color={stageTagColor(stage)}>{formatStage(stage)}</Tag>
            {row.eligibility && row.entry_mode === 'pg' && (
              <Tag color={row.eligibility.meets ? 'success' : 'warning'}>
                {row.eligibility.meets ? 'Meets' : 'Does not meet'}
              </Tag>
            )}
            {row.entry_mode === 'transfer' && !row.credit_assessment_complete && (
              <Tag color="warning">Needs credit assessment</Tag>
            )}
          </Space>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 260,
        render: (_, row) => (
          <Space size="small" wrap>
            {has('admissions.view') && (
              <Button size="small" icon={<Eye size={14} />} onClick={() => setDecisionRow(row)}>
                View
              </Button>
            )}
            {has('admissions.view') && (
              <Button size="small" icon={<ClipboardList size={14} />} onClick={() => setFileId(row.id)}>
                File
              </Button>
            )}
            {has('admissions.view') && (
              <Button
                size="small"
                icon={<Printer size={14} />}
                loading={printingId === row.id}
                onClick={() => openDocument(row.id, 'form')}
              >
                Form
              </Button>
            )}
            {has('admissions.view') && row.offer_reference && (
              <Button
                size="small"
                icon={<FileText size={14} />}
                loading={printingId === row.id}
                onClick={() => openDocument(row.id, 'offer')}
              >
                Letter
              </Button>
            )}
          </Space>
        ),
      },
    );

    return cols;
  }, [channel.referenceColumn, channel.showEntryMode, has, openDocument, printingId]);

  const onTableChange = (next: TablePaginationConfig) => {
    const page = next.current ?? 1;
    const pageSize = next.pageSize ?? pagination.pageSize;
    setPagination((prev) => ({ ...prev, current: page, pageSize }));
    load(page, pageSize);
  };

  const toggleStageGroup = (stages: string[]) => {
    setStageFilter((prev) => (isStageGroupActive(prev, stages) ? '' : stages.join(',')));
  };

  const inReviewCount = countStages(summary?.by_stage, REVIEW_STAGES);
  const offerCount = countStages(summary?.by_stage, OFFER_STAGES);
  const rejectedCount = countStages(summary?.by_stage, REJECTED_STAGES);
  const pipelineTotal = summary?.total ?? pagination.total;
  const stageSelectValue = STAGE_OPTIONS.some((option) => option.value === stageFilter)
    ? stageFilter
    : undefined;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Applications"
        title={channel.title}
        description={channel.description}
        icon={CHANNEL_ICON[channel.key]}
      >
        <Dropdown menu={{ items: downloadMenu }} trigger={['click']} disabled={exporting || loading}>
          <Button
            type="primary"
            icon={<Download size={14} />}
            loading={exporting}
          >
            Download
          </Button>
        </Dropdown>
        <RefreshButton onClick={() => load(pagination.current)} loading={loading} />
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="In pipeline"
          value={pipelineTotal}
          hint={hasActiveFilters && !stageFilter ? 'Matching current filters' : 'All applications in this list'}
          icon={Layers}
          tone="sky"
          active={!stageFilter}
          onClick={() => setStageFilter('')}
        />
        <StatCard
          label="In review"
          value={inReviewCount}
          hint="Submitted through recommended"
          icon={ClipboardList}
          tone="amber"
          active={isStageGroupActive(stageFilter, REVIEW_STAGES)}
          onClick={() => toggleStageGroup(REVIEW_STAGES)}
        />
        <StatCard
          label="Offers"
          value={offerCount}
          hint="Approved, issued, or awaiting fee"
          icon={BadgeCheck}
          tone="emerald"
          active={isStageGroupActive(stageFilter, OFFER_STAGES)}
          onClick={() => toggleStageGroup(OFFER_STAGES)}
        />
        <StatCard
          label="Rejected"
          value={rejectedCount}
          hint="Closed applications"
          icon={CircleX}
          tone="rose"
          active={isStageGroupActive(stageFilter, REJECTED_STAGES)}
          onClick={() => toggleStageGroup(REJECTED_STAGES)}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3">
            <div className="relative w-full min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <Input
                allowClear
                size="large"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={() => setSearch(searchInput.trim())}
                placeholder={searchPlaceholder}
                className="!pl-9 w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                className="w-full min-w-[180px] sm:w-auto sm:min-w-[200px]"
                size="large"
                placeholder="College"
                value={collegeFilter}
                onChange={(value) => {
                  setCollegeFilter(value);
                  setDepartmentFilter(undefined);
                  setProgramFilter(undefined);
                }}
                options={collegeOptions}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                className="w-full min-w-[180px] sm:w-auto sm:min-w-[200px]"
                size="large"
                placeholder="Department"
                value={departmentFilter}
                onChange={(value) => {
                  setDepartmentFilter(value);
                  setProgramFilter(undefined);
                }}
                options={departmentOptions}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                className="w-full min-w-[200px] sm:w-auto sm:min-w-[220px]"
                size="large"
                placeholder="Programme"
                value={programFilter}
                onChange={(value) => setProgramFilter(value)}
                options={programOptions}
              />
              <Select
                allowClear
                className="w-full min-w-[140px] sm:w-auto sm:min-w-[160px]"
                size="large"
                placeholder="Admission session"
                value={sessionFilter}
                onChange={(value) => setSessionFilter(value)}
                options={sessionOptions}
              />
              {channel.showEntryMode && (
                <Select
                  allowClear
                  className="w-full min-w-[140px] sm:w-auto sm:min-w-[150px]"
                  size="large"
                  placeholder="Category"
                  value={entryModeFilter || undefined}
                  onChange={(value) => setEntryModeFilter(value || '')}
                  options={entryModeOptions}
                />
              )}
              <Select
                allowClear
                className="w-full min-w-[140px] sm:w-auto sm:min-w-[170px]"
                size="large"
                placeholder="Stage"
                value={stageSelectValue}
                onChange={(value) => setStageFilter(value || '')}
                options={channel.key === 'postgraduate' ? PG_STAGE_OPTIONS : STAGE_OPTIONS}
              />
              <Select
                allowClear
                className="w-full min-w-[140px] sm:w-auto sm:min-w-[150px]"
                size="large"
                placeholder="Fee status"
                value={feeStatusFilter || undefined}
                onChange={(value) => setFeeStatusFilter(value || '')}
                options={FEE_OPTIONS}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 sm:px-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{pagination.total}</span>
            {' '}application{pagination.total === 1 ? '' : 's'}
            {hasActiveFilters ? ' matching filters' : ' in pipeline'}
          </p>
          <p className="text-xs text-slate-400">
            Downloads include institution header and current filters (up to 5,000 rows).
          </p>
        </div>

        <Table<ApplicationRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1760 }}
          tableLayout="fixed"
          className="applications-table"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
          }}
          onChange={onTableChange}
          locale={{ emptyText: hasActiveFilters ? 'No applications match your filters.' : 'No applications in the pipeline.' }}
        />
      </section>

      <Modal
        open={!!docModal}
        title={docModal?.title || 'Document'}
        onCancel={() => setDocModal(null)}
        width={920}
        centered
        destroyOnHidden
        footer={[
          <Button key="print" onClick={printDocModal}>Print</Button>,
          <Button key="download" onClick={downloadDocModal}>Download</Button>,
          <Button key="close" type="primary" onClick={() => setDocModal(null)}>Close</Button>,
        ]}
        styles={{ body: { padding: 0, background: '#f1f5f9' } }}
      >
        {docModal && (
          <iframe
            id="admissions-doc-frame"
            title={docModal.title}
            srcDoc={docModal.html}
            className="w-full border-0 bg-white"
            style={{ height: 'min(70vh, 720px)' }}
          />
        )}
      </Modal>

      <ApplicationDecisionModal
        open={!!decisionRow}
        row={decisionRow}
        referenceKind={channel.referenceColumn}
        canAdvance={decisionRow ? canAdvanceTo(decisionRow) : false}
        saving={moving}
        onClose={() => setDecisionRow(null)}
        onOpenFile={() => {
          if (!decisionRow) return;
          setFileId(decisionRow.id);
          setDecisionRow(null);
        }}
        onUpdate={async ({ to, decision, reason, acceptanceFeeAmount }) => {
          if (!decisionRow) return false;
          return move(decisionRow.id, to, decision, acceptanceFeeAmount, reason);
        }}
        onRevert={async ({ reason }) => {
          if (!decisionRow) return false;
          setMoving(true);
          try {
            await api.post(`/api/applications/${decisionRow.id}/revert`, {
              reason: reason || undefined,
            });
            message.success('Last decision reverted.');
            await load(pagination.current);
            return true;
          } catch (err: any) {
            message.error(err.response?.data?.message || 'Unable to revert this decision.');
            return false;
          } finally {
            setMoving(false);
          }
        }}
      />

      <ApplicationFileDrawer
        applicationId={fileId}
        open={fileId != null}
        onClose={() => setFileId(null)}
        onPrintForm={() => fileId && openDocument(fileId, 'form')}
        onPrintLetter={fileRow?.offer_reference ? () => fileId && openDocument(fileId, 'offer') : undefined}
        printing={fileId != null && printingId === fileId}
        onSaved={() => load(pagination.current)}
        extra={fileRow ? (
          <Button icon={<Eye size={14} />} onClick={() => setDecisionRow(fileRow)}>
            View
          </Button>
        ) : null}
      />
    </div>
  );
}
