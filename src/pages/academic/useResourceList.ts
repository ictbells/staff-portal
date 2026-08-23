import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import api from '../../api';
import { accessDeniedDescription } from '../../lib/portalAccess';

export function useResourceList<T>(endpoint: string, enabled = true) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setAccessError(null);
    api
      .get(endpoint)
      .then(({ data }) => setRows(Array.isArray(data) ? data : data.data ?? []))
      .catch((err) => {
        const reason = err.response?.data?.access_reason;
        if (err.response?.status === 403 && reason) {
          setAccessError(accessDeniedDescription(reason));
          return;
        }
        message.error('Unable to load records.');
      })
      .finally(() => setLoading(false));
  }, [endpoint, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, reload: load, accessError };
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export async function postResource(url: string, body: Record<string, unknown>) {
  try {
    await api.post(url, body);
    message.success('Saved successfully.');
  } catch (err: unknown) {
    message.error(apiError(err, 'Unable to save.'));
    throw err;
  }
}

export async function patchResource(url: string, body: Record<string, unknown>) {
  try {
    await api.patch(url, body);
    message.success('Updated successfully.');
  } catch (err: unknown) {
    message.error(apiError(err, 'Unable to update.'));
    throw err;
  }
}

export async function deleteResource(url: string) {
  try {
    await api.delete(url);
    message.success('Deleted successfully.');
  } catch (err: unknown) {
    message.error(apiError(err, 'Unable to delete.'));
    throw err;
  }
}
