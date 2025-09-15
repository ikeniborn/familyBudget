import type { Article, ArticleStats, ApiResponse } from '$lib/types';

class ArticlesService {
  private baseUrl = '/api/articles';

  async getAll(skip = 0, limit = 100, isActive?: boolean): Promise<ApiResponse<Article[]>> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString()
    });

    if (isActive !== undefined) {
      params.append('is_active', isActive.toString());
    }

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.statusText}`);
    }
    return response.json();
  }

  async getById(id: number): Promise<ApiResponse<Article>> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }
    return response.json();
  }

  async getStats(): Promise<ApiResponse<ArticleStats>> {
    const response = await fetch(`${this.baseUrl}/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch article statistics: ${response.statusText}`);
    }
    return response.json();
  }

  async create(articleData: {
    code: string;
    name: string;
    description?: string;
    is_active?: boolean;
    user_id?: number | null;
    managed_by?: number;
  }): Promise<ApiResponse<Article>> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(articleData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create article: ${response.statusText}`);
    }
    return response.json();
  }

  async update(id: number, articleData: {
    code?: string;
    name?: string;
    description?: string;
    is_active?: boolean;
    managed_by?: number;
  }): Promise<ApiResponse<Article>> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(articleData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update article: ${response.statusText}`);
    }
    return response.json();
  }

  async delete(id: number): Promise<ApiResponse<{ message: string }>> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete article: ${response.statusText}`);
    }
    return response.json();
  }

  async bulkDelete(ids: number[]): Promise<ApiResponse<{ message: string; deleted_count: number }>> {
    const response = await fetch(`${this.baseUrl}/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ article_ids: ids })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete articles: ${response.statusText}`);
    }
    return response.json();
  }
}

export const articlesService = new ArticlesService();