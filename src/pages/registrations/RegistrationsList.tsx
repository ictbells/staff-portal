import { useEffect, useState } from 'react';
import api from '../../api';
import { RefreshButton } from '../../components/RefreshButton';
import { Badge, DataTable, PageHeader, tdClass, thClass, trClass } from '../../components/ui';
import type { RegistrationChannel } from './constants';
import { ENTRY_MODES } from '../academic/constants';

function entryModeLabel(mode: string) {
  return ENTRY_MODES.find((m) => m.value === mode)?.label ?? mode.toUpperCase();
}

type Props = {
  channel: RegistrationChannel;
};

export function RegistrationsList({ channel }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/api/registrations', { params: { entry_modes: channel.entryModes.join(',') } })
      .then((r) => setRows(r.data.data || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [channel.key]);

  const colSpan = channel.showEntryMode ? 5 : 4;

  return (
    <div className="space-y-5">
      <PageHeader title={channel.title} description={channel.description}>
        <RefreshButton onClick={load} loading={loading} />
      </PageHeader>

      <DataTable empty={rows.length === 0} emptyMessage="No registered students yet." colSpan={colSpan}>
        <thead>
          <tr>
            <th className={thClass}>Student</th>
            <th className={thClass}>Matric no.</th>
            {channel.showEntryMode && <th className={thClass}>Entry mode</th>}
            <th className={thClass}>Programme</th>
            <th className={thClass}>Tuition</th>
          </tr>
        </thead>
        {!rows.length ? null : (
          <tbody>
            {rows.map((student) => (
              <tr key={student.id} className={trClass}>
                <td className={tdClass}>
                  <div className="font-medium text-slate-800">
                    {student.first_name} {student.last_name}
                  </div>
                  <div className="text-xs text-slate-500">{student.user?.email}</div>
                </td>
                <td className={tdClass}>{student.matric_number || student.student_number}</td>
                {channel.showEntryMode && (
                  <td className={tdClass}>
                    <Badge variant="info">{entryModeLabel(student.application?.entry_mode)}</Badge>
                  </td>
                )}
                <td className={tdClass}>{student.program?.name ?? '—'}</td>
                <td className={tdClass}>
                  <Badge variant="success">Paid</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </DataTable>
    </div>
  );
}
