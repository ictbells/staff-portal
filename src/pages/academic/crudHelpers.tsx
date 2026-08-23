import { useState } from 'react';
import { Button, Form, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';
import { ConfirmDeleteButton } from '../../components/ConfirmDeleteButton';
import { deleteResource, patchResource, postResource } from './useResourceList';

export function formatDisplayDate(value?: string | null) {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format('D MMM YYYY') : String(value).slice(0, 10);
}

export function toDateValue(value?: string | null) {
  return value ? dayjs(value) : undefined;
}

export function fromDateValue(value: unknown) {
  if (value && typeof value === 'object' && 'format' in value && typeof (value as { format: (f: string) => string }).format === 'function') {
    return (value as { format: (f: string) => string }).format('YYYY-MM-DD');
  }
  return value ?? null;
}

export function actionColumn<T extends { id: number }>(
  onEdit: (row: T) => void,
  onDelete: (row: T) => Promise<void>,
): ColumnsType<T>[number] {
  return {
    title: 'Actions',
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: (_, row) => (
      <Space size={4}>
        <Button type="link" size="small" onClick={() => onEdit(row)}>
          Edit
        </Button>
        <ConfirmDeleteButton onConfirm={() => onDelete(row)} />
      </Space>
    ),
  };
}

export function useCrudModal<T extends { id: number }>() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const openCreate = (defaults?: Record<string, unknown>) => {
    setEditing(null);
    form.resetFields();
    if (defaults) form.setFieldsValue(defaults);
    setOpen(true);
  };

  const openEdit = (row: T, values: Record<string, unknown>) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue(values);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const save = async (
    createUrl: string,
    updateUrl: (id: number) => string,
    payload: Record<string, unknown>,
    onSuccess: () => void,
  ) => {
    setSaving(true);
    try {
      if (editing) {
        await patchResource(updateUrl(editing.id), payload);
      } else {
        await postResource(createUrl, payload);
      }
      close();
      onSuccess();
    } catch {
      /* handled in helpers */
    } finally {
      setSaving(false);
    }
  };

  const remove = async (url: string, onSuccess: () => void) => {
    await deleteResource(url);
    onSuccess();
  };

  return {
    form,
    open,
    editing,
    saving,
    isEdit: editing != null,
    openCreate,
    openEdit,
    close,
    save,
    remove,
  };
}

export type CrudModalProps = {
  title: string;
  open: boolean;
  saving: boolean;
  isEdit: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
};

export { Form };
