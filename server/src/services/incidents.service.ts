import { IncidentsRepository, ListIncidentsFilters } from '../repositories/incidents.repository';

export interface ServiceResult<T = any> {
  status: number;
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class IncidentsService {
  private repository: IncidentsRepository;

  constructor() {
    this.repository = new IncidentsRepository();
  }

  /**
   * List incidents with filters and pagination.
   */
  async list(filters: ListIncidentsFilters): Promise<ServiceResult> {
    const { incidents, total } = await this.repository.findAll(filters);
    return {
      status: 200,
      success: true,
      data: incidents,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
      },
    };
  }

  /**
   * Get single incident by ID.
   */
  async getById(id: number): Promise<ServiceResult> {
    const incident = await this.repository.findById(id);
    if (!incident) {
      return {
        status: 404,
        success: false,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      };
    }
    return {
      status: 200,
      success: true,
      data: incident,
    };
  }

  /**
   * Acknowledge an incident.
   * OPEN -> ACKNOWLEDGED
   * ACKNOWLEDGED -> idempotent return, no duplicate timeline event
   * RESOLVED -> 400 error
   */
  async acknowledge(id: number, note?: string): Promise<ServiceResult> {
    const current = await this.repository.findById(id);
    if (!current) {
      return {
        status: 404,
        success: false,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      };
    }

    if (current.status === 'RESOLVED') {
      return {
        status: 400,
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Cannot acknowledge an incident that is already resolved',
        },
      };
    }

    if (current.status === 'ACKNOWLEDGED') {
      return {
        status: 200,
        success: true,
        message: 'Incident is already acknowledged',
        data: current,
      };
    }

    // Atomic transition OPEN -> ACKNOWLEDGED with timeline event
    return await this.repository.executeInTransaction(async (client) => {
      const updated = await this.repository.transitionToAcknowledged(id, client);
      if (!updated) {
        // Concurrent state update occurred
        const recheck = await this.repository.findById(id, client);
        if (recheck?.status === 'ACKNOWLEDGED') {
          return {
            status: 200,
            success: true,
            message: 'Incident is already acknowledged',
            data: recheck,
          };
        }
        return {
          status: 400,
          success: false,
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: 'Cannot acknowledge incident in its current state',
          },
        };
      }

      const description = note ? `Incident acknowledged: ${note}` : 'Incident acknowledged by user';
      await this.repository.createTimelineEvent(id, 'ACKNOWLEDGED', description, client);

      return {
        status: 200,
        success: true,
        message: 'Incident acknowledged successfully',
        data: updated,
      };
    });
  }

  /**
   * Manually resolve an incident.
   * OPEN / ACKNOWLEDGED -> RESOLVED
   * RESOLVED -> 400 error
   */
  async resolve(id: number, note?: string): Promise<ServiceResult> {
    const current = await this.repository.findById(id);
    if (!current) {
      return {
        status: 404,
        success: false,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      };
    }

    if (current.status === 'RESOLVED') {
      return {
        status: 400,
        success: false,
        error: { code: 'ALREADY_RESOLVED', message: 'Incident is already resolved' },
      };
    }

    // Atomic transition (OPEN | ACKNOWLEDGED) -> RESOLVED with timeline event
    return await this.repository.executeInTransaction(async (client) => {
      const resolved = await this.repository.transitionToResolved(id, client);
      if (!resolved) {
        // Concurrent resolution won the race
        return {
          status: 400,
          success: false,
          error: { code: 'ALREADY_RESOLVED', message: 'Incident is already resolved' },
        };
      }

      const description = note ? `Incident resolved: ${note}` : 'Incident manually resolved by user';
      await this.repository.createTimelineEvent(id, 'RESOLVED', description, client);

      return {
        status: 200,
        success: true,
        message: 'Incident resolved successfully',
        data: resolved,
      };
    });
  }

  /**
   * Add an operator note to the incident timeline.
   */
  async addNote(id: number, note: string): Promise<ServiceResult> {
    const current = await this.repository.findById(id);
    if (!current) {
      return {
        status: 404,
        success: false,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      };
    }

    const timelineEntry = await this.repository.createTimelineEvent(id, 'NOTE_ADDED', note);
    return {
      status: 201,
      success: true,
      message: 'Note added successfully',
      data: timelineEntry,
    };
  }

  /**
   * Get chronological timeline for an incident.
   */
  async getTimeline(id: number): Promise<ServiceResult> {
    const current = await this.repository.findById(id);
    if (!current) {
      return {
        status: 404,
        success: false,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      };
    }

    const timeline = await this.repository.getTimeline(id);
    return {
      status: 200,
      success: true,
      data: timeline,
    };
  }
}
