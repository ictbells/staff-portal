import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Dropdown, Modal, message } from 'antd';
import { Download, Pencil, Trash2 } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { useAuth } from '../../auth';
import { AccessDeniedPanel } from '../../components/AccessDeniedPanel';
import { getNavItemAccess } from '../../lib/portalAccess';
import {
  Badge, Card, DataTable, Spinner, TablePager, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { downloadMenu, downloadReport } from './download';
import type { ReportDefinition, ReportRunResult, SavedReport } from './types';

export default function ReportRun() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth, has, loading: authLoading } = useAuth();
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

  const [report, setReport] = useState<SavedReport | null>(null);
  const [preview, setPreview] = useState<ReportRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [denied, setDenied] = useState<'missing_permission' | 'missing_portal_link' | 'missing_both' | null>(null);

  const definition: ReportDefinition | null = report
    ? {
        dataset: report.dataset_key,
        columns: report.definition.columns || [],
        filters: report.definition.filters || [],
        group_by: report.definition.group_by || [],
        aggregations: report.definition.aggregations || [],
        sorts: report.definition.sorts || [],
      }
    : null;

  const run = async (page = 1, current = definition) => {
    if (!current) return;
    setRunning(true);
    try {
      const { data } = await api.post('/api/reports/run', {
        ...current,
        page,
        per_page: 25,
        saved_report_id: Number(id),
      });
      setPreview(data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setDenied(err.response?.data?.access_reason || 'missing_permission');
      } else {
        message.error(err.response?.data?.message || 'Unable to run this report.');
      }
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!access.canAccess || !id) {
      setLoading(false);
      return;
    }
    api.get(`/api/reports/saved/${id}`)
      .then(async ({ data }) => {
        setReport(data);
        const def: ReportDefinition = {
          dataset: data.dataset_key,
          columns: data.definition.columns || [],
          filters: data.definition.filters || [],
          group_by: data.definition.group_by || [],
          aggregations: data.definition.aggregations || [],
          sorts: data.definition.sorts || [],
        };
        await run(1, def);
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setDenied(err.response?.data?.access_reason || 'missing_permission');
        } else if (err.response?.status === 404) {
          message.error('Report not found.');
          navigate('/reports');
        } else {
          message.error('Unable to load this report.');
        }
      })
      .finally(() => setLoading(false));
  }, [access.canAccess, id]);

  const remove = () => {
    Modal.confirm({
      title: 'Delete this saved report?',
      content: 'This cannot be undone.',
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await api.delete(`/api/reports/saved/${id}`);
        if (!isPendingApproval(res)) {
          message.success('Report deleted.');
        }
        navigate('/reports');
      },
    });
  };

  if (authLoading || loading) return <Spinner label="Loading report…" />;
  if (!access.canAccess) return <AccessDeniedPanel reason={access.reason} resourceLabel="Reports" />;
  if (denied) return <AccessDeniedPanel reason={denied} resourceLabel="this report" />;
  if (!report) return <p className="text-slate-500">Unable to load this report.</p>;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="System"
        title={report.name}
        description={report.description || 'Saved custom report.'}
        icon={Download}
      >
        <Link to="/reports" className="text-sm text-sky-100 underline-offset-2 hover:underline">Back to reports</Link>
        {canManage && (
          <Link to={`/reports/${report.id}/edit`}>
            <Button icon={<Pencil size={14} />}>Edit</Button>
          </Link>
        )}
        {canManage && (
          <Button danger icon={<Trash2 size={14} />} onClick={remove}>Delete</Button>
        )}
        <Dropdown
          menu={{ items: downloadMenu(async (format) => {
            if (!definition) return;
            setExporting(true);
            await downloadReport(definition, format, report.name);
            setExporting(false);
          }) }}
          trigger={['click']}
          disabled={exporting}
        >
          <Button type="primary" icon={<Download size={14} />} loading={exporting}>Download</Button>
        </Dropdown>
      </WorkspaceHero>

      <div className="flex items-center gap-2">
        <Badge variant={report.visibility === 'shared' ? 'info' : 'default'}>{report.visibility}</Badge>
        <span className="text-sm text-slate-500">{report.creator?.name || 'Unknown owner'}</span>
      </div>

      {preview && (
        <Card title="Results" description={preview.filter_summary.join(' · ') || 'No filters applied.'}>
          <DataTable colSpan={preview.columns.length}>
            <thead>
              <tr>
                {preview.columns.map((column) => (
                  <th key={column.key} className={thClass}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.length === 0 && (
                <tr>
                  <td className={`${tdClass} text-slate-500`} colSpan={preview.columns.length}>No matching rows.</td>
                </tr>
              )}
              {preview.rows.map((row, index) => (
                <tr key={index} className={trClass}>
                  {preview.columns.map((column) => (
                    <td key={column.key} className={tdClass}>{row[column.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>
          <TablePager
            page={preview.meta.current_page}
            lastPage={preview.meta.last_page}
            total={preview.meta.total}
            from={preview.meta.from}
            to={preview.meta.to}
            onChange={(page) => run(page)}
            disabled={running}
          />
        </Card>
      )}
    </div>
  );
}
