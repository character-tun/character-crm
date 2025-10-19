import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';

const OrdersTable = ({ orders }) => {
  return (
    <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
      <Table
        stickyHeader
        aria-label="orders table"
        sx={(theme) => ({
          '& tbody tr:nth-of-type(odd)': { backgroundColor: alpha(theme.palette.primary.main, 0.035) },
          '& tbody tr:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.085) },
        })}
      >
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Клиент</TableCell>
            <TableCell>Дата</TableCell>
            <TableCell align="right">Сумма</TableCell>
            <TableCell>Статус</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell component="th" scope="row">
                {order.id}
              </TableCell>
              <TableCell>{order.customer}</TableCell>
              <TableCell>{order.date}</TableCell>
              <TableCell align="right">₽{order.amount}</TableCell>
              <TableCell>{order.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default OrdersTable;