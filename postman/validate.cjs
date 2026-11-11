// Controle local des fichiers et de la syntaxe des assertions, sans requete reseau.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const collection = read('Immovia-Sprint1.postman_collection.json');
const environment = read('Immovia-Local.postman_environment.json');
assert.equal(collection.auth.type, 'bearer');
assert.equal(collection.auth.bearer[0].value, '{{access_token}}');
assert.equal(environment.values.find(value => value.key === 'access_token').value, '');
assert.equal(environment.values.find(value => value.key === 'base_url').value, 'http://localhost:8080');
assert.equal(collection.item.length, 9);
for (const item of collection.item) {
  assert(item.request.url.raw.startsWith('{{base_url}}/api/'));
  assert(item.event.some(event => event.listen === 'test'));
  for (const event of item.event) new vm.Script(event.script.exec.join('\n'));
  if (item.request.body) JSON.parse(item.request.body.raw);
}
console.log('Postman : JSON valides, 9 requetes, scripts syntaxiquement valides, aucun token fourni.');
