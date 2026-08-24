import { useEffect, useState } from 'react';
import { Alert, Button, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload';
import { Download, FileSpreadsheet, Upload as UploadIcon, Wallet } from 'lucide-react';
import api from '../../api';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { RefreshButton } from '../../components/RefreshButton';

type PendingRow = { matric_number: string; rows: number };

type ImportResult = {
  status?: string;
  queued?: boolean;
  import_id?: string;
  posted?: number;
  pending?: number;
  skipped?: number;
  pending_by_matric?: PendingRow[];
  errors?: { row: number; matric_number?: string; invoice_number?: string; message: string }[];
  message?: string;
};

export function ImportInvoicesPage() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);

  const loadPending = () => {
    api.get('/api/invoices/import-pending')
      .then(({ data }) => setPending(data.pending_by_matric ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadPending();
  }, []);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/invoices/import-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'invoice-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the template.');
    }
  };

  const pollStatus = async (importId: string) => {
    const { data } = await api.get(`/api/invoices/import/${importId}`);
    setResult(data);
    if (data.status === 'queued' || data.status === 'processing') {
      window.setTimeout(() => {
        pollStatus(importId).catch(() => message.error('Unable to refresh import progress.'));
      }, 2500);
    } else if (data.status === 'done') {
      message.success(`Posted ${data.posted || 0} invoice(s).`);
      loadPending();
    } else if (data.status === 'failed') {
      message.error(data.message || 'Import failed.');
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
      const { data } = await api.post('/api/invoices/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.queued && data.import_id) {
        setResult({ queued: true, status: 'queued', import_id: data.import_id });
        message.info('Import queued. This page will refresh when it finishes.');
        await pollStatus(data.import_id);
      } else {
        setResult(data.data ?? data);
        setFileList([]);
        message.success(data.message || 'Import finished.');
        loadPending();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to import invoices.');
    } finally {
      setUploading(false);
    }
  };

  const downloadErrors = async () => {
    if (!result?.import_id) return;
    try {
      const { data } = await api.get(`/api/invoices/import/${result.import_id}/errors`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'invoice-import-errors.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the error spreadsheet.');
    }
  };

  const pendingList = result?.pending_by_matric ?? pending;

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Import invoices"
        description="Load billed fees and recorded payments by matric number. Rows for students who are not in the system yet stay pending until Import students runs. Wallet credits are a separate sheet."
        icon={Wallet}
      >
        <RefreshButton onClick={loadPending} />
        <Button icon={<Download size={14} />} onClick={downloadTemplate}>Template</Button>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Posted" value={result?.posted ?? '—'} hint="Attached to a student" icon={Wallet} />
        <StatCard label="Pending" value={result?.pending ?? pendingList.length} hint="Waiting for student import" icon={FileSpreadsheet} />
        <StatCard label="Skipped" value={result?.skipped ?? '—'} hint="Rows with errors" icon={FileSpreadsheet} />
        <StatCard label="Matrics waiting" value={pendingList.length} hint="Distinct matric numbers" icon={FileSpreadsheet} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Upload spreadsheet</h2>
        <p className="text-sm text-slate-600">
          One row is one invoice. Extra rows with the same invoice_number add extra payments.
          Tuition requires installment_percent (25/50/75/100). paid_amount records money received on the invoice — it does not credit the wallet.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <Upload
            beforeUpload={() => false}
            maxCount={1}
            accept=".xlsx,.xls,.csv"
            fileList={fileList}
            onChange={({ fileList: next }) => setFileList(next)}
          >
            <Button icon={<UploadIcon className="h-4 w-4" />}>Choose file</Button>
          </Upload>
          <Button type="primary" loading={uploading} onClick={submitUpload}>Import invoices</Button>
        </div>
        {result?.queued && (result.status === 'queued' || result.status === 'processing') && (
          <Alert type="info" showIcon message="Import is running in the background. This summary will update when it finishes." />
        )}
        {result?.status === 'done' && (
          <Alert
            type="success"
            showIcon
            message={`Posted ${result.posted || 0} invoice(s). ${result.pending || 0} pending. ${result.skipped || 0} skipped.`}
          />
        )}
        {!!result?.errors?.length && (
          <div className="space-y-2">
            <Button onClick={downloadErrors}>Download failed rows</Button>
            <ul className="text-sm text-slate-600 list-disc pl-5">
              {result.errors.slice(0, 8).map((error) => (
                <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>
              ))}
            </ul>
          </div>
        )}
        {!!pendingList.length && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Pending by matric</h3>
            <ul className="text-sm text-slate-600 list-disc pl-5">
              {pendingList.slice(0, 20).map((row) => (
                <li key={row.matric_number}>{row.matric_number}: {row.rows} row(s)</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
