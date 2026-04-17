export const DRAFT_STORAGE_KEY = 'wf-app-form-draft';
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DRAFT_DEBOUNCE_MS = 1000;
export const DRAFT_EXCLUDED_FIELDS = ['appAvatarImage', 'appScreenshots'];

export const VIEW_MODE_STORAGE_KEY = 'wf-app-form-view-mode';

export function serializableFormData(formData) {
  const copy = { ...formData };
  for (const field of DRAFT_EXCLUDED_FIELDS) {
    delete copy[field];
  }
  return copy;
}

export function formatDraftAge(savedAt) {
  const ageMs = Date.now() - savedAt;
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}
