import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from '../components/AccessDeniedPanel';
import { getNavItemAccess } from '../lib/portalAccess';
import { Badge, Btn, Card, PageHeader, Spinner } from '../components/ui';

type ResourceDetail = {
  slug: string;
  title: string;
  description: string;
  version: string;
  updated_at: string;
  filename: string;
  content_markdown: string;
};

export default function ResourceView() {
  const { slug } = useParams<{ slug: string }>();
  const { auth, has, loading: authLoading } = useAuth();
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<'md' | 'pdf' | null>(null);

  const access = useMemo(
    () => getNavItemAccess(
      { key: 'resources', perm: 'resources.view' },
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    ),
    [auth?.nav_link_keys, auth?.nav_unrestricted, has],
  );

  useEffect(() => {
    if (!slug || !access.canAccess) return;
    api
      .get(`/api/resources/${slug}`)
      .then(({ data }) => setResource(data))
      .catch(() => setError('Unable to load this document.'))
      .finally(() => setLoading(false));
  }, [access.canAccess, slug]);

  const download = async (format: 'md' | 'pdf') => {
    if (!resource) return;
    setDownloading(format);
    setError('');
    try {
      const endpoint = format === 'pdf'
        ? `/api/resources/${resource.slug}/pdf`
        : `/api/resources/${resource.slug}/download`;
      const { data } = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'pdf'
        ? resource.filename.replace(/\.md$/i, '.pdf')
        : resource.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Download failed.');
    } finally {
      setDownloading(null);
    }
  };

  if (authLoading) {
    return <Spinner label="Loading…" />;
  }
  if (!access.canAccess) {
    return <AccessDeniedPanel reason={access.reason} resourceLabel="Resources" />;
  }

  if (loading) {
    return <Spinner label="Loading document…" />;
  }

  if (!resource) {
    return (
      <div className="space-y-4">
        <Link to="/resources" className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to resources
        </Link>
        <p className="text-red-700">{error || 'Document not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Link to="/resources" className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline w-fit">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to resources
        </Link>

        <PageHeader
          title={resource.title}
          description={resource.description}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">v{resource.version}</Badge>
            <span className="text-xs text-slate-500">Updated {resource.updated_at}</span>
            <Btn
              type="button"
              size="sm"
              variant="secondary"
              disabled={downloading === 'pdf'}
              className="inline-flex items-center gap-1.5"
              onClick={() => download('pdf')}
            >
              {downloading === 'pdf' ? <Spinner label="Preparing PDF…" /> : (
                <>
                  <FileDown className="h-3.5 w-3.5" aria-hidden />
                  Download PDF
                </>
              )}
            </Btn>
            <Btn
              type="button"
              size="sm"
              variant="ghost"
              disabled={downloading === 'md'}
              className="inline-flex items-center gap-1.5"
              onClick={() => download('md')}
            >
              {downloading === 'md' ? <Spinner label="Downloading…" /> : (
                <>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Markdown
                </>
              )}
            </Btn>
          </div>
        </PageHeader>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <Card title="Document" description="Read the full standard operating procedure below.">
        <article className="sop-prose max-w-none text-slate-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {resource.content_markdown}
          </ReactMarkdown>
        </article>
      </Card>
    </div>
  );
}
