const Joi = require('joi');

// Shared enums from models (duplicated here for contracts to avoid runtime import cycles)
const ACTION_TYPES = ['charge', 'closeWithoutPayment', 'payrollAccrual', 'notify', 'print'];
const CHANNELS = ['sms', 'email', 'telegram'];
const GROUPS = ['draft', 'in_progress', 'closed_success', 'closed_fail'];

// Basic helpers
const idSchema = Joi.string().min(1);
// Relax ObjectId-like to accept short DEV strings and real ObjectId when present
const objectIdLike = Joi.string().min(1);

// Order Status Actions
const orderStatusActionSchema = Joi.object({
  type: Joi.string().valid(...ACTION_TYPES).required(),
  templateId: Joi.string().optional(),
  channel: Joi.string().valid(...CHANNELS).optional(),
  docId: Joi.string().optional(),
});

// Order Status
const orderStatusSchema = Joi.object({
  _id: idSchema.required(),
  code: Joi.string().regex(/^[a-z0-9_-]{2,40}$/).required(),
  name: Joi.string().required(),
  color: Joi.string().optional(),
  group: Joi.string().valid(...GROUPS).required(),
  order: Joi.number().integer().min(0).optional(),
  actions: Joi.array().items(orderStatusActionSchema).default([]),
  system: Joi.boolean().default(false),
  locationId: Joi.string().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});

// Grouped statuses response: [{ group, items: [OrderStatus] }]
const groupedStatusesResponseSchema = Joi.array().items(Joi.object({
  group: Joi.string().valid(...GROUPS).required(),
  items: Joi.array().items(orderStatusSchema).required(),
}));

// Create/Update requests
const createStatusRequestSchema = Joi.object({
  code: Joi.string().regex(/^[a-z0-9_-]{2,40}$/).required(),
  name: Joi.string().required(),
  color: Joi.string().optional(),
  group: Joi.string().valid(...GROUPS).required(),
  order: Joi.number().integer().min(0).optional(),
  actions: Joi.array().items(orderStatusActionSchema).optional(),
  system: Joi.boolean().optional(),
  locationId: Joi.string().optional(),
});

const updateStatusRequestSchema = Joi.object({
  code: Joi.string().regex(/^[a-z0-9_-]{2,40}$/).optional(),
  name: Joi.string().optional(),
  color: Joi.string().optional(),
  group: Joi.string().valid(...GROUPS).optional(),
  order: Joi.number().integer().min(0).optional(),
  actions: Joi.array().items(orderStatusActionSchema).optional(),
  system: Joi.boolean().optional(),
  locationId: Joi.string().optional(),
}).min(1);

// Reorder
const reorderItemSchema = Joi.object({
  id: idSchema.required(),
  group: Joi.string().valid(...GROUPS).optional(),
  order: Joi.number().integer().min(0).optional(),
});
const statusesReorderRequestSchema = Joi.array().items(reorderItemSchema);
const statusesReorderResponseSchema = Joi.object({ ok: Joi.boolean().valid(true), updated: Joi.number().integer().min(0).required(), errors: Joi.array().items(Joi.object({ id: Joi.string().optional(), error: Joi.string().required() })).required() });

// Order Status Logs
const orderStatusLogSchema = Joi.object({
  orderId: objectIdLike.required(),
  from: Joi.string().allow(null),
  to: Joi.string().required(),
  userId: objectIdLike.optional(),
  userName: Joi.string().optional(),
  note: Joi.string().allow('').optional(),
  actionsEnqueued: Joi.array().items(Joi.alternatives().try(orderStatusActionSchema, Joi.object())).default([]),
  createdAt: Joi.date().required(),
});
const orderStatusLogsResponseSchema = Joi.array().items(orderStatusLogSchema);

// Change status (DEV response)
const changeStatusResponseDevSchema = Joi.object({
  ok: Joi.boolean().valid(true).required(),
  log: orderStatusLogSchema.required(),
  closed: Joi.object({ success: Joi.boolean().required(), at: Joi.date().required(), by: objectIdLike.required() }).optional(),
});

// Files list response
const orderFilesResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), files: Joi.array().items(Joi.object({ id: Joi.string().required(), name: Joi.string().required(), mime: Joi.string().required(), size: Joi.number().required(), createdAt: Joi.date().optional() })).required() });

// Payments
const paymentCreateRequestSchema = Joi.object({ orderId: objectIdLike.required() });
const paymentCreateResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), id: Joi.string().required() });

// Cash
const cashRegisterSchema = Joi.object({
  _id: idSchema.optional(),
  code: Joi.string().required(),
  name: Joi.string().required(),
  defaultForLocation: Joi.boolean().default(false),
  cashierMode: Joi.string().optional(),
  isSystem: Joi.boolean().default(false),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
const cashListResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), items: Joi.array().items(cashRegisterSchema).required() });
const cashCreateRequestSchema = Joi.object({ code: Joi.string().required(), name: Joi.string().required(), defaultForLocation: Joi.boolean().optional(), cashierMode: Joi.string().optional(), isSystem: Joi.boolean().optional() });
const cashItemResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), item: cashRegisterSchema.required() });

