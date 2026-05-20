/**
 * Stores the last webhook call received for debugging
 */

export let lastWebhookCall = {
  timestamp: null,
  method: null,
  headers: {},
  body: null,
  bodyKeys: [],
  bodyType: null,
  bodySize: null,
}

export function recordWebhookCall(req) {
  lastWebhookCall = {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'user-agent': req.headers['user-agent'],
    },
    body: req.body,
    bodyKeys: Object.keys(req.body || {}),
    bodyType: Array.isArray(req.body) ? 'array' : typeof req.body,
    bodySize: JSON.stringify(req.body || {}).length,
  }
}

export function getLastWebhookCall() {
  return lastWebhookCall
}
