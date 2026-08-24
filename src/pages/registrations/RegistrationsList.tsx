import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Input, Select, Table, Tag, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  Award, BookOpen, Download, FileSpreadsheet, FileText, GraduationCap, Layers, Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { StatCard, WorkspaceHero } from '../../components/ui';
import type { RegistrationChannel, RegistrationChannelKey } from './constants';
import { ENTRY_MODES } from '../academic/constants';

const CHANNEL_ICON: Record<RegistrationChannelKey, LucideIcon> = {
  undergraduate: GraduationCap,
  jupeb: BookOpen,
  postgraduate: Award,
};

type RegistrationRow = {
  id: number;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  matric_number?: string | null;
  student_number?: string | null;
  user?: { name?: string; email?: string };
  program?: { name?: string; code?: string };
  application?: {
    entry_mode?: string;
    intake?: { name?: string; term?: { session_label?: string } };
  };
};

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((m) => m.value === mode)?.label ?? mode.toUpperCase();
}

function studentName(row: RegistrationRow) {
  const parts = [row.first_name, row.middle_name, row.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return row.user?.name || '—';
}

type Props = {
  channel: RegistrationChannel;
};

export function RegistrationsList({ channel }: Props) {
  const { has } = useAuth();
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [entryModeFilter, setEntryModeFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState<number | undefined>(undefined);
  const [programFilter, setProgramFilter] = useState<number | undefined>(undefined);
  const [sessions, setSessions] = useState<{ id: number; session_label: string; name?: string; is_current?: boolean }[]>([]);
  const [programs, setPrograms] = useState<{ id: number; name: string; code?: string | null }[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [summary, setSummary] = useState<{ by_entry_mode?: Record<string, number>; programmes?: number; total?: number } | null>(null);

  const entryModeOptions = useMemo(
    () => channel.entryModes.map((mode) => ({
      value: mode,
      label: entryModeLabel(mode),
    })),
    [channel.entryModes],
  );

  const sessionOptions = useMemo(
    () => sessions.map((term) => ({
      value: term.id,
      label: term.is_current ? `${term.session_label} (current)` : term.session_label,
    })),
    [sessions],
  );

  const programOptions = useMemo(
    () => programs.map((program) => ({
      value: program.id,
      label: program.code ? `${program.code} — ${program.name}` : program.name,
    })),
    [programs],
  );

  const hasActiveFilters = !!(search || entryModeFilter || sessionFilter || programFilter);

  const load = useCallback(async (
    page = 1,
    pageSize = pagination.pageSize,
    overrides?: {
      search?: string;
      entryMode?: string;
      session?: number | undefined;
      program?: number | undefined;
    },
  ) => {
    setLoading(true);
    try {
      const nextSearch = overrides && 'search' in overrides ? overrides.search ?? '' : search;
      const nextEntryMode = overrides && 'entryMode' in overrides ? overrides.entryMode ?? '' : entryModeFilter;
      const nextSession = overrides && 'session' in overrides ? overrides.session : sessionFilter;
      const nextProgram = overrides && 'program' in overrides ? overrides.program : programFilter;
      const { data } = await api.get('/api/registrations', {
        params: {
          entry_modes: channel.entryModes.join(','),
          entry_mode: nextEntryMode || undefined,
          academic_session_id: nextSession || undefined,
          program_id: nextProgram || undefined,
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
      message.error('Unable to load registrations.');
    } finally {
      setLoading(false);
    }
  }, [channel.entryModes, entryModeFilter, pagination.pageSize, programFilter, search, sessionFilter]);

  useEffect(() => {
    api.get('/api/registrations/sessions')
      .then(({ data }) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    setProgramFilter(undefined);
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
    setEntryModeFilter('');
    setSessionFilter(undefined);
    setProgramFilter(undefined);
    load(1, pagination.pageSize, {
      search: '',
      entryMode: '',
      session: undefined,
      program: undefined,
    });
  }, [channel.key]);

  useEffect(() => {
    load(1);
  }, [search, entryModeFilter, sessionFilter, programFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearch((prev) => (prev === next ? prev : next));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filterParams = useMemo(() => ({
    entry_modes: channel.entryModes.join(','),
    entry_mode: entryModeFilter || undefined,
    academic_session_id: sessionFilter || undefined,
    program_id: programFilter || undefined,
    search: search || undefined,
  }), [channel.entryModes, entryModeFilter, programFilter, search, sessionFilter]);

  const download = useCallback(async (format: 'pdf' | 'excel' | 'word') => {
    if (!has('registrations.view')) {
      message.error('You do not have permission to download registrations.');
      return;
    }
    setExporting(true);
    try {
      const { data } = await api.get('/api/registrations/export', {
        params: {
          ...filterParams,
          format,
          title: channel.title,
          show_entry_mode: channel.showEntryMode ? 1 : 0,
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
      link.download = `${channel.key}-registrations-${stamp}.${extension}`;
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
  }, [channel.key, channel.showEntryMode, channel.title, filterParams, has]);

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

  const columns: ColumnsType<RegistrationRow> = useMemo(() => {
    const cols: ColumnsType<RegistrationRow> = [
      {
        title: 'Student',
        key: 'student',
        width: 220,
        ellipsis: true,
        render: (_, row) => (
          <div className="overflow-hidden">
            <div className="font-medium text-slate-800 truncate">{studentName(row)}</div>
            <div className="text-xs text-slate-500 truncate">{row.user?.email || '—'}</div>
          </div>
        ),
      },
      {
        title: 'Matric no.',
        key: 'matric',
        width: 150,
        ellipsis: true,
        render: (_, row) => row.matric_number || row.student_number || '—',
      },
    ];

    if (channel.showEntryMode) {
      cols.push({
        title: 'Entry mode',
        key: 'entry_mode',
        width: 130,
        render: (_, row) => (
          <Tag color="blue">{entryModeLabel(row.application?.entry_mode || '')}</Tag>
        ),
      });
    }

    cols.push(
      {
        title: 'Programme',
        key: 'programme',
        width: 220,
        ellipsis: true,
        render: (_, row) => row.program?.name || row.program?.code || '—',
      },
      {
        title: 'Session',
        key: 'session',
        width: 130,
        ellipsis: true,
        render: (_, row) => row.application?.intake?.term?.session_label || '—',
      },
      {
        title: 'Tuition',
        key: 'tuition',
        width: 100,
        render: () => <Tag color="success">Paid</Tag>,
      },
    );

    return cols;
  }, [channel.showEntryMode]);

  const onTableChange = (next: TablePaginationConfig) => {
    const page = next.current ?? 1;
    const pageSize = next.pageSize ?? pagination.pageSize;
    setPagination((prev) => ({ ...prev, current: page, pageSize }));
    load(page, pageSize);
  };

  const registeredTotal = summary?.total ?? pagination.total;
  const programmesCount = summary?.programmes ?? 0;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Registrations"
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

      <div className={`grid grid-cols-2 ${channel.showEntryMode ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}>
        <StatCard
          label="Registered"
          value={registeredTotal}
          hint={hasActiveFilters && !entryModeFilter ? 'Matching current filters' : 'Tuition paid and matriculated'}
          icon={GraduationCap}
          tone="sky"
          active={!entryModeFilter}
          onClick={() => setEntryModeFilter('')}
        />
        {channel.showEntryMode ? channel.entryModes.map((mode) => (
          <StatCard
            key={mode}
            label={entryModeLabel(mode)}
            value={Number(summary?.by_entry_mode?.[mode] || 0)}
            hint="Click to filter this category"
            icon={Layers}
            tone="amber"
            active={entryModeFilter === mode}
            onClick={() => setEntryModeFilter((prev) => (prev === mode ? '' : mode))}
          />
        )) : (
          <StatCard
            label="Programmes"
            value={programmesCount}
            hint="Distinct programmes in this list"
            icon={BookOpen}
            tone="emerald"
          />
        )}
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
                placeholder="Search name, email, matric no…"
                className="!pl-9 w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
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
                placeholder="Session"
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
            </div>
          </div>
        </div>

        <div className="px-4 py-3 sm:px-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{pagination.total}</span>
            {' '}registration{pagination.total === 1 ? '' : 's'}
            {hasActiveFilters ? ' matching filters' : ' listed'}
          </p>
          <p className="text-xs text-slate-400">
            Downloads include institution header and current filters (up to 5,000 rows).
          </p>
        </div>

        <Table<RegistrationRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: channel.showEntryMode ? 1100 : 980 }}
          tableLayout="fixed"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
          }}
          onChange={onTableChange}
          locale={{ emptyText: hasActiveFilters ? 'No registrations match your filters.' : 'No registered students yet.' }}
        />
      </section>
    </div>
  );
}
