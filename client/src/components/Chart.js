import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { useChartColors } from '../theme/useChartColors';

const Chart = ({ data, dataKey }) => {
  const theme = useTheme();
  const colors = useChartColors();
  const caption = theme.typography.caption;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis
          dataKey="name"
          stroke={colors.text}
          tick={{ fill: colors.text, fontSize: caption.fontSize, fontFamily: caption.fontFamily, fontWeight: caption.fontWeight }}
          axisLine={{ stroke: colors.grid }}
          tickLine={{ stroke: colors.grid }}
        />
        <YAxis
          stroke={colors.text}
          tick={{ fill: colors.text, fontSize: caption.fontSize, fontFamily: caption.fontFamily, fontWeight: caption.fontWeight }}
          axisLine={{ stroke: colors.grid }}
          tickLine={{ stroke: colors.grid }}
        />
        <Tooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius, color: theme.palette.text.primary }} />
        <Bar dataKey={dataKey} fill={colors.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default Chart;