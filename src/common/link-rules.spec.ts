import {
  linkError,
  socialUrlError,
  USERNAME_PATTERN,
  RESERVED_USERNAMES,
} from './link-rules';

describe('linkError', () => {
  it('accepts http(s) for url types', () => {
    expect(linkError('Link', 'https://exemplo.com/a?b=1')).toBeNull();
    expect(linkError('Youtube', 'http://youtube.com/watch?v=1')).toBeNull();
  });
  it('rejects javascript:, data: and bare text', () => {
    expect(linkError('Link', 'javascript:alert(1)')).not.toBeNull();
    expect(linkError('Link', 'data:text/html,x')).not.toBeNull();
    expect(linkError('Whatsapp', 'abc')).not.toBeNull();
  });
  it('validates mailto and tel', () => {
    expect(linkError('Email', 'mailto:a@b.com')).toBeNull();
    expect(linkError('Email', 'https://b.com')).not.toBeNull();
    expect(linkError('Telefone', 'tel:+5511999998888')).toBeNull();
    expect(linkError('Telefone', 'tel:abc')).not.toBeNull();
  });
  it('lets a header have no url', () => {
    expect(linkError('Cabecalho', '')).toBeNull();
  });
});

describe('socialUrlError', () => {
  it('uses mailto for email and http(s) for the rest', () => {
    expect(socialUrlError('email', 'mailto:a@b.com')).toBeNull();
    expect(socialUrlError('instagram', 'https://instagram.com/x')).toBeNull();
    expect(socialUrlError('instagram', 'javascript:1')).not.toBeNull();
  });
});

describe('username', () => {
  it('matches the pattern', () => {
    expect(USERNAME_PATTERN.test('maria.silva_1')).toBe(true);
    expect(USERNAME_PATTERN.test('ab')).toBe(false);
    expect(USERNAME_PATTERN.test('Maria')).toBe(false);
    expect(USERNAME_PATTERN.test('_maria')).toBe(false);
  });
  it('reserves front routes', () => {
    ['login', 'costumer', 'api', 'u'].forEach((r) =>
      expect(RESERVED_USERNAMES.has(r)).toBe(true),
    );
  });
});
