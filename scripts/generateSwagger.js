const fs = require('fs');
const path = require('path');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

const reportFile = path.join(__dirname, '../storage/reports/api-contracts/swagger.json');

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Character CRM API',
    version: '1.0.0',
    description: 'OpenAPI spec generated from existing contracts and routes.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      DeleteResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
      },
      PaymentCreateRequest: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          type: { type: 'string', enum: ['income', 'expense'] },
          articlePath: { type: 'array', items: { type: 'string' }, minItems: 1 },
          amount: { type: 'number', minimum: 0, exclusiveMinimum: true },
          method: { type: 'string' },
          cashRegisterId: { type: 'string' },
          note: { type: 'string' },
          locationId: { type: 'string' },
        },
        required: ['orderId'],
        additionalProperties: true,
      },
      PaymentCreateResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          id: { type: 'string' },
        },
        required: ['ok', 'id'],
        additionalProperties: true,
      },
      Payment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          orderId: { type: 'string' },
          type: { type: 'string', enum: ['income', 'expense', 'refund'] },
          articlePath: { type: 'array', items: { type: 'string' }, minItems: 1 },
          amount: { type: 'number', minimum: 0, exclusiveMinimum: true },
          method: { type: 'string' },
          cashRegisterId: { type: 'string' },
          note: { type: 'string' },
          createdBy: { anyOf: [ { type: 'string' }, { type: 'object', additionalProperties: true } ] },
          locked: { type: 'boolean' },
          lockedAt: { type: 'string', format: 'date-time' },
          locationId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['type', 'articlePath', 'amount', 'cashRegisterId'],
        additionalProperties: true,
      },
      PaymentItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/Payment' } },
        required: ['item'],
        additionalProperties: true,
      },
      PaymentsListResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          items: { type: 'array', items: { $ref: '#/components/schemas/Payment' } },
          totals: { type: 'object', properties: {
            income: { type: 'number' },
            expense: { type: 'number' },
            refund: { type: 'number' },
            balance: { type: 'number' },
          }, required: ['income','expense','refund','balance'] },
        },
        required: ['items', 'totals'],
        additionalProperties: true,
      },
      PaymentRefundRequest: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          articlePath: { type: 'array', items: { type: 'string' }, minItems: 1 },
          amount: { type: 'number', minimum: 0, exclusiveMinimum: true },
          method: { type: 'string' },
          cashRegisterId: { type: 'string' },
          note: { type: 'string' },
          locationId: { type: 'string' },
        },
        required: ['orderId'],
        additionalProperties: true,
      },
      PaymentPatchRequest: {
        type: 'object',
        properties: {
          amount: { type: 'number', minimum: 0, exclusiveMinimum: true },
          articlePath: { type: 'array', items: { type: 'string' }, minItems: 1 },
          method: { type: 'string' },
          cashRegisterId: { type: 'string' },
          note: { type: 'string' },
          locationId: { type: 'string' },
        },
        additionalProperties: true,
      },

      // Auth schemas
      AuthUser: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          email: { type: 'string' },
          full_name: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
        additionalProperties: true,
      },
      AuthRegisterFirstRequest: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['email', 'password'],
        additionalProperties: true,
      },
      AuthRegisterFirstResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
        required: ['ok', 'user'],
        additionalProperties: true,
        example: { ok: true, user: { _id: 'u1', email: 'admin@example.com' } },
      },
      AuthLoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
        additionalProperties: true,
      },
      AuthLoginResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          access: { type: 'string' },
          refresh: { type: 'string' },
        },
        required: ['ok', 'accessToken', 'refreshToken'],
        additionalProperties: true,
        example: {
          ok: true,
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token',
          access: 'jwt-access-token',
          refresh: 'jwt-refresh-token',
        },
      },
      AuthRefreshRequest: {
        type: 'object',
        properties: {
          refresh: { type: 'string' },
          refreshToken: { type: 'string' },
        },
        required: ['refresh'],
        additionalProperties: true,
      },
      AuthRefreshResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          accessToken: { type: 'string' },
          access: { type: 'string' },
        },
        required: ['ok', 'accessToken'],
        additionalProperties: true,
        example: {
          ok: true,
          accessToken: 'jwt-access-token',
          access: 'jwt-access-token',
        },
      },

      // Item catalog schemas
      Item: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          sku: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
          createdBy: { anyOf: [ { type: 'string' }, { type: 'object', additionalProperties: true } ] },
          locked: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        additionalProperties: true,
      },
      ItemCreateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          sku: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: true,
      },
      ItemPatchRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          sku: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
        },
        additionalProperties: true,
      },
      ItemItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/Item' } },
        required: ['item'],
        additionalProperties: true,
      },
      ItemsListResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          items: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
        },
        required: ['items'],
        additionalProperties: true,
      },
      ItemCreateResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          id: { type: 'string' },
        },
        required: ['ok', 'id'],
        additionalProperties: true,
      },

      // Field schemas
      FieldSpec: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          type: { type: 'string', enum: ['text','number','date','bool','list','multilist'] },
          label: { type: 'string' },
          required: { type: 'boolean' },
          options: { type: 'array', items: { anyOf: [ { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'object', additionalProperties: true } ] } },
          note: { type: 'string' },
        },
        required: ['code','type'],
        additionalProperties: true,
      },
      FieldSchema: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          scope: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'integer', minimum: 1 },
          isActive: { type: 'boolean' },
          note: { type: 'string' },
          createdBy: { anyOf: [ { type: 'string' }, { type: 'object', additionalProperties: true } ] },
          createdAt: { type: 'string', format: 'date-time' },
          fields: { type: 'array', items: { $ref: '#/components/schemas/FieldSpec' } },
        },
        required: ['scope','name','version','fields'],
        additionalProperties: true,
      },
      FieldSchemaCreateRequest: {
        type: 'object',
        properties: {
          scope: { type: 'string' },
          name: { type: 'string' },
          fields: { type: 'array', items: { $ref: '#/components/schemas/FieldSpec' } },
          note: { type: 'string' },
        },
        required: ['scope','name'],
        additionalProperties: true,
      },
      FieldSchemaPatchRequest: {
        type: 'object',
        properties: {
          fields: { type: 'array', items: { $ref: '#/components/schemas/FieldSpec' } },
          note: { type: 'string' },
        },
        additionalProperties: true,
      },
      FieldSchemaItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/FieldSchema' } },
        required: ['item'],
        additionalProperties: true,
      },
      FieldSchemasListResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { $ref: '#/components/schemas/FieldSchema' } } },
        required: ['items'],
        additionalProperties: true,
      },

      // Dictionary schemas
      Dictionary: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string' },
          values: { type: 'array', items: { anyOf: [ { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'object', additionalProperties: true } ] } },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['code','values'],
        additionalProperties: true,
      },
      DictionaryCreateRequest: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          values: { type: 'array', items: { anyOf: [ { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'object', additionalProperties: true } ] } },
        },
        required: ['code'],
        additionalProperties: true,
      },
      DictionaryPatchRequest: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          values: { type: 'array', items: { anyOf: [ { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'object', additionalProperties: true } ] } },
        },
        additionalProperties: true,
      },
      DictionaryItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/Dictionary' } },
        required: ['item'],
        additionalProperties: true,
      },
      DictionariesListResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { $ref: '#/components/schemas/Dictionary' } } },
        required: ['items'],
        additionalProperties: true,
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/payments': {






    get: {
      summary: 'List payments',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'type', in: 'query', schema: { type: 'string', enum: ['income','expense','refund'] } },
        { name: 'orderId', in: 'query', schema: { type: 'string' } },
        { name: 'cashRegisterId', in: 'query', schema: { type: 'string' } },
        { name: 'locationId', in: 'query', schema: { type: 'string' } },
        { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'articlePath', in: 'query', schema: { type: 'string' }, description: 'Prefix "a/b/c" or contains segment "a"' },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500 }, description: 'Default 50' },
        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 }, description: 'Default 0' },
      ],
      responses: {
        '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentsListResponse' } } } },
        '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      },
    },
    post: {
      summary: 'Create income or expense payment',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentCreateRequest' } } } },
      responses: {
        '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentItemResponse' } } } },
        '400': { description: 'Validation or order constraints', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { validation: { value: { error: 'VALIDATION_ERROR' } }, paymentsLocked: { value: { error: 'PAYMENTS_LOCKED' } }, orderClosed: { value: { error: 'ORDER_CLOSED' } } } } } },
        '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        '404': { description: 'Cash register not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CASH_NOT_FOUND' } } } },
        '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      },
    },
    },
    '/api/payments/refund': {
      post: {
        summary: 'Create refund payment',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentRefundRequest' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentItemResponse' } } } },
          '400': { description: 'Validation or order constraints', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { validation: { value: { error: 'VALIDATION_ERROR' } }, paymentsLocked: { value: { error: 'PAYMENTS_LOCKED' } }, orderClosed: { value: { error: 'ORDER_CLOSED' } } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Cash register not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CASH_NOT_FOUND' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/payments/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      patch: {
        summary: 'Edit payment',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentPatchRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentItemResponse' } } } },
          '400': { description: 'Validation or lock constraints', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { validation: { value: { error: 'VALIDATION_ERROR' } }, locked: { value: { error: 'PAYMENT_LOCKED' } } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'NOT_FOUND' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/api/payments/{id}/lock': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      post: {
        summary: 'Lock payment',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentItemResponse' } } } },
          '400': { description: 'Already locked', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'PAYMENT_LOCKED' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'NOT_FOUND' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/api/notify/templates': {
      get: {
        summary: 'List notify templates',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotifyTemplatesListResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create notify template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NotifyTemplate' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotifyTemplateItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/notify/templates/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get notify template',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotifyTemplateItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        summary: 'Update notify template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NotifyTemplate' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotifyTemplateItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        summary: 'Delete notify template',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } } },
          '400': { description: 'Template in use', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/doc-templates': {
      get: {
        summary: 'List doc templates',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocTemplatesListResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create doc template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DocTemplate' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocTemplateItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/doc-templates/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get doc template',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocTemplateItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        summary: 'Update doc template',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DocTemplate' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocTemplateItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        summary: 'Delete doc template',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } } },
          '400': { description: 'Template in use', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/order-types': {
      get: {
        summary: 'List order types',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderTypesListResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create order type',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderType' },
              example: {
                code: 'default',
                name: 'Default',
                startStatusId: 'st_new',
                allowedStatuses: ['st_new', 'st_in_progress'],
                docTemplateIds: ['doc_invoice', 'doc_contract'],
                isSystem: true
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderTypeItemResponse' } } }
          },
          '400': {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  invalidStart: { value: { error: 'ORDERTYPE_INVALID_START_STATUS' } },
                  validation: { value: { error: 'VALIDATION_ERROR' } }
                }
              }
            }
          },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CODE_EXISTS' } } } },
          '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        },
      },
    },
    '/api/order-types/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get order type',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderTypeItemResponse' } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        summary: 'Update order type',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderType' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderTypeItemResponse' } } } },
          '400': {
            description: 'Bad Request: invalid start status not in allowedStatuses',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'ORDERTYPE_INVALID_START_STATUS' } } }
          },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CODE_EXISTS' } } } },
          '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        summary: 'Delete order type',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': {
            description: 'Conflict: cannot delete system type or type in use',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  systemType: { value: { error: 'SYSTEM_TYPE' } },
                  inUse: { value: { error: 'ORDERTYPE_IN_USE' } }
                }
              }
            }
          },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/cash': {
      get: {
        summary: 'List cash registers',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Max items to return' },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 }, description: 'Offset for pagination' },
        ],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/CashRegistersListResponse' } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create cash register',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CashRegister' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/CashRegisterItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CODE_EXISTS' } } } },
        },
      },
    },
    '/api/cash/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      patch: {
        summary: 'Update cash register',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CashRegister' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/CashRegisterItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { systemCode: { value: { error: 'SYSTEM_CODE_PROTECTED' } } } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Conflict (code exists)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CODE_EXISTS' } } } },
        },
      },
      delete: {
        summary: 'Delete cash register',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Conflict: register in use', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CASH_IN_USE' } } } },
        },
      },
    },

    '/api/queue/status-actions/metrics': {
      get: {
        summary: 'Get status actions queue metrics',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'n', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Number of failed jobs to include' },
        ],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/QueueMetrics' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/public/health': {
      get: {
        summary: 'Health',
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        },
      },
    },
    '/api/public/status': {
      get: {
        summary: 'Service status',
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        },
      },
    },
    '/api/clients': {
      get: {
        summary: 'List clients',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/clients/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get client',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/boxes': {
      get: {
        summary: 'List boxes',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/boxes/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get box',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/detailing-orders': {
      get: {
        summary: 'List detailing orders',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/detailing-orders/batch': {
      get: {
        summary: 'Get detailing orders by ids',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'ids', in: 'query', schema: { type: 'string' }, description: 'Comma-separated ids' },
        ],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/detailing-orders/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get detailing order',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/detailing-orders/client/{clientId}': {
      parameters: [ { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'List detailing orders for client',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // Field Schemas
    '/api/fields': {
      get: {
        summary: 'List field schemas',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemasListResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create field schema version',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaCreateRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { optionsRequired: { value: { error: 'FIELD_OPTIONS_REQUIRED' } } } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/fields/schemas': {
      post: {
        summary: 'Create field schema version (alias)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaCreateRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { optionsRequired: { value: { error: 'FIELD_OPTIONS_REQUIRED' } } } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/fields/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get field schema by id',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        summary: 'Update field schema fields/note',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaPatchRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { optionsRequired: { value: { error: 'FIELD_OPTIONS_REQUIRED' } } } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        summary: 'Delete field schema (forbidden if active)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Cannot delete active', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'DELETE_ACTIVE_FORBIDDEN' } } } },
        },
      },
    },
    '/api/fields/{scope}/{name}/versions': {
      parameters: [
        { name: 'scope', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'name', in: 'path', required: true, schema: { type: 'string' } }
      ],
      get: {
        summary: 'List schema versions for scope/name',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemasListResponse' } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/fields/{id}/activate': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      post: {
        summary: 'Activate field schema version',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/fields/{id}/deactivate': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      post: {
        summary: 'Deactivate field schema version',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/FieldSchemaItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // Dictionaries
    '/api/dicts': {
      get: {
        summary: 'List dictionaries',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionariesListResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create dictionary',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryCreateRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryItemResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CODE_EXISTS' } } } },
        },
      },
    },
    '/api/dicts/{id}': {
      parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get dictionary',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      patch: {
        summary: 'Update dictionary',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryPatchRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Code exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'CODE_EXISTS' } } } },
        },
      },
      delete: {
        summary: 'Delete dictionary',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/dicts/by-code/{code}': {
      parameters: [ { name: 'code', in: 'path', required: true, schema: { type: 'string' } } ],
      get: {
        summary: 'Get dictionary by code',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DictionaryItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // Auth endpoints
    '/api/auth/register-first': {
      post: {
        summary: 'Register first user (Admin)',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRegisterFirstRequest' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRegisterFirstResponse' } } } },
          '400': { description: 'Users already exist', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { usersExist: { value: { error: 'USERS_ALREADY_EXIST' } } } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/bootstrap-admin': {
      post: {
        summary: 'Bootstrap first admin (compatible)',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRegisterFirstRequest' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRegisterFirstResponse' } } } },
          '400': { description: 'Users already exist', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { usersExist: { value: { error: 'USERS_ALREADY_EXIST' } } } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Login',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLoginRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLoginResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRefreshRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRefreshResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
};

// Merge Orders spec fragments before writing
const orderSpec = require('./orderSwaggerSpec');
Object.assign(spec.components.schemas, orderSpec.schemas);
Object.assign(spec.paths, orderSpec.paths);
const outDir = path.join(__dirname, '..', 'artifacts');
ensureDir(outDir);
const outPath = path.join(outDir, 'swagger.json');
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI written: ${outPath}`);