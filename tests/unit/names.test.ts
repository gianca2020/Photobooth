import { describe, expect, it } from 'vitest';
import { escapeHTML, namesLine } from '../../app/src/photo/names';

describe('namesLine', () => {
  it('joins the typed names with a middle dot', () => {
    expect(namesLine({ count: 3, names: ['Ana', 'Ben', 'Cleo', ''] })).toBe('Ana · Ben · Cleo');
  });
  it('is empty when nobody typed a name (no names line at all)', () => {
    expect(namesLine({ count: 4, names: ['', ' ', '\t', ''] })).toBe('');
  });
  it('leaves unnamed guests out and trims spaces', () => {
    expect(namesLine({ count: 3, names: ['  Ana ', '', 'Cleo', ''] })).toBe('Ana · Cleo');
  });
  it('ignores names of guests who are no longer in the booth (count went back down)', () => {
    expect(namesLine({ count: 2, names: ['Ana', 'Ben', 'Cleo', 'Dee'] })).toBe('Ana · Ben');
    expect(namesLine({ count: 1, names: ['', 'Ben', '', ''] })).toBe('');
  });
});

describe('escapeHTML', () => {
  it('neutralises markup typed into a name', () => {
    expect(escapeHTML(`<img src=x onerror="alert('x')">&`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  });
});
