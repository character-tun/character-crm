import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Chemistry = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        Химия
      </Typography>
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6">Страница в разработке</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          Здесь будет отображаться информация о химических средствах.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Chemistry;