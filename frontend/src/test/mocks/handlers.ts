import { rest } from 'msw';
import fixtures from '../fixtures';

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to create API endpoint URL
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

// Auth handlers
export const authHandlers = [
  // Login
  rest.post(apiUrl('/auth/login'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: fixtures.users.activeUser,
        token: 'mock-jwt-token',
      })
    );
  }),

  // Logout
  rest.post(apiUrl('/auth/logout'), (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ message: 'Logged out successfully' }));
  }),

  // Current user
  rest.get(apiUrl('/auth/me'), (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
    }
    return res(ctx.status(200), ctx.json(fixtures.users.activeUser));
  }),
];

// User handlers
export const userHandlers = [
  // Get all users
  rest.get(apiUrl('/users'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([fixtures.users.activeUser, fixtures.users.inactiveUser])
    );
  }),

  // Get user by ID
  rest.get(apiUrl('/users/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const user = Object.values(fixtures.users).find(u => u.id === Number(id));
    
    if (!user) {
      return res(ctx.status(404), ctx.json({ message: 'User not found' }));
    }
    
    return res(ctx.status(200), ctx.json(user));
  }),
];

// Period handlers
export const periodHandlers = [
  // Get all periods
  rest.get(apiUrl('/periods'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(Object.values(fixtures.periods))
    );
  }),

  // Get period by ID
  rest.get(apiUrl('/periods/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const period = Object.values(fixtures.periods).find(p => p.id === Number(id));
    
    if (!period) {
      return res(ctx.status(404), ctx.json({ message: 'Period not found' }));
    }
    
    return res(ctx.status(200), ctx.json(period));
  }),
];

// Financial Center handlers
export const financialCenterHandlers = [
  // Get all financial centers
  rest.get(apiUrl('/financial_centers'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(Object.values(fixtures.financialCenters))
    );
  }),

  // Get financial center by ID
  rest.get(apiUrl('/financial_centers/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const fc = Object.values(fixtures.financialCenters).find(f => f.id === Number(id));
    
    if (!fc) {
      return res(ctx.status(404), ctx.json({ message: 'Financial center not found' }));
    }
    
    return res(ctx.status(200), ctx.json(fc));
  }),
];

// Cost Center handlers
export const costCenterHandlers = [
  // Get all cost centers
  rest.get(apiUrl('/cost_centers'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(Object.values(fixtures.costCenters))
    );
  }),

  // Get cost center by ID
  rest.get(apiUrl('/cost_centers/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const cc = Object.values(fixtures.costCenters).find(c => c.id === Number(id));
    
    if (!cc) {
      return res(ctx.status(404), ctx.json({ message: 'Cost center not found' }));
    }
    
    return res(ctx.status(200), ctx.json(cc));
  }),
];

// Nomenclature handlers
export const nomenclatureHandlers = [
  // Get all nomenclatures
  rest.get(apiUrl('/nomenclatures'), (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page')) || 1;
    const limit = Number(req.url.searchParams.get('limit')) || 10;
    const search = req.url.searchParams.get('search') || '';
    
    let items = Object.values(fixtures.nomenclatures);
    
    // Apply search filter
    if (search) {
      items = items.filter(n => 
        n.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Apply pagination
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);
    
    return res(
      ctx.status(200),
      ctx.json({
        items: paginatedItems,
        total: items.length,
        page,
        pages: Math.ceil(items.length / limit),
      })
    );
  }),

  // Get nomenclature by ID
  rest.get(apiUrl('/nomenclatures/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const nomenclature = Object.values(fixtures.nomenclatures).find(n => n.id === Number(id));
    
    if (!nomenclature) {
      return res(ctx.status(404), ctx.json({ message: 'Nomenclature not found' }));
    }
    
    return res(ctx.status(200), ctx.json(nomenclature));
  }),
];

// Row Type handlers
export const rowTypeHandlers = [
  // Get all row types
  rest.get(apiUrl('/row_types'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(Object.values(fixtures.rowTypes))
    );
  }),

  // Get row type by ID
  rest.get(apiUrl('/row_types/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const rowType = Object.values(fixtures.rowTypes).find(r => r.id === Number(id));
    
    if (!rowType) {
      return res(ctx.status(404), ctx.json({ message: 'Row type not found' }));
    }
    
    return res(ctx.status(200), ctx.json(rowType));
  }),
];

