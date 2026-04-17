import { describe, expect, it } from 'vitest';
import {
  buildSubmissionWebhookData,
  createAirtableSubmissionId,
  getFieldValue,
} from './submissionPayload';

describe('getFieldValue', () => {
  it('returns the first element of an array', () => {
    expect(getFieldValue(['first', 'second'])).toBe('first');
  });

  it('returns undefined when the array is empty', () => {
    expect(getFieldValue([])).toBeUndefined();
  });

  it('returns scalar values as-is', () => {
    expect(getFieldValue('x')).toBe('x');
    expect(getFieldValue(0)).toBe(0);
    expect(getFieldValue(false)).toBe(false);
  });

  it('returns undefined or null unchanged', () => {
    expect(getFieldValue(undefined)).toBeUndefined();
    expect(getFieldValue(null)).toBeNull();
  });
});

describe('createAirtableSubmissionId', () => {
  it('returns an existing id unchanged', () => {
    expect(createAirtableSubmissionId('recABCDEFG')).toBe('recABCDEFG');
  });

  it('generates a fresh id with the expected prefix when none is given', () => {
    const id = createAirtableSubmissionId();
    expect(id).toMatch(/^68dbffcba545b75803b43a99.+/);
    expect(id.length).toBeGreaterThan('68dbffcba545b75803b43a99'.length);
  });

  it('produces distinct ids on repeated calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => createAirtableSubmissionId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('buildSubmissionWebhookData — New submissions', () => {
  const baseFields = {
    submissionType: 'New',
    appName: 'Example App',
    clientId: 'a'.repeat(64),
    paymentType: ['Free'],
    visibility: ['Public'],
    appCategory: ['AI', 'Marketing'],
    creatorName: 'Jane Doe',
    appDetailDescription: '<p>Hello</p>',
    agreementAccepted: 'true',
  };

  it('wraps the data under payload and surfaces form metadata', () => {
    const { webhookData } = buildSubmissionWebhookData({
      fields: baseFields,
      submissionId: 'local-123',
    });
    expect(webhookData.payload.name).toBe('Marketplace App Submission');
    expect(webhookData.payload.siteId).toBeTruthy();
    expect(webhookData.payload.data.dbSubmissionId).toBe('local-123');
    expect(webhookData.payload.data.formId).toBeTruthy();
    expect(webhookData.payload.data.pageUrl).toBe('https://developers.webflow.com/submit');
  });

  it('emits a new airtableSubmissionId when none is provided', () => {
    const { airtableSubmissionId, webhookData } = buildSubmissionWebhookData({ fields: baseFields });
    expect(airtableSubmissionId).toBeTruthy();
    expect(webhookData.payload.data.id).toBe(airtableSubmissionId);
  });

  it('reuses an existing airtableSubmissionId when provided', () => {
    const { airtableSubmissionId, webhookData } = buildSubmissionWebhookData({
      fields: baseFields,
      airtableSubmissionId: 'recABC',
    });
    expect(airtableSubmissionId).toBe('recABC');
    expect(webhookData.payload.data.id).toBe('recABC');
  });

  it('maps payment checkboxes and label from the selected payment types', () => {
    const { webhookData } = buildSubmissionWebhookData({
      fields: { ...baseFields, paymentType: ['Free', 'Paid'] },
    });
    const d = webhookData.payload.data;
    expect(d['Checkbox Free']).toBe(true);
    expect(d['Checkbox Paid']).toBe(true);
    expect(d['Selected Payment Type']).toBe('Free, Paid');
    expect(d['Is Payment type set?']).toBe(true);
  });

  it('maps visibility into Public/Private checkboxes', () => {
    const { webhookData } = buildSubmissionWebhookData({
      fields: { ...baseFields, visibility: ['Private'] },
    });
    const d = webhookData.payload.data;
    expect(d['Checkbox Public']).toBe(false);
    expect(d['Checkbox Private']).toBe(true);
    expect(d['Selected Visibility Type']).toBe('Private');
  });

  it('joins multiple categories with a comma', () => {
    const { webhookData } = buildSubmissionWebhookData({
      fields: { ...baseFields, appCategory: ['AI', 'Marketing', 'SEO'] },
    });
    expect(webhookData.payload.data['App Category']).toBe('AI, Marketing, SEO');
  });

  it('places blobUrls at the documented positions (avatar + 5 screenshots)', () => {
    const { webhookData } = buildSubmissionWebhookData({
      fields: baseFields,
      blobUrls: ['avatar.png', 'ss1.png', 'ss2.png'],
    });
    const d = webhookData.payload.data;
    expect(d['App Avatar Image']).toBe('avatar.png');
    expect(d['App Screenshot 1']).toBe('ss1.png');
    expect(d['App Screenshot 2']).toBe('ss2.png');
    expect(d['App Screenshot 3']).toBe('');
    expect(d['App Screenshot 4']).toBe('');
    expect(d['App Screenshot 5']).toBe('');
  });

  it('preserves the Long-Description field as-is (HTML strings round-trip)', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const { webhookData } = buildSubmissionWebhookData({
      fields: { ...baseFields, appDetailDescription: html },
    });
    expect(webhookData.payload.data['Long-Description']).toBe(html);
  });

  it('sets retryAttempt and automaticRetry flags only when supplied', () => {
    const regular = buildSubmissionWebhookData({ fields: baseFields });
    expect(regular.webhookData.payload.data.retryAttempt).toBeUndefined();
    expect(regular.webhookData.payload.data.automaticRetry).toBeUndefined();

    const retried = buildSubmissionWebhookData({
      fields: baseFields,
      retryAttempt: 2,
      automaticRetry: true,
    });
    expect(retried.webhookData.payload.data.retryAttempt).toBe(2);
    expect(retried.webhookData.payload.data.automaticRetry).toBe(true);
  });
});

describe('buildSubmissionWebhookData — Update submissions', () => {
  it('omits fields that were not supplied, rather than defaulting them to empty', () => {
    const { webhookData } = buildSubmissionWebhookData({
      fields: {
        submissionType: 'Update',
        clientId: 'a'.repeat(64),
        appName: 'Renamed App',
      },
    });
    const d = webhookData.payload.data;
    expect(d['Submission Type']).toBe('Update');
    expect(d['App Name']).toBe('Renamed App');
    // Fields the user didn't touch should be absent from the payload entirely.
    expect('Creator Name' in d).toBe(false);
    expect('Long-Description' in d).toBe(false);
    expect('Website URL' in d).toBe(false);
  });

  it('surfaces the "Name updates" notice only for Update submissions', () => {
    const { webhookData: newSubmission } = buildSubmissionWebhookData({
      fields: { submissionType: 'New', appName: 'X' },
    });
    expect(newSubmission.payload.data['Field 3']).toBe('');

    const { webhookData: update } = buildSubmissionWebhookData({
      fields: { submissionType: 'Update', appName: 'X' },
    });
    expect(update.payload.data['Field 3']).toBe('Name updates must be requested via Support');
  });
});
