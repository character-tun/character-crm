import React from 'react';
import { Grid, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';

/**
 * Unified FiltersBar component
 * Props:
 * - value: { dateFrom, dateTo, cashRegisterId, article, locationId, q }
 * - onChange: (nextFilters) => void
 * - cashRegisters: Array<{ _id?: string, id?: string, name: string, code?: string }>
 * - locations: string[]
 * - articles: string[] (article paths)
 * - debounceMs?: number (for search input)
 */
export default function FiltersBar({
  value = {},
  onChange,
  cashRegisters = [],
  locations = [],
  articles = [],
  debounceMs = 400,
}) {
  const { dateFrom = '', dateTo = '', cashRegisterId = '', article = '', locationId = '', q = '' } = value || {};

  const [searchInput, setSearchInput] = React.useState(q || '');
  React.useEffect(() => { setSearchInput(q || ''); }, [q]);
  React.useEffect(() => {
    const handle = setTimeout(() => {
      if ((q || '') !== (searchInput || '')) {
        const next = { ...value, q: searchInput || '' };
        onChange && onChange(next);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [searchInput, debounceMs, onChange, q, value]);

  const setField = (field, v) => {
    const next = { ...value, [field]: v };
    onChange && onChange(next);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={2}>
        <DatePicker
          label="С даты"
          value={dateFrom ? new Date(dateFrom) : null}
          onChange={(nv) => setField('dateFrom', nv ? format(new Date(nv), 'yyyy-MM-dd') : '')}
          slotProps={{ textField: { fullWidth: true } }}
        />
      </Grid>
      <Grid item xs={12} md={2}>
        <DatePicker
          label="По дату"
          value={dateTo ? new Date(dateTo) : null}
          onChange={(nv) => setField('dateTo', nv ? format(new Date(nv), 'yyyy-MM-dd') : '')}
          slotProps={{ textField: { fullWidth: true } }}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel id="fb-cash-label">Касса</InputLabel>
          <Select
            labelId="fb-cash-label"
            label="Касса"
            value={cashRegisterId}
            onChange={(e) => setField('cashRegisterId', e.target.value)}
          >
            <MenuItem value="">Все</MenuItem>
            {cashRegisters.map((c) => (
              <MenuItem key={String(c._id || c.id)} value={String(c._id || c.id)}>
                {c.name}{c.code ? ` (${c.code})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel id="fb-article-label">Статья</InputLabel>
          <Select
            labelId="fb-article-label"
            label="Статья"
            value={article}
            onChange={(e) => setField('article', e.target.value)}
          >
            <MenuItem value="">Все</MenuItem>
            {articles.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={2}>
        <FormControl fullWidth>
          <InputLabel id="fb-location-label">Локация</InputLabel>
          <Select
            labelId="fb-location-label"
            label="Локация"
            value={locationId}
            onChange={(e) => setField('locationId', e.target.value)}
          >
            <MenuItem value="">Все</MenuItem>
            {locations.map((loc) => (
              <MenuItem key={loc} value={loc}>{loc}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Поиск"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          fullWidth
        />
      </Grid>
    </Grid>
  );
}