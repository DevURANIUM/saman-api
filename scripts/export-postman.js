'use strict';
const fs = require('node:fs');
const path = require('node:path');

function collectionFrom(openapi) {
  const groups = new Map();
  for (const [route, operations] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const parameters = [...(operations.parameters || []), ...(operation.parameters || [])];
      const pathname = route.replace(/\{([^}]+)\}/g, ':$1');
      const query = parameters.filter(p => p.in === 'query').map(p => ({ key: p.name,
        value: String(p.schema?.default ?? p.example ?? ''), disabled: !p.required,
        description: p.description || p.schema?.description || '' }));
      const raw = '{{baseUrl}}' + pathname + (query.some(p => !p.disabled)
        ? '?' + query.filter(p => !p.disabled).map(p => p.key + '=' + encodeURIComponent(p.value)).join('&') : '');
      const request = { method: method.toUpperCase(),
        header: [{ key: 'Accept', value: 'application/json' }],
        url: { raw, host: ['{{baseUrl}}'], path: pathname.slice(1).split('/'), query,
          variable: parameters.filter(p => p.in === 'path').map(p => ({ key: p.name, value: '', description: p.description || '' })) },
        description: operation.description || operation.summary };
      if (operation.security?.length === 0) request.auth = { type: 'noauth' };
      const json = operation.requestBody?.content?.['application/json'];
      if (json) {
        request.header.push({ key: 'Content-Type', value: 'application/json' });
        // Named variables keep passwords and payment secrets out of exported files.
        const example = json.example || Object.fromEntries(Object.keys(json.schema?.properties || {}).map(key => [key, '{{' + key + '}}']));
        request.body = { mode: 'raw', raw: JSON.stringify(example, null, 2), options: { raw: { language: 'json' } } };
      }
      const item = { name: method.toUpperCase() + ' ' + route, request, response: [] };
      for (const [code, response] of Object.entries(operation.responses || {})) {
        const example = response.content?.['application/json']?.example;
        if (example !== undefined) item.response.push({ name: response.description, originalRequest: request,
          status: Number(code) === 200 ? 'OK' : response.description, code: Number(code),
          header: [{ key: 'Content-Type', value: 'application/json' }], body: JSON.stringify(example, null, 2) });
      }
      const group = route.split('/')[1];
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
  }
  return { info: { name: 'Saman Mobillet API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Set baseUrl and apiKey locally. Requests never run automatically. Monetary operations submit real instructions when explicitly sent. Examples use synthetic values.' },
    auth: { type: 'apikey', apikey: [{ key: 'key', value: 'x-api-key', type: 'string' },
      { key: 'value', value: '{{apiKey}}', type: 'string' }, { key: 'in', value: 'header', type: 'string' }] },
    variable: [{ key: 'baseUrl', value: 'http://127.0.0.1:8089/v1' }, { key: 'apiKey', value: '' }],
    item: [...groups].map(([name, item]) => ({ name, item })) };
}
if (require.main === module) {
  const collection = collectionFrom(require('../docs/openapi.json'));
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'saman-api.postman_collection.json'), JSON.stringify(collection, null, 2));
  console.log('Postman collection generated');
}
module.exports = { collectionFrom };
