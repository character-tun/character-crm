const Joi = require('joi');

const clientSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Имя клиента обязательно для заполнения',
    'any.required': 'Имя клиента обязательно для заполнения'
  }),
  phone: Joi.string().allow(''),
  telegram: Joi.string().allow(''),
  city: Joi.string().allow(''),
  vehicle: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string()),
  notes: Joi.string().allow('')
});

module.exports = clientSchema;