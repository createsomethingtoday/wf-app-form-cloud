import { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith('image/'));
}

export default function FileUploadField({
  id,
  name,
  label,
  accept = '.bmp, .dng, .eps, .gif, .jpg, .jpeg, .png, .ps, .raw, .svg, .tga, .tif, .tiff',
  description,
  uploadedFile,
  onFileUpload,
  onFileRemove,
  fileInputRef,
  required = false,
  errorMessage = '',
  showAsterisk = false,
  className = ''
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const errorId = errorMessage ? `${id}-error` : undefined;

  useEffect(() => {
    if (uploadedFile && isImageFile(uploadedFile)) {
      const url = URL.createObjectURL(uploadedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl('');
    return undefined;
  }, [uploadedFile]);

  const handleButtonKeyDown = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setIsDragOver(false);
  };

  return (
    <div className={`input-group ${className}`}>
      <label htmlFor={id} className="input-label">
        {label} {showAsterisk && <span className="dyn-asterisk" style={{ display: 'none' }}>*</span>}
        <br />
      </label>
      {description && (
        <div data-wf--rich-text--alignment="left-align" className="rich-text-component paragraph-sm">
          <div className="rich-text w-richtext">
            <p><span dangerouslySetInnerHTML={{ __html: description }} /></p>
          </div>
        </div>
      )}

      {!uploadedFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '1.5rem',
            border: `2px dashed ${isDragOver
              ? 'var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))'
              : 'var(--_color---neutral--gray-300, #d0d0d0)'}`,
            borderRadius: '8px',
            background: isDragOver
              ? 'color-mix(in srgb, var(--_color---primary--webflow-blue, #146ef5) 8%, transparent)'
              : 'transparent',
            transition: 'background 120ms ease, border-color 120ms ease',
          }}
        >
          <Upload size={20} aria-hidden="true" />
          <div style={{ fontWeight: 600 }}>
            {isDragOver ? 'Drop to upload' : 'Drag and drop a file here'}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))' }}>
            or
          </div>
          <input
            className="w-file-upload-input"
            accept={accept}
            name={name}
            data-name={name}
            aria-hidden="true"
            type="file"
            id={id}
            tabIndex="-1"
            ref={fileInputRef}
            onChange={(e) => onFileUpload(e.target.files[0])}
            style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
            aria-required={required ? 'true' : undefined}
            aria-invalid={errorMessage ? 'true' : undefined}
            aria-describedby={errorId}
          />
          <label
            htmlFor={id}
            role="button"
            tabIndex="0"
            className="form-file_upload-button w-file-upload-label"
            onKeyDown={(event) => handleButtonKeyDown(event, () => fileInputRef?.current?.click())}
            style={{ margin: 0 }}
          >
            <div className="w-inline-block">Browse files</div>
          </label>
        </div>
      )}

      {uploadedFile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            border: '1px solid var(--_color---neutral--gray-300, #d0d0d0)',
            borderRadius: '8px',
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'cover',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                background: 'var(--_color---neutral--gray-100, #f2f2f2)',
                flexShrink: 0,
              }}
            >
              <Upload size={20} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {uploadedFile?.name || 'fileuploaded.jpg'}
            </div>
            {formatFileSize(uploadedFile?.size) && (
              <div style={{ fontSize: '0.875rem', color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))' }}>
                {formatFileSize(uploadedFile?.size)}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Remove file"
            onClick={onFileRemove}
            onKeyDown={(event) => handleButtonKeyDown(event, onFileRemove)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              border: 'none',
              background: 'transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div id={errorId} className="validation-error-message cc-error_text" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
