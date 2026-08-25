import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Modal, Popconfirm, Select, Tag } from 'antd';
import type { AdmissionsReferenceColumn } from './constants';
import { ENTRY_MODES } from '../academic/constants';

export type DecisionApplication = {
  id: number;
  application_number?: string | null;
  jamb_registration?: string | null;
  offer_reference?: string | null;
  entry_mode: string;
  stage: string;
  submitted_at?: string | null;
  user?: { name?: string; email?: string; jamb_registration?: string | null };
  program?: {
    name?: string;
    code?: string;
    department?: { id?: number; name?: string; faculty?: { id?: number; name?: string } };
  };
  intake?: { name?: string; acceptance_fee_amount?: number | string; term?: { session_label?: string } };
  application_fee_invoice?: { status?: string };
  eligibility?: { meets: boolean; failed?: { rule: string; message: string }[] };
  workflow?: {
    next_stage?: string;
    next_label?: string;
    next_permission?: string;
    can_revert?: boolean;
    revert?: { restore_stage: string; restore_label: string; last_decision?: string | null; last_to_stage?: string } | null;
  };
  previous_university?: string | null;
  credit_assessment_complete?: boolean;
};

export type DecisionPayload = {
  to: string;
  decision?: string;
  reason?: string;
  acceptanceFeeAmount?: number;
};

export type RevertPayload = {
  reason?: string;
};

const NEXT_STAGE: Record<string, string> = {
  submitted: 'screening',
  screening: 'verification',
  verification: 'shortlisting',
  shortlisting: 'recommended',
  recommended: 'approved',
  approved: 'offer_issued',
};

function nextFor(row: DecisionApplication) {
  if (row.workflow?.next_stage) return row.workflow.next_stage;
  if (row.entry_mode === 'transfer' && row.stage === 'verification') return 'credit_assessment';
  if (row.entry_mode === 'transfer' && row.stage === 'credit_assessment') return 'shortlisting';
  return NEXT_STAGE[row.stage];
}

function formatStage(stage?: string) {
  return (stage || '—').replace(/_/g, ' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((item) => item.value === mode)?.label ?? mode.toUpperCase();
}

function stageTagColor(stage: string): string {
  const map: Record<string, string> = {
    submitted: 'default',
    screening: 'processing',
    verification: 'processing',
    credit_assessment: 'cyan',
    shortlisting: 'purple',
    recommended: 'gold',
    approved: 'success',
    offer_issued: 'success',
    awaiting_acceptance_fee: 'warning',
    rejected: 'error',
    matriculated: 'success',
  };
  return map[stage] || 'default';
}

function referenceValue(row: DecisionApplication, kind: AdmissionsReferenceColumn) {
  if (kind === 'jamb') {
    if (row.entry_mode === 'transfer') return row.previous_university || '—';
    return row.jamb_registration || row.user?.jamb_registration || '—';
  }
  return row.application_number || '—';
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-slate-800 break-words">{children}</div>
    </div>
  );
}

