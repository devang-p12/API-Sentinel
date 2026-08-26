import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import testRoutes from './routes/test.routes';

const app = express();
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Routes
app.use('/api/tests', testRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 API Sentinel Proxy Server running on port ${PORT}`);
  console.log(`CORS allowed for: ${FRONTEND_URL}`);
});

export default app;
