export interface TicketEntry {
  id: string;
  ticket_key: string;
  stage: string;
  flow: string;
  result: string;
  failing_cmd: string;
  comment: string;
  label_action: 'add' | 'skip';
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownConfig {
  stages: DropdownOption[];
  flows: Record<string, DropdownOption[]>;
  results: DropdownOption[];
}

export interface LabelCheckResult {
  ticket_key: string;
  new_label: string;
  existing_results_labels: string[];
  has_conflict: boolean;
}

export interface TicketUpdateResult {
  ticket_key: string;
  success: boolean;
  label_applied: string | null;
  comment_added: boolean;
  error: string | null;
}

export interface BulkUpdateResponse {
  results: TicketUpdateResult[];
  total: number;
  successful: number;
  failed: number;
}

export interface UserInfo {
  account_id: string;
  display_name: string;
  email: string;
  avatar_url: string;
}

export interface AuditEntry {
  timestamp: string;
  epoch: number;
  user_name: string;
  user_email: string;
  ticket_key: string;
  action: string;
  label: string;
  comment: string;
  details: string;
}

// ── Assignee Updater types ─────────────────────────────────────────────────────

export interface AssigneeUser {
  id: number;
  display_name: string;
  username: string;
  email: string;
  is_active: boolean;
}

export interface JiraSearchUser {
  account_id: string;
  display_name: string;
  email_address: string;
  avatar_url: string;
}

export interface AssigneeTicketEntry {
  id: string;
  ticket_key: string;
  assignee_username: string;
  assignee_account_id: string;
  comment: string;
}

export interface AssigneeUpdateResult {
  ticket_key: string;
  success: boolean;
  assignee_set: string | null;
  comment_added: boolean;
  error: string | null;
}

export interface BulkAssigneeUpdateResponse {
  results: AssigneeUpdateResult[];
  total: number;
  successful: number;
  failed: number;
}

export interface CurrentAssigneeInfo {
  ticket_key: string;
  display_name: string;
  account_id: string;
  error?: string;
}
