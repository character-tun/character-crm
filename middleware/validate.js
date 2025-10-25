const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
  if (error) {
    const details = error.details.map((d) => d.message);
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details });
  }
  return next();
};

// Payments
const paymentCreateSchema = Joi.object({
  orderId: Joi.string().required(),
}).unknown(true);

const paymentRefundSchema = Joi.object({
  orderId: Joi.string().required(),
}).unknown(true);

const paymentPatchSchema = Joi.object({
  amount: Joi.number().greater(0),
  articlePath: Joi.array().items(Joi.string().min(1)).min(1),
  method: Joi.string(),
  cashRegisterId: Joi.string(),
  note: Joi.string(),
  locationId: Joi.string(),
}).min(1).unknown(true);

// Cash
const cashCreateSchema = Joi.object({
  code: Joi.string().trim().min(1).required(),
  name: Joi.string().trim().min(1).required(),
  defaultForLocation: Joi.boolean().optional(),
  cashierMode: Joi.string().valid('manual', 'auto').optional(),
  isSystem: Joi.boolean().optional(),
  locationId: Joi.string().optional(),
}).unknown(true);

const cashPatchSchema = Joi.object({
  code: Joi.string().trim().min(1),
  name: Joi.string().trim().min(1),
  defaultForLocation: Joi.boolean(),
  cashierMode: Joi.string().valid('manual', 'auto'),
  isSystem: Joi.boolean(),
  locationId: Joi.string().optional(),
}).min(1).unknown(true);

// Items (catalog)
const itemCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  price: Joi.number().min(0).optional(),
  unit: Joi.string().trim().optional(),
  uom: Joi.string().trim().optional(),
  type: Joi.string().valid('good', 'service').optional(),
  sku: Joi.string().trim().optional(),
  brand: Joi.string().trim().optional(),
  group: Joi.string().trim().optional(),
  attributes: Joi.object().unknown(true).optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  note: Joi.string().trim().optional(),
}).unknown(true);

const itemPatchSchema = Joi.object({
  name: Joi.string().trim().min(1),
  price: Joi.number().min(0),
  unit: Joi.string().trim(),
  uom: Joi.string().trim(),
  type: Joi.string().valid('good', 'service'),
  sku: Joi.string().trim(),
  brand: Joi.string().trim(),
  group: Joi.string().trim(),
  attributes: Joi.object().unknown(true),
  tags: Joi.array().items(Joi.string().trim()),
  note: Joi.string().trim(),
}).min(1).unknown(true);

// Stock
const stockItemCreateSchema = Joi.object({
  itemId: Joi.string().trim().required(),
  qtyOnHand: Joi.number().optional(),
  unit: Joi.string().trim().optional(),
  minQty: Joi.number().min(0).optional(),
  maxQty: Joi.number().min(0).optional(),
}).unknown(true);

const stockMovementCreateSchema = Joi.object({
  itemId: Joi.string().trim().required(),
  type: Joi.string().valid('receipt', 'issue', 'adjust').required(),
  qty: Joi.number().not(0).required(),
  locationId: Joi.string().trim().optional(),
  cost: Joi.number().min(0).optional(),
  ts: Joi.date().optional(),
  note: Joi.string().trim().optional(),
  source: Joi.object({
    kind: Joi.string().valid('order', 'manual', 'supplier', 'system').optional(),
    id: Joi.string().optional(),
  }).optional(),
}).unknown(true);

const stockTransferSchema = Joi.object({
  itemId: Joi.string().trim().required(),
  fromLocationId: Joi.string().trim().required(),
  toLocationId: Joi.string().trim().required(),
  qty: Joi.number().greater(0).required(),
  cost: Joi.number().min(0).optional(),
  ts: Joi.date().optional(),
  note: Joi.string().trim().optional(),
  source: Joi.object({
    kind: Joi.string().valid('order', 'manual', 'supplier', 'system').optional(),
    id: Joi.string().optional(),
  }).optional(),
}).unknown(true);

const stockInventorySchema = Joi.object({
  itemId: Joi.string().trim().required(),
  locationId: Joi.string().trim().required(),
  qty: Joi.number().min(0).required(),
  cost: Joi.number().min(0).optional(),
  ts: Joi.date().optional(),
  note: Joi.string().trim().optional(),
}).unknown(true);

// Shop
const shopSaleItemSchema = Joi.object({
  itemId: Joi.string().trim().optional(),
  name: Joi.string().trim().min(1).required(),
  sku: Joi.string().trim().optional(),
  unit: Joi.string().trim().optional(),
  price: Joi.number().min(0).required(),
  qty: Joi.number().greater(0).required(),
}).unknown(true);

const shopSaleCreateSchema = Joi.object({
  items: Joi.array().items(shopSaleItemSchema).min(1).required(),
  locationId: Joi.string().trim().optional(),
  method: Joi.string().trim().optional(),
  cashRegisterId: Joi.string().trim().optional(),
  note: Joi.string().trim().optional(),
}).unknown(true);

const shopSaleRefundSchema = Joi.object({
  amount: Joi.number().greater(0).optional(),
  reason: Joi.string().trim().optional(),
}).unknown(true);

module.exports = {
  validate,
  schemas: {
    paymentCreateSchema,
    paymentRefundSchema,
    paymentPatchSchema,
    cashCreateSchema,
    cashPatchSchema,
    itemCreateSchema,
    itemPatchSchema,
    stockItemCreateSchema,
    stockMovementCreateSchema,
    stockTransferSchema,
    stockInventorySchema,
    shopSaleCreateSchema,
    shopSaleRefundSchema,
  },
};
