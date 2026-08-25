import { useEffect, useState } from 'react';
import { Select } from 'antd';
import api from '../api';

export type SessionOption = { id: number; label: string; is_current?: boolean };
export type LevelOption = { value: string; label: string };

export function useSessionLevelOptions() {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);

  useEffect(() => {
    api.get('/api/academic/sessions')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setSessions(list.map((row: any) => ({
          id: row.id,
          label: row.label || row.session_label || row.name,
          is_current: !!row.is_current,
        })));
      })
      .catch(() => setSessions([]));
    api.get('/api/academic/levels')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        const mapped = list
          .map((row: any) => ({
            value: String(row.code || row.name || ''),
            label: row.name || String(row.code || ''),
          }))
          .filter((row: LevelOption) => row.value);
        setLevels(mapped.length ? mapped : ['100', '200', '300', '400', '500'].map((value) => ({ value, label: value })));
      })
      .catch(() => {
        setLevels(['100', '200', '300', '400', '500'].map((value) => ({ value, label: value })));
      });
  }, []);

  return { sessions, levels };
}

export function SessionLevelFilters({
  sessionId,
  level,
  onSessionChange,
  onLevelChange,
  showSession = true,
  showLevel = true,
  className = '',
}: {
  sessionId?: number;
  level?: string;
  onSessionChange?: (value: number | undefined) => void;
  onLevelChange?: (value: string | undefined) => void;
  showSession?: boolean;
  showLevel?: boolean;
  className?: string;
}) {
  const { sessions, levels } = useSessionLevelOptions();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {showSession && (
        <Select
          allowClear
          className="min-w-[180px]"
          placeholder="Session"
          value={sessionId}
          onChange={(value) => onSessionChange?.(value)}
          options={sessions.map((session) => ({
            value: session.id,
            label: session.is_current ? `${session.label} (current)` : session.label,
          }))}
        />
      )}
      {showLevel && (
        <Select
          allowClear
          className="min-w-[140px]"
          placeholder="Level"
          value={level}
          onChange={(value) => onLevelChange?.(value)}
          options={levels}
        />
      )}
    </div>
  );
}
