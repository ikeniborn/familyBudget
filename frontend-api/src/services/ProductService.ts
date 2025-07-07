import { BaseService } from './BaseService';
import { Product, ProductPrice, ProductNomenclature, PrismaClient } from '../generated/prisma';

interface CreateProductInput {
  name: string;
  category?: string;
  unit?: string;
  barcode?: string;
  description?: string;
}

interface CreateProductPriceInput {
  productId: number;
  supplierName?: string;
  priceValue: number;
  priceDate: Date;
}

export class ProductService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Products
  async createProduct(data: CreateProductInput): Promise<Product> {
    return this.prisma.product.create({
      data,
      include: {
        prices: true,
        nomenclatures: {
          include: {
            nomenclature: true
          }
        }
      }
    });
  }

  async getProducts(
    page: number = 1,
    limit: number = 20,
    search?: string,
    category?: string
  ): Promise<{ products: Product[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const where = {
      isActive: true,
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive' as const
        }
      }),
      ...(category && { category })
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          prices: {
            orderBy: { priceDate: 'desc' },
            take: 1
          },
          nomenclatures: {
            include: {
              nomenclature: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      this.prisma.product.count({ where })
    ]);

    return { products, total };
  }

  async getProductById(id: number): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        prices: {
          orderBy: { priceDate: 'desc' }
        },
        nomenclatures: {
          include: {
            nomenclature: true
          }
        }
      }
    });
  }

  async updateProduct(
    id: number,
    data: Partial<CreateProductInput>
  ): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        prices: true,
        nomenclatures: {
          include: {
            nomenclature: true
          }
        }
      }
    });
  }

  async deleteProduct(id: number): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false }
    });
  }

  // Product Prices
  async addPrice(data: CreateProductPriceInput, userId: string): Promise<ProductPrice> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.productPrice.create({
        data: {
          ...data,
          userId: userIdInt
        },
        include: {
          product: true,
          user: true
        }
      });
    });
  }

  async getPriceHistory(productId: number): Promise<ProductPrice[]> {
    return this.prisma.productPrice.findMany({
      where: { productId },
      include: {
        user: true
      },
      orderBy: { priceDate: 'desc' }
    });
  }

  // Product-Nomenclature Links
  async linkToNomenclature(
    productId: number,
    nomenclatureId: number
  ): Promise<ProductNomenclature> {
    return this.prisma.productNomenclature.create({
      data: {
        productId,
        nomenclatureId
      },
      include: {
        product: true,
        nomenclature: true
      }
    });
  }

  async unlinkFromNomenclature(
    productId: number,
    nomenclatureId: number
  ): Promise<ProductNomenclature> {
    return this.prisma.productNomenclature.delete({
      where: {
        productId_nomenclatureId: {
          productId,
          nomenclatureId
        }
      }
    });
  }

  // Categories
  async getCategories(): Promise<string[]> {
    const result = await this.prisma.product.findMany({
      select: { category: true },
      where: {
        isActive: true,
        category: { not: null }
      },
      distinct: ['category']
    });

    return result
      .map(item => item.category)
      .filter((category): category is string => category !== null)
      .sort();
  }

  // Bulk operations
  async createManyProducts(products: CreateProductInput[]): Promise<number> {
    const result = await this.prisma.product.createMany({
      data: products,
      skipDuplicates: true
    });
    return result.count;
  }
}