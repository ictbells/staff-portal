import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  message,
} from 'antd';
import dayjs from 'dayjs';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  FileHeart,
  HeartPulse,
  Pill,
  Receipt,
  Settings2,
  Shield,
  Stethoscope,
  Thermometer,
  UserRound,
  Users,
} from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../auth';
import { RefreshButton } from '../../components/RefreshButton';
import { Badge, Card, StatCard, WorkspaceHero, fieldLabelClass } from '../../components/ui';

type TabKey = 'queue' | 'appointments' | 'chart' | 'bills' | 'settings';
type EncounterTab = 'clinical' | 'prescriptions' | 'charges' | 'sick_notes';

const DATE_PICKER_FORMAT = 'DD/MM/YYYY';

function money(n?: number | string | null) {
  return `₦${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD MMM YYYY') : String(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD MMM YYYY, HH:mm') : String(value);
}

function titleCase(value?: string | null) {
  if (!value) return '—';
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function studentName(student?: any) {
  if (!student) return 'Student';
  const name = [student.first_name, student.last_name].filter(Boolean).join(' ');
  return name || student.user?.name || 'Student';
}

function studentMatric(student?: any) {
  return student?.matric_number || student?.student_number || '—';
}

function initials(student?: any) {
  const first = String(student?.first_name || student?.user?.name || 'S').trim().charAt(0);
  const last = String(student?.last_name || '').trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

function medicalProfile(student?: any) {
  return student?.medical_profile || student?.medicalProfile;
}

function statusBadge(status?: string) {
  const key = String(status || '');
  const variant = key === 'completed' || key === 'paid' || key === 'scheduled'
    ? 'success'
    : key === 'in_progress' || key === 'open'
      ? 'info'
      : key === 'waiting' || key === 'pending' || key === 'unpaid'
        ? 'warning'
        : 'default';
  return <Badge variant={variant}>{titleCase(key)}</Badge>;
}

function priorityTone(priority?: number | null) {
  const value = Number(priority || 0);
  if (value <= 1) return 'bg-red-50 text-red-700 ring-red-200';
  if (value === 2) return 'bg-orange-50 text-orange-800 ring-orange-200';
  if (value === 3) return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function NhisBadge({ profile }: { profile?: any }) {
  if (!profile?.nhis_enrolled) return null;
  return <Badge variant="info">NHIS</Badge>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="bg-white px-4 py-4 sm:px-5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 break-words">{value == null || value === '' ? '—' : value}</dd>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-800 mb-3">{children}</h3>;
}

export default function ClinicWorkspace() {
  const { has } = useAuth();
  const canView = has('medical.view_any') || has('medical.manage');
  const canManage = has('medical.manage');
  const canBill = has('medical.billing');
  const [tab, setTab] = useState<TabKey>('queue');
  const [encounterTab, setEncounterTab] = useState<EncounterTab>('clinical');
  const [queueDate, setQueueDate] = useState(dayjs());
  const [queue, setQueue] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [queueQuery, setQueueQuery] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInForm] = Form.useForm();
  const [visitId, setVisitId] = useState<number | null>(null);
  const [visit, setVisit] = useState<any>(null);
  const [split, setSplit] = useState<any>(null);
  const [chartStudentId, setChartStudentId] = useState<number | undefined>();
  const [chart, setChart] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [profileForm] = Form.useForm();
  const [immForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [rxForm] = Form.useForm();
  const [sickForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const [coverageOverride, setCoverageOverride] = useState<number | null>(null);
  const [printHtml, setPrintHtml] = useState<string | null>(null);

  const printSickNote = async (id: number) => {
    try {
      const { data } = await api.get(`/api/clinic/sick-notes/${id}/print`, { responseType: 'text' });
      setPrintHtml(typeof data === 'string' ? data : String(data));
    } catch {
      message.error('Could not load sick note');
    }
  };

  const studentOptions = useMemo(
    () => students.map((s) => ({
      value: s.id,
      label: `${s.first_name} ${s.last_name}${s.matric_number ? ` (${s.matric_number})` : ''}`,
    })),
    [students],
  );

  const loadStudents = useCallback(() => {
    api.get('/api/students', { params: { page: 1, per_page: 200 } })
      .then((r) => setStudents(r.data.data ?? r.data ?? []))
      .catch(() => {});
  }, []);

  const loadQueue = useCallback(() => {
    if (!canView) return;
    setLoading(true);
    api.get('/api/clinic/queue', { params: { date: queueDate.format('YYYY-MM-DD') } })
      .then((r) => {
        setQueue(r.data.visits || []);
        setSettings(r.data.settings);
      })
      .catch(() => message.error('Could not load clinic queue'))
      .finally(() => setLoading(false));
  }, [canView, queueDate]);

  const loadAppointments = useCallback(() => {
    if (!canView) return;
    api.get('/api/clinic/appointments')
      .then((r) => setAppointments(Array.isArray(r.data) ? r.data : []))
      .catch(() => message.error('Could not load clinic appointments'));
  }, [canView]);

  const loadBills = useCallback(() => {
    if (!canView && !canBill) return;
    api.get('/api/clinic/bills')
      .then((r) => setBills(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [canView, canBill]);

  const loadSettings = useCallback(() => {
    api.get('/api/clinic/settings')
      .then((r) => {
        setSettings(r.data);
        settingsForm.setFieldsValue(r.data);
      })
      .catch(() => {});
  }, [settingsForm]);

  const loadChart = useCallback(() => {
    if (!chartStudentId) {
      setChart(null);
      return;
    }
    setLoading(true);
    api.get(`/api/medical/${chartStudentId}`)
      .then((r) => {
        setChart(r.data);
        profileForm.setFieldsValue({
          ...r.data.profile,
          nhis_valid_until: r.data.profile?.nhis_valid_until ? dayjs(r.data.profile.nhis_valid_until) : null,
        });
      })
      .catch(() => setChart(null))
      .finally(() => setLoading(false));
  }, [chartStudentId, profileForm]);

  const openVisit = async (id: number) => {
    setVisitId(id);
    setEncounterTab('clinical');
    const { data } = await api.get(`/api/clinic/visits/${id}`);
    setVisit(data);
    const preview = await api.get(`/api/clinic/visits/${id}/preview-split`);
    setSplit(preview.data);
  };

  const refreshVisit = async () => {
    if (!visitId) return;
    await openVisit(visitId);
  };

  useEffect(() => {
    if (!canView) return;
    loadStudents();
    loadQueue();
    loadSettings();
  }, [canView, loadStudents, loadQueue, loadSettings]);

  useEffect(() => {
    if (tab === 'queue') loadQueue();
    if (tab === 'appointments') loadAppointments();
    if (tab === 'bills') loadBills();
    if (tab === 'settings') loadSettings();
    if (tab === 'chart') loadChart();
  }, [tab, loadQueue, loadAppointments, loadBills, loadSettings, loadChart]);

  useEffect(() => { loadChart(); }, [chartStudentId, loadChart]);

  const filteredQueue = useMemo(() => {
    const q = queueQuery.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((row) => {
      const student = row.student || {};
      const hay = [
        student.first_name,
        student.last_name,
        student.matric_number,
        student.student_number,
        row.complaint,
        row.visit_type,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [queue, queueQuery]);

  const waiting = filteredQueue.filter((row) => row.status === 'waiting');
  const inProgress = filteredQueue.filter((row) => row.status === 'in_progress');
  const finished = filteredQueue.filter((row) => row.status === 'completed' || row.status === 'cancelled');
  const nhisInQueue = queue.filter((row) => medicalProfile(row.student)?.nhis_enrolled).length;
  const completedToday = queue.filter((row) => row.status === 'completed').length;

  const billTotals = useMemo(() => ({
    gross: bills.reduce((sum, row) => sum + Number(row.gross_amount ?? row.amount ?? 0), 0),
    covered: bills.reduce((sum, row) => sum + Number(row.nhis_covered_amount ?? 0), 0),
    payable: bills.reduce((sum, row) => sum + Number(row.student_payable_amount ?? row.amount ?? 0), 0),
  }), [bills]);

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: 'queue', label: 'Queue', icon: Users },
    { key: 'appointments', label: 'Appointments', icon: CalendarClock },
    { key: 'chart', label: 'Charts', icon: HeartPulse },
    { key: 'bills', label: 'Bills', icon: Receipt },
    ...(canManage ? [{ key: 'settings' as const, label: 'Settings', icon: Settings2 }] : []),
  ];

  const encounterTabs: { key: EncounterTab; label: string; icon: typeof Activity }[] = [
    { key: 'clinical', label: 'Clinical', icon: Stethoscope },
    { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { key: 'charges', label: 'Charges', icon: Receipt },
    { key: 'sick_notes', label: 'Sick notes', icon: FileHeart },
  ];

  if (!canView) {
    return (
      <div className="space-y-5">
        <WorkspaceHero
          eyebrow="Campus services"
          title="Clinic"
          description="Campus clinic for matriculated students."
          icon={Stethoscope}
        />
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          You need <code className="text-xs">medical.view_any</code> or <code className="text-xs">medical.manage</code>.
        </p>
      </div>
    );
  }

  const checkIn = async () => {
    try {
      const values = await checkInForm.validateFields();
      const { data } = await api.post('/api/clinic/queue', {
        student_id: values.student_id,
        visit_type: values.visit_type || 'walk_in',
        complaint: values.complaint,
        triage_priority: values.triage_priority,
        visited_on: queueDate.format('YYYY-MM-DD'),
      });
      message.success(data?.reused_appointment
        ? 'Checked in against today’s appointment.'
        : 'Student checked in');
      setCheckInOpen(false);
      checkInForm.resetFields();
      loadQueue();
      loadAppointments();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || 'Could not check in student');
    }
  };

  const saveProfile = async () => {
    if (!chartStudentId) return;
    const values = await profileForm.validateFields();
    await api.put(`/api/medical/${chartStudentId}`, {
      ...values,
      nhis_valid_until: values.nhis_valid_until ? values.nhis_valid_until.format('YYYY-MM-DD') : null,
      nhis_coverage_percent: values.nhis_coverage_percent === '' || values.nhis_coverage_percent === undefined
        ? null
        : values.nhis_coverage_percent,
    });
    message.success('Profile saved');
    loadChart();
  };

  const addImmunization = async () => {
    if (!chartStudentId) return;
    const values = await immForm.validateFields();
    await api.post(`/api/medical/${chartStudentId}/immunizations`, {
      vaccine: values.vaccine,
      given_on: values.given_on ? values.given_on.format('YYYY-MM-DD') : null,
    });
    immForm.resetFields();
    message.success('Immunization recorded');
    loadChart();
  };

  const addItem = async () => {
    if (!visitId) return;
    const values = await itemForm.validateFields();
    await api.post(`/api/clinic/visits/${visitId}/items`, values);
    itemForm.resetFields();
    await refreshVisit();
  };

  const addRx = async () => {
    if (!visitId) return;
    const values = await rxForm.validateFields();
    await api.post(`/api/clinic/visits/${visitId}/prescriptions`, values);
    rxForm.resetFields();
    message.success('Prescription added');
    await refreshVisit();
  };

  const addSick = async () => {
    if (!visitId) return;
    const values = await sickForm.validateFields();
    await api.post(`/api/clinic/visits/${visitId}/sick-notes`, {
      reason: values.reason,
      restrictions: values.restrictions,
      valid_from: values.range[0].format('YYYY-MM-DD'),
      valid_to: values.range[1].format('YYYY-MM-DD'),
    });
    sickForm.resetFields();
    message.success('Sick note issued');
    await refreshVisit();
  };

  const finalize = async () => {
    if (!visitId) return;
    await api.post(`/api/clinic/visits/${visitId}/finalize-bill`, {
      coverage_percent_override: coverageOverride,
    });
    message.success('Bill finalized');
    await refreshVisit();
    loadBills();
  };

  const saveSettings = async () => {
    const values = await settingsForm.validateFields();
    const { data } = await api.put('/api/clinic/settings', values);
    setSettings(data);
    message.success('Clinic settings saved');
  };

  const startVisit = async (id: number) => {
    await api.patch(`/api/clinic/visits/${id}`, { status: 'in_progress' });
    openVisit(id);
    loadQueue();
  };

  const completeVisit = async (id: number) => {
    await api.patch(`/api/clinic/visits/${id}`, { status: 'completed' });
    loadQueue();
    if (visitId === id) refreshVisit();
  };

  const approveAppointment = async (id: number) => {
    try {
      await api.post(`/api/clinic/appointments/${id}/approve`);
      message.success('Appointment approved.');
      loadAppointments();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not approve appointment.');
    }
  };

  const rejectAppointment = async (id: number) => {
    try {
      await api.post(`/api/clinic/appointments/${id}/reject`);
      message.success('Appointment rejected.');
      loadAppointments();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not reject appointment.');
    }
  };

  const checkInAppointment = async (row: any) => {
    try {
      const { data } = await api.post('/api/clinic/queue', {
        student_id: row.student_id,
        visit_type: 'appointment',
        visited_on: String(row.visited_on || '').slice(0, 10),
      });
      message.success(data?.reused_appointment
        ? 'Checked in against today’s appointment.'
        : 'Student checked in');
      loadAppointments();
      loadQueue();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Could not check in student');
    }
  };

  const refreshCurrent = () => {
    if (tab === 'queue') loadQueue();
    if (tab === 'appointments') loadAppointments();
    if (tab === 'chart') loadChart();
    if (tab === 'bills') loadBills();
    if (tab === 'settings') loadSettings();
  };

  const renderQueueCard = (row: any) => (
    <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-sky-200 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-800">
          {initials(row.student)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-slate-900 truncate">{studentName(row.student)}</p>
            <NhisBadge profile={medicalProfile(row.student)} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{studentMatric(row.student)}</p>
        </div>
        {row.triage_priority ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${priorityTone(row.triage_priority)}`}>
            P{row.triage_priority}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          {row.visit_type === 'appointment' ? 'Appointment' : 'Walk-in'}
        </span>
        {row.scheduled_at && <span>{formatDateTime(row.scheduled_at)}</span>}
      </div>
      {row.complaint && <p className="mt-2 text-sm text-slate-700 line-clamp-2">{row.complaint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {canManage && row.status === 'waiting' && (
          <Button size="small" type="primary" onClick={() => startVisit(row.id)}>Start</Button>
        )}
        <Button size="small" onClick={() => openVisit(row.id)}>Open</Button>
        {canManage && row.status !== 'completed' && row.status !== 'cancelled' && (
          <Button size="small" onClick={() => completeVisit(row.id)}>Complete</Button>
        )}
      </div>
    </div>
  );

  const queueColumn = (title: string, rows: any[], empty: string, tone: string) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 min-h-[18rem]">
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone}`} />
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        <span className="text-xs font-medium text-slate-500">{rows.length}</span>
      </div>
      <div className="space-y-3">
        {rows.length ? rows.map(renderQueueCard) : (
          <p className="text-sm text-slate-500 px-1 py-6 text-center">{empty}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <WorkspaceHero
        eyebrow="Campus clinic"
        title="Clinic workspace"
        description="Check in students, run encounters, issue sick notes, and split NHIS-aware clinic bills."
        icon={Stethoscope}
      >
        {canManage && (
          <Button type="primary" icon={<ClipboardPlus size={14} />} onClick={() => setCheckInOpen(true)}>
            Check in
          </Button>
        )}
        <RefreshButton onClick={refreshCurrent} loading={loading} />
      </WorkspaceHero>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Waiting" value={waiting.length} hint={queueDate.format('DD MMM YYYY')} icon={Clock3} tone="amber" />
        <StatCard label="In progress" value={inProgress.length} hint="Active encounters" icon={Activity} tone="sky" />
        <StatCard label="Completed" value={completedToday} hint="Finished today" icon={CheckCircle2} tone="emerald" />
        <StatCard label="NHIS in queue" value={nhisInQueue} hint={`Default cover ${settings?.nhis_default_coverage_percent ?? 90}%`} icon={Shield} tone="sky" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                active ? 'bg-sky-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className={`${fieldLabelClass} mb-0 sm:w-48`}>
              Date
              <div className="mt-1">
                <DatePicker className="w-full" value={queueDate} format={DATE_PICKER_FORMAT} onChange={(d) => d && setQueueDate(d)} />
              </div>
            </label>
            <label className={`${fieldLabelClass} mb-0 flex-1`}>
              Find in queue
              <Input
                className="mt-1"
                allowClear
                placeholder="Name, matric, or complaint"
                value={queueQuery}
                onChange={(e) => setQueueQuery(e.target.value)}
              />
            </label>
          </div>
          {loading && !queue.length ? (
            <EmptyPanel title="Loading queue" body="Fetching visits for the selected date." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {queueColumn('Waiting', waiting, 'No students waiting.', 'bg-amber-400')}
              {queueColumn('In progress', inProgress, 'No active encounters.', 'bg-sky-500')}
              {queueColumn('Done', finished, 'No completed visits yet.', 'bg-emerald-500')}
            </div>
          )}
        </div>
      )}

      {tab === 'appointments' && (
        <div className="space-y-4">
          <Card
            title="Appointment requests"
            description="Approve student bookings before they join the live queue. Check in a scheduled student when they arrive."
          >
            <Table
              rowKey="id"
              size="small"
              dataSource={appointments}
              locale={{ emptyText: 'No pending or scheduled appointments.' }}
              pagination={{ pageSize: 15 }}
              columns={[
                { title: 'Student', render: (_: any, row: any) => studentName(row.student) },
                { title: 'Matric', render: (_: any, row: any) => studentMatric(row.student) },
                { title: 'When', dataIndex: 'scheduled_at', render: (v: string) => formatDateTime(v) },
                { title: 'Reason', dataIndex: 'complaint', ellipsis: true },
                { title: 'Status', dataIndex: 'status', render: (s: string) => statusBadge(s) },
                {
                  title: '',
                  render: (_: any, row: any) => canManage ? (
                    <div className="flex flex-wrap gap-2">
                      {row.status === 'pending' && (
                        <>
                          <Button size="small" type="primary" onClick={() => approveAppointment(row.id)}>Approve</Button>
                          <Popconfirm
                            title="Reject this appointment?"
                            description="The student can book another slot."
                            okText="Reject"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => rejectAppointment(row.id)}
                          >
                            <Button size="small" danger>Reject</Button>
                          </Popconfirm>
                        </>
                      )}
                      {row.status === 'scheduled' && (
                        <Button size="small" type="primary" onClick={() => checkInAppointment(row)}>Check in</Button>
                      )}
                    </div>
                  ) : null,
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'chart' && (
        <div className="space-y-4">
          <Card title="Student chart" description="Open a medical profile, immunizations, and visit history.">
            <label className={fieldLabelClass}>
              Student
              <Select
                showSearch
                allowClear
                className="w-full max-w-lg mt-1"
                placeholder="Search by name or matric"
                options={studentOptions}
                optionFilterProp="label"
                value={chartStudentId}
                onChange={setChartStudentId}
              />
            </label>
          </Card>

          {!chartStudentId && (
            <EmptyPanel title="Select a student" body="Choose a student to view their clinic chart, NHIS details, and visit history." />
          )}

          {chart && (
            <>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 border-b border-slate-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-800">
                    {initials(chart.student)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{studentName(chart.student)}</h2>
                      <NhisBadge profile={chart.profile} />
                    </div>
                    <p className="text-sm text-slate-500">{studentMatric(chart.student)}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    Effective NHIS cover <span className="font-semibold text-slate-900">{chart.effective_coverage_percent ?? 0}%</span>
                  </div>
                </div>
                <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
                  <Field label="Blood type" value={chart.profile?.blood_type} />
                  <Field label="Genotype" value={chart.profile?.genotype} />
                  <Field label="NHIS number" value={chart.profile?.nhis_number} />
                  <Field label="Provider" value={chart.profile?.nhis_provider} />
                </dl>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card title="Medical profile" description="Allergies, conditions, and NHIS enrolment.">
                  <Form form={profileForm} layout="vertical" disabled={!canManage} className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Form.Item name="blood_type" label="Blood type"><Input /></Form.Item>
                    <Form.Item name="genotype" label="Genotype">
                      <Select options={['AA', 'AS', 'AC', 'SS', 'SC', 'CC'].map((v) => ({ value: v, label: v }))} allowClear />
                    </Form.Item>
                    <Form.Item name="allergies" label="Allergies" className="md:col-span-2"><Input.TextArea rows={2} /></Form.Item>
                    <Form.Item name="conditions" label="Conditions" className="md:col-span-2"><Input.TextArea rows={2} /></Form.Item>
                    <Form.Item name="nhis_enrolled" label="NHIS enrolled" valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name="nhis_number" label="NHIS number"><Input /></Form.Item>
                    <Form.Item name="nhis_provider" label="Provider / HMO"><Input /></Form.Item>
                    <Form.Item
                      name="nhis_coverage_percent"
                      label={`Coverage % override (blank = campus default ${settings?.nhis_default_coverage_percent ?? 90}%)`}
                    >
                      <InputNumber min={0} max={100} className="w-full" />
                    </Form.Item>
                    <Form.Item name="nhis_valid_until" label="NHIS valid until">
                      <DatePicker className="w-full" format={DATE_PICKER_FORMAT} />
                    </Form.Item>
                  </Form>
                  {canManage && <Button type="primary" onClick={saveProfile}>Save profile</Button>}
                </Card>

                <Card title="Immunizations" description="Record vaccines given at the campus clinic.">
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    locale={{ emptyText: 'No immunizations recorded.' }}
                    dataSource={chart.immunizations || []}
                    columns={[
                      { title: 'Vaccine', dataIndex: 'vaccine' },
                      { title: 'Given on', dataIndex: 'given_on', render: (v: string) => formatDate(v) },
                      ...(canManage ? [{
                        title: '',
                        render: (_: any, row: any) => (
                          <Button size="small" danger type="link" onClick={async () => {
                            await api.delete(`/api/medical/immunizations/${row.id}`);
                            loadChart();
                          }}>Remove</Button>
                        ),
                      }] : []),
                    ]}
                  />
                  {canManage && (
                    <Form form={immForm} layout="inline" className="mt-3 gap-2" onFinish={addImmunization}>
                      <Form.Item name="vaccine" rules={[{ required: true }]}><Input placeholder="Vaccine" /></Form.Item>
                      <Form.Item name="given_on"><DatePicker format={DATE_PICKER_FORMAT} /></Form.Item>
                      <Button htmlType="submit">Add</Button>
                    </Form>
                  )}
                </Card>
              </div>

              <Card title="Visit history" description="Previous clinic encounters for this student.">
                <Table
                  rowKey="id"
                  size="small"
                  locale={{ emptyText: 'No visits yet.' }}
                  dataSource={chart.visits || []}
                  columns={[
                    { title: 'Date', dataIndex: 'visited_on', render: (v: string) => formatDate(v) },
                    { title: 'Status', dataIndex: 'status', render: (s: string) => statusBadge(s) },
                    { title: 'Complaint', dataIndex: 'complaint', ellipsis: true },
                    { title: 'Diagnosis', dataIndex: 'diagnosis', ellipsis: true },
                    {
                      title: '',
                      render: (_: any, row: any) => (
                        <Button size="small" type="link" onClick={() => openVisit(row.id)}>Open</Button>
                      ),
                    },
                  ]}
                />
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'bills' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Gross billed" value={money(billTotals.gross)} icon={Receipt} tone="sky" />
            <StatCard label="NHIS covered" value={money(billTotals.covered)} icon={Shield} tone="sky" />
            <StatCard label="Student pays" value={money(billTotals.payable)} icon={UserRound} tone="amber" />
          </div>
          <Card title="Clinic bills" description="Recent finalized clinic bills and the student-payable share.">
            <Table
              rowKey="id"
              dataSource={bills}
              locale={{ emptyText: 'No clinic bills yet.' }}
              columns={[
                { title: 'Student', render: (_: any, row: any) => studentName(row.visit?.student) },
                { title: 'Gross', render: (_: any, row: any) => money(row.gross_amount ?? row.amount) },
                { title: 'NHIS covered', render: (_: any, row: any) => money(row.nhis_covered_amount) },
                { title: 'Student pays', render: (_: any, row: any) => money(row.student_payable_amount ?? row.amount) },
                { title: 'Status', dataIndex: 'status', render: (s: string) => statusBadge(s) },
                { title: 'Invoice', render: (_: any, row: any) => row.invoice?.number || '—' },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'settings' && canManage && (
        <Card title="NHIS billing rules" description="Campus default coverage. Per-student overrides live on the chart.">
          <p className="text-sm text-slate-600 mb-4">
            Students on NHIS do not pay the full clinic charge. The student invoice is only the uncovered share.
          </p>
          <Form form={settingsForm} layout="vertical" className="max-w-md" onFinish={saveSettings}>
            <Form.Item name="nhis_enabled" label="Enable NHIS billing splits" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="nhis_default_coverage_percent" label="Default NHIS coverage %" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} className="w-full" />
            </Form.Item>
            <Form.Item name="nhis_auto_cover_lines" label="Auto-mark new charge lines as NHIS-covered" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Button type="primary" htmlType="submit">Save settings</Button>
          </Form>
        </Card>
      )}

      <Modal title="Check in student" open={checkInOpen} onCancel={() => setCheckInOpen(false)} onOk={checkIn} okText="Check in">
        <Form form={checkInForm} layout="vertical">
          <Form.Item name="student_id" label="Student" rules={[{ required: true }]}>
            <Select showSearch options={studentOptions} optionFilterProp="label" placeholder="Search student" />
          </Form.Item>
          <Form.Item name="visit_type" label="Visit type" initialValue="walk_in">
            <Select options={[
              { value: 'walk_in', label: 'Walk-in' },
              { value: 'appointment', label: 'Appointment' },
            ]} />
          </Form.Item>
          <Form.Item name="triage_priority" label="Priority (1 highest – 5 lowest)">
            <InputNumber min={1} max={5} className="w-full" />
          </Form.Item>
          <Form.Item name="complaint" label="Complaint">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={null}
        width={840}
        open={!!visitId}
        onClose={() => { setVisitId(null); setVisit(null); }}
        destroyOnHidden
      >
        {visit && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50/40 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
                  {initials(visit.student)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{studentName(visit.student)}</h2>
                    <NhisBadge profile={medicalProfile(visit.student)} />
                    {statusBadge(visit.status)}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {studentMatric(visit.student)} · {visit.visit_type === 'appointment' ? 'Appointment' : 'Walk-in'} · {formatDate(visit.visited_on)}
                  </p>
                  {visit.complaint && <p className="mt-2 text-sm text-slate-700">{visit.complaint}</p>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {encounterTabs.map((item) => {
                const Icon = item.icon;
                const active = encounterTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setEncounterTab(item.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {encounterTab === 'clinical' && canManage && (
              <Form
                layout="vertical"
                initialValues={visit}
                key={visit.updated_at || visit.id}
                onFinish={async (values) => {
                  await api.patch(`/api/clinic/visits/${visit.id}`, values);
                  message.success('Visit saved');
                  refreshVisit();
                  loadQueue();
                }}
              >
                <SectionLabel>Complaint and diagnosis</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Form.Item name="complaint" label="Complaint"><Input.TextArea rows={3} /></Form.Item>
                  <Form.Item name="diagnosis" label="Diagnosis"><Input.TextArea rows={3} /></Form.Item>
                  <Form.Item name="notes" label="Notes (internal)" className="sm:col-span-2"><Input.TextArea rows={2} /></Form.Item>
                </div>
                <SectionLabel>Vitals</SectionLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Form.Item name="temperature" label="Temp (°C)"><InputNumber className="w-full" prefix={<Thermometer size={12} />} /></Form.Item>
                  <Form.Item name="pulse" label="Pulse"><InputNumber className="w-full" /></Form.Item>
                  <Form.Item name="bp_systolic" label="BP systolic"><InputNumber className="w-full" /></Form.Item>
                  <Form.Item name="bp_diastolic" label="BP diastolic"><InputNumber className="w-full" /></Form.Item>
                  <Form.Item name="weight_kg" label="Weight (kg)"><InputNumber className="w-full" /></Form.Item>
                  <Form.Item name="height_cm" label="Height (cm)"><InputNumber className="w-full" /></Form.Item>
                  <Form.Item name="disposition" label="Disposition" className="sm:col-span-2"><Input /></Form.Item>
                  <Form.Item name="status" label="Status">
                    <Select options={['waiting', 'in_progress', 'completed', 'cancelled'].map((v) => ({ value: v, label: titleCase(v) }))} />
                  </Form.Item>
                </div>
                <Button type="primary" htmlType="submit">Save encounter</Button>
              </Form>
            )}

            {encounterTab === 'clinical' && !canManage && (
              <dl className="grid grid-cols-2 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                <Field label="Complaint" value={visit.complaint} />
                <Field label="Diagnosis" value={visit.diagnosis} />
                <Field label="Temperature" value={visit.temperature} />
                <Field label="Pulse" value={visit.pulse} />
                <Field label="Disposition" value={visit.disposition} />
                <Field label="Status" value={statusBadge(visit.status)} />
              </dl>
            )}

            {encounterTab === 'prescriptions' && (
              <div>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: 'No prescriptions on this visit.' }}
                  dataSource={visit.prescriptions || []}
                  columns={[
                    { title: 'Medication', dataIndex: 'medication' },
                    { title: 'Dosage', dataIndex: 'dosage' },
                    { title: 'Freq', dataIndex: 'frequency' },
                    {
                      title: 'Dispensed',
                      render: (_: boolean, row: any) => row.dispensed_at
                        ? formatDateTime(row.dispensed_at)
                        : canManage
                          ? (
                            <Button size="small" onClick={async () => {
                              await api.patch(`/api/clinic/prescriptions/${row.id}/dispense`);
                              refreshVisit();
                            }}>Dispense</Button>
                          )
                          : 'No',
                    },
                  ]}
                />
                {canManage && (
                  <Form form={rxForm} layout="inline" className="mt-3 gap-2" onFinish={addRx}>
                    <Form.Item name="medication" rules={[{ required: true }]}><Input placeholder="Medication" /></Form.Item>
                    <Form.Item name="dosage"><Input placeholder="Dosage" /></Form.Item>
                    <Form.Item name="frequency"><Input placeholder="Frequency" /></Form.Item>
                    <Form.Item name="duration"><Input placeholder="Duration" /></Form.Item>
                    <Button htmlType="submit">Add</Button>
                  </Form>
                )}
              </div>
            )}

            {encounterTab === 'charges' && (
              <div>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: 'No charge lines yet.' }}
                  dataSource={visit.items || []}
                  columns={[
                    { title: 'Description', dataIndex: 'description' },
                    { title: 'Qty', dataIndex: 'quantity' },
                    { title: 'Unit', render: (_: any, row: any) => money(row.unit_amount) },
                    { title: 'Total', render: (_: any, row: any) => money(row.line_total) },
                    {
                      title: 'NHIS',
                      dataIndex: 'nhis_covered',
                      render: (v: boolean, row: any) => (
                        <Checkbox
                          checked={!!v}
                          disabled={!!visit.bill || !(canBill || canManage)}
                          onChange={async (e) => {
                            await api.patch(`/api/clinic/visit-items/${row.id}`, { nhis_covered: e.target.checked });
                            refreshVisit();
                          }}
                        />
                      ),
                    },
                    {
                      title: '',
                      render: (_: any, row: any) => !visit.bill && (canBill || canManage) ? (
                        <Button size="small" danger type="link" onClick={async () => {
                          await api.delete(`/api/clinic/visit-items/${row.id}`);
                          refreshVisit();
                        }}>Remove</Button>
                      ) : null,
                    },
                  ]}
                />
                {!visit.bill && (canBill || canManage) && (
                  <Form form={itemForm} layout="inline" className="mt-3 gap-2" onFinish={addItem}>
                    <Form.Item name="description" rules={[{ required: true }]}><Input placeholder="Description" /></Form.Item>
                    <Form.Item name="quantity" initialValue={1}><InputNumber min={0.01} /></Form.Item>
                    <Form.Item name="unit_amount" rules={[{ required: true }]}><InputNumber min={0} placeholder="Amount" /></Form.Item>
                    <Button htmlType="submit">Add line</Button>
                  </Form>
                )}
                {split && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Gross</div>
                      <div className="mt-1 font-semibold text-slate-900">{money(split.gross)}</div>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-sky-700">NHIS covered</div>
                      <div className="mt-1 font-semibold text-sky-950">
                        {money(split.covered)} <span className="text-xs font-normal">({split.coverage_percent}%)</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                      <div className="text-xs uppercase tracking-wide text-amber-800">Student pays</div>
                      <div className="mt-1 font-semibold text-amber-950">{money(split.payable)}</div>
                    </div>
                  </div>
                )}
                {!visit.bill && canBill && (
                  <div className="mt-4 flex flex-wrap gap-2 items-end">
                    <label className={fieldLabelClass}>
                      Coverage % override (optional)
                      <InputNumber
                        className="mt-1 w-40"
                        min={0}
                        max={100}
                        value={coverageOverride ?? undefined}
                        onChange={(v) => setCoverageOverride(v === null ? null : Number(v))}
                      />
                    </label>
                    <Button type="primary" onClick={finalize}>Finalize bill</Button>
                  </div>
                )}
                {visit.bill && (
                  <p className="mt-3 text-sm text-emerald-700">
                    Bill {visit.bill.status}: student payable {money(visit.bill.student_payable_amount)}
                    {visit.bill.invoice ? ` · ${visit.bill.invoice.number}` : ' · fully covered (no invoice)'}
                  </p>
                )}
              </div>
            )}

            {encounterTab === 'sick_notes' && (
              <div>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: 'No sick notes issued on this visit.' }}
                  dataSource={visit.sick_notes || visit.sickNotes || []}
                  columns={[
                    { title: 'From', dataIndex: 'valid_from', render: (v: string) => formatDate(v) },
                    { title: 'To', dataIndex: 'valid_to', render: (v: string) => formatDate(v) },
                    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
                    {
                      title: '',
                      render: (_: any, row: any) => (
                        <Button size="small" type="link" onClick={() => printSickNote(row.id)}>Print</Button>
                      ),
                    },
                  ]}
                />
                {canManage && (
                  <Form form={sickForm} layout="vertical" className="mt-4" onFinish={addSick}>
                    <Form.Item name="range" label="Valid period" rules={[{ required: true }]}>
                      <DatePicker.RangePicker className="w-full" format={DATE_PICKER_FORMAT} />
                    </Form.Item>
                    <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="restrictions" label="Restrictions">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Button htmlType="submit">Issue sick note</Button>
                  </Form>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="Sick note"
        open={!!printHtml}
        onCancel={() => setPrintHtml(null)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setPrintHtml(null)}>Close</Button>,
          <Button
            key="print"
            type="primary"
            onClick={() => {
              const frame = document.getElementById('clinic-sick-note-frame') as HTMLIFrameElement | null;
              frame?.contentWindow?.print();
            }}
          >
            Print
          </Button>,
        ]}
      >
        {printHtml && (
          <iframe
            id="clinic-sick-note-frame"
            title="Sick note"
            className="w-full h-[70vh] border border-slate-200 rounded"
            srcDoc={printHtml}
          />
        )}
      </Modal>
    </div>
  );
}
