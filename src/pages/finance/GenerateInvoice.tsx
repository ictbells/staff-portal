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

type CatalogFee = {
  id: number;
  name: string;
  description?: string | null;
  category?: string;
  amount?: number;
  is_active?: boolean;
  wallet_allowed?: boolean;
};

type FoundStudent = {
  id: number;
  name: string;
  matric_number?: string | null;
  program?: string | null;
  current_level?: string | number | null;
};

const EXCLUDED_CATEGORIES = ['application_fee', 'acceptance_fee', 'transcript', 'programme_fee'];

function studentFromStatus(payload: any): FoundStudent | null {
  const row = payload?.student;
  if (!row?.id) return null;
  return {
    id: row.id,
    name: row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Student',
    matric_number: row.matric_number || row.student_number || null,
    program: row.program?.name || row.program || null,
    current_level: row.current_level ?? null,
  };
}

function categoryLabel(value?: string) {
  return String(value || 'other').replaceAll('_', ' ');
}

export function GenerateInvoice() {
  const [items, setItems] = useState<CatalogFee[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matric, setMatric] = useState('');
  const [student, setStudent] = useState<FoundStudent | null>(null);
  const [studentError, setStudentError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const loadCatalog = () => {
    setCatalogLoading(true);
    api.get('/api/fees', { params: { active: 1, operational: 1 } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setItems(list.filter((row: CatalogFee) => (
          row.is_active !== false
          && row.wallet_allowed !== false
          && !EXCLUDED_CATEGORIES.includes(String(row.category || ''))
        )));
      })
      .catch(() => {
        setItems([]);
        message.error('Could not load fee items.');
      })
      .finally(() => setCatalogLoading(false));
  };

  useEffect(() => { loadCatalog(); }, []);

  const lookupStudent = async (value = matric) => {
    const key = value.trim();
    if (!key) {
      setStudent(null);
      setStudentError('Enter a matric number.');
      return;
    }
    setLookingUp(true);
    setStudentError('');
    try {
      const { data } = await api.get('/api/finance/student-status', { params: { matric: key } });
      const match = studentFromStatus(data);
      if (!match) {
        setStudent(null);
        setStudentError('No student was found with that matric number.');
        return;
      }
      setStudent(match);
      if (match.matric_number) setMatric(match.matric_number);
    } catch (e: any) {
      setStudent(null);
      setStudentError(e.response?.data?.message || 'No student was found with that matric number.');
    } finally {
      setLookingUp(false);
    }
  };

  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((row) => row.id === id)).filter((row): row is CatalogFee => Boolean(row)),
    [selectedIds, items],
  );
  const lines = useMemo(
    () => selectedItems.map((row) => ({
      id: row.id,
      label: row.name,
      category: categoryLabel(row.category),
      description: row.description,
      amount: Number(row.amount || 0),
    })),
    [selectedItems],
  );
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const generateInvoice = async () => {
    const key = (student?.matric_number || matric).trim();
    if (!key || !selectedIds.length) return;
    setSaving(true);
    try {
      const { data } = await api.post('/api/invoices', {
        matric: key,
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
        description="Enter a matric number and choose operational fee items (hostel, clinic, sundry, and similar). School-fee programme lines are not listed here."
        icon={Receipt}
      >
        <RefreshButton onClick={loadCatalog} loading={catalogLoading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Fee items" value={items.length} hint="Operational catalog charges" icon={List} />
        <StatCard label="Selected" value={selectedIds.length} hint={selectedIds.length ? formatNaira(total) : 'Choose charges below'} icon={Wallet} tone="amber" />
      </div>

      <Card title="Student and fee items" description="Only operational fee items appear here. Programme-schedule charges (tuition, ICT, laboratory, and the rest) stay on Programme fees.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className={fieldLabelClass}>Matric number</span>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={matric}
                  onChange={(e) => {
                    setMatric(e.target.value);
                    setStudent(null);
                    setStudentError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lookupStudent(e.currentTarget.value);
                    }
                  }}
                  placeholder="Type matric number"
                  autoComplete="off"
                />
                <Btn
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => lookupStudent()}
                  disabled={lookingUp || !matric.trim()}
                >
                  {lookingUp ? 'Finding…' : 'Find'}
                </Btn>
              </div>
              {student ? (
                <p className="mt-1.5 text-xs text-slate-600">
                  {student.name}
                  {student.matric_number ? ` · ${student.matric_number}` : ''}
                  {student.program ? ` · ${student.program}` : ''}
                  {student.current_level ? ` · ${student.current_level}L` : ''}
                </p>
              ) : studentError ? (
                <p className="mt-1.5 text-xs text-rose-600">{studentError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500">Find the student before generating, or generate with the matric number as typed.</p>
              )}
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
              placeholder={items.length ? 'Select one or more fee items' : 'No active fee items'}
              loading={catalogLoading}
              value={selectedIds}
              onChange={setSelectedIds}
              options={items.map((row) => ({
                value: row.id,
                label: `${row.name} · ${categoryLabel(row.category)} (${formatNaira(Number(row.amount || 0))})`,
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
          colSpan={3}
        >
          <thead>
            <tr>
              <th className={thClass}>Item</th>
              <th className={thClass}>Category</th>
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
                  <td className={`${tdClass} capitalize`}>{line.category}</td>
                  <td className={`${tdClass} text-right font-medium`}>{formatNaira(line.amount)}</td>
                </tr>
              ))}
              <tr className={trClass}>
                <td className={`${tdClass} font-semibold`} colSpan={2}>Total</td>
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
