import https from 'node:https';
import { createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

// Fixed public research sources. Fetched text is evidence, never instructions.
export const references = Object.freeze([
  {
    id: 'WSTG-ATHN-04',
    url: 'https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/04-Authentication_Testing/04-Testing_for_Bypassing_Authentication_Schema/',
  },
  {
    id: 'WSTG-ATHZ-04',
    url: 'https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References/',
  },
  {
    id: 'OWASP-Authorization-Cheat-Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
  },
]);
const maxBytes = 1024 * 1024;

function readable(html) {
  // Extract plain text for JSON evidence. This is not an HTML sanitizer.
  const hiddenElements = new Set(['head', 'script', 'style', 'nav', 'footer', 'template']);
  const blockElements = new Set(['body', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'div', 'section', 'tr', 'br', 'hr', 'pre', 'blockquote']);
  const hidden = [];
  const parts = [];
  const tagStart = /<(\/?)([a-z][a-z0-9:-]*)(?=[\t\n\f\r />])/iy;
  const rawEnds = new Map([
    ['script', /<\/script(?=[\t\n\f\r />])/gi],
    ['style', /<\/style(?=[\t\n\f\r />])/gi],
  ]);
  let cursor = 0;

  while (cursor < html.length) {
    // Raw-text elements end only at their own closing tag, or at EOF.
    const rawEnd = rawEnds.get(hidden.at(-1));
    if (rawEnd) {
      rawEnd.lastIndex = cursor;
      const closing = rawEnd.exec(html);
      if (!closing) break;
      cursor = closing.index;
    }
    if (html.startsWith('<!--', cursor)) {
      const end = html.indexOf('-->', cursor + 4);
      cursor = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[cursor] !== '<') {
      const next = html.indexOf('<', cursor);
      const end = next < 0 ? html.length : next;
      if (!hidden.length) parts.push(html.slice(cursor, end));
      cursor = end;
      continue;
    }

    const declaration = html.startsWith('<!', cursor) || html.startsWith('<?', cursor);
    tagStart.lastIndex = cursor;
    const tag = declaration ? null : tagStart.exec(html);
    if (!declaration && !tag) {
      if (!hidden.length) parts.push('<');
      cursor += 1;
      continue;
    }
    let end = tag ? tagStart.lastIndex : cursor + 2;
    let quote = '';
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        break;
      }
    }
    if (end === html.length) break;
    cursor = end + 1;
    if (!tag) continue;

    const name = tag[2].toLowerCase();
    if (tag[1]) {
      const index = hidden.lastIndexOf(name);
      if (index >= 0) hidden.length = index;
    } else if (hiddenElements.has(name)) {
      hidden.push(name);
    }
    if (!hidden.length && (blockElements.has(name) || name === 'head')) parts.push('\n');
  }

  // One replacement pass preserves nested references as literal text.
  const entities = new Map([
    ['&nbsp;', ' '], ['&amp;', '&'], ['&quot;', '"'],
    ['&#39;', "'"], ['&apos;', "'"], ['&lt;', '<'], ['&gt;', '>'],
  ]);
  return parts.join('')
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt|#39);/gi, entity => entities.get(entity.toLowerCase()))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .split(/\n+/).map(line => line.replace(/[ \t\r]+/g, ' ').trim())
    .filter(Boolean).join('\n');
}

