export const FORM_SECTIONS = [
  {
    id: 'app-info',
    label: 'App info',
    fields: [
      'submissionType',
      'appName',
      'clientId',
      'appCapabilities',
      'appInstallUrl',
      'appAvatarImage',
      'appAvatarAltText',
      'paymentType',
      'visibility',
    ],
  },
  {
    id: 'creator-info',
    label: 'Creator info',
    fields: ['creatorName', 'creatorWfAccountEmail', 'creatorContactEmail'],
  },
  {
    id: 'app-details',
    label: 'App details',
    fields: [
      'appCategory',
      'appPreviewDescription',
      'appDetailDescription',
      'appFeaturesOverview',
      'appWebsiteUrl',
    ],
  },
  {
    id: 'app-credentials-info',
    label: 'Credentials',
    fields: ['appAccessCredentials', 'credentialsTierConfirmation'],
  },
  {
    id: 'support-info',
    label: 'Support info',
    fields: [
      'appDemoVideoUrl',
      'appPrivacyPolicyUrl',
      'appSupportEmail',
      'appSupportUrl',
      'appTermsUrl',
    ],
  },
  {
    id: 'acknowledgements',
    label: 'Agreement',
    fields: ['agreementAccepted'],
  },
  {
    id: 'review-submission',
    label: 'Review',
    fields: [],
  },
];

export const REVIEW_SECTIONS = FORM_SECTIONS.filter(
  (section) => section.id !== 'review-submission'
);

export const WIZARD_STEP_COUNT = FORM_SECTIONS.length;

export function hasMeaningfulFormValue(value) {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasMeaningfulFormValue(entry));
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((entry) => hasMeaningfulFormValue(entry));
  }
  return false;
}

export function computeSectionStatus({ fields, formData, isFieldRequired, hasError }) {
  if (hasError) {
    return 'error';
  }
  const required = fields.filter((field) => isFieldRequired(field));
  if (required.length === 0) {
    return 'complete';
  }
  const filled = required.filter((field) => hasMeaningfulFormValue(formData[field]));
  if (filled.length === required.length) {
    return 'complete';
  }
  if (filled.length > 0) {
    return 'partial';
  }
  return 'empty';
}
