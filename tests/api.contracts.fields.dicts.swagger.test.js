const fs = require('fs');
const path = require('path');

describe('Swagger contracts: Fields & Dicts', () => {
  let spec;
  beforeAll(() => {
    const p = path.resolve(__dirname, '../artifacts/swagger.json');
    const raw = fs.readFileSync(p, 'utf8');
    spec = JSON.parse(raw);
  });

  test('basic spec info', () => {
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info && spec.info.title).toMatch(/CRM API/i);
  });

  test('components.schemas contain Field/Dict models', () => {
    const s = spec.components && spec.components.schemas;
    expect(s).toBeTruthy();
    const required = [
      'FieldSchema',
      'FieldSpec',
      'FieldSchemaCreateRequest',
      'FieldSchemaPatchRequest',
      'Dictionary',
      'DictionaryCreateRequest',
      'DictionaryPatchRequest',
    ];
    required.forEach((name) => expect(s).toHaveProperty(name));

    // spot-check FieldSpec enum types
    const fieldTypeEnum = s.FieldSpec && s.FieldSpec.properties && s.FieldSpec.properties.type && s.FieldSpec.properties.type.enum;
    expect(fieldTypeEnum).toEqual(
      expect.arrayContaining(['text', 'number', 'date', 'bool', 'list', 'multilist']),
    );
  });

  test('paths include Fields endpoints', () => {
    const p = spec.paths;
    expect(p).toHaveProperty('/api/fields');
    expect(p['/api/fields']).toHaveProperty('get');
    expect(p['/api/fields']).toHaveProperty('post');

    expect(p).toHaveProperty('/api/fields/{id}');
    expect(p['/api/fields/{id}']).toHaveProperty('get');
    expect(p['/api/fields/{id}']).toHaveProperty('patch');
    expect(p['/api/fields/{id}']).toHaveProperty('delete');

    expect(p).toHaveProperty('/api/fields/{id}/activate');
    expect(p['/api/fields/{id}/activate']).toHaveProperty('post');

    expect(p).toHaveProperty('/api/fields/{id}/deactivate');
    expect(p['/api/fields/{id}/deactivate']).toHaveProperty('post');

    expect(p).toHaveProperty('/api/fields/{scope}/{name}/versions');
    expect(p['/api/fields/{scope}/{name}/versions']).toHaveProperty('get');

    // security spot-check
    const sec = p['/api/fields'].get.security || [];
    const secNames = sec.map((obj) => Object.keys(obj)[0]);
    expect(secNames).toContain('bearerAuth');
  });

  test('paths include Dicts endpoints', () => {
    const p = spec.paths;
    expect(p).toHaveProperty('/api/dicts');
    expect(p['/api/dicts']).toHaveProperty('get');
    expect(p['/api/dicts']).toHaveProperty('post');

    expect(p).toHaveProperty('/api/dicts/{id}');
    expect(p['/api/dicts/{id}']).toHaveProperty('get');
    expect(p['/api/dicts/{id}']).toHaveProperty('patch');
    expect(p['/api/dicts/{id}']).toHaveProperty('delete');

    expect(p).toHaveProperty('/api/dicts/by-code/{code}');
    expect(p['/api/dicts/by-code/{code}']).toHaveProperty('get');

    // response 200 present
    expect(p['/api/dicts'].get.responses).toHaveProperty('200');
    expect(p['/api/dicts/{id}'].get.responses).toHaveProperty('200');
  });
});
