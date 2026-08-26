export type TranscriptChannelKey = 'undergraduate' | 'jupeb' | 'postgraduate';

export type TranscriptChannel = {
  key: TranscriptChannelKey;
  navKey: string;
  path: string;
  publicPath: string;
  label: string;
  title: string;
  description: string;
  entryModes: string[];
};

export const TRANSCRIPT_CHANNELS: TranscriptChannel[] = [
  {
    key: 'undergraduate',
    navKey: 'transcript-undergraduate',
    path: '/transcript-requests/undergraduate',
    publicPath: '/transcript-request/undergraduate',
    label: 'Undergraduate',
    title: 'Undergraduate transcript requests',
    description: 'Paid official transcript requests for undergraduate programmes.',
    entryModes: ['utme', 'de', 'transfer'],
  },
  {
    key: 'jupeb',
    navKey: 'transcript-jupeb',
    path: '/transcript-requests/jupeb',
    publicPath: '/transcript-request/jupeb',
    label: 'JUPEB',
    title: 'JUPEB transcript requests',
    description: 'Paid official transcript requests for JUPEB programmes.',
    entryModes: ['jupeb'],
  },
  {
    key: 'postgraduate',
    navKey: 'transcript-postgraduate',
    path: '/transcript-requests/postgraduate',
    publicPath: '/transcript-request/postgraduate',
    label: 'Postgraduate',
    title: 'Postgraduate transcript requests',
    description: 'Paid official transcript requests for postgraduate programmes.',
    entryModes: ['pg'],
  },
];

export function transcriptChannelByKey(key: string): TranscriptChannel | undefined {
  return TRANSCRIPT_CHANNELS.find((channel) => channel.key === key);
}

export const TRANSCRIPT_TYPES = [
  { value: 'e_copy', label: 'E-copy', description: 'Signed PDF sent to an email address you provide.' },
  { value: 'within_nigeria', label: 'Within Nigeria', description: 'Hard copy posted to an address in Nigeria.' },
  { value: 'outside_nigeria', label: 'Outside Nigeria', description: 'Hard copy posted to an address outside Nigeria.' },
  { value: 'student_copy', label: 'Student copy', description: 'Collect at the Registry or give a postal address.' },
] as const;

export type TranscriptTypeValue = (typeof TRANSCRIPT_TYPES)[number]['value'];
