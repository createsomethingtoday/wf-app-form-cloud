import { useState } from 'react';
import { Check, TriangleAlert } from 'lucide-react';

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[\w-]+\.[\w.-]+/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function validateUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  let candidate;
  try {
    candidate = new URL(trimmed);
  } catch {
    return 'Enter a valid URL (e.g. https://example.com).';
  }

  if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
    return 'URL must start with http:// or https://.';
  }

  if (!candidate.hostname.includes('.')) {
    return 'URL must include a domain (e.g. example.com).';
  }

  return '';
}

export default function FormField({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  required = false,
  maxLength,
  placeholder = '',
  description,
  helpText,
  errorMessage = '',
  autoComplete,
  showAsterisk = false,
  className = '',
  inputClassName = 'input w-input',
  style = {}
}) {
  const [urlError, setUrlError] = useState('');
  const isUrl = type === 'url';

  const handleBlur = (event) => {
    if (isUrl) {
      const normalized = normalizeUrl(event.target.value);
      if (normalized !== event.target.value) {
        onChange(normalized);
        setUrlError(validateUrl(normalized));
      } else {
        setUrlError(validateUrl(event.target.value));
      }
    }
    if (onBlur) {
      onBlur(event);
    }
  };

  const handleChange = (event) => {
    if (isUrl && urlError) {
      setUrlError('');
    }
    onChange(event.target.value);
  };

  const showValidSignal = isUrl && !errorMessage && !urlError && value && value.trim().length > 0 && !validateUrl(value);
  const activeErrorMessage = errorMessage || urlError;
  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = activeErrorMessage ? `${id}-error` : undefined;
  const currentLength = typeof value === 'string' ? value.length : 0;
  const showCounter = typeof maxLength === 'number' && currentLength > 0;
  const counterId = showCounter ? `${id}-count` : undefined;
  const atLimit = showCounter && currentLength >= maxLength;
  const nearLimit = showCounter && currentLength >= maxLength * 0.9 && !atLimit;
  const describedBy = [helpTextId, counterId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`input-group ${className}`} style={style}>
      <label htmlFor={id} className="input-label">
        {label}
        {showAsterisk && <span className="dyn-asterisk">*</span>}
        <br />
      </label>
      {description && (
        <div data-wf--rich-text--alignment="left-align" className="rich-text-component paragraph-sm">
          <div className="rich-text w-richtext">
            <p><span dangerouslySetInnerHTML={{ __html: description }} /></p>
          </div>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          className={inputClassName}
          maxLength={maxLength}
          name={name}
          data-name={name}
          placeholder={placeholder}
          type={type}
          id={id}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={activeErrorMessage ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required ? 'true' : undefined}
          style={isUrl ? { paddingRight: '2.25rem' } : undefined}
        />
        {isUrl && (showValidSignal || activeErrorMessage) && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              color: showValidSignal
                ? 'var(--colors--success, #15803d)'
                : 'var(--colors--danger, #dc2626)',
            }}
          >
            {showValidSignal ? <Check size={16} /> : <TriangleAlert size={16} />}
          </span>
        )}
      </div>
      {helpText && (
        <div id={helpTextId} className="cc-help-text">
          {helpText}
        </div>
      )}
      {showCounter && (
        <div
          id={counterId}
          style={{
            marginTop: '0.25rem',
            fontSize: '0.75rem',
            textAlign: 'right',
            color: atLimit
              ? 'var(--colors--danger, #dc2626)'
              : nearLimit
                ? 'var(--colors--warning, #b45309)'
                : 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
          }}
        >
          {currentLength} / {maxLength}
        </div>
      )}
      {activeErrorMessage && (
        <div id={errorId} className="validation-error-message cc-error_text" role="alert">
          {activeErrorMessage}
        </div>
      )}
    </div>
  );
}
