import { useEffect, useState } from 'react';
import { Alert, Button, Input, Table, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import { Download, FileSpreadsheet, GraduationCap, Upload as UploadIcon } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { RefreshButton } from '../../components/RefreshButton';

type PendingStudent = {
  id: number;
  first_name?: string;
  last_name?: string;
  student_number?: string | null;
  matric_number?: string | null;
  email?: string | null;
  application_number?: string | null;
  programme?: string | null;
};

type ImportResult = {
  assigned?: number;
  skipped?: number;
  errors?: { row: number; application_number?: string; message: string }[];
};

export function JupebMatricPage() {
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [matric, setMatric] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const loadPending = () => {
    setLoading(true);
    api.get('/api/jupeb/matric/pending')
      .then(({ data }) => setPending(Array.isArray(data.data) ? data.data : []))
      .catch(() => setPending([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPending();
  }, []);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/jupeb/matric/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'jupeb-matric-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the template.');
    }
  };

  const assignOne = async () => {
    if (!selectedId) {
      message.warning('Select a student from the pending list.');
      return;
    }
    if (!matric.trim()) {
      message.warning('Enter the matric number.');
      return;
    }
    setAssigning(true);
    try {
      const res = await api.post('/api/jupeb/matric/assign', {
        student_id: selectedId,
        matric_number: matric.trim(),
      });
      if (isPendingApproval(res)) {
        return;
      }
      message.success(res.data.message || 'Matric number assigned.');
      setMatric('');
      setSelectedId(undefined);
      loadPending();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to assign the matric number.');
    } finally {
      setAssigning(false);
    }
  };

  const submitUpload = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('Choose a spreadsheet file to upload.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setResult(null);
    try {
      const res = await api.post('/api/jupeb/matric/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (isPendingApproval(res)) {
        setFileList([]);
        return;
      }
      setResult(res.data.data ?? res.data);
      setFileList([]);
      message.success(res.data.message || 'Import finished.');
      loadPending();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to import matric numbers.');
    } finally {
      setUploading(false);
    }
  };

  const columns: ColumnsType<PendingStudent> = [
    {
      title: 'Application no.',
      dataIndex: 'application_number',
      render: (value) => value || '—',
    },
    {
      title: 'Name',
      render: (_, row) => `${row.last_name || ''} ${row.first_name || ''}`.trim() || '—',
    },
    { title: 'Email', dataIndex: 'email', render: (value) => value || '—' },
    { title: 'Student no.', dataIndex: 'student_number', render: (value) => value || '—' },
    { title: 'Programme', dataIndex: 'programme', render: (value) => value || '—' },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Admission Setup"
        title="JUPEB matric numbers"
        description="JUPEB students are not given an automatic matric number. Assign one student at a time, or download the template and upload a filled spreadsheet."
        icon={GraduationCap}
      >
        <RefreshButton onClick={loadPending} />
        <Button icon={<Download size={14} />} onClick={downloadTemplate}>Template</Button>
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Pending" value={pending.length} hint="JUPEB students without a matric number" icon={GraduationCap} />
        <StatCard label="Assigned" value={result?.assigned ?? '—'} hint="Last spreadsheet upload" icon={FileSpreadsheet} />
        <StatCard label="Skipped" value={result?.skipped ?? '—'} hint="Rows with errors" icon={FileSpreadsheet} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Assign one student</h2>
        <p className="text-sm text-slate-600">Select a pending student, enter the official JUPEB matric number, then assign.</p>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Matric number</label>
            <Input
              value={matric}
              onChange={(e) => setMatric(e.target.value.toUpperCase())}
              placeholder="e.g. JUPEB/2026/0001"
            />
          </div>
          <Button type="primary" loading={assigning} onClick={assignOne} disabled={!selectedId}>
            Assign matric
          </Button>
        </div>
        {selectedId ? (
          <p className="text-xs text-slate-500">
            Selected: {pending.find((row) => row.id === selectedId)?.application_number
              || pending.find((row) => row.id === selectedId)?.email
              || `#${selectedId}`}
          </p>
        ) : (
          <p className="text-xs text-slate-500">Click a row in the table to select the student.</p>
        )}
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={pending}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No JUPEB students are waiting for a matric number.' }}
          rowClassName={(row) => (row.id === selectedId ? 'ant-table-row-selected' : '')}
          onRow={(row) => ({
            onClick: () => setSelectedId(row.id),
          })}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Upload spreadsheet</h2>
        <p className="text-sm text-slate-600">
          Download the template, fill one row per student on the Matric sheet, then upload.
          Required: matric_number plus application_number, student_number, email, or NIN.
          The Pending students sheet is a lookup — copy identifiers from there.
        </p>
        <Upload
          maxCount={1}
          accept=".xlsx,.xls,.csv"
          fileList={fileList}
          beforeUpload={(file) => {
            setFileList([{ uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
            return false;
          }}
          onRemove={() => setFileList([])}
        >
          <Button icon={<UploadIcon size={14} />}>Choose file</Button>
        </Upload>
        <Button type="primary" loading={uploading} onClick={submitUpload} disabled={!fileList.length}>
          Upload matric numbers
        </Button>
        {(result?.errors?.length ?? 0) > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${result?.errors?.length} row(s) could not be assigned`}
            description={
              <ul className="list-disc pl-5 text-sm">
                {(result?.errors || []).slice(0, 8).map((error) => (
                  <li key={error.row}>Row {error.row}: {error.message}</li>
                ))}
              </ul>
            }
          />
        )}
      </div>
    </div>
  );
}
