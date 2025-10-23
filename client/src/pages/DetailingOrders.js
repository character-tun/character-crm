import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, MenuItem, Select
} from '@mui/material';
import FormField from '../components/FormField';

import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import AddIcon from '@mui/icons-material/Add';
import { formatCurrencyRu } from '../services/format';
import DataGridBase from '../components/DataGridBase';
import ModalBase from '../components/ModalBase';

const DetailingOrders = () => {
  const [orders, setOrders] = useState([
    { 
      id: '1', 
      client_id: '1', 
      clientName: 'Иван Петров',
      service: 'Полировка кузова', 
      status: 'В работе',
      box: 'Бокс 1',
      start: new Date('2023-04-15T10:00:00'),
      end: new Date('2023-04-15T18:00:00'),
      materials_cost: 5000,
      labor_cost: 15000,
      total: 25000
    },
    { 
      id: '2', 
      client_id: '2', 
      clientName: 'Анна Сидорова',
      service: 'Керамическое покрытие', 
      status: 'Новый',
      box: 'Бокс 2',
      start: new Date('2023-04-17T09:00:00'),
      end: new Date('2023-04-17T17:00:00'),
      materials_cost: 12000,
      labor_cost: 18000,
      total: 40000
    },
  ]);
  
  const [open, setOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    client_id: '',
    service: '',
    status: 'Новый',
    box: '',
    start: new Date(),
    end: new Date(),
    materials_cost: 0,
    labor_cost: 0,
    total: 0
  });

  // Mock clients data - would be fetched from API in real app
  const clients = [
    { id: '1', name: 'Иван Петров' },
    { id: '2', name: 'Анна Сидорова' },
    { id: '3', name: 'Сергей Иванов' },
  ];

  // Mock boxes data - would be fetched from API in real app
  const boxes = [
    { id: '1', name: 'Бокс 1' },
    { id: '2', name: 'Бокс 2' },
    { id: '3', name: 'Бокс 3' },
  ];

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewOrder({
      ...newOrder,
      [name]: value
    });
  };

  const handleDateChange = (name, value) => {
    setNewOrder({
      ...newOrder,
      [name]: value
    });
  };

  const handleSubmit = () => {
    const selectedClient = clients.find(client => client.id === newOrder.client_id);
    const selectedBox = boxes.find(box => box.id === newOrder.box);
    
    const order = {
      id: Date.now().toString(),
      ...newOrder,
      clientName: selectedClient ? selectedClient.name : '',
      box: selectedBox ? selectedBox.name : '',
      profit: newOrder.total - (newOrder.materials_cost + newOrder.labor_cost)
    };
    
    setOrders([...orders, order]);
    setNewOrder({
      client_id: '',
      service: '',
      status: 'Новый',
      box: '',
      start: new Date(),
      end: new Date(),
      materials_cost: 0,
      labor_cost: 0,
      total: 0
    });
    
    handleClose();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('ru-RU');
  };

  const columns = [
    { field: 'clientName', headerName: 'Клиент', width: 180 },
    { field: 'service', headerName: 'Услуга', width: 200 },
    { 
      field: 'status', 
      headerName: 'Статус', 
      width: 120,
      renderCell: (params) => {
        let bg;
        switch (params.value) {
          case 'Новый': bg = 'var(--status-draft)'; break;
          case 'В работе': bg = 'var(--status-in-progress)'; break;
          case 'Готов': bg = 'var(--status-success)'; break;
          case 'Выдан': bg = 'var(--status-success)'; break;
          default: bg = 'var(--color-info)';
        }
        return (
          <span style={{ 
            backgroundColor: bg, 
            color: 'var(--color-text)',
            padding: '3px 10px',
            borderRadius: 'var(--radius)',
            fontSize: '0.75rem'
          }}>
            {params.value}
          </span>
        );
      }
    },
    { field: 'box', headerName: 'Бокс', width: 100 },
    { 
      field: 'start', 
      headerName: 'Начало', 
      width: 160,
      valueFormatter: (params) => formatDate(params.value)
    },
    { 
      field: 'end', 
      headerName: 'Окончание', 
      width: 160,
      valueFormatter: (params) => formatDate(params.value)
    },
    { 
      field: 'total', 
      headerName: 'Сумма', 
      width: 120,
      valueFormatter: (params) => formatCurrencyRu(params.value)
    },
    { 
      field: 'profit', 
      headerName: 'Прибыль', 
      width: 120,
      valueGetter: (params) => params.row.total - (params.row.materials_cost + params.row.labor_cost),
      valueFormatter: (params) => formatCurrencyRu(params.value)
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Заказы на детейлинг
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleOpen}
        >
          Новый заказ
        </Button>
      </Box>

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGridBase
          rows={orders}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5, 10, 20]}
          checkboxSelection
          disableSelectionOnClick
        />
      </Paper>

      <ModalBase
        open={open}
        onClose={handleClose}
        title="Создать новый заказ"
        maxWidth="md"
        actions={(
          <React.Fragment>
            <Button onClick={handleClose}>Отмена</Button>
            <Button onClick={handleSubmit} variant="contained">Сохранить</Button>
          </React.Fragment>
        )}
      >
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <FormField label="Клиент" fullWidth>
              <Select
                name="client_id"
                value={newOrder.client_id}
                onChange={handleChange}
                fullWidth
              >
                {clients.map(client => (
                  <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>
                ))}
              </Select>
            </FormField>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField label="Услуга" fullWidth>
              <TextField
                name="service"
                fullWidth
                value={newOrder.service}
                onChange={handleChange}
              />
            </FormField>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField label="Статус" fullWidth>
              <Select
                name="status"
                value={newOrder.status}
                onChange={handleChange}
                fullWidth
              >
                <MenuItem value="Новый">Новый</MenuItem>
                <MenuItem value="В работе">В работе</MenuItem>
                <MenuItem value="Готов">Готов</MenuItem>
                <MenuItem value="Выдан">Выдан</MenuItem>
              </Select>
            </FormField>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField label="Бокс" fullWidth>
              <Select
                name="box"
                value={newOrder.box}
                onChange={handleChange}
                fullWidth
              >
                {boxes.map(box => (
                  <MenuItem key={box.id} value={box.id}>{box.name}</MenuItem>
                ))}
              </Select>
            </FormField>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField label="Начало" fullWidth>
              <DateTimePicker
                value={newOrder.start}
                onChange={(newValue) => handleDateChange('start', newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </FormField>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormField label="Окончание" fullWidth>
              <DateTimePicker
                value={newOrder.end}
                onChange={(newValue) => handleDateChange('end', newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </FormField>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormField label="Стоимость материалов" fullWidth>
              <TextField
                name="materials_cost"
                type="number"
                fullWidth
                value={newOrder.materials_cost}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <span>₽</span>,
                }}
              />
            </FormField>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormField label="Стоимость работ" fullWidth>
              <TextField
                name="labor_cost"
                type="number"
                fullWidth
                value={newOrder.labor_cost}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <span>₽</span>,
                }}
              />
            </FormField>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormField label="Итоговая сумма" fullWidth>
              <TextField
                name="total"
                type="number"
                fullWidth
                value={newOrder.total}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <span>₽</span>,
                }}
              />
            </FormField>
          </Grid>
        </Grid>
      </ModalBase>
    </Box>
  );
};

export default DetailingOrders;