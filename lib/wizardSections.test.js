import { describe, expect, it } from 'vitest';
import {
  FORM_SECTIONS,
  REVIEW_SECTIONS,
  WIZARD_STEP_COUNT,
  computeSectionStatus,
  hasMeaningfulFormValue,
} from './wizardSections';

describe('hasMeaningfulFormValue', () => {
  it('treats empty strings as meaningless', () => {
    expect(hasMeaningfulFormValue('')).toBe(false);
    expect(hasMeaningfulFormValue('   ')).toBe(false);
  });

  it('treats non-empty strings as meaningful', () => {
    expect(hasMeaningfulFormValue('hello')).toBe(true);
  });

  it('treats empty arrays as meaningless', () => {
    expect(hasMeaningfulFormValue([])).toBe(false);
  });

  it('treats arrays with any meaningful entry as meaningful', () => {
    expect(hasMeaningfulFormValue(['', 'hi'])).toBe(true);
    expect(hasMeaningfulFormValue(['', ''])).toBe(false);
  });

  it('treats true as meaningful and false as meaningless', () => {
    expect(hasMeaningfulFormValue(true)).toBe(true);
    expect(hasMeaningfulFormValue(false)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(hasMeaningfulFormValue(null)).toBe(false);
    expect(hasMeaningfulFormValue(undefined)).toBe(false);
  });

  it('treats File instances as meaningful (they would otherwise look empty via Object.values)', () => {
    // Smoke test for the bug that caused step gating to fail on the App info
    // section after an avatar upload. File properties live on the prototype,
    // so Object.values(file) returns [] — the branch had to special-case them.
    if (typeof File === 'undefined') {
      return; // node without undici File — not a realistic runtime here
    }
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });
    expect(hasMeaningfulFormValue(file)).toBe(true);
  });

  it('treats File-like duck-typed objects as meaningful when they have name + size > 0', () => {
    expect(hasMeaningfulFormValue({ name: 'a.png', size: 128 })).toBe(true);
  });

  it('empty plain object is not meaningful', () => {
    expect(hasMeaningfulFormValue({})).toBe(false);
  });
});

describe('computeSectionStatus', () => {
  const isFieldRequired = (name) => ['a', 'b'].includes(name);

  it('returns "complete" when there are no required fields in the section', () => {
    expect(
      computeSectionStatus({
        fields: ['x', 'y'],
        formData: {},
        isFieldRequired,
      })
    ).toBe('complete');
  });

  it('returns "empty" when no required fields are filled', () => {
    expect(
      computeSectionStatus({
        fields: ['a', 'b'],
        formData: { a: '', b: '' },
        isFieldRequired,
      })
    ).toBe('empty');
  });

  it('returns "partial" when some required fields are filled', () => {
    expect(
      computeSectionStatus({
        fields: ['a', 'b'],
        formData: { a: 'x', b: '' },
        isFieldRequired,
      })
    ).toBe('partial');
  });

  it('returns "complete" when all required fields are filled', () => {
    expect(
      computeSectionStatus({
        fields: ['a', 'b'],
        formData: { a: 'x', b: 'y' },
        isFieldRequired,
      })
    ).toBe('complete');
  });

  it('returns "error" when hasError is truthy, regardless of fill state', () => {
    expect(
      computeSectionStatus({
        fields: ['a', 'b'],
        formData: { a: 'x', b: 'y' },
        isFieldRequired,
        hasError: true,
      })
    ).toBe('error');
  });
});

describe('FORM_SECTIONS shape', () => {
  it('has a stable set of section ids, all unique', () => {
    const ids = FORM_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('app-info');
    expect(ids).toContain('review-submission');
  });

  it('places review-submission as the last section', () => {
    expect(FORM_SECTIONS[FORM_SECTIONS.length - 1].id).toBe('review-submission');
  });

  it('REVIEW_SECTIONS excludes the review-submission section itself', () => {
    expect(REVIEW_SECTIONS.find((s) => s.id === 'review-submission')).toBeUndefined();
    expect(REVIEW_SECTIONS.length).toBe(FORM_SECTIONS.length - 1);
  });

  it('WIZARD_STEP_COUNT matches the section count', () => {
    expect(WIZARD_STEP_COUNT).toBe(FORM_SECTIONS.length);
  });
});
