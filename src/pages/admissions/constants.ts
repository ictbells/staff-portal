export type AdmissionsChannelKey = 'undergraduate' | 'jupeb' | 'postgraduate';

export type AdmissionsReferenceColumn = 'jamb' | 'application_number';

export type AdmissionsChannel = {
  key: AdmissionsChannelKey;
  navKey: string;
  path: string;
  label: string;
  title: string;
  description: string;
  entryModes: string[];
  showEntryMode: boolean;
  referenceColumn: AdmissionsReferenceColumn;
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
    referenceColumn: 'jamb',
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
    referenceColumn: 'application_number',
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
    referenceColumn: 'application_number',
  },
];

export function admissionsChannelByKey(key: string): AdmissionsChannel | undefined {
  return ADMISSIONS_CHANNELS.find((c) => c.key === key);
}

export type ClearanceChannel = AdmissionsChannel;

export const CLEARANCE_CHANNELS: ClearanceChannel[] = ADMISSIONS_CHANNELS.map((channel) => ({
  ...channel,
  navKey: `admissions-clearance-${channel.key}`,
  path: `/applications/clearance/${channel.key}`,
  title: `${channel.label} physical clearance`,
  description: `Clear ${channel.label} applicants who have paid acceptance and come for physical verification.`,
}));

export function clearanceChannelByKey(key: string): ClearanceChannel | undefined {
  return CLEARANCE_CHANNELS.find((channel) => channel.key === key);
}
