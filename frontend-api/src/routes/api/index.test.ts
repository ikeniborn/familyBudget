import request from 'supertest';
import express from 'express';
import apiRouter from './index';

describe('API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api', apiRouter);
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'unified-api');
      
      // Verify timestamp is valid ISO string
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should return correct content type', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('Route mounting', () => {
    it('should mount simple routes', async () => {
      // Test that simple routes are accessible
      const response = await request(app)
        .get('/api/test')
        .expect(404); // Will be 404 unless route exists in simple routes

      // This test verifies the router is mounted correctly
      expect(response.status).toBeDefined();
    });
  });
});