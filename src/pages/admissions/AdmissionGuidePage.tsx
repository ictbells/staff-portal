import { useEffect, useState } from 'react';
import { message } from 'antd';
import { BookOpen } from 'lucide-react';
import api, { isPendingApproval } from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { Badge, Btn, Card, fieldLabelClass, inputClass, WorkspaceHero } from '../../components/ui';

type Section = { heading: string; body: string };

type Guide = {
  id: number;
  title: string;
  intro?: string | null;
  sections: Section[];
  published_at?: string | null;
  updated_at?: string | null;
};

const emptySection = (): Section => ({ heading: '', body: '' });

export default function AdmissionGuidePage() {
  const { has } = useAuth();
  const canManage = has('admissions.guide');
  const [guide, setGuide] = useState<Guide | null>(null);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [sections, setSections] = useState<Section[]>([emptySection()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/api/staff/admission-guide')
      .then((r) => {
        const row = r.data as Guide;
        setGuide(row);
        setTitle(row.title || '');
        setIntro(row.intro || '');
        setSections(Array.isArray(row.sections) && row.sections.length ? row.sections : [emptySection()]);
      })
      .catch(() => message.error('Could not load the admission guide.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const setSection = (index: number, patch: Partial<Section>) => {
    setSections((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    setSections((current) => {
      const next = [...current];
      const target = index + dir;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const payload = () => ({
    title: title.trim(),
    intro: intro.trim(),
    sections: sections
      .map((row) => ({ heading: row.heading.trim(), body: row.body.trim() }))
      .filter((row) => row.heading || row.body),
  });

  const save = async () => {
    if (!title.trim()) {
      message.error('Title is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/api/staff/admission-guide', payload());
      if (isPendingApproval(res)) {
        message.success('Submitted for office approval.');
        return;
      }
      const row = res.data as Guide;
      setGuide(row);
      message.success('Admission guide saved.');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not save the guide.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    setSaving(true);
    try {
      const published = !!guide?.published_at;
      const res = await api.post(`/api/staff/admission-guide/${published ? 'unpublish' : 'publish'}`);
      if (isPendingApproval(res)) {
        message.success('Submitted for office approval.');
        return;
      }
      setGuide(res.data);
      message.success(published ? 'Guide unpublished. It is no longer shown on the student portal.' : 'Guide published on the student portal.');
    } catch (err: any) {
      message.error(err.response?.data?.message || err.response?.data?.errors?.title?.[0] || err.response?.data?.errors?.sections?.[0] || 'Could not change publish state.');
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    try {
      const { data } = await api.get('/api/staff/admission-guide/print', { responseType: 'text' });
      setPreviewHtml(data);
    } catch {
      message.error('Could not open the print preview.');
    }
  };

  const printPreview = () => {
    const frame = document.getElementById('admission-guide-preview') as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const downloadPreview = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admission-guide.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Applications"
        title="Admission guide"
        description="Edit the guide shown as a popup on the student portal landing page. Publishing makes it visible for applicants to read and download."
        icon={BookOpen}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={guide?.published_at ? 'success' : 'warning'}>
          {guide?.published_at ? 'Published' : 'Draft'}
        </Badge>
        {guide?.updated_at && (
          <span className="text-xs text-slate-500">
            Last saved {new Date(guide.updated_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <Card title="Guide content">
        <div className="space-y-4">
          <div>
            <label className={fieldLabelClass} htmlFor="guide-title">Title</label>
            <input id="guide-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className={fieldLabelClass} htmlFor="guide-intro">Introduction</label>
            <textarea id="guide-intro" className={`${inputClass} min-h-[96px]`} value={intro} onChange={(e) => setIntro(e.target.value)} disabled={!canManage} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className={fieldLabelClass}>Sections</p>
              {canManage && (
                <Btn variant="ghost" size="sm" onClick={() => setSections((current) => [...current, emptySection()])}>
                  Add section
                </Btn>
              )}
            </div>
            {sections.map((section, index) => (
              <div key={index} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section {index + 1}</p>
                  {canManage && (
                    <div className="flex flex-wrap gap-1">
                      <Btn variant="ghost" size="sm" disabled={index === 0} onClick={() => moveSection(index, -1)}>Up</Btn>
                      <Btn variant="ghost" size="sm" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>Down</Btn>
                      <Btn variant="danger" size="sm" onClick={() => setSections((current) => {
                        const next = current.filter((_, i) => i !== index);
                        return next.length ? next : [emptySection()];
                      })}>Remove</Btn>
                    </div>
                  )}
                </div>
                <input
                  className={inputClass}
                  placeholder="Heading"
                  value={section.heading}
                  onChange={(e) => setSection(index, { heading: e.target.value })}
                  disabled={!canManage}
                />
                <textarea
                  className={`${inputClass} min-h-[110px]`}
                  placeholder="Details"
                  value={section.body}
                  onChange={(e) => setSection(index, { body: e.target.value })}
                  disabled={!canManage}
                />
              </div>
            ))}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
              <Btn variant="secondary" onClick={togglePublish} disabled={saving}>
                {guide?.published_at ? 'Unpublish' : 'Publish'}
              </Btn>
              <Btn variant="ghost" onClick={openPreview}>Preview / print</Btn>
            </div>
          )}
        </div>
      </Card>

      {previewHtml && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50"
          onClick={() => setPreviewHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Admission guide preview"
        >
          <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Print preview</h3>
              <div className="flex gap-2">
                <button type="button" onClick={printPreview} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium">Print</button>
                <button type="button" onClick={downloadPreview} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium">Download</button>
                <button type="button" onClick={() => setPreviewHtml(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium">Close</button>
              </div>
            </div>
            <iframe id="admission-guide-preview" title="Admission guide" srcDoc={previewHtml} className="w-full h-[min(70vh,720px)] border-0 bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
