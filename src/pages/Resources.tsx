import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, FileDown, FileText, FolderOpen } from 'lucide-react';
import api, { apiUrl } from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import { getNavItemAccess } from '../lib/portalAccess';
import { RefreshButton } from '../components/RefreshButton';
import { Badge, Btn, Card, DataTable, Spinner, StatCard, WorkspaceHero, tdClass, thClass, trClass } from '../components/ui';

type ResourceItem = {
  slug: string;
  title: string;
  description: string;
  version: string;
  updated_at: string;
  filename: string;
};

export default function Resources() {
  const { auth, has, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const access = useMemo(
    () => getNavItemAccess(
      { key: 'resources', perm: 'resources.view' },
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );

  const load = () => {
    if (!access.canAccess) return;
    setLoading(true);
    setError('');
    api
      .get('/api/resources')
      .then(({ data }) => setItems(data))
      .catch(() => setError('Unable to load resources.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [access.canAccess]);

  const download = async (item: ResourceItem, format: 'md' | 'pdf') => {
    const key = `${item.slug}:${format}`;
    setDownloading(key);
    setError('');
    try {
      const endpoint = format === 'pdf'
        ? `/api/resources/${item.slug}/pdf`
        : `/api/resources/${item.slug}/download`;
      const { data } = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'pdf'
        ? item.filename.replace(/\.md$/i, '.pdf')
        : item.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Download failed. You may not have permission or the file is unavailable.');
    } finally {
      setDownloading(null);
    }
  };

  if (authLoading) {
    return <Spinner label="Loading resources…" />;
  }
  if (!access.canAccess) {
    return <AccessDeniedPanel reason={access.reason} resourceLabel="Resources" />;
  }

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="System"
        title="Resources"
        description="Operational documents and standard operating procedures for authorised staff."
        icon={FolderOpen}
      >
        <RefreshButton onClick={load} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Documents" value={items.length} hint="SOPs available to your account" icon={FileText} />
        <StatCard label="API docs" value="Swagger" hint="Interactive route explorer" icon={BookOpen} />
      </div>

      <Card title="API documentation" description="Interactive Swagger UI for all registered API routes.">
        <p className="text-sm text-slate-600 mb-4">
          Explore and test endpoints. Authenticated routes require a bearer token from staff sign-in.
        </p>
        <Btn
          type="button"
          variant="secondary"
          className="inline-flex items-center gap-1.5"
          onClick={() => window.open(apiUrl('/api/docs', 'http://localhost:8000'), '_blank', 'noopener,noreferrer')}
        >
          Open API docs
        </Btn>
      </Card>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <Card
        title="Available documents"
        description="Read SOPs in the portal or download as PDF or Markdown."
      >
        {loading ? (
          <Spinner label="Loading documents…" />
        ) : (
          <DataTable empty={!items.length} emptyMessage="No resources are available for your account." colSpan={5}>
            <thead>
              <tr>
                <th className={thClass}>Document</th>
                <th className={thClass}>Version</th>
                <th className={thClass}>Updated</th>
                <th className={thClass}>Format</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            {!items.length ? null : (
              <tbody>
                {items.map((item) => (
                  <tr key={item.slug} className={trClass}>
                    <td className={tdClass}>
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-sky-50 p-2 text-sky-600 shrink-0">
                          <FileText className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{item.title}</div>
                          <p className="text-sm text-slate-500 mt-0.5 max-w-xl">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <Badge variant="info">v{item.version}</Badge>
                    </td>
                    <td className={`${tdClass} text-slate-600`}>{item.updated_at}</td>
                    <td className={`${tdClass} text-slate-600 text-xs`}>PDF, Markdown</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/resources/${item.slug}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                        >
                          <BookOpen className="h-3.5 w-3.5" aria-hidden />
                          Read
                        </Link>
                        <Btn
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={downloading === `${item.slug}:pdf`}
                          onClick={() => download(item, 'pdf')}
                          className="inline-flex items-center gap-1.5"
                        >
                          {downloading === `${item.slug}:pdf` ? (
                            <Spinner label="PDF…" />
                          ) : (
                            <>
                              <FileDown className="h-3.5 w-3.5" aria-hidden />
                              PDF
                            </>
                          )}
                        </Btn>
                        <Btn
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={downloading === `${item.slug}:md`}
                          onClick={() => download(item, 'md')}
                          className="inline-flex items-center gap-1.5"
                        >
                          {downloading === `${item.slug}:md` ? (
                            <Spinner label="…" />
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              MD
                            </>
                          )}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
