const mongoose = require('mongoose');
const OrderType = require('../server/models/OrderType');

(async () => {
  const id1 = new mongoose.Types.ObjectId();
  const id2 = new mongoose.Types.ObjectId();

  const ok = new OrderType({
    code: '  AbC  ',
    name: 'Valid',
    startStatusId: id1,
    allowedStatuses: [id1],
  });

  const bad = new OrderType({
    code: '  AbC  ',
    name: 'Invalid',
    startStatusId: id1,
    allowedStatuses: [id2],
  });

  const result = { ok: {}, bad: {} };

  try {
    await ok.validate();
    result.ok = { code: ok.code, validated: true };
  } catch (e) {
    result.ok = { error: e && e.name };
  }

  try {
    await bad.validate();
    result.bad = { validated: true };
  } catch (e) {
    result.bad = {
      name: e && e.name,
      hasPath: !!(e && e.errors && e.errors.startStatusId),
      message: e && e.errors && e.errors.startStatusId && e.errors.startStatusId.message,
    };
  }

  console.log(JSON.stringify(result, null, 2));
})();