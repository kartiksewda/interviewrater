export const APP_CONFIG = {
  name: 'InterviewIQ',
  tagline: 'Get brutally honest interview feedback in 3 minutes',
  prices: {
    singleReport: 99,
    monthly: 499,
  },
  roles: [
    { id: 'sde1', label: 'SDE-1', description: 'Software Development Engineer' },
    { id: 'bank_po', label: 'Bank PO', description: 'Bank Probationary Officer' },
    { id: 'mba_gdpi', label: 'MBA GD-PI', description: 'MBA Group Discussion & Personal Interview' },
  ] as const,
  maxRecordingSeconds: 180,
} as const;

export type RoleId = (typeof APP_CONFIG.roles)[number]['id'];
