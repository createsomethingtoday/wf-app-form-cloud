const DIRECT_UPLOAD_FIELD_NAMES = new Set(['appAvatarImage', 'appScreenshots']);

export function appendSubmissionField(formData, key, value) {
  // File inputs are uploaded later under their canonical multipart keys
  // (`avatar` and `screenshots`). Appending them here as well duplicates
  // the blobs and corrupts the Airtable field ordering.
  if (DIRECT_UPLOAD_FIELD_NAMES.has(key)) {
    return;
  }

  if (key === 'appScopes') {
    formData.append(key, JSON.stringify(value || []));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      formData.append(key, item);
    });
    return;
  }

  if (value !== null && value !== undefined) {
    formData.append(key, value);
  }
}
