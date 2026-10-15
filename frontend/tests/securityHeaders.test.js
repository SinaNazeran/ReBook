import { describe, expect, it } from 'vitest';
import { hostHeaderArtifacts, parseHostHeaders, securityHeaders } from '../security-headers';

describe('frontend security headers', () => {
  it('permits the configured API and local uploaded image previews', () => {
    const headers = securityHeaders('https://api.rebook.example/api');
    const csp = headers['Content-Security-Policy'];
    expect(csp).toContain("connect-src 'self' https://api.rebook.example");
    expect(csp).toContain("img-src 'self' https://api.rebook.example data: blob:");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain('unsafe-eval');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toBe('max-age=300');
  });
  it('rejects remote HTTP and credentials in the API URL', () => {
    for (const url of ['http://api.example/api', 'https://user:secret@api.example/api', 'file:///api']) {
      expect(() => securityHeaders(url)).toThrow();
    }
    expect(() => securityHeaders('http://localhost:8000/api')).not.toThrow();
    expect(() => securityHeaders('http://localhost:8000/api', { production: true })).toThrow();
  });
  it('exports both platform and nginx policies without unsafe script allowances', () => {
    const headers = securityHeaders('https://api.rebook.example/api');
    const artifacts = hostHeaderArtifacts(headers);
    expect(parseHostHeaders(artifacts._headers)).toEqual({ ...headers, 'Cache-Control': 'no-cache' });
    expect(artifacts._headers).toContain('/*\n');
    expect(artifacts['security-headers.conf']).toContain('add_header X-Frame-Options "DENY" always;');
    for (const [name, value] of Object.entries(headers)) {
      expect(artifacts._headers).toContain(`${name}: ${value}`);
      expect(artifacts['security-headers.conf']).toContain(`add_header ${name} "${value}" always;`);
    }
  });
});
