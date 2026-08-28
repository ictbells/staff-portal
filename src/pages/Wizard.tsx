import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth';

const steps = [
  { key: 'application_form', title: 'Application form' },
  { key: 'biodata', title: 'Biodata' },
  { key: 'academic_qualifications', title: 'Academic qualifications' },
  { key: 'programme_selection', title: 'Programme selection' },
  { key: 'required_documents', title: 'Required documents' },
];

export default function Wizard() {
  const { auth, refresh } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [payload, setPayload] = useState<any>({});
  const [nin, setNin] = useState('');
  const [msg, setMsg] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);

  const load = async (id: number) => {
    const { data } = await api.get(`/api/applications/${id}`);
    setApp(data);
    const current = data.current_step || 'application_form';
    const i = Math.max(0, steps.findIndex((s) => s.key === current));
    setIdx(i);
    const step = data.steps?.find((s: any) => s.step_key === steps[i].key);
    setPayload(step?.payload || {});
  };

  useEffect(() => {
    api.get('/api/programs').then((r) => setPrograms(r.data));
    const id = auth?.application_id;
    if (id) load(id);
    else api.get('/api/applications').then((r) => {
      const first = r.data.data?.[0];
      if (first) load(first.id);
    });
  }, [auth?.application_id]);

  const save = async () => {
    await api.post(`/api/applications/${app.id}/steps`, { step_key: steps[idx].key, payload });
    setMsg('Progress saved');
    await load(app.id);
  };

  const verifyNin = async () => {
    const { data } = await api.post(`/api/applications/${app.id}/nin`, { nin });
    setPayload((p: any) => ({ ...p, ...data.mapped_fields, nin }));
    setMsg('NIN verified. Personal details are locked.');
  };

  const submit = async () => {
    await save();
    await api.post(`/api/applications/${app.id}/submit`, { submission_notice_accepted: true });
    await refresh();
    setMsg('Submitted for screening');
  };

  if (!app) return <p>No application in progress. Start one from Apply.</p>;
  if (!['fee_paid', 'form_in_progress'].includes(app.stage)) {
    return <p>This file is at <strong>{app.stage}</strong> and the form is locked.</p>;
  }

  const step = steps[idx];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Application form</h1>
      <div className="flex gap-2 text-xs">
        {steps.map((s, i) => (
          <button key={s.key} onClick={() => { setIdx(i); setPayload(app.steps.find((x: any) => x.step_key === s.key)?.payload || {}); }} className={`px-2 py-1 rounded ${i === idx ? 'bg-sky-500 text-white' : 'bg-white border'}`}>
            {i + 1}. {s.title}
          </button>
        ))}
      </div>
      <div className="bg-white border rounded-xl p-6 space-y-3">
        {msg && <p className="text-green-700 text-sm">{msg}</p>}
        {step.key === 'application_form' && (
          <>
            <input className="border rounded px-3 py-2 w-full" placeholder="Phone" value={payload.phone || ''} onChange={(e) => setPayload({ ...payload, phone: e.target.value })} />
            <textarea className="border rounded px-3 py-2 w-full" placeholder="Address" value={payload.address || ''} onChange={(e) => setPayload({ ...payload, address: e.target.value })} />
            <label className="text-sm flex gap-2"><input type="checkbox" checked={!!payload.declaration} onChange={(e) => setPayload({ ...payload, declaration: e.target.checked })} /> I confirm the information is true.</label>
          </>
        )}
        {step.key === 'biodata' && (
          <>
            <div className="flex gap-2">
              <input className="border rounded px-3 py-2 flex-1" placeholder="NIN (11 digits)" value={nin} onChange={(e) => setNin(e.target.value)} />
              <button type="button" onClick={verifyNin} className="bg-green-700 text-white px-3 rounded">Verify with Prembly</button>
            </div>
            {['first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender', 'nin'].map((f) => (
              <input key={f} readOnly className="border rounded px-3 py-2 w-full bg-slate-100" value={payload[f] || ''} placeholder={f} />
            ))}
            <p className="text-xs text-slate-500">NIN fields are the source of truth and cannot be edited.</p>
            <input className="border rounded px-3 py-2 w-full" placeholder="Next of kin" value={payload.next_of_kin || ''} onChange={(e) => setPayload({ ...payload, next_of_kin: e.target.value })} />
            <input className="border rounded px-3 py-2 w-full" placeholder="Next of kin phone" value={payload.next_of_kin_phone || ''} onChange={(e) => setPayload({ ...payload, next_of_kin_phone: e.target.value })} />
          </>
        )}
        {step.key === 'academic_qualifications' && (
          <textarea className="border rounded px-3 py-2 w-full h-32" placeholder="UTME/DE/JUPEB/Transfer/PG qualifications" value={payload.details || ''} onChange={(e) => setPayload({ ...payload, details: e.target.value })} />
        )}
        {step.key === 'programme_selection' && (
          <select className="border rounded px-3 py-2 w-full" value={payload.program_id || ''} onChange={(e) => setPayload({ ...payload, program_id: Number(e.target.value) })}>
            <option value="">Select programme</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {step.key === 'required_documents' && (
          <div>
            <input type="file" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append('file', file);
              fd.append('doc_type', 'supporting');
              await api.post(`/api/applications/${app.id}/documents`, fd);
              setMsg('Document uploaded');
            }} />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={save} className="bg-sky-500 text-white px-4 py-2 rounded-lg">Save progress</button>
          {idx === steps.length - 1 && (
            <button
              onClick={submit}
              disabled={app.application_window_open === false}
              className="bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Final submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
