import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import testRoutes from './routes/test.routes';
import apiRoutes from './routes/api.routes';
import loadTestRoutes from './routes/load-test.routes';
import monitoringRoutes from './routes/monitoring.routes';
import analyticsRoutes from './routes/analytics.routes';
import alertRulesRoutes from './routes/alert-rules.routes';
import { schedulerService } from './controllers/load-test.controller';
import { MonitoringWorker } from './services/monitoring.worker';

const app = express();
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const monitoringWorker = new MonitoringWorker();

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Database Health Check & API Routes
app.use('/', apiRoutes);
app.use('/api', apiRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/load-tests', loadTestRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alert-rules', alertRulesRoutes);
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
  monitoringWorker.start(10000); // 10 second polling interval
});

export default app;
