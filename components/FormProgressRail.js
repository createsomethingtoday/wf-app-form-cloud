import { useEffect, useState } from 'react';
import { AlertCircle, Check, Circle, CircleDot } from 'lucide-react';

const STATUS_META = {
  complete: {
    label: 'Complete',
    color: 'var(--colors--success, #15803d)',
    Icon: Check,
  },
  partial: {
    label: 'In progress',
    color: 'var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))',
    Icon: CircleDot,
  },
  empty: {
    label: 'Not started',
    color: 'var(--colors--text-secondary, var(--_color---neutral--gray-500, #7a7a7a))',
    Icon: Circle,
  },
  error: {
    label: 'Needs attention',
    color: 'var(--colors--danger, #dc2626)',
    Icon: AlertCircle,
  },
};

export default function FormProgressRail({ sections, progress }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observers = [];
    const onIntersect = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    };
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (!el) continue;
      const observer = new IntersectionObserver(onIntersect, {
        rootMargin: '-30% 0px -60% 0px',
      });
      observer.observe(el);
      observers.push(observer);
    }
    return () => observers.forEach((observer) => observer.disconnect());
  }, [sections]);

  const handleClick = (id) => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveId(id);
  };

  const percent = Math.max(0, Math.min(100, Math.round(progress ?? 0)));

  return (
    <div
      role="navigation"
      aria-label="Form sections"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        marginBottom: '1.5rem',
        padding: '0.875rem 1rem',
        background: 'var(--colors--background, rgba(255,255,255,0.92))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid var(--_color---neutral--gray-200, #e6e6e6)',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.625rem',
          gap: '1rem',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
          {percent === 100 ? 'Ready to submit' : `${percent}% complete`}
        </div>
        <div
          style={{
            flex: 1,
            height: '6px',
            borderRadius: '999px',
            background: 'var(--_color---neutral--gray-200, #e6e6e6)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              background:
                percent === 100
                  ? 'var(--colors--success, #15803d)'
                  : 'var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))',
              transition: 'width 200ms ease',
            }}
          />
        </div>
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
        }}
      >
        {sections.map((section) => {
          const meta = STATUS_META[section.status] || STATUS_META.empty;
          const Icon = meta.Icon;
          const isActive = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => handleClick(section.id)}
                aria-current={isActive ? 'location' : undefined}
                aria-label={`${section.label} — ${meta.label}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.625rem',
                  border: `1px solid ${isActive
                    ? 'var(--colors--primary-accent, var(--_color---primary--webflow-blue, #146ef5))'
                    : 'var(--_color---neutral--gray-300, #d0d0d0)'}`,
                  borderRadius: '999px',
                  background: isActive
                    ? 'color-mix(in srgb, var(--_color---primary--webflow-blue, #146ef5) 10%, transparent)'
                    : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} aria-hidden="true" style={{ color: meta.color }} />
                <span>{section.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
