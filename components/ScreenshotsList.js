import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, TriangleAlert, Upload, X } from 'lucide-react';

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

function usePreviewUrl(file) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (file && typeof file === 'object' && typeof file.type === 'string' && file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setUrl('');
    return undefined;
  }, [file]);
  return url;
}

function ScreenshotCard({
  file,
  altText,
  index,
  total,
  onAltTextChange,
  onRemove,
  onMove,
  error,
}) {
  const previewUrl = usePreviewUrl(file);
  const altTextId = `screenshot-alt-text-${index}`;

  return (
    <li
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.75rem',
        border: '1px solid var(--_color---neutral--gray-300, #d0d0d0)',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          width: '96px',
          height: '64px',
          borderRadius: '4px',
          overflow: 'hidden',
          background: 'var(--_color---neutral--gray-100, #f2f2f2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Upload size={20} aria-hidden="true" />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div
          style={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Screenshot {index + 1}
          {file?.name && (
            <span
              style={{
                fontWeight: 400,
                marginLeft: '0.5rem',
                color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
                fontSize: '0.8125rem',
              }}
            >
              {file.name}{file.size ? ` · ${formatFileSize(file.size)}` : ''}
            </span>
          )}
        </div>
        <label htmlFor={altTextId} style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
          Alt text <span style={{ color: 'var(--colors--danger, #dc2626)' }}>*</span>
        </label>
        <input
          id={altTextId}
          className="input w-input"
          type="text"
          placeholder="Describe what this screenshot shows"
          maxLength={256}
          value={altText || ''}
          onChange={(event) => onAltTextChange(index, event.target.value)}
          style={{ margin: 0 }}
        />
        {error && (
          <div
            className="cc-error_text"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              color: 'var(--colors--danger, #dc2626)',
            }}
          >
            <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            {error}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <button
          type="button"
          aria-label={`Move screenshot ${index + 1} up`}
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          style={iconButtonStyle(index === 0)}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          aria-label={`Move screenshot ${index + 1} down`}
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          style={iconButtonStyle(index === total - 1)}
        >
          <ChevronDown size={16} />
        </button>
        <button
          type="button"
          aria-label={`Remove screenshot ${index + 1}`}
          onClick={() => onRemove(index)}
          style={iconButtonStyle(false)}
        >
          <X size={16} />
        </button>
      </div>
    </li>
  );
}

export default function ScreenshotsList({
  screenshots = [],
  altTexts = [],
  onScreenshotsChange,
  onAltTextsChange,
  onFileValidate,
  maxScreenshots = 5,
  accept = '.bmp, .dng, .eps, .gif, .jpg, .jpeg, .png, .ps, .raw, .svg, .tga, .tif, .tiff',
  errors = [],
  inputId = 'screenshots-add-input',
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const items = screenshots.filter((file) => file);
  const alts = items.map((_, index) => altTexts[index] || '');
  const atCapacity = items.length >= maxScreenshots;
  const remaining = Math.max(0, maxScreenshots - items.length);

  const handleFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) {
      return;
    }
    const accepted = [];
    for (const file of incoming) {
      if (items.length + accepted.length >= maxScreenshots) {
        break;
      }
      const nextIndex = items.length + accepted.length;
      const isValid = onFileValidate ? await onFileValidate(file, nextIndex) : true;
      if (!isValid) {
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) {
      return;
    }
    const nextFiles = [...items, ...accepted];
    const nextAlts = [...alts, ...accepted.map(() => '')];
    onScreenshotsChange(nextFiles);
    onAltTextsChange(nextAlts);
  };

  const handleInputChange = (event) => {
    handleFiles(event.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    handleFiles(event.dataTransfer?.files);
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

  const handleAltTextChange = (index, value) => {
    const nextAlts = alts.slice();
    nextAlts[index] = value;
    onAltTextsChange(nextAlts);
  };

  const handleRemove = (index) => {
    const nextFiles = items.slice();
    nextFiles.splice(index, 1);
    const nextAlts = alts.slice();
    nextAlts.splice(index, 1);
    onScreenshotsChange(nextFiles);
    onAltTextsChange(nextAlts);
  };

  const handleMove = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) {
      return;
    }
    const nextFiles = items.slice();
    [nextFiles[index], nextFiles[target]] = [nextFiles[target], nextFiles[index]];
    const nextAlts = alts.slice();
    [nextAlts[index], nextAlts[target]] = [nextAlts[target], nextAlts[index]];
    onScreenshotsChange(nextFiles);
    onAltTextsChange(nextAlts);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
        }}
      >
        <span>
          {items.length} of {maxScreenshots} screenshots
          {items.length > 0 && items.length < 4 && ' — 4 required'}
          {items.length === 0 && ' — 4 required'}
        </span>
      </div>

      {items.length > 0 && (
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 0.75rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {items.map((file, index) => (
            <ScreenshotCard
              key={`${file.name || 'file'}-${index}`}
              file={file}
              altText={alts[index]}
              index={index}
              total={items.length}
              onAltTextChange={handleAltTextChange}
              onRemove={handleRemove}
              onMove={handleMove}
              error={errors[index] || ''}
            />
          ))}
        </ol>
      )}

      {atCapacity ? (
        <div
          style={{
            fontSize: '0.875rem',
            color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
            padding: '0.625rem 0.75rem',
            border: '1px dashed var(--_color---neutral--gray-300, #d0d0d0)',
            borderRadius: '6px',
          }}
        >
          Maximum of {maxScreenshots} screenshots reached. Remove one to add another.
        </div>
      ) : (
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
            {isDragOver
              ? 'Drop to add screenshots'
              : `Drag and drop ${remaining === maxScreenshots ? 'up to ' + maxScreenshots + ' screenshots' : remaining + ' more'}`}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))' }}>
            or
          </div>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={accept}
            multiple
            onChange={handleInputChange}
            style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
          />
          <label
            htmlFor={inputId}
            role="button"
            tabIndex={0}
            className="form-file_upload-button w-file-upload-label"
            style={{ margin: 0 }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="w-inline-block">Browse files</div>
          </label>
        </div>
      )}
    </div>
  );
}

function iconButtonStyle(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.75rem',
    height: '1.75rem',
    border: 'none',
    background: 'transparent',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
    opacity: disabled ? 0.3 : 1,
  };
}
