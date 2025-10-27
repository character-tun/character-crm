const Joi = require('joi');

// POST /api/stocks/adjust — { itemId, locationId, qty, note }
const adjustSchema = Joi.object({
  itemId: Joi.string().trim().required(),
  locationId: Joi.string().trim().required(),
  qty: Joi.number().not(0).required(),
  note: Joi.string().trim().optional(),
}).unknown(true);

// POST /api/stocks/transfer — { itemId, from, to, qty, note }
const transferSchema = Joi.object({
  itemId: Joi.string().trim().required(),
  from: Joi.string().trim().required(),
  to: Joi.string().trim().required(),
  qty: Joi.number().greater(0).required(),
  note: Joi.string().trim().optional(),
}).unknown(true);

module.exports = { adjustSchema, transferSchema };