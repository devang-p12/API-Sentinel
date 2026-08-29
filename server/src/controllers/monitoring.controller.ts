import { Request, Response } from 'express';
import { MonitoringService } from '../services/monitoring.service';

export class MonitoringController {
  private service: MonitoringService;

  constructor() {
    this.service = new MonitoringService();
  }

  async updateConfig(req: Request, res: Response) {
    try {
      const apiId = parseInt(req.params.apiId, 10);
      if (isNaN(apiId)) {
        return res.status(400).json({ error: 'Invalid API ID' });
      }
      
      const config = {
        monitoringEnabled: req.body.monitoringEnabled === true,
        monitoringInterval: parseInt(req.body.monitoringInterval, 10) || 60,
        timeout: parseInt(req.body.timeout, 10) || 5000,
        degradedThresholdMs: parseInt(req.body.degradedThresholdMs, 10) || 1000
      };

      const updated = await this.service.updateConfig(apiId, config);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating monitoring config:', error);
      res.status(500).json({ error: 'Failed to update monitoring config' });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      const apiId = parseInt(req.params.apiId, 10);
      if (isNaN(apiId)) {
        return res.status(400).json({ error: 'Invalid API ID' });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const logs = await this.service.getLogs(apiId, limit);
      res.json(logs);
    } catch (error: any) {
      console.error('Error fetching monitoring logs:', error);
      res.status(500).json({ error: 'Failed to fetch monitoring logs' });
    }
  }

  async getDashboardStats(req: Request, res: Response) {
    try {
      const stats = await this.service.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }

  async getApiHealthList(req: Request, res: Response) {
    try {
      const { environment, status } = req.query;
      const list = await this.service.getApiHealthList({
        environment: environment as string,
        status: status as string
      });
      res.json(list);
    } catch (error: any) {
      console.error('Error fetching API health list:', error);
      res.status(500).json({ error: 'Failed to fetch API health list' });
    }
  }

  async getApiHealthDetails(req: Request, res: Response) {
    try {
      const apiId = parseInt(req.params.apiId, 10);
      if (isNaN(apiId)) {
        return res.status(400).json({ error: 'Invalid API ID' });
      }
      
      const details = await this.service.getApiHealthDetails(apiId);
      res.json(details);
    } catch (error: any) {
      console.error('Error fetching API health details:', error);
      res.status(500).json({ error: 'Failed to fetch API health details' });
    }
  }
}
