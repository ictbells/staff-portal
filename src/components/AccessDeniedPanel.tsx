import { Alert } from 'antd';
import { ShieldX } from 'lucide-react';
import type { AccessReason } from '../lib/portalAccess';
import { accessDeniedDescription, accessDeniedTitle } from '../lib/portalAccess';

type Props = {
  reason: AccessReason;
  resourceLabel?: string;
};

export function AccessDeniedPanel({ reason, resourceLabel }: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <ShieldX className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-3 min-w-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {accessDeniedTitle(reason, resourceLabel)}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {accessDeniedDescription(reason)}
            </p>
          </div>
          <Alert
            type="warning"
            showIcon
            message="No access"
            description="You can still use other modules assigned to your office from the sidebar."
          />
        </div>
      </div>
    </div>
  );
}
