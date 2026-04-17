import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

export default function FeaturesList({
  features = [],
  onChange,
  maxFeatures = 5,
  maxLength = 200,
  inputId = 'feature-input',
  placeholder = 'Add a feature',
}) {
  const [draft, setDraft] = useState('');
  const items = features.filter((value) => value !== null && value !== undefined);
  const atCapacity = items.length >= maxFeatures;
  const remaining = Math.max(0, maxFeatures - items.length);

  const addFeature = () => {
    const trimmed = draft.trim();
    if (!trimmed || atCapacity) {
      return;
    }
    onChange([...items, trimmed]);
    setDraft('');
  };

  const removeFeature = (index) => {
    const next = items.slice();
    next.splice(index, 1);
    onChange(next);
  };

  const moveFeature = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) {
      return;
    }
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addFeature();
    } else if (event.key === 'Escape') {
      setDraft('');
    }
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
          {items.length} of {maxFeatures} features
          {items.length > 0 && remaining > 0 && ` — add ${remaining} more or submit`}
          {items.length === 0 && ' — at least one required'}
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
          {items.map((value, index) => (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--_color---neutral--gray-300, #d0d0d0)',
                borderRadius: '6px',
                background: 'var(--colors--background-secondary, transparent)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '1.5rem',
                  textAlign: 'right',
                  color: 'var(--colors--text-secondary, var(--_color---neutral--gray-600, #5a5a5a))',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {index + 1}.
              </span>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{value}</span>
              <button
                type="button"
                aria-label={`Move feature ${index + 1} up`}
                onClick={() => moveFeature(index, -1)}
                disabled={index === 0}
                style={iconButtonStyle(index === 0)}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                aria-label={`Move feature ${index + 1} down`}
                onClick={() => moveFeature(index, 1)}
                disabled={index === items.length - 1}
                style={iconButtonStyle(index === items.length - 1)}
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                aria-label={`Remove feature ${index + 1}`}
                onClick={() => removeFeature(index)}
                style={iconButtonStyle(false)}
              >
                <X size={16} />
              </button>
            </li>
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
          Maximum of {maxFeatures} features reached. Remove one to add another.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
          <input
            id={inputId}
            type="text"
            className="input w-input"
            placeholder={placeholder}
            maxLength={maxLength}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, margin: 0 }}
          />
          <button
            type="button"
            onClick={addFeature}
            disabled={!draft.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0 1rem',
              background: 'var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: draft.trim() ? 'pointer' : 'not-allowed',
              opacity: draft.trim() ? 1 : 0.5,
            }}
          >
            <Plus size={16} />
            Add
          </button>
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
