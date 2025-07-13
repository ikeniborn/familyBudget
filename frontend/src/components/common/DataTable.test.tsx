import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { DataTable } from './DataTable';
import { ColumnDef } from '@tanstack/react-table';

interface TestData {
  id: number;
  name: string;
  age: number;
  email: string;
}

const testData: TestData[] = [
  { id: 1, name: 'John Doe', age: 30, email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', age: 25, email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', age: 35, email: 'bob@example.com' },
  { id: 4, name: 'Alice Brown', age: 28, email: 'alice@example.com' },
  { id: 5, name: 'Charlie Wilson', age: 32, email: 'charlie@example.com' },
];

const columns: ColumnDef<TestData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'age',
    header: 'Age',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
];

describe('DataTable', () => {
  it('should render table with data', () => {
    customRender(<DataTable data={testData} columns={columns} />);

    // Check headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();

    // Check data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should show "Нет данных" when data is empty', () => {
    customRender(<DataTable data={[]} columns={columns} />);

    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });

  it('should render search input by default', () => {
    customRender(<DataTable data={testData} columns={columns} />);

    const searchInput = screen.getByPlaceholderText('Поиск...');
    expect(searchInput).toBeInTheDocument();
  });

  it('should filter data when searching', async () => {
    const { user } = customRender(<DataTable data={testData} columns={columns} />);

    const searchInput = screen.getByPlaceholderText('Поиск...');
    await user.type(searchInput, 'John');

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('should use custom search placeholder', () => {
    customRender(
      <DataTable 
        data={testData} 
        columns={columns} 
        searchPlaceholder="Search users..."
      />
    );

    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
  });

  it('should hide search when showSearch is false', () => {
    customRender(
      <DataTable 
        data={testData} 
        columns={columns} 
        showSearch={false}
      />
    );

    expect(screen.queryByPlaceholderText('Поиск...')).not.toBeInTheDocument();
  });

  it('should sort data when clicking column header', async () => {
    const { user } = customRender(<DataTable data={testData} columns={columns} />);

    const ageHeader = screen.getByText('Age');
    
    // Get initial order
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('30'); // John's age

    // Click to sort ascending
    await user.click(ageHeader);

    await waitFor(() => {
      const sortedRows = screen.getAllByRole('row');
      expect(sortedRows[1]).toHaveTextContent('25'); // Jane's age (youngest)
    });

    // Click again to sort descending
    await user.click(ageHeader);

    await waitFor(() => {
      const sortedRows = screen.getAllByRole('row');
      expect(sortedRows[1]).toHaveTextContent('35'); // Bob's age (oldest)
    });
  });

  it('should show sort indicators', async () => {
    const { user } = customRender(<DataTable data={testData} columns={columns} />);

    const nameHeader = screen.getByText('Name');
    
    // Initially should show unsorted indicator
    expect(nameHeader.parentElement?.querySelector('.lucide-chevrons-up-down')).toBeInTheDocument();

    // Click to sort ascending
    await user.click(nameHeader);
    expect(nameHeader.parentElement?.querySelector('.lucide-chevron-up')).toBeInTheDocument();

    // Click to sort descending
    await user.click(nameHeader);
    expect(nameHeader.parentElement?.querySelector('.lucide-chevron-down')).toBeInTheDocument();
  });

  it('should not show pagination for single page', () => {
    customRender(
      <DataTable 
        data={testData} 
        columns={columns} 
        pageSize={10}
      />
    );

    expect(screen.queryByText('Назад')).not.toBeInTheDocument();
    expect(screen.queryByText('Вперед')).not.toBeInTheDocument();
  });

  it('should show pagination when data exceeds page size', () => {
    const largeData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      age: 20 + i,
      email: `user${i + 1}@example.com`,
    }));

    customRender(
      <DataTable 
        data={largeData} 
        columns={columns} 
        pageSize={10}
      />
    );

    expect(screen.getByText('Назад')).toBeInTheDocument();
    expect(screen.getByText('Вперед')).toBeInTheDocument();
    expect(screen.getByText(/Показано 1 - 10 из 15/)).toBeInTheDocument();
  });

  it('should handle pagination navigation', async () => {
    const largeData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      age: 20 + i,
      email: `user${i + 1}@example.com`,
    }));

    const { user } = customRender(
      <DataTable 
        data={largeData} 
        columns={columns} 
        pageSize={10}
      />
    );

    // Initially on page 1
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.queryByText('User 11')).not.toBeInTheDocument();

    // Go to next page
    const nextButton = screen.getByText('Вперед');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.queryByText('User 1')).not.toBeInTheDocument();
      expect(screen.getByText('User 11')).toBeInTheDocument();
      expect(screen.getByText(/Показано 11 - 15 из 15/)).toBeInTheDocument();
    });

    // Go back to previous page
    const prevButton = screen.getByText('Назад');
    await user.click(prevButton);

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.queryByText('User 11')).not.toBeInTheDocument();
    });
  });

  it('should disable pagination buttons appropriately', async () => {
    const largeData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      age: 20 + i,
      email: `user${i + 1}@example.com`,
    }));

    const { user } = customRender(
      <DataTable 
        data={largeData} 
        columns={columns} 
        pageSize={10}
      />
    );

    const prevButton = screen.getByText('Назад');
    const nextButton = screen.getByText('Вперед');

    // On first page, prev should be disabled
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Go to last page
    await user.click(nextButton);

    await waitFor(() => {
      expect(prevButton).not.toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  it('should hide pagination when showPagination is false', () => {
    const largeData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      age: 20 + i,
      email: `user${i + 1}@example.com`,
    }));

    customRender(
      <DataTable 
        data={largeData} 
        columns={columns} 
        pageSize={10}
        showPagination={false}
      />
    );

    expect(screen.queryByText('Назад')).not.toBeInTheDocument();
    expect(screen.queryByText('Вперед')).not.toBeInTheDocument();
  });

  it('should handle custom column rendering', () => {
    const customColumns: ColumnDef<TestData>[] = [
      {
        accessorKey: 'name',
        header: 'Full Name',
        cell: ({ row }) => <strong>{row.getValue('name')}</strong>,
      },
      {
        accessorKey: 'age',
        header: () => <span className="text-red-500">Age</span>,
        cell: ({ row }) => `${row.getValue('age')} years old`,
      },
    ];

    customRender(<DataTable data={testData} columns={customColumns} />);

    // Check custom header
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    const ageHeader = screen.getByText('Age');
    expect(ageHeader).toHaveClass('text-red-500');

    // Check custom cell rendering
    const johnName = screen.getByText('John Doe');
    expect(johnName.tagName).toBe('STRONG');
    expect(screen.getByText('30 years old')).toBeInTheDocument();
  });

  it('should handle columns without sorting', () => {
    const mixedColumns: ColumnDef<TestData>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: false,
      },
      {
        accessorKey: 'age',
        header: 'Age',
      },
    ];

    customRender(<DataTable data={testData} columns={mixedColumns} />);

    const nameHeader = screen.getByText('Name');
    const ageHeader = screen.getByText('Age');

    // Name header should not have cursor-pointer class
    expect(nameHeader.parentElement).not.toHaveClass('cursor-pointer');
    // Age header should have cursor-pointer class
    expect(ageHeader.parentElement).toHaveClass('cursor-pointer');

    // No sorting indicator for disabled column
    expect(nameHeader.parentElement?.querySelector('.lucide-chevrons-up-down')).not.toBeInTheDocument();
  });
});