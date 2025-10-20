const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

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
      PaymentCreateRequest: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['orderId'],
        additionalProperties: true,
      },
      PaymentCreateResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['payment', 'refund'] },
          orderId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'type', 'orderId'],
        additionalProperties: true,
      },
      NotifyTemplate: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'sms', 'push'] },
          subject: { type: 'string' },
          bodyHtml: { type: 'string' },
          variables: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['code', 'name', 'subject', 'bodyHtml'],
        additionalProperties: true,
      },
      DocTemplate: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          bodyHtml: { type: 'string' },
          variables: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['code', 'name', 'bodyHtml'],
        additionalProperties: true,
      },
      NotifyTemplatesListResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { $ref: '#/components/schemas/NotifyTemplate' } } },
        required: ['items'],
        additionalProperties: true,
      },
      NotifyTemplateItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/NotifyTemplate' } },
        required: ['item'],
        additionalProperties: true,
      },
      DocTemplatesListResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { $ref: '#/components/schemas/DocTemplate' } } },
        required: ['items'],
        additionalProperties: true,
      },
      DocTemplateItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/DocTemplate' } },
        required: ['item'],
        additionalProperties: true,
      },
      QueueMetrics: {
        type: 'object',
        properties: {
          processed24h: { type: 'integer' },
          failed24h: { type: 'integer' },
          active: { type: 'integer' },
          waiting: { type: 'integer' },
          delayed: { type: 'integer' },
          failedLastN: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                failedReason: { type: 'string' },
                timestamp: { type: 'string' },
              },
              additionalProperties: true,
            },
          },
          failedLastHour: { type: 'integer' },
        },
        required: ['processed24h', 'failed24h', 'active', 'waiting', 'delayed'],
        additionalProperties: true,
      },
      OrderType: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          startStatusId: { anyOf: [ { type: 'string' }, { type: 'object', additionalProperties: true } ] },
          allowedStatuses: { type: 'array', items: { anyOf: [ { type: 'string' }, { type: 'object', additionalProperties: true } ] } },
          fieldsSchemaId: { anyOf: [ { type: 'string' }, { type: 'object', additionalProperties: true } ] },
          docTemplateIds: { type: 'array', items: { anyOf: [ { type: 'string' }, { $ref: '#/components/schemas/DocTemplate' } ] } },
          isSystem: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['code', 'name'],
        additionalProperties: true,
      },
      OrderTypesListResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { $ref: '#/components/schemas/OrderType' } } },
        required: ['items'],
        additionalProperties: true,
      },
      OrderTypeItemResponse: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/OrderType' } },
        required: ['item'],
        additionalProperties: true,
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/payments': {
      post: {
        summary: 'Create payment',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentCreateRequest' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentCreateResponse' } } } },
          '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/payments/refund': {
      post: {
        summary: 'Create refund',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentCreateRequest' } } },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentCreateResponse' } } } },
          '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
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
  },
};

const outDir = path.join(__dirname, '..', 'artifacts');
ensureDir(outDir);
const outPath = path.join(outDir, 'swagger.json');
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI written: ${outPath}`);