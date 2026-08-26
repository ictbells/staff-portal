import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Checkbox, Dropdown, Form, Input, Modal, Select, message } from 'antd';
import { Download, Play, Save } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { useAuth } from '../../auth';
import { AccessDeniedPanel } from '../../components/AccessDeniedPanel';
import { getNavItemAccess } from '../../lib/portalAccess';
import {
  Card, DataTable, Spinner, TablePager, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { downloadMenu, downloadReport } from './download';
import {
  emptyDefinition,
  operatorLabel,
  type ReportAggregation,
  type ReportDataset,
  type ReportDefinition,
  type ReportFilter,
  type ReportRunResult,
  type SavedReport,
} from './types';

const AGG_FNS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

export default function ReportBuilder() {
  const { id } = useParams();
  const [params] = useSearchParams();
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

  const [datasets, setDatasets] = useState<ReportDataset[]>([]);
  const [datasetKey, setDatasetKey] = useState(params.get('dataset') || '');
  const [definition, setDefinition] = useState<ReportDefinition | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');
  const [preview, setPreview] = useState<ReportRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  const dataset = datasets.find((item) => item.key === datasetKey) || null;

  useEffect(() => {
    if (!access.canAccess) {
      setLoading(false);
      return;
    }
    api.get('/api/reports/datasets')
      .then(async ({ data }) => {
        const list: ReportDataset[] = data.data || [];
        setDatasets(list);
        if (id) {
          const saved = await api.get(`/api/reports/saved/${id}`);
          const report: SavedReport = saved.data;
          setName(report.name);
          setDescription(report.description || '');
          setVisibility(report.visibility);
          setDatasetKey(report.dataset_key);
          setDefinition({
            dataset: report.dataset_key,
            columns: report.definition.columns || [],
            filters: report.definition.filters || [],
            group_by: report.definition.group_by || [],
            aggregations: report.definition.aggregations || [],
            sorts: report.definition.sorts || [],
          });
          return;
        }
        const initial = params.get('dataset') || list[0]?.key || '';
        setDatasetKey(initial);
        const found = list.find((item) => item.key === initial);
        if (found) setDefinition(emptyDefinition(found));
      })
      .catch((err) => {
        if (err.response?.status === 403) setDenied(true);
        else message.error(err.response?.data?.message || 'Unable to load the report builder.');
      })
      .finally(() => setLoading(false));
  }, [access.canAccess, id]);

  useEffect(() => {
    if (id || !dataset || definition?.dataset === dataset.key) return;
    setDefinition(emptyDefinition(dataset));
    setPreview(null);
  }, [dataset?.key, id]);

  const grouped = (definition?.group_by.length || 0) > 0;

  const run = useCallback(async (page = 1) => {
    if (!definition) return;
    setRunning(true);
    try {
      const { data } = await api.post('/api/reports/run', {
        ...definition,
        page,
        per_page: 25,
        saved_report_id: id ? Number(id) : undefined,
      });
      setPreview(data);
    } catch (err: any) {
      if (err.response?.status === 403) setDenied(true);
      else message.error(err.response?.data?.message || 'Unable to run this report.');
    } finally {
      setRunning(false);
    }
  }, [definition, id]);

  const save = async () => {
    if (!definition || !canManage) return;
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        dataset_key: definition.dataset,
        definition,
        visibility,
      };
      if (id) {
        const res = await api.patch(`/api/reports/saved/${id}`, payload);
        if (!isPendingApproval(res)) {
          message.success('Report updated.');
        }
        setSaveOpen(false);
      } else {
        const res = await api.post('/api/reports/saved', payload);
        if (isPendingApproval(res)) {
          setSaveOpen(false);
          return;
        }
        message.success('Report saved.');
        navigate(`/reports/${res.data.id}/edit`, { replace: true });
        setSaveOpen(false);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to save this report.');
    } finally {
      setSaving(false);
    }
  };

  const exportNow = async (format: 'pdf' | 'excel' | 'word') => {
    if (!definition) return;
    setExporting(true);
    await downloadReport(definition, format, name || dataset?.label || 'Report');
    setExporting(false);
  };

  const update = (patch: Partial<ReportDefinition>) => {
    setDefinition((current) => (current ? { ...current, ...patch } : current));
  };

  if (authLoading || loading) return <Spinner label="Loading report builder…" />;
  if (!access.canAccess) return <AccessDeniedPanel reason={access.reason} resourceLabel="Reports" />;
  if (denied) return <AccessDeniedPanel reason="missing_permission" resourceLabel="this dataset" />;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="System"
        title={id ? (name || 'Edit report') : 'New report'}
        description="Choose columns, filters, and optional grouping. Preview stays inside the datasets your role can access."
        icon={Play}
      >
        <Link to="/reports" className="text-sm text-sky-100 underline-offset-2 hover:underline">Back to reports</Link>
        <Button icon={<Play size={14} />} loading={running} onClick={() => run(1)}>Preview</Button>
        {canManage && (
          <Button type="primary" icon={<Save size={14} />} onClick={() => setSaveOpen(true)}>Save</Button>
        )}
        <Dropdown menu={{ items: downloadMenu(exportNow) }} trigger={['click']} disabled={exporting || !definition}>
          <Button icon={<Download size={14} />} loading={exporting}>Download</Button>
        </Dropdown>
      </WorkspaceHero>

      {dataset && definition && (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Dataset" description="Only datasets you have permission to query are listed.">
              <Select
                className="w-full"
                value={datasetKey}
                disabled={Boolean(id)}
                onChange={(value) => setDatasetKey(value)}
                options={datasets.map((item) => ({ value: item.key, label: `${item.category} · ${item.label}` }))}
              />
              <p className="text-sm text-slate-500 mt-2">{dataset.description}</p>
            </Card>
            <Card title="Grouping" description="Leave empty for a row listing. Grouping returns counts and totals.">
              <Select
                mode="multiple"
                className="w-full"
                placeholder="Group by…"
                value={definition.group_by}
                onChange={(group_by) => update({
                  group_by,
                  aggregations: group_by.length > 0 && definition.aggregations.length === 0
                    ? [{ fn: 'count', field: '*', as: 'total' }]
                    : definition.aggregations,
                })}
                options={dataset.columns.map((column) => ({ value: column.key, label: column.label }))}
              />
            </Card>
          </div>

          {!grouped && (
            <Card title="Columns">
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {dataset.columns.map((column) => (
                  <Checkbox
                    key={column.key}
                    checked={definition.columns.includes(column.key)}
                    onChange={(event) => {
                      const columns = event.target.checked
                        ? [...definition.columns, column.key]
                        : definition.columns.filter((key) => key !== column.key);
                      update({ columns });
                    }}
                  >
                    {column.label}
                  </Checkbox>
                ))}
              </div>
            </Card>
          )}

          {grouped && (
            <Card title="Aggregations">
              <div className="space-y-2">
                {definition.aggregations.map((aggregation, index) => (
                  <div key={index} className="grid sm:grid-cols-3 gap-2">
                    <Select
                      value={aggregation.fn}
                      options={AGG_FNS}
                      onChange={(fn) => {
                        const aggregations = [...definition.aggregations];
                        aggregations[index] = { ...aggregation, fn };
                        update({ aggregations });
                      }}
                    />
                    <Select
                      value={aggregation.field}
                      options={[
                        { value: '*', label: 'Records' },
                        ...dataset.columns.filter((column) => column.aggregatable).map((column) => ({
                          value: column.key,
                          label: column.label,
                        })),
                      ]}
                      onChange={(field) => {
                        const aggregations = [...definition.aggregations];
                        aggregations[index] = { ...aggregation, field };
                        update({ aggregations });
                      }}
                    />
                    <Input
                      value={aggregation.as}
                      placeholder="Alias"
                      onChange={(event) => {
                        const aggregations = [...definition.aggregations];
                        aggregations[index] = { ...aggregation, as: event.target.value.replace(/[^a-z0-9_]/g, '') };
                        update({ aggregations });
                      }}
                    />
                  </div>
                ))}
                <Button
                  onClick={() => update({
                    aggregations: [...definition.aggregations, { fn: 'count', field: '*', as: `total_${definition.aggregations.length + 1}` } as ReportAggregation],
                  })}
                >
                  Add aggregation
                </Button>
              </div>
            </Card>
          )}

          <Card title="Filters">
            <div className="space-y-2">
              {definition.filters.map((filter, index) => {
                const column = dataset.columns.find((item) => item.key === filter.field);
                return (
                  <div key={index} className="grid sm:grid-cols-4 gap-2">
                    <Select
                      value={filter.field}
                      options={dataset.columns.map((item) => ({ value: item.key, label: item.label }))}
                      onChange={(field) => {
                        const next = [...definition.filters];
                        const nextColumn = dataset.columns.find((item) => item.key === field);
                        next[index] = { field, op: nextColumn?.operators[0] || 'eq', value: '' };
                        update({ filters: next });
                      }}
                    />
                    <Select
                      value={filter.op}
                      options={(column?.operators || []).map((op) => ({ value: op, label: operatorLabel(op) }))}
                      onChange={(op) => {
                        const next = [...definition.filters];
                        next[index] = { ...filter, op };
                        update({ filters: next });
                      }}
                    />
                    {filter.op === 'is_null' || filter.op === 'is_not_null' ? (
                      <div className="text-sm text-slate-500 self-center">No value needed</div>
                    ) : column?.type === 'enum' ? (
                      <Select
                        mode={filter.op === 'in' ? 'multiple' : undefined}
                        className="w-full"
                        value={filter.value as any}
                        options={(column.options || []).map((item) => ({ value: item, label: item }))}
                        onChange={(value) => {
                          const next = [...definition.filters];
                          next[index] = { ...filter, value };
                          update({ filters: next });
                        }}
                      />
                    ) : (
                      <Input
                        value={Array.isArray(filter.value) ? filter.value.join(',') : String(filter.value ?? '')}
                        placeholder={filter.op === 'between' ? 'from,to' : 'Value'}
                        onChange={(event) => {
                          const next = [...definition.filters];
                          const raw = event.target.value;
                          next[index] = {
                            ...filter,
                            value: filter.op === 'in' || filter.op === 'between' ? raw.split(',').map((part) => part.trim()) : raw,
                          };
                          update({ filters: next as ReportFilter[] });
                        }}
                      />
                    )}
                    <Button onClick={() => update({ filters: definition.filters.filter((_, i) => i !== index) })}>
                      Remove
                    </Button>
                  </div>
                );
              })}
              <Button
                onClick={() => update({
                  filters: [...definition.filters, { field: dataset.columns[0].key, op: dataset.columns[0].operators[0], value: '' }],
                })}
              >
                Add filter
              </Button>
            </div>
          </Card>

          <Card title="Sort">
            <div className="grid sm:grid-cols-2 gap-2">
              <Select
                allowClear
                className="w-full"
                placeholder="Sort field"
                value={definition.sorts[0]?.field}
                options={dataset.columns.filter((column) => column.sortable).map((column) => ({ value: column.key, label: column.label }))}
                onChange={(field) => update({
                  sorts: field ? [{ field, dir: definition.sorts[0]?.dir || 'asc' }] : [],
                })}
              />
              <Select
                className="w-full"
                value={definition.sorts[0]?.dir || 'asc'}
                options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
                onChange={(dir) => update({
                  sorts: definition.sorts[0]?.field ? [{ field: definition.sorts[0].field, dir }] : [],
                })}
              />
            </div>
          </Card>
        </>
      )}

      {preview && (
        <Card title="Preview" description={preview.filter_summary.join(' · ') || 'No filters applied.'}>
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

      <Modal
        title={id ? 'Update saved report' : 'Save report'}
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText="Save"
      >
        <Form layout="vertical">
          <Form.Item label="Name" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Form.Item>
          <Form.Item label="Description">
            <Input.TextArea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </Form.Item>
          <Form.Item label="Visibility">
            <Select
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: 'private', label: 'Private — only me' },
                { value: 'shared', label: 'Shared — staff who can access this dataset' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
