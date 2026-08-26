import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Select, Table, Upload, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import { BookOpen, ClipboardList, Download, GraduationCap, Upload as UploadIcon } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { RefreshButton } from '../../components/RefreshButton';

type CandidateRow = {
  id: number;
  rg_num: string;
  rg_candname?: string;
  rg_sex?: string;
  state_name?: string;
  rg_aggr?: number;
  co_name?: string;
  academic_year: string;
  created_at?: string;
};

type IntakeOption = {
  id: number;
  name: string;
  entry_mode?: string;
  session_label?: string | null;
  is_accepting?: boolean;
  is_open?: boolean;
  term?: { session_label?: string; name?: string } | null;
};

function intakeSessionLabel(item: IntakeOption) {
  return item.session_label || item.term?.session_label || '';
}

function intakeLabel(item: IntakeOption) {
  const session = intakeSessionLabel(item);
  return session ? `${item.name} · ${session}` : item.name;
}

export function CandidateDataPage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [filters, setFilters] = useState({ registration_number: '', candidate_name: '', academic_year: '' });
  const [uploadIntakeId, setUploadIntakeId] = useState<number | undefined>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const loadSessions = () => {
    api.get('/api/candidate-data/sessions')
      .then(({ data }) => {
        const list: IntakeOption[] = data.intakes ?? [];
        setIntakes(list);
        setUploadIntakeId((current) => {
          if (current && list.some((item) => item.id === current)) {
            return current;
          }
          const accepting = list.find((item) => item.is_accepting && intakeSessionLabel(item));
          const withSession = list.find((item) => intakeSessionLabel(item));
          return accepting?.id ?? withSession?.id ?? list[0]?.id;
        });
      })
      .catch(() => {});
  };

  const load = (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    api.get('/api/candidate-data', {
      params: {
        page,
        per_page: pageSize,
        registration_number: filters.registration_number || undefined,
        candidate_name: filters.candidate_name || undefined,
        academic_year: filters.academic_year || undefined,
      },
    })
      .then(({ data }) => {
        setRows(data.data ?? []);
        setPagination({
          current: data.current_page ?? page,
          pageSize: data.per_page ?? pageSize,
          total: data.total ?? 0,
        });
      })
      .catch((err) => {
        message.error(err.response?.data?.message || 'Unable to load candidate data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    load(1, pagination.pageSize);
  }, [filters.academic_year]);

  const intakeOptions = useMemo(
    () => intakes.map((item) => ({ value: item.id, label: intakeLabel(item) })),
    [intakes],
  );

  const filterOptions = useMemo(() => {
    const seen = new Set<string>();
    return intakes.flatMap((item) => {
      const year = intakeSessionLabel(item);
      if (!year || seen.has(year)) return [];
      seen.add(year);
      return [{ value: year, label: intakeLabel(item) }];
    });
  }, [intakes]);

  const columns: ColumnsType<CandidateRow> = [
    { title: 'JAMB no.', dataIndex: 'rg_num', key: 'rg_num' },
    { title: 'Candidate name', dataIndex: 'rg_candname', key: 'rg_candname' },
    { title: 'Sex', dataIndex: 'rg_sex', key: 'rg_sex', width: 80 },
    { title: 'State', dataIndex: 'state_name', key: 'state_name' },
    { title: 'Aggregate', dataIndex: 'rg_aggr', key: 'rg_aggr', width: 100 },
    { title: 'Course', dataIndex: 'co_name', key: 'co_name' },
    { title: 'Session', dataIndex: 'academic_year', key: 'academic_year', width: 120 },
  ];

  const handleTableChange = (pager: TablePaginationConfig) => {
    load(pager.current ?? 1, pager.pageSize ?? 25);
  };

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/candidate-data/import-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'candidate-data-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the template.');
    }
  };

  const submitUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('Choose a spreadsheet file to upload.');
      return;
    }
    if (!uploadIntakeId) {
      message.warning('Select the application session for this upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('intake_id', String(uploadIntakeId));

    setUploading(true);
    setUploadResult(null);
    try {
      const res = await api.post('/api/candidate-data/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (isPendingApproval(res)) {
        setFileList([]);
        return;
      }
      setUploadResult(res.data.message);
      setFileList([]);
      load(1, pagination.pageSize);
      message.success('Candidate data uploaded.');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Application setup"
        title="Candidate data"
        description="Upload JAMB candidate lists for an application session before applicants sign up. Students must verify their registration number against this list."
        icon={GraduationCap}
      >
        <RefreshButton onClick={() => load()} loading={loading} />
        <Button icon={<Download className="h-4 w-4" />} onClick={downloadTemplate}>Template</Button>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Candidates" value={pagination.total} hint="Matching current filters" icon={GraduationCap} />
        <StatCard label="On this page" value={rows.length} hint="Current table page" icon={ClipboardList} />
        <StatCard label="Application sessions" value={intakes.length} hint="Available application windows" icon={BookOpen} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Upload spreadsheet</h2>
        <p className="text-sm text-slate-600">
          Download the template, then upload Excel (.xlsx, .xls) or CSV. Required column: registration number.
          Optional columns include candidate name, sex, state, aggregate, course, LGA, and UTME subject scores.
          The application session is selected here, not in the file.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Application session</label>
            <Select
              className="w-full"
              placeholder="Select application session"
              value={uploadIntakeId}
              onChange={setUploadIntakeId}
              options={intakeOptions}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <Button icon={<Download className="h-4 w-4" />} onClick={downloadTemplate}>Template</Button>
          <Upload
            beforeUpload={() => false}
            maxCount={1}
            accept=".xlsx,.xls,.csv"
            fileList={fileList}
            onChange={({ fileList: next }) => setFileList(next)}
          >
            <Button icon={<UploadIcon className="h-4 w-4" />}>Choose file</Button>
          </Upload>
          <Button type="primary" loading={uploading} onClick={submitUpload}>
            Upload
          </Button>
        </div>
        {uploadResult && <Alert type="success" showIcon message={uploadResult} />}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <Form layout="inline" className="flex flex-wrap gap-2">
          <Form.Item label="JAMB no.">
            <Input
              value={filters.registration_number}
              onChange={(e) => setFilters((current) => ({ ...current, registration_number: e.target.value.toUpperCase() }))}
              placeholder="Search"
            />
          </Form.Item>
          <Form.Item label="Name">
            <Input
              value={filters.candidate_name}
              onChange={(e) => setFilters((current) => ({ ...current, candidate_name: e.target.value }))}
              placeholder="Search"
            />
          </Form.Item>
          <Form.Item label="Application session">
            <Select
              allowClear
              className="min-w-[220px]"
              placeholder="All sessions"
              value={filters.academic_year || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, academic_year: value ?? '' }))}
              options={filterOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item>
            <Button onClick={() => load(1, pagination.pageSize)}>Search</Button>
          </Form.Item>
        </Form>

        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
        />
      </div>
    </div>
  );
}
