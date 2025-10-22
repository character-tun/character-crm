import { useTheme } from '@mui/material';

export const useChartColors = () => {
  const t = useTheme();
  return {
    primary: t.palette.primary.main,
    grid: t.palette.mode === 'dark' ? t.palette.grey[800] : t.palette.grey[300],
    text: t.palette.text.secondary,
  };
};