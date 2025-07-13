import request from 'supertest';
import express from 'express';
import session from 'express-session';

describe('Simple API Routes - Basic Structure Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      })
    );

    // Create basic test routes to verify structure
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'test-service'
      });
    });

    app.get('/periods', (_req, res) => {
      res.json([{ period_id: 1, period_name: 'test' }]);
    });

    app.get('/test-auth', (req, res) => {
      const userId = req.session?.user?.user_id?.toString() || req.headers['x-user-id']?.toString() || null;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      res.json({ userId });
    });

    app.post('/test-validation', (req, res) => {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      res.status(201).json({ name });
    });
  });

  describe('Basic route structure', () => {
    it('should handle health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'test-service');
    });

    it('should handle GET requests with JSON response', async () => {
      const response = await request(app)
        .get('/periods')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('period_id', 1);
    });

    it('should handle authentication via header', async () => {
      const response = await request(app)
        .get('/test-auth')
        .set('x-user-id', '123')
        .expect(200);

      expect(response.body).toEqual({ userId: '123' });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/test-auth')
        .expect(401);

      expect(response.body).toEqual({ error: 'User not authenticated' });
    });

    it('should handle POST requests with validation', async () => {
      const response = await request(app)
        .post('/test-validation')
        .send({ name: 'Test Product' })
        .expect(201);

      expect(response.body).toEqual({ name: 'Test Product' });
    });

    it('should validate required fields in POST requests', async () => {
      const response = await request(app)
        .post('/test-validation')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'Name is required' });
    });
  });

  describe('Session handling', () => {
    it('should support session-based authentication', (done) => {
      const agent = request.agent(app);
      
      // Add middleware to set session
      app.use('/set-session', (req: any, res) => {
        req.session.user = { user_id: 456 };
        res.json({ sessionSet: true });
      });

      app.use('/check-session', (req: any, res) => {
        const userId = req.session?.user?.user_id?.toString() || null;
        res.json({ userId });
      });

      // Set session first
      agent
        .get('/set-session')
        .expect(200)
        .end((err) => {
          if (err) return done(err);
          
          // Check session persists
          agent
            .get('/check-session')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err);
              expect(res.body.userId).toBe('456');
              done();
            });
        });
    });
  });

  describe('Express middleware integration', () => {
    it('should parse JSON bodies', async () => {
      app.post('/echo', (req, res) => {
        res.json(req.body);
      });

      const testData = { test: 'data', number: 123 };
      const response = await request(app)
        .post('/echo')
        .send(testData)
        .expect(200);

      expect(response.body).toEqual(testData);
    });

    it('should handle query parameters', async () => {
      app.get('/query-test', (req, res) => {
        res.json({
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 10,
          search: req.query.search as string,
        });
      });

      const response = await request(app)
        .get('/query-test?page=2&limit=20&search=test')
        .expect(200);

      expect(response.body).toEqual({
        page: 2,
        limit: 20,
        search: 'test',
      });
    });
  });
});