function fetchReferenceOnce(reference) {
  return new Promise(resolve => {
    const fetchedAt = new Date().toISOString();
    let settled = false;
    let timer;
    let status = null;
    let bytes = 0;
    const chunks = [];
    const finish = details => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...reference, fetchedAt, status, responseBytes: bytes, redirectsFollowed: 0, ...details });
    };
    const req = https.get(reference.url, {
      headers: {
        Accept: 'text/html',
        'Accept-Encoding': 'identity',
        'User-Agent': 'REDLINE-Sustainaboy-Reference-Review/1.0',
      },
    }, res => {
      status = res.statusCode ?? null;
      // Return redirects to the validating wrapper. No credentials are sent.
      if (status !== 200) {
        finish({ outcome: 'unavailable', reason: 'http_status', redirectLocation: res.headers.location ?? null });
        res.destroy();
        return;
      }
      const contentType = String(res.headers['content-type'] ?? '');
      const encoding = String(res.headers['content-encoding'] ?? 'identity');
      if (!/^text\/html(?:;|$)/i.test(contentType) || encoding !== 'identity') {
        finish({ outcome: 'unavailable', reason: 'unexpected_representation' });
        res.destroy();
        return;
      }
      res.on('data', chunk => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > maxBytes) {
          finish({ outcome: 'unavailable', reason: 'response_limit' });
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (settled) return;
        if (!res.complete) {
          finish({ outcome: 'unavailable', reason: 'incomplete_response' });
          return;
        }
        const body = Buffer.concat(chunks);
        const html = body.toString('utf8');
        const title = readable(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 240);
        // HTML relocation notices are not research documents; never execute or follow them.
        const hasMetaRefresh = /<meta\b[^>]*\bhttp-equiv\s*=\s*(?:"\s*refresh\s*"|'\s*refresh\s*'|refresh(?=[\s/>]))/i.test(html);
        if (/^redirecting[\s.…]*$/i.test(title) || hasMetaRefresh) {
          finish({
            outcome: 'unavailable', reason: 'html_redirect_document',
            title, contentType,
            sha256: createHash('sha256').update(body).digest('hex'),
          });
          return;
        }
        const passages = readable(html).split('\n')
          .filter(line => line.length >= 70 && /authenticat|authoriz|access control|permission|privilege|IDOR|direct object|deny by default/i.test(line))
          .slice(0, 6).map(line => line.slice(0, 500));
        finish({
          outcome: 'fetched', title, contentType,
          sha256: createHash('sha256').update(body).digest('hex'),
          passages, excerptOnly: true,
        });
      });
      res.on('error', () => finish({ outcome: 'unavailable', reason: 'response_error' }));
      res.on('aborted', () => finish({ outcome: 'unavailable', reason: 'response_aborted' }));
    });
    timer = setTimeout(() => {
      finish({ outcome: 'unavailable', reason: 'timeout' });
      req.destroy();
    }, 15000);
    req.on('error', () => finish({ outcome: 'unavailable', reason: 'connection_or_tls_error' }));
  });
}

export async function fetchReference(reference, requestOnce = fetchReferenceOnce) {
  if (!references.some(item => item.id === reference?.id && item.url === reference?.url)) {
    throw new TypeError('Unknown research reference');
  }
  const origin = new URL(reference.url).origin;
  // Redirects stay on the source origin and within its research collection.
  const allowedPrefixes = new Map([[origin, origin === 'https://wstg.owasp.org'
    ? '/v4.2/4-Web_Application_Security_Testing/' : '/cheatsheets/']]);
  const visited = new Set([reference.url]);
  const redirectChain = [];
  let currentUrl = reference.url;

  while (true) {
    const response = await requestOnce({ ...reference, url: currentUrl });
    const { redirectLocation, ...details } = response;
    const result = {
      ...details,
      url: reference.url,
      finalUrl: currentUrl,
      redirectsFollowed: redirectChain.length,
      redirectChain: [...redirectChain],
    };
    if (![301, 302, 303, 307, 308].includes(response.status)) return result;
    if (redirectChain.length >= 3) {
      return { ...result, outcome: 'unavailable', reason: 'redirect_limit' };
    }

    let next;
    try {
      if (typeof redirectLocation !== 'string' || !redirectLocation.trim()) {
        throw new Error('missing_location');
      }
      next = new URL(redirectLocation, currentUrl);
    } catch {
      return { ...result, outcome: 'unavailable', reason: 'invalid_redirect' };
    }
    if (next.protocol !== 'https:' || !allowedPrefixes.has(next.origin) ||
        !next.pathname.startsWith(allowedPrefixes.get(next.origin)) ||
        next.username || next.password || next.search || next.hash) {
      return {
        ...result, outcome: 'unavailable', reason: 'redirect_outside_reference_boundary',
        blockedRedirectOrigin: next.origin,
      };
    }
    if (visited.has(next.href)) {
      return { ...result, outcome: 'unavailable', reason: 'redirect_loop' };
    }
    redirectChain.push({ from: currentUrl, status: response.status, to: next.href });
    visited.add(next.href);
    currentUrl = next.href;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) {
    process.stderr.write('This command accepts no arguments; research URLs are fixed.\n');
    process.exitCode = 2;
  } else {
    const documents = [];
    for (const reference of references) {
      if (documents.length) await pause(300);
      documents.push(await fetchReference(reference));
    }
    process.stdout.write(JSON.stringify({
      schema: 'redline-sustainaboy-research/v1',
      documents,
    }, null, 2) + '\n');
    if (documents.some(document => document.outcome !== 'fetched')) process.exitCode = 1;
  }
}
