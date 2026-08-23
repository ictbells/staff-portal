import { FormEvent, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth';
import { Badge, Btn, Card, DataTable, fieldHelpClass, formStackClass, inputClass, PageHeader, Spinner, tdClass, thClass, trClass } from '../components/ui';
import { PasswordHints } from './Reset';

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function Profile() {
  const { auth, setAuth } = useAuth();
  const user = auth?.user;
  const staff = user?.staff;
  const rolePermissions = auth?.role_permissions ?? [];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [staffTitle, setStaffTitle] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setStaffTitle(staff?.title || '');
  }, [user?.name, user?.phone, staff?.title]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password && password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        phone: phone.trim(),
      };
      if (staff) payload.staff_title = staffTitle.trim();
      if (password) payload.password = password;
      if (password) payload.password_confirmation = passwordConfirmation;

      const { data } = await api.patch('/api/me', payload);
      setAuth(data);
      setPassword('');
      setPasswordConfirmation('');
      setSuccess('Profile updated.');
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(' '));
      } else {
        setError(err.response?.data?.message || 'Unable to update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" description="Update your account details. Email cannot be changed here." />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Account" description="Editable profile fields for your staff sign-in.">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700 ring-2 ring-sky-200">
              {initials(name || user?.name)}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate">{name || user?.name || '—'}</div>
              <div className="text-sm text-slate-500 truncate">{user?.email || '—'}</div>
              {phone && <div className="text-sm text-slate-500 truncate">{phone}</div>}
            </div>
          </div>

          <form onSubmit={submit} className={formStackClass}>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{success}</p>}

            <label className="block text-sm font-medium text-slate-700">
              Full name
              <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Email
              <input className={`${inputClass} mt-1 bg-slate-50 text-slate-500`} value={user?.email || ''} readOnly />
              <p className={fieldHelpClass}>Contact ICT to change your work email.</p>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Phone
              <input
                className={`${inputClass} mt-1`}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08030000000"
              />
            </label>

            {staff && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Job title
                  <input className={`${inputClass} mt-1`} value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} placeholder="e.g. Admissions Officer" />
                </label>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Staff number</div>
                    <div className="font-medium text-slate-800 mt-0.5">{staff.staff_number || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Office placement</div>
                    <div className="font-medium text-slate-800 mt-0.5">{staff.office_placement || '—'}</div>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-slate-100 pt-5 space-y-5">
              <div className="text-sm font-medium text-slate-700">Change password</div>
              <input
                type="password"
                className={inputClass}
                placeholder="New password (leave blank to keep current)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <input
                type="password"
                className={inputClass}
                placeholder="Confirm new password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                autoComplete="new-password"
              />
              {password && <PasswordHints password={password} email={user?.email} />}
            </div>

            <Btn type="submit" disabled={saving}>
              {saving ? <Spinner label="Saving…" /> : 'Save changes'}
            </Btn>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Roles" description="Roles assigned to your account.">
            <div className="flex flex-wrap gap-2">
              {auth?.roles?.length
                ? auth.roles.map((role) => <Badge key={role.id} variant="info">{role.name}</Badge>)
                : <span className="text-sm text-slate-500">No roles assigned</span>}
            </div>
          </Card>

          <Card title="Permissions by role" description="Capabilities granted through each role.">
            {!rolePermissions.length ? (
              <p className="text-sm text-slate-500">No permissions assigned.</p>
            ) : (
              <div className="space-y-5">
                {rolePermissions.map((group) => (
                  <div key={group.role.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="info">{group.role.name}</Badge>
                      <span className="text-xs text-slate-500">{group.permissions.length} permission{group.permissions.length === 1 ? '' : 's'}</span>
                    </div>
                    <DataTable empty={!group.permissions.length} emptyMessage="No permissions on this role." colSpan={3} tableClassName="min-w-[28rem] w-full">
                      <thead>
                        <tr>
                          <th className={thClass}>Module</th>
                          <th className={thClass}>Permission</th>
                          <th className={thClass}>Key</th>
                        </tr>
                      </thead>
                      {!group.permissions.length ? null : (
                        <tbody>
                          {group.permissions.map((permission) => (
                            <tr key={permission.key} className={trClass}>
                              <td className={`${tdClass} capitalize text-slate-500`}>{permission.module}</td>
                              <td className={`${tdClass} font-medium text-slate-800`}>{permission.label}</td>
                              <td className={tdClass}>
                                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{permission.key}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      )}
                    </DataTable>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
