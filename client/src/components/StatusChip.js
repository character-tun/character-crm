import React from 'react';
import Chip from '@mui/material/Chip';

/**
 * Unified StatusChip component.
 * Props:
 * - status: 'draft' | 'in-progress' | 'success' | 'fail'
 * - label?: string (defaults to capitalized status)
 * - variant?: 'solid' | 'outlined'
 * - size?: 'small' | 'medium'
 */
export default function StatusChip({ status = 'draft', label, variant = 'solid', size = 'small', ...rest }) {
  const map = {
    draft: 'status-chip--draft',
    'in-progress': 'status-chip--in-progress',
    success: 'status-chip--success',
    fail: 'status-chip--fail',
  };
  const statusClass = map[status] || map.draft;
  const outlinedClass = variant === 'outlined' ? 'status-chip--outlined' : '';
  const finalLabel = label || toLabel(status);

  return (
    <Chip
      className={`status-chip ${statusClass} ${outlinedClass}`}
      label={finalLabel}
      size={size}
      {...rest}
    />
  );
}

function toLabel(value) {
  switch (value) {
    case 'in-progress':
      return 'В процессе';
    case 'success':
      return 'Успех';
    case 'fail':
      return 'Ошибка';
    case 'draft':
    default:
      return 'Черновик';
  }
}