// Queue Metrics
const queueMetricsResponseSchema = Joi.object({
  processed24h: Joi.number().integer().min(0).required(),
  failed24h: Joi.number().integer().min(0).required(),
  active: Joi.number().integer().min(0).required(),
  waiting: Joi.number().integer().min(0).required(),
  delayed: Joi.number().integer().min(0).required(),
  failedLastN: Joi.array().items(Joi.object({ id: Joi.alternatives().try(Joi.number(), Joi.string()).required(), orderId: Joi.string().optional(), statusCode: Joi.string().optional(), logId: Joi.string().optional(), error: Joi.alternatives().try(Joi.string(), Joi.object()).optional(), finishedAt: Joi.alternatives().try(Joi.number(), Joi.date()).optional() })).required(),
  failedLastHour: Joi.number().integer().min(0).required(),
});

// Notify Templates
const notifyTemplateSchema = Joi.object({
  _id: idSchema.optional(),
  code: Joi.string().required(),
  name: Joi.string().required(),
  channel: Joi.string().valid('email', 'sms', 'telegram').default('email'),
  subject: Joi.string().required(),
  bodyHtml: Joi.string().required(),
  variables: Joi.array().items(Joi.string()).default([]),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
const notifyTemplatesListResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), items: Joi.array().items(notifyTemplateSchema).required() });
const notifyTemplateCreateRequestSchema = Joi.object({ code: Joi.string().required(), name: Joi.string().required(), subject: Joi.string().required(), bodyHtml: Joi.string().required(), variables: Joi.array().items(Joi.string()).optional() });
const notifyTemplateItemResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), item: notifyTemplateSchema.required() });

// Doc Templates
const docTemplateSchema = Joi.object({
  _id: idSchema.optional(),
  code: Joi.string().required(),
  name: Joi.string().required(),
  bodyHtml: Joi.string().required(),
  variables: Joi.array().items(Joi.string()).default([]),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
const docTemplatesListResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), items: Joi.array().items(docTemplateSchema).required() });
const docTemplateCreateRequestSchema = Joi.object({ code: Joi.string().required(), name: Joi.string().required(), bodyHtml: Joi.string().required(), variables: Joi.array().items(Joi.string()).optional() });
const docTemplateItemResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), item: docTemplateSchema.required() });

// Stock
const stockItemSchema = Joi.object({
  _id: idSchema.optional(),
  itemId: Joi.string().required(),
  qtyOnHand: Joi.number().required(),
  unit: Joi.string().allow('').optional(),
  minQty: Joi.number().min(0).optional(),
  maxQty: Joi.number().min(0).optional(),
  locked: Joi.boolean().optional(),
  createdBy: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
const stockItemsListResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), items: Joi.array().items(stockItemSchema).required() });
const stockItemCreateRequestSchema = Joi.object({ itemId: Joi.string().required(), qtyOnHand: Joi.number().optional(), unit: Joi.string().optional(), minQty: Joi.number().min(0).optional(), maxQty: Joi.number().min(0).optional() });
const stockItemCreateResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), id: Joi.string().required() });

const stockMovementSchema = Joi.object({
  _id: idSchema.optional(),
  stockItemId: Joi.string().optional(),
  itemId: Joi.string().required(),
  type: Joi.string().valid('receipt','issue','adjust').required(),
  qty: Joi.number().required(),
  note: Joi.string().allow('').optional(),
  source: Joi.object().optional(),
  createdBy: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  createdAt: Joi.date().optional(),
});
const stockMovementsListResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), items: Joi.array().items(stockMovementSchema).required() });
const stockMovementCreateRequestSchema = Joi.object({ itemId: Joi.string().required(), type: Joi.string().valid('receipt','issue','adjust').required(), qty: Joi.number().required(), note: Joi.string().optional(), source: Joi.object({ kind: Joi.string().valid('order','manual','supplier','system').optional(), id: Joi.string().optional() }).optional() });
const stockMovementItemResponseSchema = Joi.object({ ok: Joi.boolean().valid(true).required(), item: stockMovementSchema.required() });

module.exports = {
  // Enums
  ACTION_TYPES, CHANNELS, GROUPS,
  // Statuses
  orderStatusActionSchema,
  orderStatusSchema,
  groupedStatusesResponseSchema,
  createStatusRequestSchema,
  updateStatusRequestSchema,
  reorderItemSchema,
  statusesReorderRequestSchema,
  statusesReorderResponseSchema,
  // Orders
  orderStatusLogSchema,
  orderStatusLogsResponseSchema,
  changeStatusResponseDevSchema,
  orderFilesResponseSchema,
  // Payments
  paymentCreateRequestSchema,
  paymentCreateResponseSchema,
  // Cash
  cashRegisterSchema,
  cashListResponseSchema,
  cashCreateRequestSchema,
  cashItemResponseSchema,
  // Queue
  queueMetricsResponseSchema,
  // Templates
  notifyTemplateSchema,
  notifyTemplatesListResponseSchema,
  notifyTemplateCreateRequestSchema,
  notifyTemplateItemResponseSchema,
  docTemplateSchema,
  docTemplatesListResponseSchema,
  docTemplateCreateRequestSchema,
  docTemplateItemResponseSchema,
  // Stock
  stockItemSchema,
  stockItemsListResponseSchema,
  stockItemCreateRequestSchema,
  stockItemCreateResponseSchema,
  stockMovementSchema,
  stockMovementsListResponseSchema,
  stockMovementCreateRequestSchema,
  stockMovementItemResponseSchema,
};