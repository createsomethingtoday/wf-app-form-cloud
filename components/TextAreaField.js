export default function TextAreaField({
  id,
  name,
  label,
  value,
  onChange,
  required = false,
  maxLength,
  placeholder = '',
  description,
  helpText,
  errorMessage = '',
  showAsterisk = false,
  showCharacterCount = false,
  className = '',
  textAreaClassName = 'input cc-text-area w-input',
  style = {}
}) {
  const helpTextId = helpText ? `${id}-help` : undefined;
  const errorId = errorMessage ? `${id}-error` : undefined;
  const currentLength = typeof value === 'string' ? value.length : 0;
  const shouldShowCount = typeof maxLength === 'number' && (showCharacterCount || currentLength > 0);
  const characterCountId = shouldShowCount ? `${id}-count` : undefined;
  const atLimit = shouldShowCount && currentLength >= maxLength;
  const nearLimit = shouldShowCount && currentLength >= maxLength * 0.9 && !atLimit;
  const describedBy = [helpTextId, characterCountId, errorId].filter(Boolean).join(' ') || undefined;

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
      <textarea
        id={id}
        name={name}
        maxLength={maxLength}
        data-name={name}
        placeholder={placeholder}
        required={required}
        className={textAreaClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={errorMessage ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required ? 'true' : undefined}
      />
      {helpText && (
        <div id={helpTextId} className="cc-help-text">
          {helpText}
        </div>
      )}
      {shouldShowCount && (
        <div
          id={characterCountId}
          className="cc-character-count"
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
      {errorMessage && (
        <div id={errorId} className="validation-error-message cc-error_text" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
