import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { KeyRound, Search, X } from 'lucide-react';
import api from '../api';
import { RefreshButton } from '../components/RefreshButton';
import { Btn, inputClass, StatCard, WorkspaceHero } from '../components/ui';

type PermissionRow = {
  id: number;
  key: string;
  label: string;
  module: string;
};

export default function Permissions() {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [module, setModule] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback((page = 1, nextSearch = search, nextModule = module) => {
    setLoading(true);
    api
      .get('/api/permissions', {
        params: {
          page,
          search: nextSearch || undefined,
          module: nextModule || undefined,
        },
      })
      .then(({ data }) => {
        setRows(data.data ?? []);
        setPagination({
          current: data.current_page ?? page,
          pageSize: data.per_page ?? 20,
          total: data.total ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, [module, search]);

  useEffect(() => {
    api.get('/api/permissions', { params: { grouped: 1 } }).then(({ data }) => {
      setModules(Object.keys(data).sort());
    });
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch((current) => {
        const trimmed = searchInput.trim();
        if (current === trimmed) return current;
        load(1, trimmed, module);
        return trimmed;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, load, module]);

  const hasFilters = useMemo(() => Boolean(search || module), [search, module]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setModule(undefined);
    load(1, '', undefined);
  };

  const columns: ColumnsType<PermissionRow> = [
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 160,
      render: (value: string) => <span className="capitalize text-slate-500">{value}</span>,
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{key}</code>
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (label: string) => <span className="font-medium text-slate-800">{label}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Administration"
        title="Permission catalog"
        description="Read-only. Permissions are defined by the application — assign them on the Roles screen."
        icon={KeyRound}
      >
        <RefreshButton onClick={() => load(pagination.current, search, module)} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Permissions" value={pagination.total} hint="Matching current filters" icon={KeyRound} />
        <StatCard label="Modules" value={modules.length} hint="Permission groups" icon={KeyRound} />
        <StatCard label="This page" value={rows.length} icon={KeyRound} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72 max-w-full shrink-0">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className={`${inputClass} pl-9`}
              placeholder="Search key, label, or module"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = searchInput.trim();
                  setSearch(trimmed);
                  load(1, trimmed, module);
                }
              }}
            />
          </div>
          <Select
            allowClear
            placeholder="Module"
            value={module}
            onChange={(value) => {
              setModule(value);
              load(1, search, value);
            }}
            options={modules.map((m) => ({ value: m, label: m }))}
            className="min-w-[160px]"
          />
          {hasFilters && (
            <Btn type="button" variant="secondary" className="inline-flex items-center gap-1.5" onClick={clearFilters}>
              <X size={14} aria-hidden />
              Clear filters
            </Btn>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table<PermissionRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          size="middle"
          locale={{ emptyText: 'No permissions found.' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: false,
            onChange: (page) => load(page, search, module),
          }}
        />
      </div>
    </div>
  );
}
