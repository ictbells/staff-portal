import type { AxiosResponse } from 'axios';
import { message } from 'antd';
import api from '../../api';
import type { ReportDefinition } from './types';

export async function downloadReport(definition: ReportDefinition, format: 'pdf' | 'excel' | 'word', title: string) {
  try {
    const { data } = await api.post('/api/reports/export', {
      ...definition,
      format,
      title,
    }, { responseType: 'blob' });
    const mime = format === 'pdf'
      ? 'application/pdf'
      : format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx';
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    if (blob.type.includes('application/json')) {
      const parsed = JSON.parse(await blob.text());
      message.error(parsed.message || 'Unable to download the report.');
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '-').toLowerCase()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    const blob = err.response?.data;
    if (blob instanceof Blob) {
      try {
        message.error(JSON.parse(await blob.text()).message || 'Unable to download the report.');
        return;
      } catch {
        message.error('Unable to download the report.');
        return;
      }
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
