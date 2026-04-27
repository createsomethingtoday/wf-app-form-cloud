import { describe, expect, it } from 'vitest';
import { validateScreenshotAltTexts } from './submitFormRuntime';

describe('validateScreenshotAltTexts', () => {
  it('allows submissions with no uploaded screenshots', () => {
    expect(validateScreenshotAltTexts({}, {})).toBeNull();
  });

  it('allows every uploaded screenshot with alt text', () => {
    const response = validateScreenshotAltTexts(
      {
        screenshotAltText0: 'Dashboard overview',
        screenshotAltText1: 'Settings screen',
      },
      {
        screenshots: [
          { name: 'dashboard.png' },
          { name: 'settings.png' },
        ],
      }
    );

    expect(response).toBeNull();
  });

  it('rejects uploaded screenshots without alt text', async () => {
    const response = validateScreenshotAltTexts(
      {
        screenshotAltText0: 'Dashboard overview',
        screenshotAltText1: '',
      },
      {
        screenshots: [
          { name: 'dashboard.png' },
          { name: 'icon.png' },
        ],
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Screenshot alt text required',
      details: [{ index: 2, filename: 'icon.png' }],
    });
  });
});
