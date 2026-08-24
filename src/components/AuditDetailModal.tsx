import { Modal } from 'antd';
import { auditChanges, auditStateLines } from '../lib/auditDiff';
import { tdClass, thClass } from './ui';

export type AuditRow = {
  id: number;
  action: string;
  summary?: string;
  occurred_at?: string;
  actor_email?: string;
  actor_name?: string;
  module?: string;
  entity_type?: string | null;
  entity_id?: number | null;
  request_id?: string;
  ip?: string | null;
  device?: string | null;
  reason?: string | null;
  before_state?: unknown;
  after_state?: unknown;
};

export function AuditDetailModal({
  entry,
  open,
  onClose,
}: {
  entry: AuditRow | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;

  const changes = auditChanges(entry.before_state, entry.after_state);
  const hasStates = entry.before_state != null || entry.after_state != null;

  return (
    <Modal
      title="Audit entry details"
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      <div className="space-y-4 text-sm">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Action</dt>
            <dd className="font-medium text-slate-800">{entry.action}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">When</dt>
            <dd className="text-slate-700">{entry.occurred_at || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Actor</dt>
            <dd className="text-slate-700">{entry.actor_email || entry.actor_name || '—'}</dd>
            {entry.actor_name && entry.actor_email ? (
              <div className="text-xs text-slate-500 mt-0.5">{entry.actor_name}</div>
            ) : null}
          </div>
          {entry.reason && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Reason</dt>
              <dd className="text-slate-700">{entry.reason}</dd>
            </div>
          )}
          {entry.summary && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Summary</dt>
              <dd className="text-slate-700">{entry.summary}</dd>
            </div>
          )}
        </dl>

        {hasStates && (
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              {changes.length ? `Changes (${changes.length})` : 'No field changes recorded'}
            </h3>
            {changes.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className={thClass}>Field</th>
                      <th className={thClass}>Before</th>
                      <th className={thClass}>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((row) => (
                      <tr key={row.field} className="border-t border-slate-100">
                        <td className={`${tdClass} font-mono text-xs text-slate-600`}>{row.field}</td>
                        <td className={`${tdClass} text-rose-700 break-all`}>{row.before}</td>
                        <td className={`${tdClass} text-emerald-700 break-all`}>{row.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500">Before and after snapshots are identical.</p>
            )}
          </div>
        )}

        {hasStates && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StateBlock title="Before" state={entry.before_state} />
            <StateBlock title="After" state={entry.after_state} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function StateBlock({ title, state }: { title: string; state: unknown }) {
  const lines = auditStateLines(state);

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</h4>
      {lines.length ? (
        <dl className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-56 space-y-2">
          {lines.map(([field, value]) => (
            <div key={field}>
              <dt className="font-mono text-slate-500">{field}</dt>
              <dd className="text-slate-800 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">—</p>
      )}
    </div>
  );
}
