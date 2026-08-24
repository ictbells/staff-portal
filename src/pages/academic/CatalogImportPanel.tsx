import { useState } from 'react';
import { Alert, Button, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload';
import { Download, Upload as UploadIcon } from 'lucide-react';
import api from '../../api';

type ImportResult = {
  created?: number;
  skipped?: number;
  failed?: number;
  errors?: { row: number; message: string }[];
};

export function CatalogImportPanel({
  templateUrl,
  templateFilename,
  importUrl,
  description,
  onImported,
}: {
  templateUrl: string;
  templateFilename: string;
  importUrl: string;
  description: string;
  onImported: () => void;
}) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get(templateUrl, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = templateFilename;
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
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post(importUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setFileList([]);
      const created = Number(data.created || 0);
      const skipped = Number(data.skipped || 0);
      const failed = Number(data.failed || 0);
      message.success(`Imported ${created} new row(s). ${skipped} skipped. ${failed} failed.`);
      onImported();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Unable to import the spreadsheet.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border-b border-slate-100 space-y-3">
      <p className="text-sm text-slate-600">{description}</p>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Download size={14} />} onClick={downloadTemplate}>Template</Button>
        <Upload
          beforeUpload={() => false}
          maxCount={1}
          accept=".xlsx,.xls,.csv"
          fileList={fileList}
          onChange={({ fileList: next }) => setFileList(next)}
        >
          <Button icon={<UploadIcon size={14} />}>Choose file</Button>
        </Upload>
        <Button type="primary" loading={uploading} onClick={submitUpload}>Import</Button>
      </div>
      {result && (
        <Alert
          type={result.failed ? 'warning' : 'success'}
          showIcon
          message={`Created ${result.created || 0}. Skipped ${result.skipped || 0}. Failed ${result.failed || 0}.`}
        />
      )}
      {!!result?.errors?.length && (
        <ul className="text-sm text-slate-600 list-disc pl-5">
          {result.errors.slice(0, 8).map((error) => (
            <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