// Registry handlers
export const registryHandlers = [
  // Create registry entry
  rest.post(apiUrl('/registry'), async (req, res, ctx) => {
    const body = await req.json();
    const newEntry = {
      id: Date.now(),
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    return res(ctx.status(201), ctx.json(newEntry));
  }),

  // Get last registry row
  rest.get(apiUrl('/registry/last_row'), (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.registry.factEntry));
  }),
];

// Report handlers
export const reportHandlers = [
  // Budget by nomenclature report
  rest.get(apiUrl('/report/budget/row_type_nomenclature'), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(fixtures.reports.budgetByNomenclature)
    );
  }),

  // Empty report
  rest.get(apiUrl('/report/budget/total'), (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(fixtures.reports.emptyReport));
  }),
];

// Product handlers
export const productHandlers = [
  // Get products
  rest.get(apiUrl('/products'), (req, res, ctx) => {
    const search = req.url.searchParams.get('search') || '';
    const page = Number(req.url.searchParams.get('page')) || 1;
    const limit = Number(req.url.searchParams.get('limit')) || 10;
    
    let products = Object.values(fixtures.products);
    
    // Apply search
    if (search) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.includes(search)
      );
    }
    
    // Apply pagination
    const start = (page - 1) * limit;
    const paginatedProducts = products.slice(start, start + limit);
    
    return res(
      ctx.status(200),
      ctx.json({
        items: paginatedProducts,
        total: products.length,
        page,
        pages: Math.ceil(products.length / limit),
      })
    );
  }),

  // Get product by ID
  rest.get(apiUrl('/products/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const product = Object.values(fixtures.products).find(p => p.id === Number(id));
    
    if (!product) {
      return res(ctx.status(404), ctx.json({ message: 'Product not found' }));
    }
    
    return res(ctx.status(200), ctx.json(product));
  }),

  // Create product
  rest.post(apiUrl('/products'), async (req, res, ctx) => {
    const body = await req.json();
    const newProduct = {
      id: Date.now(),
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    return res(ctx.status(201), ctx.json(newProduct));
  }),

  // Update product
  rest.put(apiUrl('/products/:id'), async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    const product = Object.values(fixtures.products).find(p => p.id === Number(id));
    
    if (!product) {
      return res(ctx.status(404), ctx.json({ message: 'Product not found' }));
    }
    
    const updatedProduct = {
      ...product,
      ...body,
      updated_at: new Date().toISOString(),
    };
    
    return res(ctx.status(200), ctx.json(updatedProduct));
  }),

  // Delete product
  rest.delete(apiUrl('/products/:id'), (req, res, ctx) => {
    const { id } = req.params;
    const product = Object.values(fixtures.products).find(p => p.id === Number(id));
    
    if (!product) {
      return res(ctx.status(404), ctx.json({ message: 'Product not found' }));
    }
    
    return res(ctx.status(204));
  }),

  // Get product prices
  rest.get(apiUrl('/products/:id/prices'), (req, res, ctx) => {
    const { id } = req.params;
    const prices = Object.values(fixtures.productPrices).filter(
      p => p.product_id === Number(id)
    );
    
    return res(ctx.status(200), ctx.json(prices));
  }),

  // Add product price
  rest.post(apiUrl('/products/:id/prices'), async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    
    const newPrice = {
      id: Date.now(),
      product_id: Number(id),
      ...body,
      created_at: new Date().toISOString(),
    };
    
    return res(ctx.status(201), ctx.json(newPrice));
  }),
];

// Combine all handlers
export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...periodHandlers,
  ...financialCenterHandlers,
  ...costCenterHandlers,
  ...nomenclatureHandlers,
  ...rowTypeHandlers,
  ...registryHandlers,
  ...reportHandlers,
  ...productHandlers,
];

// Error handlers for testing error scenarios
export const errorHandlers = {
  serverError: rest.get(apiUrl('/*'), (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ message: 'Internal server error' })
    );
  }),
  
  networkError: rest.get(apiUrl('/*'), (req, res, ctx) => {
    return res.networkError('Failed to connect');
  }),
  
  unauthorized: rest.get(apiUrl('/*'), (req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({ message: 'Unauthorized' })
    );
  }),
};

export default handlers;