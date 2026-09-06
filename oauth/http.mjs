// Same-origin boundary adapted from dsh-openai-oauth 0.4.0 (MIT), oauth-http.js.
import { isIP } from 'node:net'
import { randomBytes } from 'node:crypto'
import { loginPage } from './ui.mjs'
const PATH = '/api/codex-oauth'
function loopback(address) {
  if (typeof address !== 'string') return false
  if (address === '::1') return true
  const ipv4 = address.startsWith('::ffff:') ? address.slice(7) : address
  return isIP(ipv4) === 4 && ipv4.startsWith('127.')
}
function trusted(req) {
  if (!loopback(req.socket.remoteAddress) || !req.headers.host) return false
  try {
    const authority = new URL(`http://${req.headers.host}`)
    const hostname = authority.hostname.replace(/^\[|\]$/g, '')
    if (hostname !== 'localhost' && !loopback(hostname)) return false
    if (req.headers['sec-fetch-site'] === 'cross-site') return false
    return !req.headers.origin || new URL(req.headers.origin).origin === authority.origin
  } catch { return false }
}
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
export async function handleOAuthRequest(control, req, res) {
  if (!trusted(req)) return json(res, 403, { error: 'local_ui_only' })
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (req.method === 'GET' && path === `${PATH}/ui`) {
    const nonce = randomBytes(18).toString('base64')
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
      'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    })
    return res.end(loginPage(nonce))
  }
  const action = {
    [`GET ${PATH}`]: 'status', [`GET ${PATH}/usage`]: 'usage',
    [`POST ${PATH}/login`]: 'login', [`POST ${PATH}/cancel`]: 'cancelLogin', [`POST ${PATH}/logout`]: 'logout',
  }[`${req.method} ${path}`]
  if (!action) return json(res, 404, { error: 'not_found' })
  try { return json(res, 200, await control[action]()) }
  catch { return json(res, 503, { error: 'operation_failed' }) }
}
export function oauthRoute(control) {
  return { kind: 'prefix', path: PATH, handler: (req, res) => handleOAuthRequest(control, req, res) }
}
