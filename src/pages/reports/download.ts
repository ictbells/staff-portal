import type { AxiosResponse } from 'axios';
import { message } from 'antd';
import api from '../../api';
import type { ReportDefinition } from './types';

function mimeFor(format: 'pdf' | 'excel' | 'word') {
  return format === 'pdf'
    ? 'application/pdf'
    : format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

async function errorFromBlob(blob: Blob): Promise<string | null> {
  const prefix = (await blob.slice(0, 8).text()).trim();
  if (prefix.startsWith('%PDF') || prefix.startsWith('PK')) return null;
  if (blob.type.includes('json') || prefix.startsWith('{')) {
    try {
      const parsed = JSON.parse(await blob.text());
      return parsed.message || 'Unable to download the report.';
    } catch {
      return 'Unable to download the report.';
    }
  }
  if (blob.type.includes('html') || prefix.startsWith('<')) {
    return 'Unable to generate the PDF. Try Excel or Word, or narrow the filters.';
  }
  return null;
}

export async function downloadReport(definition: ReportDefinition, format: 'pdf' | 'excel' | 'word', title: string) {
  try {
    const { data } = await api.post('/api/reports/export', {
      ...definition,
      format,
      title,
    }, { responseType: 'blob' });
    const mime = mimeFor(format);
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const error = await errorFromBlob(blob);
    if (error) {
      message.error(error);
      return;
    }
    const file = new Blob([blob], { type: mime });
    const url = window.URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '-').toLowerCase()}.${format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    const blob = err.response?.data;
    if (blob instanceof Blob) {
      message.error((await errorFromBlob(blob)) || 'Unable to download the report.');
      return;
    }
    message.error(err.response?.data?.message || 'Unable to download the report.');
  }
}

export function downloadMenu(onSelect: (format: 'pdf' | 'excel' | 'word') => void) {
  return [
    { key: 'pdf', label: 'PDF', onClick: () => onSelect('pdf') },
    { key: 'excel', label: 'Excel', onClick: () => onSelect('excel') },
    { key: 'word', label: 'Word', onClick: () => onSelect('word') },
  ];
}

export function isAxiosOk(response: AxiosResponse) {
  return response.status >= 200 && response.status < 300;
}
