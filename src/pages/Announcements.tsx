import { useEffect, useState } from 'react';
import { message } from 'antd';
import { Megaphone } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, TablePager, WorkspaceHero, tdClass, thClass, trClass,
} from '../components/ui';

const AUDIENCE_OPTIONS = [
  { value: 'students', label: 'Students' },
  { value: 'applicants', label: 'Applicants' },
  { value: 'students_and_applicants', label: 'Students and applicants' },
];

const emptyForm = {
  title: '',
  body: '',
  audience: 'students',
  publish: true,
};

function audienceLabel(value?: string) {
  return AUDIENCE_OPTIONS.find((o) => o.value === value)?.label
    || (value === 'all' ? 'Everyone (legacy)' : value || '—');
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_SIZE = 15;

export default function Announcements() {
  const { has } = useAuth();
  const canManage = has('announcements.manage');
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0, from: 0, to: 0, published: 0, drafts: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = (nextPage = page) => {
    setLoading(true);
    api.get('/api/announcements', { params: { page: nextPage, per_page: PAGE_SIZE } })
      .then((r) => {
        const body = r.data || {};
        const list = Array.isArray(body.data) ? body.data : [];
        const current = Number(body.current_page || nextPage);
        if (list.length === 0 && current > 1) {
          setPage(current - 1);
          return;
        }
        setRows(list);
        setMeta({
          page: current,
          lastPage: Math.max(1, Number(body.last_page || 1)),
          total: Number(body.total || 0),
          from: body.from ?? 0,
          to: body.to ?? 0,
          published: Number(body.published_count || 0),
          drafts: Number(body.draft_count || 0),
        });
      })
      .catch(() => {
        setRows([]);
        message.error('Could not load announcements.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const startEdit = (row: any) => {
    setEditing(row);
    setForm({
      title: row.title || '',
      body: row.body || '',
      audience: AUDIENCE_OPTIONS.some((o) => o.value === row.audience) ? row.audience : 'students',
      publish: !!row.published_at,
    });
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      message.error('Title and message are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/announcements/${editing.id}`, {
          title: form.title.trim(),
          body: form.body.trim(),
          audience: form.audience,
        });
        message.success('Announcement updated.');
      } else {
        await api.post('/api/announcements', {
          title: form.title.trim(),
          body: form.body.trim(),
          audience: form.audience,
          publish: form.publish,
        });
        message.success(form.publish ? 'Announcement published.' : 'Draft saved.');
      }
      const wasEditing = !!editing;
      resetForm();
      if (wasEditing) load(page);
      else if (page === 1) load(1);
      else setPage(1);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (row: any) => {
    try {
      if (row.published_at) {
        await api.post(`/api/announcements/${row.id}/unpublish`);
        message.success('Announcement unpublished.');
      } else {
        await api.post(`/api/announcements/${row.id}/publish`);
        message.success('Announcement published. Matching students were notified.');
      }
      load(page);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not change publish state.');
    }
  };

  const remove = async (row: any) => {
    try {
      await api.delete(`/api/announcements/${row.id}`);
      if (editing?.id === row.id) resetForm();
      message.success('Announcement deleted.');
      load(page);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not delete announcement.');
    }
  };

  const published = meta.published;
  const drafts = meta.drafts;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="System"
        title="Announcements"
        description="Compose campus notices for students and, optionally, applicants. Publishing sends an in-app notification."
        icon={Megaphone}
      >
        <RefreshButton onClick={() => load(page)} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="All" value={meta.total} hint="Drafts and published" icon={Megaphone} />
        <StatCard label="Published" value={published} hint="Visible in the student portal" icon={Megaphone} tone="emerald" />
        <StatCard label="Drafts" value={drafts} hint="Not yet visible" icon={Megaphone} tone="amber" />
      </div>

      {canManage && (
        <Card title={editing ? 'Edit announcement' : 'Compose announcement'}>
          <div className="space-y-3">
            <div>
              <label className={fieldLabelClass}>Title</label>
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Title"
              />
            </div>
            <div>
              <label className={fieldLabelClass}>Message</label>
              <textarea
                className={`${inputClass} min-h-[120px]`}
                value={form.body}
                onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
                placeholder="Message body"
              />
            </div>
            <div>
              <label className={fieldLabelClass}>Audience</label>
              <select
                className={inputClass}
                value={form.audience}
                onChange={(e) => setForm((s) => ({ ...s, audience: e.target.value }))}
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {!editing && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => setForm((s) => ({ ...s, publish: e.target.checked }))}
                />
                Publish now (notify matching students / applicants)
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <Btn onClick={save} disabled={saving}>{editing ? 'Save changes' : form.publish ? 'Publish' : 'Save draft'}</Btn>
              {editing && (
                <Btn variant="secondary" onClick={resetForm}>Cancel</Btn>
              )}
            </div>
          </div>
        </Card>
      )}

      <DataTable empty={!rows.length} emptyMessage="No announcements yet." colSpan={5}>
        <thead>
          <tr>
            <th className={thClass}>Title</th>
            <th className={thClass}>Audience</th>
            <th className={thClass}>Status</th>
            <th className={thClass}>Date</th>
            {canManage && <th className={`${thClass} text-right`}>Actions</th>}
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={trClass}>
                <td className={`${tdClass} align-top`}>
                  <div className="font-medium text-slate-900">{a.title}</div>
                  <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-3">{a.body}</div>
                </td>
                <td className={`${tdClass} align-top`}>{audienceLabel(a.audience)}</td>
                <td className={`${tdClass} align-top`}>
                  <Badge variant={a.published_at ? 'success' : 'warning'}>
                    {a.published_at ? 'Published' : 'Draft'}
                  </Badge>
                </td>
                <td className={`${tdClass} align-top whitespace-nowrap`}>
                  {formatWhen(a.published_at || a.created_at)}
                </td>
                {canManage && (
                  <td className={`${tdClass} text-right align-top`}>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => startEdit(a)}>Edit</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => togglePublish(a)}>
                        {a.published_at ? 'Unpublish' : 'Publish'}
                      </Btn>
                      <ConfirmDeleteButton
                        title={`Delete “${a.title}”?`}
                        description="Students will no longer see this notice."
                        onConfirm={() => remove(a)}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
      <TablePager
        page={meta.page}
        lastPage={meta.lastPage}
        total={meta.total}
        from={meta.from}
        to={meta.to}
        onChange={setPage}
        disabled={loading}
      />
    </div>
  );
}