export function ApplicationDecisionModal({
  open,
  row,
  referenceKind,
  canAdvance,
  saving,
  onClose,
  onUpdate,
  onRevert,
  onOpenFile,
}: {
  open: boolean;
  row: DecisionApplication | null;
  referenceKind: AdmissionsReferenceColumn;
  canAdvance: boolean;
  saving?: boolean;
  onClose: () => void;
  onUpdate: (payload: DecisionPayload) => Promise<boolean> | boolean;
  onRevert?: (payload: RevertPayload) => Promise<boolean> | boolean;
  onOpenFile?: () => void;
}) {
  const next = row ? nextFor(row) : undefined;
  const options = useMemo(() => {
    if (!row) return [];
    const items: { value: string; label: string }[] = [];
    if (next && canAdvance) {
      const label = row.workflow?.next_label || formatStage(next);
      const issuesOffer = next === 'offer_issued' || next === 'admission';
      items.push({
        value: next,
        label: issuesOffer ? `Issue offer — ${label}` : `Advance to ${label}`,
      });
    }
    if (row.stage !== 'rejected') {
      items.push({ value: 'rejected', label: 'Reject application' });
    }
    return items;
  }, [canAdvance, next, row]);

  const [decision, setDecision] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [revertReason, setRevertReason] = useState('');
  const [acceptanceAmount, setAcceptanceAmount] = useState<number | undefined>();
  const canRevert = Boolean(onRevert && row?.workflow?.can_revert && row.workflow.revert?.restore_stage);

  useEffect(() => {
    if (!open || !row) return;
    setDecision(options[0]?.value);
    setReason('');
    setRevertReason('');
    setAcceptanceAmount(undefined);
  }, [open, options, row]);

  const issuesOffer = decision === 'offer_issued' || decision === 'admission';
  const rejecting = decision === 'rejected';
  const needsCredit = row?.entry_mode === 'transfer'
    && !row.credit_assessment_complete
    && decision === 'shortlisting';

  const submit = async () => {
    if (!row || !decision) return;
    if (rejecting && !reason.trim()) return;
    const ok = await onUpdate({
      to: decision,
      decision: rejecting ? 'rejected' : 'advanced',
      reason: reason.trim() || undefined,
      acceptanceFeeAmount: issuesOffer ? acceptanceAmount : undefined,
    });
    if (ok) onClose();
  };

  const revert = async () => {
    if (!row || !onRevert) return;
    const ok = await onRevert({ reason: revertReason.trim() || undefined });
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      title={row?.user?.name ? `View application — ${row.user.name}` : 'View application'}
      onCancel={onClose}
      destroyOnHidden
      width={640}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        onOpenFile ? (
          <Button key="file" onClick={onOpenFile}>Open file</Button>
        ) : undefined,
        options.length > 0 ? (
          <Button
            key="update"
            type="primary"
            loading={saving}
            disabled={!decision || (rejecting && !reason.trim()) || needsCredit}
            onClick={submit}
          >
            Update decision
          </Button>
        ) : undefined,
        canRevert ? (
          <Popconfirm
            key="revert"
            title="Revert last decision?"
            description={`This returns the file to ${row?.workflow?.revert?.restore_label || 'the previous stage'}.`}
            okText="Revert"
            okButtonProps={{ danger: true, loading: saving }}
            onConfirm={revert}
          >
            <Button danger loading={saving}>Revert last decision</Button>
          </Popconfirm>
        ) : undefined,
      ].filter(Boolean)}
    >
      {row && (
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Tag color={stageTagColor(row.stage)}>{formatStage(row.stage)}</Tag>
              <Tag color="blue">{entryModeLabel(row.entry_mode)}</Tag>
              {row.eligibility && row.entry_mode === 'pg' && (
                <Tag color={row.eligibility.meets ? 'success' : 'warning'}>
                  {row.eligibility.meets ? 'Meets eligibility' : 'Does not meet eligibility'}
                </Tag>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Fact label="Applicant">{row.user?.name || '—'}</Fact>
              <Fact label="Email">{row.user?.email || '—'}</Fact>
              <Fact label={referenceKind === 'jamb' ? 'JAMB / previous school' : 'Application number'}>
                {referenceValue(row, referenceKind)}
              </Fact>
              <Fact label="Submitted">{formatDateTime(row.submitted_at)}</Fact>
              <Fact label="College">{row.program?.department?.faculty?.name || '—'}</Fact>
              <Fact label="Department">{row.program?.department?.name || '—'}</Fact>
              <Fact label="Programme">
                {row.program?.name || '—'}
                {row.program?.code ? ` (${row.program.code})` : ''}
              </Fact>
              <Fact label="Application session">
                {row.intake?.name || row.intake?.term?.session_label || '—'}
                {row.intake?.name && row.intake?.term?.session_label
                  ? ` · ${row.intake.term.session_label}`
                  : ''}
              </Fact>
              <Fact label="Application fee">{row.application_fee_invoice?.status || '—'}</Fact>
              {row.offer_reference && <Fact label="Offer reference">{row.offer_reference}</Fact>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Decision</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select the outcome for this file, then update the decision.
              </p>
            </div>
            {options.length === 0 && !canRevert ? (
              <p className="text-sm text-slate-600">This file has no further admissions decision.</p>
            ) : (
              <>
                {options.length > 0 && (
                  <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select decision</label>
                  <Select
                    className="w-full"
                    placeholder="Select decision"
                    value={decision}
                    options={options}
                    onChange={(value) => setDecision(value)}
                  />
                </div>
                {issuesOffer && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Acceptance fee (₦)</label>
                    <InputNumber
                      min={0}
                      className="w-full"
                      placeholder="Optional — catalog, then session default"
                      value={acceptanceAmount}
                      onChange={(value) => setAcceptanceAmount(value ?? undefined)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {rejecting ? 'Reason' : 'Note (optional)'}
                  </label>
                  <Input.TextArea
                    rows={3}
                    placeholder={rejecting ? 'Reason for rejection' : 'Optional note on this decision'}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                {needsCredit && (
                  <p className="text-sm text-amber-700">
                    Complete credit transfer assessment on the application file before shortlisting.
                  </p>
                )}
                {rejecting && !reason.trim() && (
                  <p className="text-sm text-amber-700">A reason is required to reject this application.</p>
                )}
                  </>
                )}
                {canRevert && (
                  <div className={options.length > 0 ? 'border-t border-slate-200 pt-3 space-y-2' : 'space-y-2'}>
                    <p className="text-sm text-slate-700">
                      Last decision can be undone. This returns the file to{' '}
                      <span className="font-medium">{row?.workflow?.revert?.restore_label}</span>.
                    </p>
                    <Input.TextArea
                      rows={2}
                      placeholder="Optional note on this revert"
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
