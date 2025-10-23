import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Button, Paper, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, FormControl, InputLabel, Select, MenuItem, Stack, Checkbox, FormControlLabel
} from '@mui/material';
import DataGridBase from '../components/DataGridBase';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { format, parse } from 'date-fns';
import FormField from '../components/FormField';

const Clients = () => {
  const [clients, setClients] = useState([
    { id: '1', name: 'Иван Петров', phone: '+7 (999) 123-4567', city: 'Москва', vehicle: 'BMW X5', tags: ['VIP'] },
    { id: '2', name: 'Анна Сидорова', phone: '+7 (999) 765-4321', city: 'Санкт-Петербург', vehicle: 'Mercedes GLE', tags: ['Постоянный'] },
    { id: '3', name: 'Сергей Иванов', phone: '+7 (999) 555-7777', city: 'Москва', vehicle: 'Audi Q7', tags: ['Новый'] },
  ]);
  const navigate = useNavigate();
  
  const [open, setOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    telegram: '',
    city: '',
    vehicle: '',
    type: '',
    tags: '',
    notes: ''
  });

  const clientTypes = useMemo(() => {
    try {
      const raw = localStorage.getItem('settings_client_types');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
    return ['Individual', 'Company'];
  }, []);

  const clientFields = useMemo(() => {
    try {
      const raw = localStorage.getItem('settings_client_fields');
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr)) return arr;
    } catch {}
    return [];
  }, []);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewClient({
      ...newClient,
      [name]: value
    });
  };

  const handleSubmit = () => {
    const tagsArray = newClient.tags ? newClient.tags.split(',').map(tag => tag.trim()) : [];
    
    const client = {
      id: Date.now().toString(),
      ...newClient,
      tags: tagsArray
    };
    
    setClients([...clients, client]);
    setNewClient({
      name: '',
      phone: '',
      telegram: '',
      city: '',
      vehicle: '',
      tags: '',
      notes: ''
    });
    
    handleClose();
  };

  const columns = [
    { field: 'name', headerName: 'Имя', width: 200 },
    { field: 'type', headerName: 'Тип', width: 140, valueGetter: (params) => params.row.type || '—' },
    { field: 'phone', headerName: 'Телефон', width: 150 },
    { field: 'city', headerName: 'Город', width: 150 },
    { field: 'vehicle', headerName: 'Автомобиль', width: 150 },
    { 
      field: 'tags', 
      headerName: 'Теги', 
      width: 200,
      renderCell: (params) => (
        <Box>
          {(params.value || []).map((tag, index) => (
            <span key={index} style={{ 
              backgroundColor: 'var(--color-surfaceAlt)', 
              padding: '3px 8px',
              borderRadius: '16px',
              marginRight: '5px',
              fontSize: '0.75rem'
            }}>
              {tag}
            </span>
          ))}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 220,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => navigate(`/orders?client=${encodeURIComponent(params.row.name)}`)}>Заказы</Button>
          <Button size="small" variant="contained" onClick={() => navigate(`/payments?client=${encodeURIComponent(params.row.name)}`)}>Платежи</Button>
        </Stack>
      )
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Клиенты
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleOpen}
        >
          Добавить клиента
        </Button>
      </Box>

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGridBase
          rows={clients}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5, 10, 20]}
          checkboxSelection
          disableSelectionOnClick
        />
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Добавить нового клиента</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormField label="Имя">
                <TextField
                  name="name"
                  fullWidth
                  value={newClient.name}
                  onChange={handleChange}
                />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Телефон">
                <TextField
                  name="phone"
                  fullWidth
                  value={newClient.phone}
                  onChange={handleChange}
                />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Telegram">
                <TextField
                  name="telegram"
                  fullWidth
                  value={newClient.telegram}
                  onChange={handleChange}
                />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Город">
                <TextField
                  name="city"
                  fullWidth
                  value={newClient.city}
                  onChange={handleChange}
                />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Автомобиль">
                <TextField
                  name="vehicle"
                  fullWidth
                  value={newClient.vehicle}
                  onChange={handleChange}
                />
              </FormField>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormField label="Тип клиента">
                <Select
                  fullWidth
                  value={newClient.type || ''}
                  onChange={(e)=>setNewClient(prev=>({ ...prev, type: e.target.value }))}
                >
                  {clientTypes.map((t)=>(<MenuItem key={t} value={t}>{t}</MenuItem>))}
                </Select>
              </FormField>
            </Grid>
            {/* dynamic extra fields */}
            {clientFields.length > 0 && (
              <>
                {clientFields.map((f) => (
                  <Grid item xs={12} md={6} key={f.name}>
                    {f.type === 'checkbox' ? (
                      <FormField>
                        <FormControlLabel
                          control={<Checkbox checked={!!newClient[f.name]} onChange={(e)=>setNewClient(prev=>({ ...prev, [f.name]: e.target.checked }))} />}
                          label={f.label}
                        />
                      </FormField>
                    ) : f.type === 'date' ? (
                      <FormField label={f.label}>
                        <DatePicker
                          value={newClient[f.name] ? parse(newClient[f.name], 'yyyy-MM-dd', new Date()) : null}
                          onChange={(date) => setNewClient(prev => ({ ...prev, [f.name]: date ? format(date, 'yyyy-MM-dd') : '' }))}
                          format="dd.MM.yyyy"
                          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                        />
                      </FormField>
                    ) : (
                      <FormField label={f.label}>
                        <TextField fullWidth size="small" type={f.type === 'number' ? 'number' : 'text'} value={newClient[f.name] || ''} onChange={(e)=>setNewClient(prev=>({ ...prev, [f.name]: e.target.value }))} />
                      </FormField>
                    )}
                  </Grid>
                ))}
              </>
            )}

            <Grid item xs={12} md={6}>
              <TextField
                name="tags"
                label="Теги (через запятую)"
                fullWidth
                value={newClient.tags}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="notes"
                label="Примечания"
                fullWidth
                multiline
                rows={4}
                value={newClient.notes}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Отмена</Button>
          <Button onClick={handleSubmit} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;