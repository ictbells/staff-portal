import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Form, Input, Modal, Select, message } from 'antd';
import type { MenuProps } from 'antd';
import { CircleDollarSign, Download, FileSpreadsheet, FileText, Receipt, Search, X } from 'lucide-react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import {
  Badge, Card, DataTable, fieldLabelClass, inputClass,
  StatCard, WorkspaceHero, stageBadge, TablePager, tdClass, thClass, trClass,
} from '../../components/ui';
import { formatNaira } from '../../lib/money';
import { SessionLevelFilters } from '../../components/SessionLevelFilters';

type PageMeta = {
  page: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
};

const emptyMeta: PageMeta = { page: 1, lastPage: 1, total: 0, from: null, to: null };

function statusLabel(status?: string) {
  return status === 'cancelled' ? 'Disabled' : (status || 'unknown');
}

function isWalletInvoice(invoice: any) {
  return invoice?.wallet_allowed !== false
    && !['application_fee', 'acceptance_fee'].includes(String(invoice?.category || ''));
}

function canRebate(invoice: any) {
  if (!isWalletInvoice(invoice)) return false;
  return invoice.status === 'unpaid'
    || invoice.status === 'partial'
    || (invoice.status === 'paid' && Number(invoice.rebate_total) > 0);
}

function previewRebate(invoice: any, kind?: string, value?: number) {
  const balance = Number(invoice?.balance || 0);
  const billed = Number(invoice?.amount || 0);
  const raw = kind === 'percent' ? billed * (Number(value || 0) / 100) : Number(value || 0);
  const amount = Math.round(Math.min(Math.max(raw, 0), balance) * 100) / 100;
  return { amount, newDue: Math.round(Math.max(0, balance - amount) * 100) / 100 };
}

