import request from 'supertest';
import express from 'express';
import { ReferenceDataService } from '../../services/ReferenceDataService';
import router from './simple';

// Mock the services
jest.mock('../../services/ReferenceDataService');
jest.mock('../../services/UserService');
jest.mock('../../services/RegistryService');
jest.mock('../../services/ProductService');
jest.mock('../../services/ReportService');

const app = express();
app.use(express.json());
app.use('/api', router);

describe('Periods API Endpoints', () => {
  let mockReferenceService: jest.Mocked<ReferenceDataService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReferenceService = require('../../services/ReferenceDataService').ReferenceDataService.prototype;
  });

  describe('GET /api/periods', () => {
    it('should return all periods', async () => {
      const mockPeriods = [
        { id: 1, date: new Date('2025-01-01'), ruName: 'Январь 2025' },
        { id: 2, date: new Date('2025-02-01'), ruName: 'Февраль 2025' }
      ];

      mockReferenceService.getPeriods.mockResolvedValue(mockPeriods);

      const response = await request(app)
        .get('/api/periods')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('period_id', 1);
      expect(response.body[0]).toHaveProperty('period_name', 'Январь 2025');
    });
  });

  describe('POST /api/periods', () => {
    it('should create a new period with year and month', async () => {
      const mockPeriod = {
        id: 3,
        date: new Date('2025-03-01'),
        ruName: 'Март 2025'
      };

      mockReferenceService.createPeriod.mockResolvedValue(mockPeriod);

      const response = await request(app)
        .post('/api/periods')
        .send({
          period_name: 'Март 2025',
          period_year: 2025,
          period_month: 3
        })
        .expect(201);

      expect(response.body).toHaveProperty('period_id', 3);
      expect(response.body).toHaveProperty('period_year', 2025);
      expect(response.body).toHaveProperty('period_month', 3);
      expect(mockReferenceService.createPeriod).toHaveBeenCalledWith({
        date: expect.any(Date),
        ruName: 'Март 2025'
      });
    });

    it('should return 400 for invalid period data', async () => {
      const response = await request(app)
        .post('/api/periods')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/periods/:id', () => {
    it('should update an existing period', async () => {
      const mockUpdatedPeriod = {
        id: 1,
        date: new Date('2025-01-01'),
        ruName: 'Январь 2025 (обновлен)'
      };

      mockReferenceService.updatePeriod.mockResolvedValue(mockUpdatedPeriod);

      const response = await request(app)
        .put('/api/periods/1')
        .send({
          period_name: 'Январь 2025 (обновлен)',
          period_year: 2025,
          period_month: 1
        })
        .expect(200);

      expect(response.body).toHaveProperty('period_id', 1);
      expect(response.body).toHaveProperty('period_name', 'Январь 2025 (обновлен)');
      expect(mockReferenceService.updatePeriod).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          date: expect.any(Date),
          ruName: 'Январь 2025 (обновлен)'
        })
      );
    });

    it('should handle update errors', async () => {
      mockReferenceService.updatePeriod.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/periods/1')
        .send({
          period_name: 'Test',
          period_year: 2025,
          period_month: 1
        })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to update period');
    });
  });

  describe('DELETE /api/periods/:id', () => {
    it('should delete an existing period', async () => {
      const mockPeriod = {
        id: 1,
        date: new Date('2025-01-01'),
        ruName: 'Январь 2025'
      };

      mockReferenceService.getPeriodById.mockResolvedValue(mockPeriod);
      mockReferenceService.deletePeriod.mockResolvedValue(mockPeriod);

      const response = await request(app)
        .delete('/api/periods/1')
        .expect(204);

      expect(response.body).toEqual({});
      expect(mockReferenceService.deletePeriod).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent period', async () => {
      mockReferenceService.getPeriodById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/periods/999')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Period not found');
      expect(mockReferenceService.deletePeriod).not.toHaveBeenCalled();
    });

    it('should return 400 when period has related transactions', async () => {
      const mockPeriod = {
        id: 1,
        date: new Date('2025-01-01'),
        ruName: 'Январь 2025'
      };

      mockReferenceService.getPeriodById.mockResolvedValue(mockPeriod);
      mockReferenceService.deletePeriod.mockRejectedValue(
        new Error('Cannot delete period: 5 related transactions exist')
      );

      const response = await request(app)
        .delete('/api/periods/1')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('related transactions');
    });
  });
});