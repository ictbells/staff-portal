import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  Hash,
  IdCard,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth';
import {
  Badge,
  Btn,
  Card,
  fieldHelpClass,
  fieldLabelClass,
  formStackClass,
  inputClass,
  Spinner,
  StatCard,
} from '../components/ui';
import { PasswordHints } from './Reset';

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function groupByModule(permissions: { key: string; label: string; module: string }[]) {
  const map = new Map<string, typeof permissions>();
  for (const permission of permissions) {
    const list = map.get(permission.module) ?? [];
    list.push(permission);
    map.set(permission.module, list);
  }
  return Array.from(map.entries());
}

function Field({
  label,
  icon: Icon,
  hint,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      {Icon ? (
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          {children}
        </div>
      ) : (
        children
      )}
      {hint ? <p className={fieldHelpClass}>{hint}</p> : null}
    </label>
  );
}

export default function Profile() {
  const { auth, setAuth } = useAuth();
  const user = auth?.user;
  const staff = user?.staff;
  const rolePermissions = auth?.role_permissions ?? [];
  const security = auth?.security;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [staffTitle, setStaffTitle] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setStaffTitle(staff?.title || '');
  }, [user?.name, user?.phone, staff?.title]);

  const displayName = name || user?.name || 'Staff member';
  const permissionCount = useMemo(
    () => rolePermissions.reduce((sum, group) => sum + group.permissions.length, 0),
    [rolePermissions],
  );
  const passwordMismatch = Boolean(password && passwordConfirmation && password !== passwordConfirmation);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (password && !currentPassword) {
      message.error('Enter your current password to set a new one.');
      return;
    }

    if (password && password !== passwordConfirmation) {
      message.error('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        phone: phone.trim(),
      };
      if (staff) payload.staff_title = staffTitle.trim();
      if (password) {
        payload.current_password = currentPassword;
        payload.password = password;
        payload.password_confirmation = passwordConfirmation;
      }

      const { data } = await api.patch('/api/me', payload);
      setAuth(data);
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      setShowPassword(false);
      message.success('Profile updated.');
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      if (errors) {
        message.error(Object.values(errors).flat().join(' '));
      } else {
        message.error(err.response?.data?.message || 'Unable to update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-sky-600 via-sky-700 to-sky-800 px-5 py-6 text-white sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(186,230,253,0.22),transparent_46%)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold tracking-wide text-white ring-4 ring-white/15">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-100/90">My profile</p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{displayName}</h1>
              <p className="mt-1 truncate text-sm text-slate-200">
                {staffTitle || staff?.title || auth?.roles?.[0]?.name || 'Staff account'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-sky-50/95">
                {user?.email ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{user.email}</span>
                  </span>
                ) : null}
                {phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    {phone}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {staff?.staff_number ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium ring-1 ring-white/15">
                    <Hash className="h-3.5 w-3.5" aria-hidden />
                    {staff.staff_number}
                  </span>
                ) : null}
                {staff?.office_placement ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium ring-1 ring-white/15">
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    {staff.office_placement}
                  </span>
                ) : null}
                {auth?.roles?.length
                  ? auth.roles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-white/15"
                      >
                        <Shield className="h-3.5 w-3.5" aria-hidden />
                        {role.name}
                      </span>
                    ))
                  : (
                    <span className="text-xs text-sky-100/80">No roles assigned</span>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Roles" value={auth?.roles?.length ?? 0} hint="Assigned to this account" icon={Shield} />
        <StatCard label="Permissions" value={permissionCount} hint="Granted through your roles" icon={KeyRound} />
        <StatCard
          label="Staff number"
          value={staff?.staff_number || '—'}
          hint={staff?.office_placement || 'No office placement'}
          icon={IdCard}
          tone="amber"
        />
        <StatCard
          label="Two-factor"
          value={security?.two_factor_configured ? 'On' : 'Off'}
          hint={
            security?.two_factor_policy_enabled
              ? security.two_factor_configured
                ? 'Configured for this account'
                : 'Required by organisation policy'
              : 'Optional for this organisation'
          }
          icon={ShieldCheck}
          tone={security?.two_factor_configured ? 'emerald' : 'sky'}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="space-y-6 lg:col-span-3">
          <Card title="Personal details" description="These details appear on your staff account.">
            <div className={formStackClass}>
              <Field label="Full name" icon={UserRound}>
                <input
                  className={`${inputClass} pl-10`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>

              <Field label="Email" icon={Mail} hint="Contact ICT to change your work email.">
                <input
                  className={`${inputClass} cursor-not-allowed bg-slate-50 pl-10 text-slate-500`}
                  value={user?.email || ''}
                  readOnly
                />
              </Field>

              <Field label="Phone" icon={Phone}>
                <input
                  className={`${inputClass} pl-10`}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 08030000000"
                />
              </Field>

              {staff && (
                <>
                  <Field label="Job title" icon={Briefcase}>
                    <input
                      className={`${inputClass} pl-10`}
                      value={staffTitle}
                      onChange={(e) => setStaffTitle(e.target.value)}
                      placeholder="e.g. Admissions Officer"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <IdCard className="h-3.5 w-3.5" aria-hidden />
                        Staff number
                      </div>
                      <div className="mt-1.5 font-medium text-slate-800">{staff.staff_number || '—'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <Building2 className="h-3.5 w-3.5" aria-hidden />
                        Office placement
                      </div>
                      <div className="mt-1.5 font-medium text-slate-800">{staff.office_placement || '—'}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card title="Password" description="Leave blank to keep your current password.">
            <div className={formStackClass}>
              <label className="block">
                <span className={fieldLabelClass}>Current password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass} pl-10`}
                    placeholder="Required to set a new password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </label>

              <label className="block">
                <span className={fieldLabelClass}>New password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass} px-10`}
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className={fieldLabelClass}>Confirm new password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass} pl-10 ${passwordMismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
                    placeholder="Confirm new password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {passwordMismatch ? (
                  <p className="mt-1.5 text-xs text-red-600">Passwords do not match.</p>
                ) : null}
              </label>

              {password ? <PasswordHints password={password} email={user?.email} /> : null}

              {security?.password_rotation_days ? (
                <p className={fieldHelpClass}>
                  Organisation policy requires a password update every {security.password_rotation_days} days.
                </p>
              ) : null}
            </div>
          </Card>

          <div className="flex justify-end">
            <Btn type="submit" disabled={saving} className="min-w-36 gap-2 px-4 py-2.5">
              {saving ? <Spinner label="Saving…" /> : (
                <>
                  <Save className="h-4 w-4" aria-hidden />
                  Save changes
                </>
              )}
            </Btn>
          </div>
        </form>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Roles" description="Roles assigned to your account.">
            {auth?.roles?.length ? (
              <div className="space-y-2">
                {auth.roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                      <Shield className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium capitalize text-slate-800">{role.name}</div>
                      <div className="truncate text-xs text-slate-500">{role.slug}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No roles assigned</p>
            )}
          </Card>

          <Card title="Permissions" description="Capabilities granted through each role.">
            {!rolePermissions.length ? (
              <p className="text-sm text-slate-500">No permissions assigned.</p>
            ) : (
              <div className="space-y-5">
                {rolePermissions.map((group) => {
                  const modules = groupByModule(group.permissions);
                  return (
                    <div key={group.role.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge variant="info">{group.role.name}</Badge>
                        <span className="text-xs text-slate-500">
                          {group.permissions.length} permission{group.permissions.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {!group.permissions.length ? (
                        <p className="text-sm text-slate-500">No permissions on this role.</p>
                      ) : (
                        <div className="space-y-3">
                          {modules.map(([module, permissions]) => (
                            <div key={module}>
                              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {module}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {permissions.map((permission) => (
                                  <span
                                    key={permission.key}
                                    title={permission.key}
                                    className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                  >
                                    {permission.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
