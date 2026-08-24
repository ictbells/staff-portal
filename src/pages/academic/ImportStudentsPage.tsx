import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Select, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload';
import { Download, FileSpreadsheet, GraduationCap, Upload as UploadIcon } from 'lucide-react';
import api from '../../api';
import { StatCard, WorkspaceHero } from '../../components/ui';
import { RefreshButton } from '../../components/RefreshButton';
import { ENTRY_MODES } from './constants';

type IntakeOption = {
  id: number;
  name: string;
  entry_mode: string;
  is_open?: boolean;
  term?: { session_label?: string; name?: string };
};

type ImportResult = {
  status?: string;
  queued?: boolean;
  import_id?: string;
  created?: number;
  skipped?: number;
  emailed?: number;
  nin_failed?: number;
  invoices_posted?: number;
  wallet_posted?: number;
  errors?: { row: number; email?: string; nin?: string; matric_number?: string; message: string }[];
  message?: string;
};

export function ImportStudentsPage() {
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);
  const [intakeId, setIntakeId] = useState<number | undefined>();
  const [entryMode, setEntryMode] = useState('utme');
  const [verifyNin, setVerifyNin] = useState(false);
  const [sendCredentials, setSendCredentials] = useState(true);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const loadOptions = () => {
    api.get('/api/students/import-options')
      .then(({ data }) => {
        const list: IntakeOption[] = data.intakes ?? [];
        setIntakes(list);
        setIntakeId((current) => {
          if (current && list.some((item) => item.id === current)) {
            return current;
          }
          const match = list.find((item) => item.entry_mode === entryMode) ?? list[0];
          return match?.id;
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const intakeOptions = useMemo(
    () => intakes
      .filter((item) => item.entry_mode === entryMode)
      .map((item) => ({
        value: item.id,
        label: `${item.name}${item.term?.session_label ? ` · ${item.term.session_label}` : ''}`,
      })),
    [intakes, entryMode],
  );

  useEffect(() => {
    if (!intakeOptions.some((item) => item.value === intakeId)) {
      setIntakeId(intakeOptions[0]?.value);
    }
  }, [entryMode]);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get('/api/students/import-template', {
        params: { entry_mode: entryMode },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the template.');
    }
  };

  const pollStatus = async (importId: string) => {
    const { data } = await api.get(`/api/students/import/${importId}`);
    setResult(data);
    if (data.status === 'queued' || data.status === 'processing') {
      window.setTimeout(() => {
        pollStatus(importId).catch(() => message.error('Unable to refresh import progress.'));
      }, 2500);
    } else if (data.status === 'done') {
      message.success(`Imported ${data.created || 0} student(s).`);
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
    if (!intakeId) {
      message.warning('Select an application window.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('intake_id', String(intakeId));
    formData.append('entry_mode', entryMode);
    formData.append('verify_nin', verifyNin ? '1' : '0');
    formData.append('send_credentials', sendCredentials ? '1' : '0');
    setUploading(true);
    setResult(null);
    try {
      const { data } = await api.post('/api/students/import', formData, {
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
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to import students.');
    } finally {
      setUploading(false);
    }
  };

  const downloadErrors = async () => {
    if (!result?.import_id) return;
    try {
      const { data } = await api.get(`/api/students/import/${result.import_id}/errors`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-import-errors.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Unable to download the error spreadsheet.');
    }
  };

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Enrolment"
        title="Import students"
        description="Create continuing students with a supplied matric number, a historical application file, and portal login. Import invoices and wallet history first so owing and registration follow real payment records."
        icon={GraduationCap}
      >
        <RefreshButton onClick={loadOptions} />
        <Button icon={<Download size={14} />} onClick={downloadTemplate}>Template</Button>
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Created" value={result?.created ?? '—'} hint="New student records" icon={GraduationCap} />
        <StatCard label="Skipped" value={result?.skipped ?? '—'} hint="Rows with errors" icon={FileSpreadsheet} />
        <StatCard label="Invoices posted" value={result?.invoices_posted ?? '—'} hint="Staged invoices attached" icon={FileSpreadsheet} />
        <StatCard label="Wallet posted" value={result?.wallet_posted ?? '—'} hint="Staged wallet rows replayed" icon={Download} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Upload spreadsheet</h2>
        <p className="text-sm text-slate-600">
          Download the template, fill one row per student on the Students sheet, then upload. Login uses the supplied matric number.
          The workbook also includes Campuses, Colleges, Departments, Programmes, and Levels so you can copy codes and IDs.
          Copy programme_code from Programmes and current_level from Levels.
          Required columns: email, phone, nin, first_name, last_name, programme_code, matric_number, current_level.
          Application stage is matriculated. Students appear under Registrations only when tuition invoices show at least 25% paid.
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 md:items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <Select
              className="w-full"
              value={entryMode}
              onChange={setEntryMode}
              options={ENTRY_MODES}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Application window</label>
            <Select
              className="w-full"
              placeholder="Select window"
              value={intakeId}
              onChange={setIntakeId}
              options={intakeOptions}
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
          <Button type="primary" loading={uploading} onClick={submitUpload}>Import students</Button>
        </div>
        <div className="flex flex-col gap-2">
          <Checkbox checked={verifyNin} onChange={(e) => setVerifyNin(e.target.checked)}>
            Verify NIN during upload (Prembly is called for every row)
          </Checkbox>
          <Checkbox checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)}>
            Email portal passwords (login ID is the matric number)
          </Checkbox>
        </div>
        {verifyNin && (
          <Alert type="warning" showIcon message="NIN verification calls Prembly for each row. Large files are queued so the request does not time out." />
        )}
        {result?.queued && (result.status === 'queued' || result.status === 'processing') && (
          <Alert type="info" showIcon message="Import is running in the background. This summary will update when it finishes." />
        )}
        {result?.status === 'done' && (
          <Alert
            type="success"
            showIcon
            message={`Imported ${result.created || 0} student(s). ${result.skipped || 0} skipped. ${result.invoices_posted || 0} invoice(s) posted. ${result.wallet_posted || 0} wallet row(s) posted.`}
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
      </div>
    </div>
  );
}