function payerName(invoice: any) {
  return invoice.user?.name
    || [invoice.student?.first_name, invoice.student?.last_name].filter(Boolean).join(' ')
    || '—';
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function applicantIdentifier(source: {
  student?: { matric_number?: string | null; student_number?: string | null } | null;
  user?: { jamb_registration?: string | null; latest_application?: any } | null;
  application?: { jamb_registration?: string | null; application_number?: string | null } | null;
}) {
  const matric = source.student?.matric_number || source.student?.student_number;
  if (matric) return matric;
  const application = source.application || source.user?.latest_application;
  return application?.jamb_registration
    || source.user?.jamb_registration
    || application?.application_number
    || '—';
}

function matricNumber(invoice: any) {
  return applicantIdentifier({
    student: invoice.student,
    user: invoice.user,
    application: invoice.application,
  });
}

function paymentName(payment: any) {
  const student = payment.user?.student || payment.invoice?.student;
  const fromStudent = [student?.first_name, student?.last_name].filter(Boolean).join(' ').trim();
  return payment.user?.name || fromStudent || '—';
}

function paymentMatric(payment: any) {
  return applicantIdentifier({
    student: payment.user?.student || payment.invoice?.student,
    user: payment.user,
    application: payment.invoice?.application || payment.user?.latest_application,
  });
}

function paymentReference(payment: any) {
  return payment.reference || payment.paystack_reference || payment.receipt_no || '—';
}

function rowsFrom(res: any): any[] {
  const body = res?.data;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

function metaFrom(res: any, fallbackPage = 1): PageMeta {
  const body = res?.data;
  const rows = rowsFrom(res);
  return {
    page: body?.current_page ?? fallbackPage,
    lastPage: Math.max(1, body?.last_page ?? 1),
    total: body?.total ?? rows.length,
    from: body?.from ?? (rows.length ? 1 : null),
    to: body?.to ?? (rows.length || null),
  };
}

export function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [invoiceMeta, setInvoiceMeta] = useState<PageMeta>(emptyMeta);
  const [invoicePage, setInvoicePage] = useState(1);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentMeta, setPaymentMeta] = useState<PageMeta>(emptyMeta);
  const [paymentPage, setPaymentPage] = useState(1);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('unpaid');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [collegeFilter, setCollegeFilter] = useState<number | undefined>();
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>();
  const [programFilter, setProgramFilter] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [disableForm] = Form.useForm();
  const [rebateTarget, setRebateTarget] = useState<any>(null);
  const [rebateForm] = Form.useForm();
  const [rebateTypes, setRebateTypes] = useState<any[]>([]);
  const [rebateSaving, setRebateSaving] = useState(false);
  const [reverseSavingId, setReverseSavingId] = useState<number | null>(null);
  const rebateKind = Form.useWatch('kind', rebateForm);
  const rebateValue = Form.useWatch('value', rebateForm);
  const invoicesReq = useRef(0);
  const paymentsReq = useRef(0);

  const loadCatalog = () => {
    setCatalogLoading(true);
    Promise.all([
      api.get('/api/fees/meta').catch(() => ({ data: { categories: [] } })),
      api.get('/api/programs').catch(() => ({ data: [] })),
    ])
      .then(([metaRes, programsRes]) => {
        const metaCategories = Array.isArray(metaRes.data.categories) ? metaRes.data.categories : [];
        const hasApplication = metaCategories.some((c: any) => c.value === 'application_fee');
        setCategories(hasApplication
          ? metaCategories
          : [...metaCategories, { value: 'application_fee', label: 'Application fee' }]);
        const programList = programsRes.data?.data || programsRes.data || [];
        setPrograms(Array.isArray(programList) ? programList : []);
      })
      .finally(() => setCatalogLoading(false));
  };

  const invoiceParams = (
    status = statusFilter,
    category = categoryFilter,
    collegeId = collegeFilter,
    departmentId = departmentFilter,
    programId = programFilter,
    query = search,
    from = fromDate,
    to = toDate,
    nextSession = sessionId,
    nextLevel = level,
  ) => ({
    ...(status && status !== 'all' ? { status } : {}),
    ...(category ? { category } : {}),
    ...(collegeId ? { faculty_id: collegeId } : {}),
    ...(departmentId ? { department_id: departmentId } : {}),
    ...(programId ? { program_id: programId } : {}),
    ...(query.trim() ? { search: query.trim() } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(nextSession ? { academic_session_id: nextSession } : {}),
    ...(nextLevel ? { level: nextLevel } : {}),
  });

  const loadInvoices = (
    page = invoicePage,
    status = statusFilter,
    category = categoryFilter,
    collegeId = collegeFilter,
    departmentId = departmentFilter,
    programId = programFilter,
    query = search,
    from = fromDate,
    to = toDate,
  ) => {
    const req = ++invoicesReq.current;
    setInvoicesLoading(true);
    api.get('/api/invoices', {
      params: {
        page,
        per_page: 25,
        ...invoiceParams(status, category, collegeId, departmentId, programId, query, from, to),
      },
    })
      .then((res) => {
        if (req !== invoicesReq.current) return;
        setRows(rowsFrom(res));
        setInvoiceMeta(metaFrom(res, page));
      })
      .catch(() => {
        if (req !== invoicesReq.current) return;
        setRows([]);
        setInvoiceMeta(emptyMeta);
      })
      .finally(() => {
        if (req === invoicesReq.current) setInvoicesLoading(false);
      });
  };

  const loadPayments = (page = paymentPage) => {
    const req = ++paymentsReq.current;
    setPaymentsLoading(true);
    api.get('/api/payments', { params: { page, per_page: 20 } })
      .then((res) => {
        if (req !== paymentsReq.current) return;
        setPayments(rowsFrom(res));
        setPaymentMeta(metaFrom(res, page));
      })
      .catch(() => {
        if (req !== paymentsReq.current) return;
        setPayments([]);
        setPaymentMeta(emptyMeta);
      })
      .finally(() => {
        if (req === paymentsReq.current) setPaymentsLoading(false);
      });
  };

  const refresh = () => {
    loadCatalog();
    loadInvoices();
    loadPayments();
  };

  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => {
    loadInvoices(invoicePage, statusFilter, categoryFilter, collegeFilter, departmentFilter, programFilter, search, fromDate, toDate);
  }, [invoicePage, statusFilter, categoryFilter, collegeFilter, departmentFilter, programFilter, search, fromDate, toDate, sessionId, level]);
  useEffect(() => { loadPayments(paymentPage); }, [paymentPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      setInvoicePage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  const changeStatus = (next?: string) => {
    setStatusFilter(next);
    setInvoicePage(1);
  };

  const changeCategory = (next?: string) => {
    setCategoryFilter(next);
    setInvoicePage(1);
  };

  const changeCollege = (next?: number) => {
    setCollegeFilter(next);
    setDepartmentFilter(undefined);
    setProgramFilter(undefined);
    setInvoicePage(1);
  };

  const changeDepartment = (next?: number) => {
    setDepartmentFilter(next);
    setProgramFilter(undefined);
    setInvoicePage(1);
  };

  const changeProgram = (next?: number) => {
    setProgramFilter(next);
    setInvoicePage(1);
  };

  const changeFromDate = (next: string) => {
    setFromDate(next);
    setInvoicePage(1);
  };

  const changeToDate = (next: string) => {
    setToDate(next);
    setInvoicePage(1);
  };

  const downloadInvoices = async (format: 'pdf' | 'excel' | 'word') => {
    setExporting(true);
    try {
      const { data } = await api.get('/api/invoices/export', {
        params: { format, ...invoiceParams() },
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
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `invoices-${stamp}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Download started (${format === 'word' ? 'Word' : format.toUpperCase()}).`);
    } catch (err: any) {
      const blob = err.response?.data;
      if (blob instanceof Blob) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          message.error(parsed.message || 'Unable to download invoices.');
        } catch {
          message.error('Unable to download invoices.');
        }
      } else {
        message.error(err.response?.data?.message || 'Unable to download invoices.');
      }
    } finally {
      setExporting(false);
    }
  };

  const downloadMenu: MenuProps['items'] = [
    { key: 'pdf', icon: <FileText size={14} />, label: 'PDF', onClick: () => downloadInvoices('pdf') },
    { key: 'excel', icon: <FileSpreadsheet size={14} />, label: 'Excel (.xlsx)', onClick: () => downloadInvoices('excel') },
    { key: 'word', icon: <FileText size={14} />, label: 'MS Word (.docx)', onClick: () => downloadInvoices('word') },
  ];

  const openDisable = (invoice: any) => {
    setDisableTarget(invoice);
    disableForm.resetFields();
  };

  const submitDisable = async () => {
    const invoice = disableTarget;
    if (!invoice) return;
    const values = await disableForm.validateFields();
    const reason = String(values.reason || '').trim();
    setActingId(invoice.id);
    try {
      await api.post(`/api/invoices/${invoice.id}/disable`, { reason });
      message.success(`Invoice ${invoice.number} disabled.`);
      setDisableTarget(null);
      disableForm.resetFields();
      loadInvoices();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Could not disable this invoice.');
      throw e;
    } finally {
      setActingId(null);
    }
  };

  const enableInvoice = (invoice: any) => {
    Modal.confirm({
      title: 'Enable invoice',
      content: `Enable invoice ${invoice.number} so it can be paid again?`,
      okText: 'Enable',
      cancelText: 'Cancel',
      onOk: async () => {
        setActingId(invoice.id);
        try {
          await api.post(`/api/invoices/${invoice.id}/enable`);
          message.success(`Invoice ${invoice.number} enabled.`);
          loadInvoices();
        } catch (e: any) {
          message.error(e.response?.data?.message || 'Could not enable this invoice.');
          throw e;
        } finally {
          setActingId(null);
        }
      },
    });
  };

  const openRebate = (invoice: any) => {
    setRebateTarget(invoice);
    rebateForm.resetFields();
    api.get('/api/rebate-types', { params: { active: 1 } })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const active = list.filter((row: any) => row.is_active !== false);
        setRebateTypes(active);
        const first = active[0];
        if (first) {
          rebateForm.setFieldsValue({
            rebate_type_id: first.id,
            kind: first.kind === 'amount' ? 'amount' : 'percent',
            value: first.default_value,
            reason: '',
          });
        }
      })
      .catch(() => {
        setRebateTypes([]);
        message.error('Could not load rebate types.');
      });
  };

  const onRebateTypeChange = (id: number) => {
    const type = rebateTypes.find((row) => row.id === id);
    if (!type) return;
    rebateForm.setFieldsValue({
      kind: type.kind === 'amount' ? 'amount' : 'percent',
      value: type.default_value,
    });
  };

  const submitRebate = async () => {
    const invoice = rebateTarget;
    if (!invoice) return;
    const values = await rebateForm.validateFields();
    setRebateSaving(true);
    try {
      const res = await api.post(`/api/invoices/${invoice.id}/rebates`, {
        rebate_type_id: values.rebate_type_id,
        kind: values.kind,
        value: Number(values.value),
        reason: String(values.reason || '').trim(),
      });
      message.success(`Rebate applied to ${invoice.number}.`);
      setRebateTarget(res.data?.invoice || null);
      rebateForm.resetFields();
      loadInvoices();
      if (res.data?.invoice) {
        const next = res.data.invoice;
        setRebateTarget(next);
        const first = rebateTypes[0];
        if (first && (next.status === 'unpaid' || next.status === 'partial')) {
          rebateForm.setFieldsValue({
            rebate_type_id: first.id,
            kind: first.kind === 'amount' ? 'amount' : 'percent',
            value: first.default_value,
            reason: '',
          });
        }
      } else {
        setRebateTarget(null);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Could not apply rebate.');
      throw e;
    } finally {
      setRebateSaving(false);
    }
  };

  const reverseRebate = (rebate: any) => {
    const invoice = rebateTarget;
    if (!invoice || !rebate) return;
    let reason = '';
    Modal.confirm({
      title: 'Reverse rebate',
      content: (
        <div>
          <p className="mb-2 text-sm text-slate-600">
            Restore {formatNaira(rebate.amount)} to invoice {invoice.number}?
          </p>
          <Input.TextArea
            rows={3}
            maxLength={500}
            placeholder="Reason for reversing this rebate"
            onChange={(e) => { reason = e.target.value; }}
          />
        </div>
      ),
      okText: 'Reverse',
      okButtonProps: { danger: true },
      onOk: async () => {
        const text = reason.trim();
        if (text.length < 5) {
          message.error('Enter a reverse reason of at least 5 characters.');
          return Promise.reject();
        }
        setReverseSavingId(rebate.id);
        try {
          const res = await api.post(`/api/invoices/${invoice.id}/rebates/${rebate.id}/reverse`, { reason: text });
          message.success('Rebate reversed.');
          setRebateTarget(res.data?.invoice || invoice);
          loadInvoices();
        } catch (e: any) {
          message.error(e.response?.data?.message || 'Could not reverse this rebate.');
          throw e;
        } finally {
          setReverseSavingId(null);
        }
      },
    });
  };

  const collegeOptions = useMemo(() => {
    const map = new Map<number, string>();
    programs.forEach((p: any) => {
      const faculty = p.department?.faculty;
      if (faculty?.id) map.set(faculty.id, faculty.name);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [programs]);

  const departmentOptions = useMemo(() => {
    const map = new Map<number, { label: string; facultyId?: number }>();
    programs.forEach((p: any) => {
      const dept = p.department;
      if (dept?.id) {
        map.set(dept.id, {
          label: dept.name,
          facultyId: dept.faculty_id ?? dept.faculty?.id,
        });
      }
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
      .map((p: any) => ({
        value: p.id,
        label: p.code ? `${p.name} (${p.code})` : p.name,
      })),
    [programs, collegeFilter, departmentFilter],
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.value, label: c.label })),
    [categories],
  );
  const pageLoading = catalogLoading || invoicesLoading || paymentsLoading;

  const unpaidOnPage = rows.filter((row) => row.status === 'unpaid').length;
  const partialOnPage = rows.filter((row) => row.status === 'partial').length;
  const paidOnPage = rows.filter((row) => row.status === 'paid').length;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Fees & payments"
        title="Invoices"
        description="Review invoices, disable unpaid invoices, and view recent payments. Students pay from the student portal."
        icon={Receipt}
      >
        <RefreshButton onClick={refresh} loading={pageLoading} />
      </WorkspaceHero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Matching"
          value={invoiceMeta.total}
          hint={statusFilter ? `Filter: ${statusFilter}` : 'All invoices in view'}
          icon={Receipt}
          active={!statusFilter}
          onClick={() => { setStatusFilter(undefined); setInvoicePage(1); }}
        />
        <StatCard
          label="Unpaid"
          value={statusFilter === 'unpaid' ? invoiceMeta.total : unpaidOnPage}
          hint={statusFilter === 'unpaid' ? 'Matching filter' : 'On this page'}
          icon={Receipt}
          tone="amber"
          active={statusFilter === 'unpaid'}
          onClick={() => { setStatusFilter('unpaid'); setInvoicePage(1); }}
        />
        <StatCard
          label="Partial"
          value={statusFilter === 'partial' ? invoiceMeta.total : partialOnPage}
          hint={statusFilter === 'partial' ? 'Matching filter' : 'On this page'}
          icon={CircleDollarSign}
          tone="amber"
          active={statusFilter === 'partial'}
          onClick={() => { setStatusFilter('partial'); setInvoicePage(1); }}
        />
        <StatCard
          label="Paid / payments"
          value={statusFilter === 'paid' ? invoiceMeta.total : paymentMeta.total}
          hint={statusFilter === 'paid' ? 'Matching filter' : 'Recorded payments'}
          icon={CircleDollarSign}
          tone="emerald"
          active={statusFilter === 'paid'}
          onClick={() => { setStatusFilter('paid'); setInvoicePage(1); }}
        />
      </div>

      <Card
        title="Invoice list"
        description="Disable an unpaid invoice to stop payment. Enable it again if it was disabled by mistake."
        actions={(
          <Dropdown menu={{ items: downloadMenu }} trigger={['click']} disabled={exporting || invoicesLoading}>
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
                className={`${inputClass} pl-9`}
                placeholder="Invoice number, name, or matric"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </label>
          <label className="block min-w-[160px]">
            <span className={fieldLabelClass}>Status</span>
            <Select
              allowClear
              className="w-full"
              placeholder="All statuses"
              value={statusFilter}
              onChange={changeStatus}
              options={[
                { value: 'unpaid', label: 'Unpaid' },
                { value: 'partial', label: 'Partial' },
                { value: 'paid', label: 'Paid' },
                { value: 'cancelled', label: 'Disabled' },
              ]}
            />
          </label>
          <label className="block min-w-[180px]">
            <span className={fieldLabelClass}>Category</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All categories"
              value={categoryFilter}
              onChange={changeCategory}
              options={categoryOptions}
            />
          </label>
          <label className="block min-w-[200px]">
            <span className={fieldLabelClass}>College</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All colleges"
              value={collegeFilter}
              onChange={changeCollege}
              options={collegeOptions}
            />
          </label>
          <label className="block min-w-[200px]">
            <span className={fieldLabelClass}>Department</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All departments"
              value={departmentFilter}
              onChange={changeDepartment}
              options={departmentOptions}
            />
          </label>
          <label className="block min-w-[220px]">
            <span className={fieldLabelClass}>Programme</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="w-full"
              placeholder="All programmes"
              value={programFilter}
              onChange={changeProgram}
              options={programOptions}
            />
          </label>
          <SessionLevelFilters
            sessionId={sessionId}
            level={level}
            onSessionChange={(value) => { setSessionId(value); setInvoicePage(1); }}
            onLevelChange={(value) => { setLevel(value); setInvoicePage(1); }}
          />
          <label className="block min-w-[170px]">
            <span className={fieldLabelClass}>From</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                className={inputClass}
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => changeFromDate(e.target.value)}
              />
              {fromDate ? (
                <button
                  type="button"
                  className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear from date"
                  onClick={() => changeFromDate('')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </label>
          <label className="block min-w-[170px]">
            <span className={fieldLabelClass}>To</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                className={inputClass}
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => changeToDate(e.target.value)}
              />
              {toDate ? (
                <button
                  type="button"
                  className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear to date"
                  onClick={() => changeToDate('')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </label>
        </div>
        <DataTable
          empty={!rows.length}
          emptyMessage="No invoices match this filter."
          colSpan={9}
          loading={invoicesLoading}
          loadingLabel="Loading invoices…"
        >
          <thead>
            <tr>
              <th className={thClass}>Number</th>
              <th className={thClass}>Payer</th>
              <th className={thClass}>Matric</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Amount</th>
              <th className={thClass}>Balance</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Timestamp</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          {!rows.length ? null : (
            <tbody>
              {rows.map((invoice) => (
                <tr key={invoice.id} className={trClass}>
                  <td className={`${tdClass} font-medium font-mono`}>{invoice.number}</td>
                  <td className={tdClass}>{payerName(invoice)}</td>
                  <td className={`${tdClass} font-mono`}>{matricNumber(invoice)}</td>
                  <td className={tdClass}>{(invoice.category || '').replaceAll('_', ' ')}</td>
                  <td className={tdClass}>
                    <div>{formatNaira(Number(invoice.amount || 0))}</div>
                    {Number(invoice.rebate_total) > 0 ? (
                      <div className="text-xs text-emerald-700 mt-0.5">Rebate {formatNaira(Number(invoice.rebate_total))}</div>
                    ) : null}
                  </td>
                  <td className={tdClass}>{formatNaira(invoice.balance)}</td>
                  <td className={tdClass}>
                    <Badge variant={stageBadge(invoice.status === 'cancelled' ? 'inactive' : invoice.status)}>
                      {statusLabel(invoice.status)}
                    </Badge>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                    {formatTimestamp(invoice.created_at)}
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <div className="flex justify-end gap-3">
                      {canRebate(invoice) ? (
                        <button
                          type="button"
                          className="text-sm text-sky-700 hover:underline disabled:opacity-50"
                          disabled={actingId === invoice.id}
                          onClick={() => openRebate(invoice)}
                        >
                          Rebate
                        </button>
                      ) : null}
                      {invoice.status === 'unpaid' ? (
                        <button
                          type="button"
                          className="text-sm text-rose-600 hover:underline disabled:opacity-50"
                          disabled={actingId === invoice.id}
                          onClick={() => openDisable(invoice)}
                        >
                          Disable
                        </button>
                      ) : invoice.status === 'cancelled' ? (
                        <button
                          type="button"
                          className="text-sm text-sky-700 hover:underline disabled:opacity-50"
                          disabled={actingId === invoice.id}
                          onClick={() => enableInvoice(invoice)}
                        >
                          Enable
                        </button>
                      ) : !canRebate(invoice) ? (
                        <span className="text-slate-400">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
        <TablePager
          page={invoiceMeta.page}
          lastPage={invoiceMeta.lastPage}
          total={invoiceMeta.total}
          from={invoiceMeta.from}
          to={invoiceMeta.to}
          disabled={invoicesLoading}
          onChange={setInvoicePage}
        />
      </Card>

      <Card title="Recent payments">
        <DataTable
          empty={!payments.length}
          emptyMessage="No payments recorded."
          colSpan={7}
          loading={paymentsLoading}
          loadingLabel="Loading payments…"
        >
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Matric</th>
              <th className={thClass}>Reference</th>
              <th className={thClass}>Method</th>
              <th className={thClass}>Amount</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Timestamp</th>
            </tr>
          </thead>
          {!payments.length ? null : (
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className={trClass}>
                  <td className={tdClass}>{paymentName(p)}</td>
                  <td className={`${tdClass} font-mono`}>{paymentMatric(p)}</td>
                  <td className={`${tdClass} font-mono text-xs`}>{paymentReference(p)}</td>
                  <td className={tdClass}><Badge variant="info">{p.method}</Badge></td>
                  <td className={`${tdClass} font-medium`}>{formatNaira(p.amount)}</td>
                  <td className={tdClass}><Badge variant={stageBadge(p.status)}>{p.status}</Badge></td>
                  <td className={`${tdClass} whitespace-nowrap font-mono text-xs`}>
                    {formatTimestamp(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </DataTable>
        <TablePager
          page={paymentMeta.page}
          lastPage={paymentMeta.lastPage}
          total={paymentMeta.total}
          from={paymentMeta.from}
          to={paymentMeta.to}
          disabled={paymentsLoading}
          onChange={setPaymentPage}
        />
      </Card>

      <Modal
        title="Disable invoice"
        open={!!disableTarget}
        onCancel={() => {
          if (actingId) return;
          setDisableTarget(null);
          disableForm.resetFields();
        }}
        onOk={submitDisable}
        okText="Disable"
        okButtonProps={{ danger: true, loading: actingId === disableTarget?.id }}
        cancelButtonProps={{ disabled: actingId === disableTarget?.id }}
        destroyOnHidden
      >
        <p className="mb-3 text-sm text-slate-600">
          Invoice <span className="font-mono font-medium">{disableTarget?.number}</span> will no longer be payable.
        </p>
        <Form form={disableForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Reason"
            rules={[
              { required: true, whitespace: true, message: 'Enter a reason for disabling this invoice.' },
              { min: 5, message: 'Reason must be at least 5 characters.' },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Why is this invoice being disabled?"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Apply rebate"
        open={!!rebateTarget}
        onCancel={() => {
          if (rebateSaving || reverseSavingId) return;
          setRebateTarget(null);
          rebateForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        width={560}
      >
        <p className="mb-3 text-sm text-slate-600">
          Invoice <span className="font-mono font-medium">{rebateTarget?.number}</span>
          {' · '}billed {formatNaira(Number(rebateTarget?.amount || 0))}
          {' · '}due {formatNaira(Number(rebateTarget?.balance || 0))}
        </p>
        {(rebateTarget?.rebates || []).length ? (
          <div className="mb-4 rounded-lg border border-slate-200 divide-y divide-slate-100">
            {(rebateTarget.rebates || []).map((rebate: any) => (
              <div key={rebate.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-slate-800">{rebate.type_name || rebate.rebate_type?.name || 'Rebate'}</div>
                  <div className="text-xs text-slate-500">{rebate.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular-nums text-emerald-700">−{formatNaira(Number(rebate.amount || 0))}</div>
                  {!rebate.reversed_at && rebateTarget.status !== 'cancelled' ? (
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                      disabled={reverseSavingId === rebate.id}
                      onClick={() => reverseRebate(rebate)}
                    >
                      Reverse
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {rebateTarget && (rebateTarget.status === 'unpaid' || rebateTarget.status === 'partial') ? (
          <Form form={rebateForm} layout="vertical" onFinish={submitRebate}>
            <Form.Item
              name="rebate_type_id"
              label="Rebate type"
              rules={[{ required: true, message: 'Select a rebate type.' }]}
            >
              <Select
                placeholder={rebateTypes.length ? 'Select type' : 'No active rebate types'}
                options={rebateTypes.map((row) => ({ value: row.id, label: row.name }))}
                onChange={onRebateTypeChange}
              />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="kind" label="Kind" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'percent', label: 'Percent' },
                    { value: 'amount', label: 'Amount (₦)' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="value"
                label={rebateKind === 'amount' ? 'Amount' : 'Percent'}
                rules={[{ required: true, message: 'Enter a value.' }]}
              >
                <Input type="number" min={0.01} max={rebateKind === 'percent' ? 100 : undefined} step="0.01" />
              </Form.Item>
            </div>
            <Form.Item
              name="reason"
              label="Reason"
              rules={[
                { required: true, whitespace: true, message: 'Enter a reason for this rebate.' },
                { min: 5, message: 'Reason must be at least 5 characters.' },
              ]}
            >
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="Why is this rebate being applied?" />
            </Form.Item>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm mb-3">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Rebate</span>
                <span className="tabular-nums font-medium text-emerald-700">
                  −{formatNaira(previewRebate(rebateTarget, rebateKind, Number(rebateValue || 0)).amount)}
                </span>
              </div>
              <div className="flex justify-between gap-3 mt-1">
                <span className="text-slate-500">New amount due</span>
                <span className="tabular-nums font-semibold text-slate-900">
                  {formatNaira(previewRebate(rebateTarget, rebateKind, Number(rebateValue || 0)).newDue)}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setRebateTarget(null)} disabled={rebateSaving}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={rebateSaving} className="!text-white">
                Apply rebate
              </Button>
            </div>
          </Form>
        ) : (
          <p className="text-sm text-slate-500">This invoice can no longer receive a new rebate. Reverse an existing rebate if it is still the last settlement.</p>
        )}
      </Modal>
    </div>
  );
}
