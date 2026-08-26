import { useLocation, useNavigate } from 'react-router-dom';
import { FileQuestion, Home, LogIn } from 'lucide-react';
import { useAuth } from '../auth';
import { Btn } from '../components/ui';

export default function NotFound() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname || '/';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
          <FileQuestion className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">404</p>
          <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-600">
            The page <span className="font-mono text-slate-800 break-all">{path}</span> does not exist
            or is no longer available.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {auth ? (
            <Btn className="!inline-flex gap-2" type="button" onClick={() => navigate('/')}>
              <Home className="h-4 w-4" aria-hidden />
              Back to home
            </Btn>
          ) : (
            <Btn className="!inline-flex gap-2" type="button" onClick={() => navigate('/login')}>
              <LogIn className="h-4 w-4" aria-hidden />
              Sign in
            </Btn>
          )}
          <Btn variant="secondary" type="button" onClick={() => window.history.back()}>
            Go back
          </Btn>
        </div>
      </div>
    </div>
  );
}
