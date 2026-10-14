export function securityHeaders(apiUrl, { production = false } = {}) {
  const api = new URL(apiUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
  if (api.username || api.password || (api.protocol !== 'https:' && !(!production && local && api.protocol === 'http:'))) {
    throw new Error('VITE_API_URL must use HTTPS (HTTP is allowed only for local previews).');
  }
  const policy = [
    "default-src 'self'", "script-src 'self'",
    // React, Bootstrap, toast notifications, and GSAP use inline styles.
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${api.origin}`,
    `img-src 'self' ${api.origin} data: blob:`,
    "font-src 'self'", "object-src 'none'", "base-uri 'self'",
    "frame-ancestors 'none'", "form-action 'self'",
  ].join('; ');
  return {
    'Content-Security-Policy': policy,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=300',
  };
}

export function parseHostHeaders(source) {
  return Object.fromEntries(source.trim().split('\n').slice(1).map(line => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
}

export function hostHeaderArtifacts(headers) {
  return {
    '_headers': '/*\n' + Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`).join('\n') + '\n',
    'security-headers.conf': Object.entries(headers).map(([key, value]) => `add_header ${key} "${value}" always;`).join('\n') + '\n',
  };
}
