import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { User } from '@/types/user';

// Create a custom render function that includes all providers
interface AllTheProvidersProps {
  children: React.ReactNode;
  routerProps?: MemoryRouterProps;
}

// Mock user for testing
export const mockUser: User = {
  id: 1,
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  telegram_id: 123456789,
  telegram_first_name: 'Test',
  telegram_last_name: 'User',
  telegram_username: 'testuser',
  telegram_photo_url: null,
  telegram_auth_date: new Date().toISOString(),
  is_active: true,
  is_bot: false,
  language_code: 'en',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Create a test query client with default options
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children, routerProps }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter {...routerProps}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
}

// Custom render function that includes all providers
export const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } => {
  const { routerProps, ...renderOptions } = options || {};
  const user = userEvent.setup();

  return {
    user,
    ...render(ui, {
      wrapper: ({ children }) => (
        <AllTheProviders routerProps={routerProps}>{children}</AllTheProviders>
      ),
      ...renderOptions,
    }),
  };
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { userEvent };

// Custom assertions
export const expectToBeInTheDocument = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument();
};

export const expectNotToBeInTheDocument = (element: HTMLElement | null) => {
  expect(element).not.toBeInTheDocument();
};

// Wait utilities
export const waitForLoadingToFinish = async () => {
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => {
    const loadingElements = document.querySelectorAll('[aria-busy="true"]');
    expect(loadingElements.length).toBe(0);
  });
};

// Form helpers
export const fillInput = async (
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  value: string
) => {
  await user.clear(input);
  await user.type(input, value);
};

export const selectOption = async (
  user: ReturnType<typeof userEvent.setup>,
  selectElement: HTMLElement,
  optionText: string
) => {
  await user.click(selectElement);
  const option = await screen.findByText(optionText);
  await user.click(option);
};

// Mock implementations
export const mockLocalStorage = () => {
  const localStorageMock: Storage = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      },
      get length() {
        return Object.keys(store).length;
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  return localStorageMock;
};

// Date helpers
export const mockDate = (dateString: string) => {
  const RealDate = Date;
  const mockDate = new Date(dateString);
  
  // @ts-ignore
  global.Date = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        return mockDate;
      }
      // @ts-ignore
      return new RealDate(...args);
    }
    
    static now() {
      return mockDate.getTime();
    }
  };
  
  return () => {
    global.Date = RealDate;
  };
};

// Default export for convenience
export default customRender;