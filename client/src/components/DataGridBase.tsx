import * as React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { ruRU } from '@mui/x-data-grid/locales';

type DataGridBaseProps = React.ComponentProps<typeof DataGrid> & {
  getRowId?: (row: any) => any;
};

const DataGridBase: React.FC<DataGridBaseProps> = ({
  density = 'comfortable',
  disableColumnMenu = true,
  rowHeight = 48,
  columnHeaderHeight = 56,
  localeText = ruRU.components.MuiDataGrid.defaultProps.localeText,
  pageSizeOptions = [5, 10, 25],
  disableRowSelectionOnClick = true,
  getRowId = (row: any) => row.id ?? row._id,
  initialState,
  sx,
  ...props
}) => {
  const mergedInitialState = {
    ...initialState,
    pagination: {
      ...initialState?.pagination,
      paginationModel: {
        pageSize: initialState?.pagination?.paginationModel?.pageSize ?? 5,
        page: initialState?.pagination?.paginationModel?.page ?? 0,
      },
    },
  } as React.ComponentProps<typeof DataGrid>['initialState'];

  const mergedSx = [
    (theme: any) => ({
      '& .MuiDataGrid-columnHeaders': { fontWeight: 700 },
    }),
    sx as any,
  ];

  return (
    <DataGrid
      density={density}
      disableColumnMenu={disableColumnMenu}
      rowHeight={rowHeight}
      columnHeaderHeight={columnHeaderHeight}
      localeText={localeText}
      pageSizeOptions={pageSizeOptions}
      disableRowSelectionOnClick={disableRowSelectionOnClick}
      getRowId={getRowId}
      initialState={mergedInitialState}
      sx={mergedSx as any}
      {...props}
    />
  );
};

export default DataGridBase;