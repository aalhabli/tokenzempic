import { describe, expect, it } from 'vitest';
import { renderBanner } from './banner.js';

describe('renderBanner', () => {
  it('renders the big art when the terminal is wide enough', () => {
    const out = renderBanner(120, false);
    expect(out).toContain('████████╗');
    expect(out).toContain('put your agent on a zero token diet');
  });

  it('falls back to one line on narrow terminals', () => {
    const out = renderBanner(80, false);
    expect(out).toBe('tokenzempic — put your agent on a zero token diet');
  });

  it('emits no ANSI codes when color is off', () => {
    expect(renderBanner(120, false)).not.toContain('\x1b[');
  });
});
