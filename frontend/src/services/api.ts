import axios, { AxiosInstance } from 'axios';
import {
  DropdownConfig,
  LabelCheckResult,
  BulkUpdateResponse,
  TicketEntry,
  AuditEntry,
  AssigneeUser,
  AssigneeTicketEntry,
  BulkAssigneeUpdateResponse,
  CurrentAssigneeInfo,
  JiraSearchUser,
} from '../types';

const API_BASE_URL = '/ticket-tracker-api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('tt_auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('tt_auth_token');
          localStorage.removeItem('tt_user');
          // Pass expired flag so LoginPage auto-triggers silent re-auth
          window.location.href = '/ticket-tracker/login?expired=true';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async getAuthUrl(): Promise<{ auth_url: string }> {
    const response = await this.client.get('/api/auth/login');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  async logout() {
    const token = localStorage.getItem('tt_auth_token');
    if (token) {
      await this.client.post('/api/auth/logout', { token });
    }
    localStorage.removeItem('tt_auth_token');
    localStorage.removeItem('tt_user');
  }

  // Config
  async getDropdownConfig(): Promise<DropdownConfig> {
    const response = await this.client.get('/api/tickets/config');
    return response.data;
  }

  // Dropdown option management
  async addStage(value: string, label: string) {
    const response = await this.client.post('/api/tickets/config/stages', { value, label });
    return response.data;
  }

  async removeStage(value: string) {
    await this.client.delete(`/api/tickets/config/stages/${encodeURIComponent(value)}`);
  }

  async addFlow(stage: string, value: string, label: string) {
    const response = await this.client.post(`/api/tickets/config/flows/${encodeURIComponent(stage)}`, { value, label });
    return response.data;
  }

  async removeFlow(stage: string, value: string) {
    await this.client.delete(`/api/tickets/config/flows/${encodeURIComponent(stage)}/${encodeURIComponent(value)}`);
  }

  async addResult(value: string, label: string) {
    const response = await this.client.post('/api/tickets/config/results', { value, label });
    return response.data;
  }

  async removeResult(value: string) {
    await this.client.delete(`/api/tickets/config/results/${encodeURIComponent(value)}`);
  }

  // Ticket operations
  async checkLabels(tickets: TicketEntry[]): Promise<{ results: LabelCheckResult[] }> {
    const payload = tickets.map((t) => ({
      ticket_key: t.ticket_key,
      stage: t.stage,
      flow: t.flow,
      result: t.result,
      failing_cmd: t.failing_cmd,
    }));
    const response = await this.client.post('/api/tickets/check-labels', {
      tickets: payload,
    });
    return response.data;
  }

  async getTicketLabels(ticketKey: string) {
    const response = await this.client.get(`/api/tickets/${ticketKey}/labels`);
    return response.data;
  }

  async bulkUpdateTickets(tickets: TicketEntry[]): Promise<BulkUpdateResponse> {
    const payload = tickets.map((t) => ({
      ticket_key: t.ticket_key,
      stage: t.stage,
      flow: t.flow,
      result: t.result,
      failing_cmd: t.failing_cmd,
      comment: t.comment,
      label_action: t.label_action,
    }));
    const response = await this.client.post(
      '/api/tickets/update',
      { tickets: payload },
      { timeout: 120000 }
    );
    return response.data;
  }

  // Audit history
  async getHistory(limit = 200, offset = 0, actions?: string[]): Promise<{ entries: AuditEntry[]; total: number }> {
    const params: Record<string, unknown> = { limit, offset };
    if (actions && actions.length > 0) {
      params.actions = actions;
    }
    const response = await this.client.get('/api/tickets/history', {
      params,
      paramsSerializer: (p) => {
        const parts: string[] = [];
        for (const [key, val] of Object.entries(p)) {
          if (Array.isArray(val)) {
            val.forEach((v) => parts.push(`${key}=${encodeURIComponent(v)}`));
          } else {
            parts.push(`${key}=${encodeURIComponent(String(val))}`);
          }
        }
        return parts.join('&');
      },
    });
    return response.data;
  }

  // ── Assignee Users ────────────────────────────────────────────────────────

  async getAssigneeUsers(): Promise<AssigneeUser[]> {
    const response = await this.client.get('/api/assignees/users');
    return response.data;
  }

  async addAssigneeUser(display_name: string, username: string, email: string): Promise<AssigneeUser> {
    const response = await this.client.post('/api/assignees/users', {
      display_name,
      username,
      email,
    });
    return response.data;
  }

  async removeAssigneeUser(userId: number): Promise<void> {
    await this.client.delete(`/api/assignees/users/${userId}`);
  }

  // ── Assignee Bulk Update ──────────────────────────────────────────────────

  async bulkUpdateAssignees(
    tickets: AssigneeTicketEntry[]
  ): Promise<BulkAssigneeUpdateResponse> {
    const payload = tickets.map((t) => ({
      ticket_key: t.ticket_key,
      assignee_username: t.assignee_username,
      account_id: t.assignee_account_id || undefined,
      comment: t.comment,
    }));
    const response = await this.client.post(
      '/api/assignees/update',
      { tickets: payload },
      { timeout: 120000 }
    );
    return response.data;
  }

  async searchJiraUsers(query: string): Promise<JiraSearchUser[]> {
    const response = await this.client.get('/api/assignees/search-jira', {
      params: { query },
    });
    return response.data;
  }

  async getCurrentAssignees(
    ticketKeys: string[]
  ): Promise<{ results: CurrentAssigneeInfo[] }> {
    const response = await this.client.post(
      '/api/assignees/current-assignees',
      { ticket_keys: ticketKeys },
      { timeout: 60000 }
    );
    return response.data;
  }
}

export const apiService = new ApiService();
