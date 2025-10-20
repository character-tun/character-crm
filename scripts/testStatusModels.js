const mongoose = require('mongoose');
const OrderStatus = require('../models/OrderStatus');
const OrderStatusLog = require('../models/OrderStatusLog');

(async () => {
  let connected = false;
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/character-crm';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    connected = true;
    console.log('MongoDB connected for test');
  } catch (err) {
    console.warn('MongoDB connect failed, fallback to validation-only:', err && err.message);
  }

  try {
    // Create a valid OrderStatus
    const status = new OrderStatus({
      code: 'new',
      name: 'Новый',
      color: '#999999',
      group: 'draft',
      order: 10,
      actions: [],
      system: false,
    });

    // Create a valid OrderStatusLog
    const log = new OrderStatusLog({
      orderId: new mongoose.Types.ObjectId(),
      to: 'new',
      note: 'Создание заказа',
      actionsEnqueued: [],
    });

    if (connected) {
      await status.save();
      await log.save();
      console.log('OK: saved OrderStatus and OrderStatusLog');
    } else {
      await status.validate();
      await log.validate();
      console.log('OK: validated OrderStatus and OrderStatusLog (no DB)');
    }
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
})();
