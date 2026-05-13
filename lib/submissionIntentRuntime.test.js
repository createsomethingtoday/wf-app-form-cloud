import { describe, expect, it, vi } from 'vitest';
import { handleRuntimeSubmissionIntent } from './submissionIntentRuntime';

const VALID_CLIENT_ID = '8cf601a088f929829bab1089a0ee83b563427e05dcba672c0a0580dceb6cf6d1';

describe('handleRuntimeSubmissionIntent', () => {
  it('stores submission details before the multipart upload starts', async () => {
    const database = {
      createSubmission: vi.fn(async (input) => ({
        id: '00000000-0000-4000-8000-000000000000',
        ...input,
      })),
    };

    const request = new Request('https://example.com/api/submission-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          submissionType: 'Update',
          appName: 'Unknown',
          clientId: VALID_CLIENT_ID,
          creatorContactEmail: 'creator@example.com',
        },
      }),
    });

    const response = await handleRuntimeSubmissionIntent(request, {}, database);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      submissionId: '00000000-0000-4000-8000-000000000000',
    });
    expect(database.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionType: 'Update',
        appName: 'Unknown',
        clientId: VALID_CLIENT_ID,
        creatorEmail: 'creator@example.com',
        status: 'processing',
      }),
      {},
    );
  });

  it('rejects invalid client IDs before creating an intent row', async () => {
    const database = {
      createSubmission: vi.fn(),
    };

    const request = new Request('https://example.com/api/submission-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          submissionType: 'Update',
          clientId: 'not-a-client-id',
        },
      }),
    });

    const response = await handleRuntimeSubmissionIntent(request, {}, database);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe('Invalid Client ID format');
    expect(database.createSubmission).not.toHaveBeenCalled();
  });

  it('requires a client ID before creating an intent row', async () => {
    const database = {
      createSubmission: vi.fn(),
    };

    const request = new Request('https://example.com/api/submission-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          submissionType: 'Update',
        },
      }),
    });

    const response = await handleRuntimeSubmissionIntent(request, {}, database);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe('Client ID is required');
    expect(database.createSubmission).not.toHaveBeenCalled();
  });
});
