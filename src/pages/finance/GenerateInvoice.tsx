import { useEffect, useMemo, useState } from 'react';
import { Select, message } from 'antd';
import { List, Receipt, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';
import { SessionLevelFilters } from '../../components/SessionLevelFilters';

function studentName(student: any) {
  return `${student?.first_name || ''} ${student?.last_name || ''}`.trim()
    || student?.user?.name
    || '—';
}

export function GenerateInvoice() {
  const [items, setItems] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matric, setMatric] = useState('');
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [matches, setMatches] = useState<any[]>([]);
  const [student, setStudent] = useState<any | null>(null);
  const [studentError, setStudentError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const loadCatalog = () => {
    setCatalogLoading(true);
    api.get('/api/fees', { params: { active: 1 } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setItems(list.filter((row: any) => row.is_active !== false && row.wallet_allowed !== false
          && !['application_fee', 'acceptance_fee'].includes(String(row.category || ''))));
      })
      .catch(() => {
        setItems([]);
        message.error('Could not load fee catalog items.');
      })
      .finally(() => setCatalogLoading(false));
  };

  useEffect(() => { loadCatalog(); }, []);

  useEffect(() => {
    const value = matric.trim();
    if (!value) {
      setStudent(null);
      setStudentError('');
      return;
    }
    const timer = window.setTimeout(() => {
      setLookingUp(true);
      api.get('/api/students', { params: { matric: value, per_page: 1, academic_session_id: sessionId, level } })
        .then((res) => {
          const rows = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          const match = rows[0] || null;
          setStudent(match);
          setStudentError(match ? '' : 'No student was found with that matric number.');
        })
        .catch(() => {
          setStudent(null);
          setStudentError('');
        })
        .finally(() => setLookingUp(false));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [matric, sessionId, level]);

  useEffect(() => {
    if (matric.trim()) {
      setMatches([]);
      return;
    }
    api.get('/api/students', { params: { per_page: 25, academic_session_id: sessionId, level } })
      .then((res) => {
        const rows = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setMatches(rows);
      })
      .catch(() => setMatches([]));
  }, [sessionId, level, matric]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((row) => row.id === id)).filter(Boolean),
    [selectedIds, items],
  );
  const lines = useMemo(
    () => selectedItems.map((row) => ({
      id: row.id,
      label: row.name,
      description: row.description,
      amount: Number(row.amount || 0),
    })),
    [selectedItems],
  );
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const generateInvoice = async () => {
    if (!matric.trim() || !selectedIds.length) return;
    setSaving(true);
    try {
      const { data } = await api.post('/api/invoices', {
        matric: matric.trim(),
        fee_item_ids: selectedIds,
      });
      message.success(`Invoice ${data.number || ''} generated for ${formatNaira(total)}.`.replace('  ', ' '));
      setSelectedIds([]);
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Could not generate invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Generate invoice"
        description="Type a matric number, select one or more fee catalog charges, and generate a single invoice with a line-item breakdown. Students pay from the student portal wallet."
        icon={Receipt}
      >
        <RefreshButton onClick={loadCatalog} loading={catalogLoading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Fee items" value={items.length} hint="Available to invoice" icon={List} />
        <StatCard label="Selected" value={selectedIds.length} hint={selectedIds.length ? formatNaira(total) : 'Choose charges below'} icon={Wallet} tone="amber" />
      </div>

      <Card title="Student and fee items" description="The invoice total is the sum of every selected fee catalog charge.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <SessionLevelFilters
              sessionId={sessionId}
              level={level}
              onSessionChange={setSessionId}
              onLevelChange={setLevel}
            />
            {matches.length > 0 && !matric.trim() && (
              <label className="block">
                <span className={fieldLabelClass}>Student</span>
                <Select
                  className="w-full"
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder="Select a student"
                  value={student?.id}
                  onChange={(id) => {
                    const match = matches.find((row) => row.id === id) || null;
                    setStudent(match);
                    setMatric(match?.matric_number || match?.student_number || '');
                    setStudentError('');
                  }}
                  options={matches.map((row) => ({
                    value: row.id,
                    label: `${row.last_name || ''} ${row.first_name || ''}`.trim() + (row.matric_number ? ` (${row.matric_number})` : ''),
                  }))}
                />
              </label>
            )}
          <label className="block">
            <span className={fieldLabelClass}>Matric number</span>
            <input
              className={inputClass}
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              placeholder="Type matric number"
              autoComplete="off"
            />
            {lookingUp ? (
              <p className="mt-1.5 text-xs text-slate-500">Looking up student…</p>
            ) : student ? (
              <p className="mt-1.5 text-xs text-slate-600">
                {studentName(student)}
                {student.program?.name ? ` · ${student.program.name}` : ''}
              </p>
            ) : studentError ? (
              <p className="mt-1.5 text-xs text-rose-600">{studentError}</p>
            ) : null}
          </label>
          </div>
          <label className="block">
            <span className={fieldLabelClass}>Fee items</span>
            <Select
              className="w-full"
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={items.length ? 'Select one or more fee items' : 'No active fee catalog items'}
              loading={catalogLoading}
              value={selectedIds}
              onChange={setSelectedIds}
              options={items.map((row) => ({
                value: row.id,
                label: `${row.name} (${formatNaira(Number(row.amount || 0))})`,
              }))}
              maxTagCount="responsive"
            />
          </label>
        </div>
      </Card>

      <Card title="Payment breakdown" description="This is what the student will see on the invoice before paying.">
        <DataTable
          empty={!lines.length}
          emptyMessage="Select fee items to see the amount due."
          colSpan={2}
        >
          <thead>
            <tr>
              <th className={thClass}>Item</th>
              <th className={`${thClass} text-right`}>Amount</th>
            </tr>
          </thead>
          {!lines.length ? null : (
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className={trClass}>
                  <td className={tdClass}>
                    <div>{line.label}</div>
                    {line.description ? <div className="text-xs text-slate-500">{line.description}</div> : null}
                  </td>
                  <td className={`${tdClass} text-right font-medium`}>{formatNaira(line.amount)}</td>
                </tr>
              ))}
              <tr className={trClass}>
                <td className={`${tdClass} font-semibold`}>Total</td>
                <td className={`${tdClass} text-right font-semibold`}>{formatNaira(total)}</td>
              </tr>
            </tbody>
          )}
        </DataTable>
        <div className="mt-4">
          <Btn className="!text-white" onClick={generateInvoice} disabled={saving || !matric.trim() || !selectedIds.length}>
            {saving ? 'Generating…' : `Generate invoice${total ? ` · ${formatNaira(total)}` : ''}`}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
