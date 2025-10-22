const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const details = error.details.map((d) => d.message);
    return res.status(400).json({
      ok: false,
      error: 'VALIDATION_ERROR',
      details,
    });
  }

  return next();
};

// Schemas: payments
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

// Schemas: cash
const cashCreateSchema = Joi.object({
  code: Joi.string().trim().min(1).required(),
  name: Joi.string().trim().min(1).required(),
  defaultForLocation: Joi.boolean().optional(),
  cashierMode: Joi.string().valid('open', 'strict').optional(),
  isSystem: Joi.boolean().optional(),
}).unknown(true);

const cashPatchSchema = Joi.object({
  code: Joi.string().trim().min(1),
  name: Joi.string().trim().min(1),
  defaultForLocation: Joi.boolean(),
  cashierMode: Joi.string().valid('open', 'strict'),
  isSystem: Joi.boolean(),
}).min(1).unknown(true);

module.exports = {
  validate,
  schemas: {
    paymentCreateSchema,
    paymentRefundSchema,
    paymentPatchSchema,
    cashCreateSchema,
    cashPatchSchema,
  },
};
