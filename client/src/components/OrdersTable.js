import React from 'react';
import { Paper } from '@mui/material';
import DataGridBase from './DataGridBase';

const OrdersTable = ({ orders }) => {
  const columns = [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'customer', headerName: 'Клиент', flex: 1, minWidth: 160 },
    { field: 'date', headerName: 'Дата', width: 140 },
    {
      field: 'amount',
      headerName: 'Сумма',
      type: 'number',
      width: 140,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params) => `₽${params.value}`,
    },
    { field: 'status', headerName: 'Статус', width: 160 },
  ];

  return (
    <Paper sx={{ width: '100%' }}>
      <DataGridBase
        autoHeight
        rows={orders}
        columns={columns}
        checkboxSelection={false}
        disableColumnMenu
      />
    </Paper>
  );
};

export default OrdersTable;