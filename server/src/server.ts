import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import testRoutes from './routes/test.routes';
import apiRoutes from './routes/api.routes';
import loadTestRoutes from './routes/load-test.routes';
import { schedulerService } from './controllers/load-test.controller';

const app = express();
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Database Health Check & API Routes
app.use('/', apiRoutes);
app.use('/api', apiRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/load-tests', loadTestRoutes);
app.use('/load-tests', loadTestRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 API Sentinel Proxy Server running on port ${PORT}`);
  console.log(`CORS allowed for: ${FRONTEND_URL}`);
  schedulerService.init();
});

export default app;
