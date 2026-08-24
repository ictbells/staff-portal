import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Select, Table, Upload, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import { BookOpen, ClipboardList, GraduationCap, Upload as UploadIcon } from 'lucide-react';
import api from '../../api';
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

type Term = { id: number; session_label: string; name: string; is_current?: boolean };

export function CandidateDataPage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessions, setSessions] = useState<Term[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [filters, setFilters] = useState({ registration_number: '', candidate_name: '', academic_year: '' });
  const [uploadYear, setUploadYear] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const loadSessions = () => {
    api.get('/api/candidate-data/sessions')
      .then(({ data }) => {
        const list = data.terms ?? [];
        const openSessions: string[] = data.open_intake_sessions ?? [];
        setSessions(list);
        if (!uploadYear) {
          if (openSessions.length) {
            setUploadYear(openSessions[0]);
          } else {
            const current = list.find((term: Term) => term.is_current) ?? list[0];
            if (current) setUploadYear(current.session_label);
          }
        }
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

  const sessionOptions = useMemo(
    () => sessions.map((term) => ({ value: term.session_label, label: term.session_label })),
    [sessions],
  );

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

  const submitUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('Choose a spreadsheet file to upload.');
      return;
    }
    if (!uploadYear) {
      message.warning('Select the academic session for this upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('academic_year', uploadYear);

    setUploading(true);
    setUploadResult(null);
    try {
      const { data } = await api.post('/api/candidate-data/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(data.message);
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
        eyebrow="Admission setup"
        title="Candidate data"
        description="Upload JAMB candidate lists before applicants sign up. Students must verify their registration number against this list."
        icon={GraduationCap}
      >
        <RefreshButton onClick={() => load()} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Candidates" value={pagination.total} hint="Matching current filters" icon={GraduationCap} />
        <StatCard label="On this page" value={rows.length} hint="Current table page" icon={ClipboardList} />
        <StatCard label="Sessions" value={sessions.length} hint="Available academic years" icon={BookOpen} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Upload spreadsheet</h2>
        <p className="text-sm text-slate-600">
          Accepted formats: Excel (.xlsx, .xls) or CSV. Required column: registration number (`rg_num`, `registration_number`, etc.).
          Optional columns include candidate name, sex, state, aggregate, course, LGA, and UTME subject scores.
        </p>
        <div className="grid gap-3 md:grid-cols-[240px_1fr_auto] md:items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Academic session</label>
            <Select
              className="w-full"
              placeholder="Select session"
              value={uploadYear || undefined}
              onChange={setUploadYear}
              options={sessionOptions}
            />
          </div>
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
          <Form.Item label="Session">
            <Select
              allowClear
              className="min-w-[160px]"
              placeholder="All sessions"
              value={filters.academic_year || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, academic_year: value ?? '' }))}
              options={sessionOptions}
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
