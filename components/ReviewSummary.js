import { Pencil } from 'lucide-react';

const FIELD_LABELS = {
  submissionType: 'Submission type',
  appName: 'App name',
  clientId: 'Client ID',
  appCapabilities: 'App capabilities',
  appInstallUrl: 'Install URL',
  appAvatarImage: 'App icon',
  appAvatarAltText: 'App icon alt text',
  paymentType: 'Payment type',
  visibility: 'Visibility',
  appCategory: 'Categories',
  creatorName: 'Creator name',
  creatorWfAccountEmail: 'Webflow account email',
  creatorContactEmail: 'Contact email',
  appPreviewDescription: 'Preview description',
  appDetailDescription: 'Long description',
  appFeaturesOverview: 'Features',
  appWebsiteUrl: 'Website URL',
  appScreenshots: 'Screenshots',
  appScreenshotAltTexts: 'Screenshot alt texts',
  appAccessCredentials: 'Access credentials',
  credentialsTierConfirmation: 'Access tier confirmation',
  appDemoVideoUrl: 'Demo video URL',
  appVideoUrl: 'Promo video URL',
  appPrivacyPolicyUrl: 'Privacy policy URL',
  appSupportEmail: 'Support email',
  appSupportUrl: 'Support URL',
  appTermsUrl: 'Terms & conditions URL',
  agreementAccepted: 'Agreement accepted',
};

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return { text: '—', dim: true };
  }
  if (typeof value === 'boolean') {
    return { text: value ? 'Yes' : 'No', dim: !value };
  }
  if (Array.isArray(value)) {
    const filled = value.filter((entry) => entry !== null && entry !== undefined && entry !== '');
    if (filled.length === 0) {
      return { text: '—', dim: true };
    }
    if (filled.every((entry) => entry && typeof entry === 'object' && 'name' in entry)) {
      return { text: `${filled.length} file${filled.length === 1 ? '' : 's'}`, dim: false };
    }
    if (filled.every((entry) => typeof entry === 'string')) {
      const joined = filled.join(', ');
      return joined.length > 120
        ? { text: `${joined.slice(0, 120)}…`, dim: false }
        : { text: joined, dim: false };
    }
    return { text: `${filled.length} item${filled.length === 1 ? '' : 's'}`, dim: false };
  }
  if (value && typeof value === 'object' && 'name' in value) {
    return { text: value.name, dim: false };
  }
  const str = String(value);
  if (str.length > 160) {
    return { text: `${str.slice(0, 160)}…`, dim: false };
  }
  return { text: str, dim: false };
}

function humanizeFieldName(key) {
  if (FIELD_LABELS[key]) {
    return FIELD_LABELS[key];
  }
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (ch) => ch.toUpperCase())
    .trim();
}

export default function ReviewSummary({ sections, formData, onEdit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {sections.map((section, sectionIndex) => {
        const visibleFields = section.fields.filter((field) => FIELD_LABELS[field] || field in formData);
        return (
          <div
            key={section.id}
            style={{
              border: '1px solid var(--_color---neutral--gray-300, #d0d0d0)',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{section.label}</h3>
              <button
                type="button"
                onClick={() => onEdit(sectionIndex)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  background: 'transparent',
                  color: 'var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))',
                  border: '1px solid var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            </div>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                gap: '0.375rem 1rem',
                margin: 0,
                fontSize: '0.875rem',
              }}
            >
              {visibleFields.map((field) => {
                const { text, dim } = formatValue(formData[field]);
                return (
                  <div key={field} style={{ display: 'contents' }}>
                    <dt
                      style={{
                        color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
                        fontWeight: 500,
                      }}
                    >
                      {humanizeFieldName(field)}
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        wordBreak: 'break-word',
                        color: dim
                          ? 'var(--colors--text-secondary, var(--_color---neutral--gray-500, #7a7a7a))'
                          : 'inherit',
                      }}
                    >
                      {text}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
