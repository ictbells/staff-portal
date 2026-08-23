export type RegistrationChannelKey = 'undergraduate' | 'jupeb' | 'postgraduate';

export type RegistrationChannel = {
  key: RegistrationChannelKey;
  navKey: string;
  path: string;
  label: string;
  title: string;
  description: string;
  entryModes: string[];
  showEntryMode: boolean;
};

export const REGISTRATION_CHANNELS: RegistrationChannel[] = [
  {
    key: 'undergraduate',
    navKey: 'registrations-undergraduate',
    path: '/registrations/undergraduate',
    label: 'Undergraduate',
    title: 'Undergraduate registrations',
    description: 'Students who completed admission and have paid tuition (UTME, Direct Entry, and Transfer).',
    entryModes: ['utme', 'de', 'transfer'],
    showEntryMode: true,
  },
  {
    key: 'jupeb',
    navKey: 'registrations-jupeb',
    path: '/registrations/jupeb',
    label: 'JUPEB',
    title: 'JUPEB registrations',
    description: 'JUPEB students who completed admission and have paid tuition.',
    entryModes: ['jupeb'],
    showEntryMode: false,
  },
  {
    key: 'postgraduate',
    navKey: 'registrations-postgraduate',
    path: '/registrations/postgraduate',
    label: 'Postgraduate',
    title: 'Postgraduate registrations',
    description: 'Postgraduate students who completed admission and have paid tuition.',
    entryModes: ['pg'],
    showEntryMode: false,
  },
];

export function registrationChannelByKey(key: string): RegistrationChannel | undefined {
  return REGISTRATION_CHANNELS.find((channel) => channel.key === key);
}
