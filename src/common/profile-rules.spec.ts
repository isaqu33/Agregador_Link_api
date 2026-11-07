import { BadRequestException } from '@nestjs/common';
import { checkProfileInput, templateError } from './profile-rules';

const USER = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);
const UUID = '123e4567-e89b-12d3-a456-426614174000';
const t = (value: unknown) => JSON.stringify(value);

describe('templateError', () => {
  it('accepts the classic template and the new fields', () => {
    expect(
      templateError(
        t({ cor: '#111827', formato: '10px', fonte: 'inter', botao: 'sombra' }),
        USER,
      ),
    ).toBeNull();
    expect(
      templateError(
        t({
          texto: '#ffffff',
          fundoMidia: `/media/${USER}/${UUID}.mp4`,
          marca: false,
        }),
        USER,
      ),
    ).toBeNull();
    expect(templateError(t({ texto: '', fundoMidia: '' }), USER)).toBeNull();
  });

  it('rejects broken JSON and non-objects', () => {
    expect(templateError('{nope', USER)).toMatch(/JSON/);
    expect(templateError('[1]', USER)).toMatch(/objeto/);
    expect(templateError('"x"', USER)).toMatch(/objeto/);
  });

  it('rejects unknown keys', () => {
    expect(templateError(t({ hack: 'x' }), USER)).toMatch(/desconhecido/);
  });

  it('only accepts #rrggbb as the text color', () => {
    for (const bad of ['red', '#fff', 'url(x)', '#gggggg', 'expression(1)']) {
      expect(templateError(t({ texto: bad }), USER)).toMatch(/cor/);
    }
  });

  it('only accepts a background the user uploaded', () => {
    expect(
      templateError(t({ fundoMidia: `/media/${OTHER}/${UUID}.png` }), USER),
    ).toMatch(/enviado por você/);
    for (const bad of [
      'https://evil.example/x.mp4',
      '/assets/x.png',
      `/media/${USER}/${UUID}.exe`,
      `/media/${USER}/../${UUID}.png`,
      'javascript:alert(1)',
    ]) {
      expect(templateError(t({ fundoMidia: bad }), USER)).toMatch(
        /enviado por você/,
      );
    }
  });

  it('marca must be a boolean', () => {
    expect(templateError(t({ marca: 'nao' }), USER)).toMatch(/marca/);
  });
});

describe('checkProfileInput', () => {
  it('throws 400 for an invalid template and ignores a missing one', () => {
    expect(() =>
      checkProfileInput({ template: t({ texto: 'red' }) }, USER),
    ).toThrow(BadRequestException);
    expect(() => checkProfileInput({ title: 'x' }, USER)).not.toThrow();
  });
});
