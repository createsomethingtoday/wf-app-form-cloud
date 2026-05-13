import { describe, expect, it, vi } from 'vitest';
import { resolveSubmissionRecord, validateScreenshotAltTexts } from './submitFormRuntime';

const VALID_CLIENT_ID = '8cf601a088f929829bab1089a0ee83b563427e05dcba672c0a0580dceb6cf6d1';

describe('validateScreenshotAltTexts', () => {
  it('allows submissions with no uploaded screenshots', () => {
    expect(validateScreenshotAltTexts({}, {})).toBeNull();
  });

  it('allows every uploaded screenshot with alt text', () => {
    const response = validateScreenshotAltTexts(
      {
        screenshotAltText0: 'Dashboard overview',
        screenshotAltText1: 'Settings screen',
      },
      {
        screenshots: [
          { name: 'dashboard.png' },
          { name: 'settings.png' },
        ],
      }
    );

    expect(response).toBeNull();
  });

  it('rejects uploaded screenshots without alt text', async () => {
    const response = validateScreenshotAltTexts(
      {
        screenshotAltText0: 'Dashboard overview',
        screenshotAltText1: '',
      },
      {
        screenshots: [
          { name: 'dashboard.png' },
          { name: 'icon.png' },
        ],
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Screenshot alt text required',
      details: [{ index: 2, filename: 'icon.png' }],
    });
  });
});

describe('resolveSubmissionRecord', () => {
  it('reuses a saved submission intent for the final multipart submit', async () => {
    const submissionIntentId = '00000000-0000-4000-8000-000000000000';
    const fields = {
      submissionIntentId,
      submissionType: 'Update',
      appName: 'Unknown',
      clientId: VALID_CLIENT_ID,
      creatorContactEmail: 'creator@example.com',
    };

    const database = {
      getSubmission: vi.fn(async () => ({
        id: submissionIntentId,
        submission_type: 'Update',
        app_name: 'Unknown',
        client_id: VALID_CLIENT_ID,
        status: 'processing',
      })),
      updateSubmission: vi.fn(async (id, updates) => ({
        id,
        ...updates,
      })),
      findRecentDuplicate: vi.fn(),
      createSubmission: vi.fn(),
    };

    const result = await resolveSubmissionRecord(fields, {}, database);

    expect(result.response).toBeUndefined();
    expect(result.submissionRecord.id).toBe(submissionIntentId);
    expect(database.updateSubmission).toHaveBeenCalledWith(
      submissionIntentId,
      expect.objectContaining({
        submissionType: 'Update',
        appName: 'Unknown',
        clientId: VALID_CLIENT_ID,
        creatorEmail: 'creator@example.com',
        formData: fields,
        status: 'processing',
      }),
      {},
    );
    expect(database.findRecentDuplicate).not.toHaveBeenCalled();
    expect(database.createSubmission).not.toHaveBeenCalled();
  });

  it('rejects a submission intent that belongs to a different client ID', async () => {
    const fields = {
      submissionIntentId: '00000000-0000-4000-8000-000000000000',
      submissionType: 'Update',
      clientId: VALID_CLIENT_ID,
    };

    const database = {
      getSubmission: vi.fn(async () => ({
        id: fields.submissionIntentId,
        submission_type: 'Update',
        client_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'processing',
      })),
      updateSubmission: vi.fn(),
      findRecentDuplicate: vi.fn(),
      createSubmission: vi.fn(),
    };

    const result = await resolveSubmissionRecord(fields, {}, database);
    const body = await result.response.json();

    expect(result.response.status).toBe(409);
    expect(body.message).toBe('Submission reference mismatch');
    expect(database.updateSubmission).not.toHaveBeenCalled();
    expect(database.createSubmission).not.toHaveBeenCalled();
  });
});
