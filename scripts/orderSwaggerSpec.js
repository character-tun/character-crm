// Orders schemas and paths for Swagger
module.exports = {
  schemas: {
    OrderFile: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        mime: { type: 'string' },
        size: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' },
      },
      additionalProperties: true,
    },
    OrderItemSnapshot: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        unit: { type: 'string' },
        sku: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        note: { type: 'string' },
      },
      additionalProperties: true,
    },
    OrderItem: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        qty: { type: 'number' },
        total: { type: 'number' },
        snapshot: { $ref: '#/components/schemas/OrderItemSnapshot' },
        snapshotAt: { type: 'string', format: 'date-time' },
      },
      additionalProperties: true,
    },
    OrderTotals: {
      type: 'object',
      properties: {
        subtotal: { type: 'number' },
        discountTotal: { type: 'number' },
        grandTotal: { type: 'number' },
      },
      required: ['subtotal', 'discountTotal', 'grandTotal'],
      additionalProperties: true,
    },
    OrderClosed: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        at: { type: 'string', format: 'date-time' },
        by: { type: 'string' },
      },
      additionalProperties: true,
    },
    Order: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        orderTypeId: { type: 'string' },
        clientId: { type: 'string' },
        status: { type: 'string' },
        statusChangedAt: { type: 'string', format: 'date-time' },
        closed: { $ref: '#/components/schemas/OrderClosed' },
        paymentsLocked: { type: 'boolean' },
        items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
        totals: { $ref: '#/components/schemas/OrderTotals' },
        files: { type: 'array', items: { $ref: '#/components/schemas/OrderFile' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      additionalProperties: true,
    },
    OrderCreateRequest: {
      type: 'object',
      properties: {
        orderTypeId: { type: 'string' },
        clientId: { type: 'string' },
        newClient: { type: 'object', additionalProperties: true },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              qty: { type: 'number', minimum: 1 },
              itemId: { type: 'string' },
              newItem: { $ref: '#/components/schemas/ItemCreateRequest' },
            },
            additionalProperties: true,
          },
        },
        totals: { $ref: '#/components/schemas/OrderTotals' },
        discountTotal: { type: 'number' },
      },
      required: ['orderTypeId'],
      additionalProperties: true,
    },
    OrderPatchRequest: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        newClient: { type: 'object', additionalProperties: true },
        items: { $ref: '#/components/schemas/OrderCreateRequest/properties/items' },
        totals: { $ref: '#/components/schemas/OrderTotals' },
      },
      additionalProperties: true,
    },
    OrderItemResponse: {
      type: 'object',
      properties: { ok: { type: 'boolean' }, item: { $ref: '#/components/schemas/Order' } },
      required: ['item'],
      additionalProperties: true,
    },
    OrdersListResponse: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        items: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
      },
      required: ['items'],
      additionalProperties: true,
    },
    OrderStatusPatchRequest: {
      type: 'object',
      properties: {
        newStatusCode: { type: 'string' },
        note: { type: 'string' },
        userId: { type: 'string' },
      },
      required: ['newStatusCode'],
      additionalProperties: true,
    },
    OrderStatusLog: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        userId: { type: 'string' },
        note: { type: 'string' },
        actionsEnqueued: { type: 'array', items: { type: 'object', additionalProperties: true } },
        createdAt: { type: 'string', format: 'date-time' },
      },
      additionalProperties: true,
    },
    OrderFilesResponse: {
      type: 'object',
      properties: { ok: { type: 'boolean' }, files: { type: 'array', items: { $ref: '#/components/schemas/OrderFile' } } },
      required: ['files'],
      additionalProperties: true,
    },
  },
  paths: {
    '/api/orders': {
      get: {
        summary: 'List orders',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'statuses', in: 'query', schema: { type: 'string' }, description: 'Comma-separated list' },
          { name: 'client', in: 'query', schema: { type: 'string' } },
          { name: 'clientId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 }, description: 'Default 20' },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 }, description: 'Default 0' },
        ],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrdersListResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        summary: 'Create order',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderCreateRequest' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderItemResponse' } } } },
          '400': { description: 'Validation or reference errors', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { requiredFields: { value: { error: 'REQUIRED_FIELDS_MISSING' } }, clientCreate: { value: { error: 'CLIENT_CREATE_FAILED' } }, itemMissing: { value: { error: 'ITEM_NOT_FOUND' } }, typeStatus: { value: { error: 'ORDERTYPE_NO_STATUSES' } }, startInvalid: { value: { error: 'INVALID_REFERENCE_START_STATUS' } } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'OrderType not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'OrderType not found' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/orders/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        summary: 'Get order',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderItemResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'NOT_FOUND' } } } },
        },
      },
      patch: {
        summary: 'Edit order before payments',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderPatchRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderItemResponse' } } } },
          '400': { description: 'Validation or client errors', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { clientCreate: { value: { error: 'CLIENT_CREATE_FAILED' } } } } } },
          '403': { description: 'Forbidden (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'NOT_FOUND' } } } },
          '409': { description: 'Payments locked', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'PAYMENTS_LOCKED' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/orders/{id}/status': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      patch: {
        summary: 'Change order status',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderStatusPatchRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } } },
          '400': { description: 'Validation or constraints', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples: { required: { value: { error: 'newStatusCode is required' } } } } } },
          '403': { description: 'Forbidden / REOPEN_FORBIDDEN', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'REOPEN_FORBIDDEN' } } } },
          '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Order not found' } } } },
          '409': { description: 'STATUS_NOT_ALLOWED', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'STATUS_NOT_ALLOWED' } } } },
          '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/orders/{id}/status-logs': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        summary: 'Get status change logs',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/OrderStatusLog' } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/orders/{id}/timeline': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        summary: 'Get order timeline',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/OrderStatusLog' } } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/orders/{id}/files': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        summary: 'List attached files',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderFilesResponse' } } } },
          '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Order Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { error: 'Order not found' } } } },
        },
      },
    },
  },
};
