import { describe, expect, it } from 'vitest';
import { appendSubmissionField } from './submissionFormData';

describe('appendSubmissionField', () => {
  it('serializes structured app scopes once as JSON', () => {
    const formData = new FormData();

    appendSubmissionField(formData, 'appScopes', [
      { id: 'assets', name: 'Assets', access: 'read-write' },
    ]);

    expect(formData.get('appScopes')).toBe(
      '[{"id":"assets","name":"Assets","access":"read-write"}]'
    );
  });

  it('skips duplicate file-backed fields that are uploaded under canonical keys later', () => {
    const formData = new FormData();

    appendSubmissionField(formData, 'appAvatarImage', 'avatar-placeholder');
    appendSubmissionField(formData, 'appScreenshots', ['shot-1', 'shot-2']);

    expect(formData.has('appAvatarImage')).toBe(false);
    expect(formData.has('appScreenshots')).toBe(false);
  });

  it('preserves regular array fields as repeated multipart entries', () => {
    const formData = new FormData();

    appendSubmissionField(formData, 'appCategory', ['AI', 'Analytics']);

    expect(formData.getAll('appCategory')).toEqual(['AI', 'Analytics']);
  });
});
