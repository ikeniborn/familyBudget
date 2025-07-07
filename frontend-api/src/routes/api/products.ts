import express from 'express';
import { ProductService } from '../../services/ProductService';
import prisma from '../../database/prisma';

const router = express.Router();
const productService = new ProductService(prisma);

// Middleware to get user ID from session or header
const getUserId = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.session?.user?.id || req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  req.userId = userId.toString();
  next();
};

// GET /api/products - Get products with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const category = req.query.category as string;

    const result = await productService.getProducts(page, limit, search, category);
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/categories - Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await productService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
router.post('/', async (req, res) => {
  try {
    const { name, category, unit, barcode, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const product = await productService.createProduct({
      name,
      category,
      unit,
      barcode,
      description
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { name, category, unit, barcode, description } = req.body;
    
    const product = await productService.updateProduct(productId, {
      name,
      category,
      unit,
      barcode,
      description
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    await productService.deleteProduct(productId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/:id/prices - Get price history for product
router.get('/:id/prices', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const prices = await productService.getPriceHistory(productId);
    res.json(prices);
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// POST /api/products/:id/prices - Add new price for product
router.post('/:id/prices', getUserId, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { supplierName, priceValue, priceDate } = req.body;

    if (priceValue === undefined || !priceDate) {
      return res.status(400).json({ error: 'priceValue and priceDate are required' });
    }

    const price = await productService.addPrice({
      productId,
      supplierName,
      priceValue: parseFloat(priceValue),
      priceDate: new Date(priceDate)
    }, req.userId!);

    res.status(201).json(price);
  } catch (error) {
    console.error('Error adding price:', error);
    res.status(500).json({ error: 'Failed to add price' });
  }
});

// POST /api/products/:id/nomenclatures/:nomenclatureId - Link product to nomenclature
router.post('/:id/nomenclatures/:nomenclatureId', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const nomenclatureId = parseInt(req.params.nomenclatureId);

    if (isNaN(productId) || isNaN(nomenclatureId)) {
      return res.status(400).json({ error: 'Invalid product or nomenclature ID' });
    }

    const link = await productService.linkToNomenclature(productId, nomenclatureId);
    res.status(201).json(link);
  } catch (error) {
    console.error('Error linking product to nomenclature:', error);
    res.status(500).json({ error: 'Failed to link product to nomenclature' });
  }
});

// DELETE /api/products/:id/nomenclatures/:nomenclatureId - Unlink product from nomenclature
router.delete('/:id/nomenclatures/:nomenclatureId', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const nomenclatureId = parseInt(req.params.nomenclatureId);

    if (isNaN(productId) || isNaN(nomenclatureId)) {
      return res.status(400).json({ error: 'Invalid product or nomenclature ID' });
    }

    await productService.unlinkFromNomenclature(productId, nomenclatureId);
    res.status(204).send();
  } catch (error) {
    console.error('Error unlinking product from nomenclature:', error);
    res.status(500).json({ error: 'Failed to unlink product from nomenclature' });
  }
});

// POST /api/products/bulk - Bulk create products
router.post('/bulk', async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    const count = await productService.createManyProducts(products);
    res.status(201).json({ created: count });
  } catch (error) {
    console.error('Error bulk creating products:', error);
    res.status(500).json({ error: 'Failed to bulk create products' });
  }
});

export default router;