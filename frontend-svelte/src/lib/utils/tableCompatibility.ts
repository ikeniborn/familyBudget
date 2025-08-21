/**
 * Compatibility utilities for migrating from @tanstack/svelte-table to SimpleDataTable
 */

interface TanStackColumn<T> {
  id?: string;
  accessorKey?: keyof T;
  header?: string | (() => string);
  cell?: (info: { getValue: () => any; row: { original: T } }) => string | number;
  enableSorting?: boolean;
  size?: number;
}

interface SimpleColumn<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (item: T) => string | number;
  width?: string;
}

/**
 * Converts TanStack table column definitions to SimpleDataTable format
 */
export function convertTanStackColumns<T>(tanStackColumns: TanStackColumn<T>[]): SimpleColumn<T>[] {
  return tanStackColumns.map(col => {
    const key = col.accessorKey || (col.id as keyof T);
    if (!key) {
      throw new Error('Column must have either accessorKey or id');
    }

    let header: string;
    if (typeof col.header === 'string') {
      header = col.header;
    } else if (typeof col.header === 'function') {
      header = col.header();
    } else {
      header = String(key);
    }

    const simpleCol: SimpleColumn<T> = {
      key,
      header,
      sortable: col.enableSorting !== false, // default to true unless explicitly disabled
    };

    if (col.cell) {
      simpleCol.render = (item: T) => {
        const mockInfo = {
          getValue: () => item[key],
          row: { original: item }
        };
        return col.cell!(mockInfo);
      };
    }

    if (col.size) {
      simpleCol.width = `${col.size}px`;
    }

    return simpleCol;
  });
}

/**
 * Helper to create a simple column definition
 */
export function createColumn<T>(
  key: keyof T,
  header: string,
  options: {
    sortable?: boolean;
    render?: (item: T) => string | number;
    width?: string;
  } = {}
): SimpleColumn<T> {
  return {
    key,
    header,
    sortable: options.sortable !== false, // default to true
    ...options
  };
}

/**
 * Helper to create columns from an array of key-header pairs
 */
export function createColumns<T>(
  definitions: Array<[keyof T, string, Partial<SimpleColumn<T>>?]>
): SimpleColumn<T>[] {
  return definitions.map(([key, header, options = {}]) => ({
    key,
    header,
    sortable: options.sortable !== false,
    ...options
  }));
}

/**
 * Legacy ColumnDef type for backward compatibility
 */
export interface ColumnDef<T> {
  id?: string;
  accessorKey?: keyof T;
  header?: string | (() => string);
  cell?: (info: { getValue: () => any; row: { original: T } }) => string | number;
  enableSorting?: boolean;
  size?: number;
}

/**
 * Create column helper for legacy compatibility
 */
export function createColumnHelper<T>() {
  return {
    accessor: (key: keyof T, options: Partial<ColumnDef<T>> = {}): ColumnDef<T> => ({
      accessorKey: key,
      ...options
    }),
    display: (options: ColumnDef<T>): ColumnDef<T> => options
  };
}