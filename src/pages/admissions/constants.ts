export type AdmissionsChannelKey = 'undergraduate' | 'jupeb' | 'postgraduate';

export type AdmissionsChannel = {
  key: AdmissionsChannelKey;
  navKey: string;
  path: string;
  label: string;
  title: string;
  description: string;
  entryModes: string[];
  showEntryMode: boolean;
};

export const ADMISSIONS_CHANNELS: AdmissionsChannel[] = [
  {
    key: 'undergraduate',
    navKey: 'admissions-undergraduate',
    path: '/applications/undergraduate',
    label: 'Undergraduate',
    title: 'Undergraduate applications',
    description: 'Review and process UTME, Direct Entry, and Transfer applications.',
    entryModes: ['utme', 'de', 'transfer'],
    showEntryMode: true,
  },
  {
    key: 'jupeb',
    navKey: 'admissions-jupeb',
    path: '/applications/jupeb',
    label: 'JUPEB',
    title: 'JUPEB applications',
    description: 'Review and process JUPEB foundation programme applications.',
    entryModes: ['jupeb'],
    showEntryMode: false,
  },
  {
    key: 'postgraduate',
    navKey: 'admissions-postgraduate',
    path: '/applications/postgraduate',
    label: 'Postgraduate',
    title: 'Postgraduate applications',
    description: 'Review and process postgraduate programme applications.',
    entryModes: ['pg'],
    showEntryMode: false,
  },
];

export function admissionsChannelByKey(key: string): AdmissionsChannel | undefined {
  return ADMISSIONS_CHANNELS.find((c) => c.key === key);
}
