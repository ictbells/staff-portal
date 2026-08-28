import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Dropdown, Select, message } from 'antd';
import type { MenuProps } from 'antd';
import { Download, FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { AlertTriangle, BadgeCheck, GraduationCap, Wallet } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Btn, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, stageBadge, TablePager, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';
import { ReceiptPreview, fetchReceiptHtml, receiptErrorMessage } from '../../components/ReceiptPreview';

type PageMeta = {
  page: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
};

const emptyMeta: PageMeta = { page: 1, lastPage: 1, total: 0, from: null, to: null };

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(status?: string) {
  if (status === 'cancelled' || status === 'disabled') return 'Disabled';
  return String(status || 'unknown').replaceAll('_', ' ');
}

function rowsFrom(res: any): any[] {
  const body = res?.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

function asRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export function StudentFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<PageMeta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [sessions, setSessions] = useState<{ id: number; label: string; is_current?: boolean }[]>([]);
  const [levels, setLevels] = useState<{ value: string; label: string }[]>([]);
  const [sessionId, setSessionId] = useState<number | 'all' | undefined>();
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>();
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [collegeFilter, setCollegeFilter] = useState<number | undefined>();
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>();
  const [programFilter, setProgramFilter] = useState<number | undefined>();
  const [levelFilter, setLevelFilter] = useState<string | undefined>();
  const [clearanceFilter, setClearanceFilter] = useState<string | undefined>();
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const [receiptTitle, setReceiptTitle] = useState('Receipt');
  const [receiptLoading, setReceiptLoading] = useState(false);
  const listReq = useRef(0);

  const openReceipt = async (target: { invoiceId?: number; paymentId?: number; receiptNo?: string | number }) => {
    setReceiptLoading(true);
    setReceiptHtml(null);
    setReceiptTitle(`Receipt ${target.receiptNo || target.invoiceId || target.paymentId || ''}`.trim());
    try {
      const { html, title } = await fetchReceiptHtml(target);
      setReceiptHtml(html);
      setReceiptTitle(title);
    } catch (err) {
      setReceiptHtml(null);
      message.error(receiptErrorMessage(err));
    } finally {
      setReceiptLoading(false);
    }
  };

  const listParams = () => ({
    academic_session_id: sessionId === undefined ? undefined : sessionId,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(collegeFilter ? { faculty_id: collegeFilter } : {}),
    ...(departmentFilter ? { department_id: departmentFilter } : {}),
    ...(programFilter ? { program_id: programFilter } : {}),
    ...(levelFilter ? { level: levelFilter } : {}),
    ...(clearanceFilter ? { clearance: clearanceFilter } : {}),
  });

  const loadList = (nextPage = page, nextPerPage = perPage) => {
    const req = ++listReq.current;
    setLoading(true);
    api.get('/api/finance/student-roster', {
      params: { page: nextPage, per_page: nextPerPage, ...listParams() },
    })
      .then((res) => {
        if (req !== listReq.current) return;
        const list = rowsFrom(res);
        const body = res.data;
        setRows(list);
        setMeta({
          page: body?.current_page ?? nextPage,
          lastPage: Math.max(1, body?.last_page ?? 1),
          total: body?.total ?? list.length,
          from: body?.from ?? (list.length ? 1 : null),
          to: body?.to ?? (list.length || null),
        });
        if (body?.session) {
          setSessionLabel(body.session.scope === 'all' ? 'all sessions' : (body.session.label || null));
        }
        if (body?.lookups?.current_session_id) {
          setCurrentSessionId(body.lookups.current_session_id);
        }
        if (body?.lookups?.sessions) setSessions(body.lookups.sessions);
        if (body?.lookups?.levels) setLevels(body.lookups.levels);
      })
      .catch(() => {
        if (req !== listReq.current) return;
        setRows([]);
        setMeta(emptyMeta);
        message.error('Could not load students financial status.');
      })
      .finally(() => {
        if (req === listReq.current) setLoading(false);
      });
  };

  useEffect(() => {
    api.get('/api/programs').catch(() => ({ data: [] })).then((res) => {
      const list = res.data?.data || res.data || [];
      setPrograms(Array.isArray(list) ? list : []);
    });
  }, []);

  useEffect(() => {
    loadList(page, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, sessionId, collegeFilter, departmentFilter, programFilter, levelFilter, clearanceFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    const matric = searchParams.get('matric');
    if (matric?.trim()) openDetail({ matric_number: matric.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collegeOptions = useMemo(() => {
    const map = new Map<number, string>();
    programs.forEach((p: any) => {
      const faculty = p.department?.faculty;
      if (faculty?.id) map.set(faculty.id, faculty.name);
    });
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [programs]);

  const departmentOptions = useMemo(() => {
    const map = new Map<number, { label: string; facultyId?: number }>();
    programs.forEach((p: any) => {
      const dept = p.department;
      if (dept?.id) map.set(dept.id, { label: dept.name, facultyId: dept.faculty_id ?? dept.faculty?.id });
    });
    return [...map.entries()]
      .filter(([, dept]) => !collegeFilter || dept.facultyId === collegeFilter)
      .map(([value, dept]) => ({ value, label: dept.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [programs, collegeFilter]);

  const programOptions = useMemo(
    () => programs
      .filter((p: any) => {
        const departmentId = p.department_id ?? p.department?.id;
        const facultyId = p.department?.faculty_id ?? p.department?.faculty?.id;
        if (departmentFilter && departmentId !== departmentFilter) return false;
        if (collegeFilter && facultyId !== collegeFilter) return false;
        return true;
      })
      .map((p: any) => ({ value: p.id, label: p.code ? `${p.name} (${p.code})` : p.name })),
    [programs, collegeFilter, departmentFilter],
  );

  const openDetail = (row: { id?: number; matric_number?: string | null }) => {
    setDetailLoading(true);
    api.get('/api/finance/student-status', {
      params: row.id ? { student_id: row.id } : { matric: row.matric_number },
    })
      .then((res) => {
        setDetail(res.data);
        if (res.data?.student?.matric_number) {
          setSearchParams({ matric: res.data.student.matric_number }, { replace: true });
        }
      })
      .catch((err) => message.error(err.response?.data?.message || 'Could not load that student.'))
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => {
    setDetail(null);
    setSearchParams({}, { replace: true });
  };

  const downloadRoster = async (format: 'pdf' | 'excel' | 'word') => {
    setExporting(true);
    try {
      const { data } = await api.get('/api/finance/student-roster/export', {
        params: { format, ...listParams() },
        responseType: 'blob',
      });
      const mime = format === 'pdf'
        ? 'application/pdf'
        : format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx';
      const blob = new Blob([data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `students-financial-status-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Download started (${format === 'word' ? 'Word' : format.toUpperCase()}).`);
    } catch (err: any) {
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try {
          message.error(JSON.parse(await blob.text()).message || 'Unable to download the report.');
        } catch {
          message.error('Unable to download the report.');
        }
      } else {
        message.error(err.response?.data?.message || 'Unable to download the report.');
      }
    } finally {
      setExporting(false);
    }
  };

  const downloadMenu: MenuProps['items'] = [
    { key: 'pdf', icon: <FileText size={14} />, label: 'PDF', onClick: () => downloadRoster('pdf') },
    { key: 'excel', icon: <FileSpreadsheet size={14} />, label: 'Excel (.xlsx)', onClick: () => downloadRoster('excel') },
    { key: 'word', icon: <FileText size={14} />, label: 'MS Word (.docx)', onClick: () => downloadRoster('word') },
  ];

  const student = detail?.student;
  const summary = detail?.summary;
  const invoices = asRows(detail?.invoices);
  const payments = asRows(detail?.payments).length
    ? asRows(detail?.payments)
    : invoices.flatMap((row: any) => asRows(row.payments));
  const ledger = asRows(detail?.wallet_transactions).length
    ? asRows(detail?.wallet_transactions)
    : asRows(detail?.wallet?.transactions);
  const paymentTotal = payments.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);

  if (detail && student) {
    return (
      <div className="space-y-6">
        <WorkspaceHero
          eyebrow="Fees & payments"
          title={student.name}
          description={[student.matric_number || student.student_number, student.program, student.current_level ? `${student.current_level}L` : null, student.email].filter(Boolean).join(' · ')}
          icon={GraduationCap}
        >
          <Btn variant="secondary" className="!text-white" onClick={closeDetail}>Back to list</Btn>
          <RefreshButton onClick={() => openDetail({ id: student.id, matric_number: student.matric_number })} loading={detailLoading} />
        </WorkspaceHero>
        {summary ? (
          <div className="space-y-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
              summary.clearance === 'cleared'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-amber-50 text-amber-800 ring-amber-200'
            }`}>
              {summary.clearance === 'cleared' ? 'Cleared — 100% of school fees paid' : 'Outstanding — school fees not paid in full'}
            </span>
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
              <StatCard label="Wallet" value={formatNaira(summary.wallet_balance)} icon={Wallet} />
              <StatCard label="Billed" value={formatNaira(summary.billed)} hint="100% school fees plus other invoices" icon={Wallet} />
              <StatCard label="Rebated" value={formatNaira(summary.rebate_total)} icon={BadgeCheck} tone="amber" />
              <StatCard label="Paid" value={formatNaira(summary.paid)} icon={BadgeCheck} tone="emerald" />
              <StatCard
                label="Outstanding"
                value={formatNaira(summary.outstanding)}
                hint={summary.clearance === 'cleared' ? 'School fees paid in full' : 'Includes unpaid school fees'}
                icon={Number(summary.outstanding) > 0.009 ? AlertTriangle : BadgeCheck}
                tone={Number(summary.outstanding) > 0.009 ? 'rose' : 'emerald'}
              />
            </div>
          </div>
        ) : null}
        <Card title="Invoices" description="Charges billed to this student. Paid and balance are calculated from receipts, not a stored status alone.">
          <DataTable empty={!invoices.length} emptyMessage="No invoices on this record." colSpan={9} loading={detailLoading}>
            <thead>
              <tr>
                <th className={thClass}>Invoice</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Billed</th>
                <th className={thClass}>Paid</th>
                <th className={thClass}>Rebate</th>
                <th className={thClass}>Balance</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Date</th>
                <th className={`${thClass} text-right`}>Receipt</th>
              </tr>
            </thead>
            {!invoices.length ? null : (
              <tbody>
                {invoices.map((row: any) => (
                  <tr key={row.id} className={trClass}>
                    <td className={`${tdClass} font-medium`}>
                      {row.number}
                      {asRows(row.items).length > 0 ? (
                        <ul className="mt-1.5 space-y-0.5 text-xs font-normal text-slate-500">
                          {asRows(row.items).map((item: any) => (
                            <li key={item.id || item.description} className="flex justify-between gap-3">
                              <span>{item.description}</span>
                              <span className="whitespace-nowrap">{formatNaira(item.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className={`${tdClass} capitalize`}>
                      {String(row.category || '').replaceAll('_', ' ')}
                      {row.installment_percent ? (
                        <div className="text-xs text-slate-500">{row.installment_percent}% installment</div>
                      ) : null}
                    </td>
                    <td className={tdClass}>{formatNaira(row.amount)}</td>
                    <td className={tdClass}>{formatNaira(row.amount_paid ?? 0)}</td>
                    <td className={tdClass}>{Number(row.rebate_total) > 0 ? formatNaira(row.rebate_total) : '—'}</td>
                    <td className={tdClass}>{formatNaira(row.balance)}</td>
                    <td className={tdClass}>
                      <Badge variant={stageBadge(row.status === 'cancelled' ? 'rejected' : row.status)}>
                        {statusLabel(row.status)}
                      </Badge>
                    </td>
                    <td className={tdClass}>{formatDate(row.created_at)}</td>
                    <td className={`${tdClass} text-right`}>
                      {row.status === 'paid' ? (
                        <button
                          type="button"
                          className="text-sm text-sky-700 hover:underline"
                          onClick={() => openReceipt({
                            invoiceId: row.id,
                            receiptNo: asRows(row.payments)[0]?.receipt_no || row.number,
                          })}
                        >
                          View
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </DataTable>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Successful payments" description="Receipts that settled these invoices. Wallet top-ups are in the wallet ledger.">
            <DataTable empty={!payments.length} emptyMessage="No successful invoice payments yet." colSpan={5}>
              <thead>
                <tr>
                  <th className={thClass}>Reference</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Date</th>
                  <th className={`${thClass} text-right`}>Receipt</th>
                </tr>
              </thead>
              {!payments.length ? null : (
                <tbody>
                  {payments.map((row: any) => (
                    <tr key={row.id} className={trClass}>
                      <td className={tdClass}>
                        <div className="font-medium">{row.receipt_no || row.reference || '—'}</div>
                        {row.purpose ? <div className="text-xs text-slate-500 capitalize">{String(row.purpose).replaceAll('_', ' ')}</div> : null}
                      </td>
                      <td className={`${tdClass} capitalize`}>{String(row.method || '—').replaceAll('_', ' ')}</td>
                      <td className={tdClass}>{formatNaira(row.amount)}</td>
                      <td className={tdClass}>{formatDate(row.created_at)}</td>
                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          className="text-sm text-sky-700 hover:underline"
                          onClick={() => openReceipt(
                            row.invoice_id
                              ? { invoiceId: row.invoice_id, receiptNo: row.receipt_no || row.reference }
                              : { paymentId: row.id, receiptNo: row.receipt_no || row.reference },
                          )}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className={`${tdClass} font-semibold`} colSpan={2}>Total (matches Paid)</td>
                    <td className={`${tdClass} font-semibold`}>{formatNaira(paymentTotal)}</td>
                    <td className={tdClass} colSpan={2}></td>
                  </tr>
                </tbody>
              )}
            </DataTable>
          </Card>
          <Card title="Wallet ledger" description="Credits and charges on the campus wallet.">
            <DataTable empty={!ledger.length} emptyMessage="No wallet transactions yet." colSpan={4}>
              <thead>
                <tr>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Description</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Date</th>
                </tr>
              </thead>
              {!ledger.length ? null : (
                <tbody>
                  {ledger.map((row: any) => (
                    <tr key={row.id} className={trClass}>
                      <td className={`${tdClass} capitalize`}>{row.type}</td>
                      <td className={tdClass}>{row.description || row.reference || '—'}</td>
                      <td className={tdClass}>{formatNaira(row.amount)}</td>
                      <td className={tdClass}>{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </DataTable>
          </Card>
        </div>
        <ReceiptPreview
          html={receiptHtml}
          title={receiptTitle}
          loading={receiptLoading}
          onClose={() => { setReceiptHtml(null); setReceiptLoading(false); }}
        />
      </div>
    );
  }

  const outstandingOnPage = rows.filter((row) => row.clearance !== 'cleared').length;
  const clearedOnPage = rows.filter((row) => row.clearance === 'cleared').length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Students Financial Status"
        description={sessionLabel
          ? `Students in ${sessionLabel}. Search, filter, and download the bursary position.`
          : 'Students in the current session. Search, filter, and download the bursary position.'}
        icon={GraduationCap}
      >
        <RefreshButton onClick={() => loadList(page, perPage)} loading={loading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Students"
          value={meta.total}
          hint="Matching current filters"
          icon={GraduationCap}
          active={!clearanceFilter}
          onClick={() => { setClearanceFilter(undefined); setPage(1); }}
        />
        <StatCard
          label="On this page"
          value={rows.length}
          hint={meta.from != null && meta.to != null ? `Showing ${meta.from}–${meta.to}` : 'Current page'}
          icon={Wallet}
        />
        <StatCard
          label="Outstanding"
          value={outstandingOnPage}
          hint="On this page"
          icon={AlertTriangle}
          tone="rose"
          active={clearanceFilter === 'outstanding'}
          onClick={() => { setClearanceFilter(clearanceFilter === 'outstanding' ? undefined : 'outstanding'); setPage(1); }}
        />
        <StatCard
          label="Cleared"
          value={clearedOnPage}
          hint="On this page"
          icon={BadgeCheck}
          tone="emerald"
          active={clearanceFilter === 'cleared'}
          onClick={() => { setClearanceFilter(clearanceFilter === 'cleared' ? undefined : 'cleared'); setPage(1); }}
        />
      </div>

      <Card
        title="Student list"
        description="Use View details to open the full statement. Download uses the filters below."
        actions={(
          <Dropdown menu={{ items: downloadMenu }} trigger={['click']} disabled={exporting || loading}>
            <Button type="primary" icon={<Download size={14} />} loading={exporting}>
              Download
            </Button>
          </Dropdown>
        )}
      >
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="block min-w-[220px] flex-1">
            <span className={fieldLabelClass}>Search</span>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputClass} pl-9 pr-8`}
                placeholder="Name, matric, or programme"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>Session</span>
            <Select
              className="w-full"
              placeholder="Current session"
              value={sessionId ?? currentSessionId}
              onChange={(value) => { setSessionId(value); setPage(1); }}
              options={[
                { value: 'all', label: 'All sessions' },
                ...sessions.map((s) => ({
                  value: s.id,
                  label: s.is_current ? `${s.label} (current)` : s.label,
                })),
              ]}
            />
          </label>
          <label className="block min-w-[160px]">
            <span className={fieldLabelClass}>Clearance</span>
            <Select
              allowClear
              className="w-full"
              placeholder="All students"
              value={clearanceFilter}
              onChange={(value) => { setClearanceFilter(value); setPage(1); }}
              options={[
                { value: 'outstanding', label: 'Outstanding' },
                { value: 'cleared', label: 'Cleared' },
              ]}
            />
          </label>
          <label className="block min-w-[140px]">
            <span className={fieldLabelClass}>Level</span>
            <Select
              allowClear
              className="w-full"
              placeholder="All levels"
              value={levelFilter}
              onChange={(value) => { setLevelFilter(value); setPage(1); }}
              options={levels}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>College</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All colleges"
              value={collegeFilter}
              onChange={(value) => { setCollegeFilter(value); setDepartmentFilter(undefined); setProgramFilter(undefined); setPage(1); }}
              options={collegeOptions}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>Department</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All departments"
              value={departmentFilter}
              onChange={(value) => { setDepartmentFilter(value); setProgramFilter(undefined); setPage(1); }}
              options={departmentOptions}
            />
          </label>
          <label className="block min-w-[200px]">
            <span className={fieldLabelClass}>Programme</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All programmes"
              value={programFilter}
              onChange={(value) => { setProgramFilter(value); setPage(1); }}
              options={programOptions}
            />
          </label>
        </div>

        <DataTable
          empty={!rows.length}
          emptyMessage="No students match the selected session and filters."
          colSpan={9}
          loading={loading}
        >
          <thead>
            <tr>
              <th className={thClass}>Student</th>
              <th className={thClass}>Programme</th>
              <th className={thClass}>Level</th>
              <th className={thClass}>Wallet</th>
              <th className={thClass}>Billed</th>
              <th className={thClass}>Paid</th>
              <th className={thClass}>Outstanding</th>
              <th className={thClass}>Clearance</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          {!rows.length ? null : (
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>
                    <div>{row.name}</div>
                    <div className="text-xs text-slate-500">{row.matric_number || row.student_number || '—'}</div>
                  </td>
                  <td className={tdClass}>
                    <div>{row.program || '—'}</div>
                    {row.college ? <div className="text-xs text-slate-500">{row.college}</div> : null}
                  </td>
                  <td className={tdClass}>{row.current_level ? `${row.current_level}L` : '—'}</td>
                  <td className={tdClass}>{formatNaira(row.wallet_balance)}</td>
                  <td className={tdClass}>{formatNaira(row.billed)}</td>
                  <td className={tdClass}>{formatNaira(row.paid)}</td>
                  <td className={tdClass}>{formatNaira(row.outstanding)}</td>
                  <td className={tdClass}>
                    <Badge variant={row.clearance === 'cleared' ? 'success' : 'warning'}>
                      {row.clearance === 'cleared' ? 'Cleared' : 'Outstanding'}
                    </Badge>
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <button
                      type="button"
                      className="text-sm font-medium text-sky-700 hover:text-sky-800 disabled:opacity-50"
                      disabled={detailLoading}
                      onClick={() => openDetail(row)}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <TablePager
            page={meta.page}
            lastPage={meta.lastPage}
            total={meta.total}
            from={meta.from}
            to={meta.to}
            onChange={setPage}
            disabled={loading}
          />
          {perPage < 100 && meta.total > perPage ? (
            <Btn
              variant="secondary"
              disabled={loading}
              onClick={() => { setPerPage((n) => Math.min(100, n + 25)); setPage(1); }}
            >
              View more
            </Btn>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
