import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Select } from 'antd';
import { BarChart3, Plus } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { AccessDeniedPanel } from '../../components/AccessDeniedPanel';
import { RefreshButton } from '../../components/RefreshButton';
import { getNavItemAccess } from '../../lib/portalAccess';
import { Badge, Card, DataTable, Spinner, WorkspaceHero, tdClass, thClass, trClass } from '../../components/ui';
import type { ReportDataset, SavedReport } from './types';

export default function ReportsHome() {
  const navigate = useNavigate();
  const { auth, has, loading: authLoading } = useAuth();
  const [datasets, setDatasets] = useState<ReportDataset[]>([]);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canManage = has('reports.manage');

  const access = useMemo(
    () => getNavItemAccess(
      { key: 'reports', perm: 'reports.view' },
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );

  const load = () => {
    if (!access.canAccess) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/api/reports/datasets'),
      api.get('/api/reports/saved'),
    ])
      .then(([datasetRes, savedRes]) => {
        setDatasets(datasetRes.data.data || []);
        setSaved(savedRes.data.data || []);
      })
      .catch(() => setError('Unable to load reports.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [access.canAccess]);

  const datasetOptions = useMemo(() => {
    const map = new Map<string, ReportDataset[]>();
    datasets.forEach((dataset) => {
      const list = map.get(dataset.category) ?? [];
      list.push(dataset);
      map.set(dataset.category, list);
    });
    return [...map.entries()].map(([category, items]) => ({
      label: category,
      options: items.map((dataset) => ({ value: dataset.key, label: dataset.label })),
    }));
  }, [datasets]);

  const chosen = datasets.find((dataset) => dataset.key === selectedDataset);

  const openBuilder = (key?: string) => {
    const datasetKey = key || selectedDataset;
    if (!datasetKey) return;
    navigate(`/reports/new?dataset=${encodeURIComponent(datasetKey)}`);
  };

  if (authLoading) return <Spinner label="Loading reports…" />;
  if (!access.canAccess) {
    return <AccessDeniedPanel reason={access.reason} resourceLabel="Reports" />;
  }

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="System"
        title="Reports"
        description="Build tabular reports from allowlisted datasets you are permitted to see. Save definitions to rerun later."
        icon={BarChart3}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Card title="New report" description="Choose a dataset you are allowed to query, then open the builder.">
        {datasets.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">No datasets are available for your role. Ask an administrator to grant the matching domain permissions.</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Select
                showSearch
                className="w-full"
                placeholder="Select a dataset"
                optionFilterProp="label"
                value={selectedDataset}
                options={datasetOptions}
                loading={loading}
                onChange={(value) => setSelectedDataset(value)}
              />
              {chosen && <p className="text-sm text-slate-500">{chosen.description}</p>}
            </div>
            <Button type="primary" icon={<Plus size={14} />} disabled={!selectedDataset} onClick={() => openBuilder()}>
              Build report
            </Button>
          </div>
        )}
      </Card>

      <Card title="Saved reports" description="Private reports you created and shared reports you can run.">
        <DataTable colSpan={5}>
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Dataset</th>
              <th className={thClass}>Visibility</th>
              <th className={thClass}>Owner</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {saved.length === 0 && (
              <tr>
                <td className={`${tdClass} text-slate-500`} colSpan={5}>No saved reports yet.</td>
              </tr>
            )}
            {saved.map((report) => {
              const dataset = datasets.find((item) => item.key === report.dataset_key);
              return (
                <tr key={report.id} className={trClass}>
                  <td className={tdClass}>
                    <div className="font-medium text-slate-800">{report.name}</div>
                    {report.description && <div className="text-xs text-slate-500">{report.description}</div>}
                  </td>
                  <td className={tdClass}>{dataset?.label || report.dataset_key}</td>
                  <td className={tdClass}>
                    <Badge variant={report.visibility === 'shared' ? 'info' : 'default'}>
                      {report.visibility}
                    </Badge>
                  </td>
                  <td className={`${tdClass} text-slate-500`}>{report.creator?.name || '—'}</td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <Link to={`/reports/${report.id}`} className="text-sky-700 text-sm font-medium">Open</Link>
                    {canManage && (
                      <Link to={`/reports/${report.id}/edit`} className="ml-3 text-slate-600 text-sm">Edit</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
}
