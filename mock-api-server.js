/* eslint camelcase: off */
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Моковые данные
let clients = [
  {
    _id: uuidv4(),
    name: 'Иван Петров',
    phone: '+7 999 123 4567',
    vehicle: 'BMW X5',
    city: 'Москва',
    createdAt: new Date(),
  },
];

let detailingOrders = [
  {
    _id: uuidv4(),
    client_id: clients[0]._id,
    service: 'Полировка кузова',
    status: 'Новый',
    start: new Date(),
    end: new Date(Date.now() + 86400000),
    materials_cost: 5000,
    labor_cost: 10000,
    total: 15000,
    createdAt: new Date(),
  },
];

let boxes = [
  {
    _id: uuidv4(),
    name: 'Бокс 1',
    capacity: 1,
  },
];

// API маршруты для клиентов
app.get('/api/clients', (req, res) => res.json(clients));

app.get('/api/clients/:id', (req, res) => {
  const client = clients.find((c) => c._id === req.params.id);
  if (!client) {
    return res.status(404).json({ msg: 'Клиент не найден' });
  }
  return res.json(client);
});

app.post('/api/clients', (req, res) => {
  const {
    name, phone, telegram, city, vehicle, tags, notes,
  } = req.body;

  if (!name) {
    return res.status(400).json({ msg: 'Имя клиента обязательно' });
  }

  const newClient = {
    _id: uuidv4(),
    name,
    phone,
    telegram,
    city,
    vehicle,
    tags,
    notes,
    createdAt: new Date(),
  };

  clients.push(newClient);
  return res.json(newClient);
});

app.put('/api/clients/:id', (req, res) => {
  const {
    name, phone, telegram, city, vehicle, tags, notes,
  } = req.body;

  const clientIndex = clients.findIndex((c) => c._id === req.params.id);
  if (clientIndex === -1) {
    return res.status(404).json({ msg: 'Клиент не найден' });
  }

  const updatedClient = {
    ...clients[clientIndex],
    name: name || clients[clientIndex].name,
    phone: phone !== undefined ? phone : clients[clientIndex].phone,
    telegram: telegram !== undefined ? telegram : clients[clientIndex].telegram,
    city: city !== undefined ? city : clients[clientIndex].city,
    vehicle: vehicle !== undefined ? vehicle : clients[clientIndex].vehicle,
    tags: tags !== undefined ? tags : clients[clientIndex].tags,
    notes: notes !== undefined ? notes : clients[clientIndex].notes,
  };

  clients[clientIndex] = updatedClient;
  return res.json(updatedClient);
});

app.delete('/api/clients/:id', (req, res) => {
  const clientIndex = clients.findIndex((c) => c._id === req.params.id);
  if (clientIndex === -1) {
    return res.status(404).json({ msg: 'Клиент не найден' });
  }

  clients = clients.filter((c) => c._id !== req.params.id);
  return res.json({ msg: 'Клиент удален' });
});

// API маршруты для заказов на детейлинг
app.get('/api/detailing-orders', (req, res) => res.json(detailingOrders));

app.get('/api/detailing-orders/:id', (req, res) => {
  const order = detailingOrders.find((o) => o._id === req.params.id);
  if (!order) {
    return res.status(404).json({ msg: 'Заказ не найден' });
  }
  return res.json(order);
});

app.post('/api/detailing-orders', (req, res) => {
  const {
    client_id, service, status, box, start, end, materials_cost, labor_cost, total, notes,
  } = req.body;

  if (!client_id || !service) {
    return res.status(400).json({ msg: 'Клиент и услуга обязательны' });
  }

  const newOrder = {
    _id: uuidv4(),
    client_id,
    service,
    status: status || 'Новый',
    box,
    start,
    end,
    materials_cost: materials_cost || 0,
    labor_cost: labor_cost || 0,
    total: total || 0,
    notes,
    createdAt: new Date(),
  };

  detailingOrders.push(newOrder);
  return res.json(newOrder);
});

app.put('/api/detailing-orders/:id', (req, res) => {
  const {
    client_id, service, status, box, start, end, materials_cost, labor_cost, total, notes,
  } = req.body;

  const orderIndex = detailingOrders.findIndex((o) => o._id === req.params.id);
  if (orderIndex === -1) {
    return res.status(404).json({ msg: 'Заказ не найден' });
  }

  const updatedOrder = {
    ...detailingOrders[orderIndex],
    client_id: client_id || detailingOrders[orderIndex].client_id,
    service: service || detailingOrders[orderIndex].service,
    status: status || detailingOrders[orderIndex].status,
    box: box !== undefined ? box : detailingOrders[orderIndex].box,
    start: start || detailingOrders[orderIndex].start,
    end: end || detailingOrders[orderIndex].end,
    materials_cost: materials_cost !== undefined ? materials_cost : detailingOrders[orderIndex].materials_cost,
    labor_cost: labor_cost !== undefined ? labor_cost : detailingOrders[orderIndex].labor_cost,
    total: total !== undefined ? total : detailingOrders[orderIndex].total,
    notes: notes !== undefined ? notes : detailingOrders[orderIndex].notes,
  };

  detailingOrders[orderIndex] = updatedOrder;
  return res.json(updatedOrder);
});

app.delete('/api/detailing-orders/:id', (req, res) => {
  const orderIndex = detailingOrders.findIndex((o) => o._id === req.params.id);
  if (orderIndex === -1) {
    return res.status(404).json({ msg: 'Заказ не найден' });
  }

  detailingOrders = detailingOrders.filter((o) => o._id !== req.params.id);
  return res.json({ msg: 'Заказ удален' });
});

// API маршруты для боксов
app.get('/api/boxes', (req, res) => res.json(boxes));

app.get('/api/boxes/:id', (req, res) => {
  const box = boxes.find((b) => b._id === req.params.id);
  if (!box) {
    return res.status(404).json({ msg: 'Бокс не найден' });
  }
  return res.json(box);
});

app.post('/api/boxes', (req, res) => {
  const { name, capacity } = req.body;

  if (!name) {
    return res.status(400).json({ msg: 'Название бокса обязательно' });
  }

  const newBox = {
    _id: uuidv4(),
    name,
    capacity: capacity || 1,
  };

  boxes.push(newBox);
  return res.json(newBox);
});

app.put('/api/boxes/:id', (req, res) => {
  const { name, capacity } = req.body;

  const boxIndex = boxes.findIndex((b) => b._id === req.params.id);
  if (boxIndex === -1) {
    return res.status(404).json({ msg: 'Бокс не найден' });
  }

  const updatedBox = {
    ...boxes[boxIndex],
    name: name || boxes[boxIndex].name,
    capacity: capacity !== undefined ? capacity : boxes[boxIndex].capacity,
  };

  boxes[boxIndex] = updatedBox;
  return res.json(updatedBox);
});

app.delete('/api/boxes/:id', (req, res) => {
  const boxIndex = boxes.findIndex((b) => b._id === req.params.id);
  if (boxIndex === -1) {
    return res.status(404).json({ msg: 'Бокс не найден' });
  }

  boxes = boxes.filter((b) => b._id !== req.params.id);
  return res.json({ msg: 'Бокс удален' });
});

// Базовый маршрут для тестирования
app.get('/api/test', (req, res) => res.json({ msg: 'API работает (моковая версия)' }));

const PORT = 5002;

app.listen(PORT, () => console.log(`Моковый API-сервер запущен на порту ${PORT}`));
