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

export function parseHostHeaders(source, path = '/') {
  const headers = {};
  let matches = false;
  for (const line of source.split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      const pattern = line.trim().split('/').map(part => {
        if (part.startsWith(':')) return '[^/]+';
        return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
      }).join('/');
      matches = new RegExp(`^${pattern}$`).test(path);
    } else if (matches) {
      const separator = line.indexOf(':');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
    }
  }
  return headers;
}

export function hostHeaderArtifacts(headers, assetPaths = []) {
  const immutable = 'public, max-age=31536000, immutable';
  const assets = assetPaths.filter(path => /^\/assets\/[^/]+-[\w-]{8,}\.[\w]+$/.test(path));
  const block = (path, policy) => `${path}\n  Cache-Control: ${policy}\n`;
  return {
    '_headers': '/*\n' + Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`).join('\n') + '\n'
      + ['/', '/:page', '/books/*'].map(path => block(path, 'no-cache')).join('')
      + assets.map(path => block(path, immutable)).join(''),
    'security-headers.conf': Object.entries(headers).map(([key, value]) => `add_header ${key} "${value}" always;`).join('\n')
      + '\nadd_header Cache-Control $rebook_cache_control always;\n',
    'cache-headers.conf': 'map $uri $rebook_cache_control {\n  default "no-cache";\n'
      + assets.map(path => `  "${path}" "${immutable}";\n`).join('') + '}\n',
  };
}
