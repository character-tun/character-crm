import * as React from 'react';
import { FormControl, FormLabel, FormHelperText, Box } from '@mui/material';

export type FormFieldProps = {
  label?: React.ReactNode;
  errorText?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  fullWidth?: boolean;
  sx?: any;
  children: React.ReactNode;
};

const FormField: React.FC<FormFieldProps> = ({
  label,
  errorText,
  hint,
  required = false,
  htmlFor,
  fullWidth = true,
  sx,
  children,
}) => {
  const hasError = Boolean(errorText);
  return (
    <FormControl fullWidth={fullWidth} error={hasError} sx={{ mb: 2, ...sx }}>
      {label && (
        <FormLabel htmlFor={htmlFor} required={required} sx={{ mb: 0.5 }}>
          {label}
        </FormLabel>
      )}
      <Box sx={{ mt: label ? 0.5 : 0 }}>{children}</Box>
      <FormHelperText sx={{ minHeight: 20 }}>
        {hasError ? errorText : hint || ' '}
      </FormHelperText>
    </FormControl>
  );
};

export default FormField;