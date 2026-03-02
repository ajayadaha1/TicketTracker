import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';
import LabelIcon from '@mui/icons-material/Label';
import CommentIcon from '@mui/icons-material/Comment';
import ErrorIcon from '@mui/icons-material/Error';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { apiService } from '../services/api';
import { TicketEntry, DropdownConfig, LabelCheckResult, BulkUpdateResponse, AuditEntry } from '../types';
import TicketRow from './TicketRow';
import LabelConflictDialog from './LabelConflictDialog';
import SubmitResultsDialog from './SubmitResultsDialog';
import AssigneeUpdater from './AssigneeUpdater';

const actionColors: Record<string, string> = {
  label_update: '#4caf50',
  comment_added: '#1976d2',
  update_failed: '#f44336',
  assignee_update: '#ff9800',
  assignee_failed: '#f44336',
  user_added: '#66bb6a',
  user_removed: '#ef5350',
};

const actionLabels: Record<string, string> = {
  label_update: 'label updated',
  comment_added: 'comment added',
  update_failed: 'update failed',
  assignee_update: 'assignee updated',
  assignee_failed: 'update failed',
  user_added: 'user added',
  user_removed: 'user removed',
};

const formatTimeAgo = (isoString: string) => {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

function ActionIcon({ action }: { action: string }) {
  const sx = { fontSize: 16 };
  switch (action) {
    case 'label_update':
      return <LabelIcon sx={sx} />;
    case 'comment_added':
      return <CommentIcon sx={sx} />;
    case 'update_failed':
      return <ErrorIcon sx={sx} />;
    case 'assignee_update':
      return <PersonIcon sx={sx} />;
    case 'assignee_failed':
      return <ErrorIcon sx={sx} />;
    case 'user_added':
      return <PersonAddIcon sx={sx} />;
    case 'user_removed':
      return <PersonRemoveIcon sx={sx} />;
    default:
      return <HistoryIcon sx={sx} />;
  }
}

let nextId = 0;
const createEmptyTicket = (): TicketEntry => ({
  id: String(++nextId),
  ticket_key: '',
  stage: '',
  flow: '',
  result: '',
  failing_cmd: '',
  comment: '',
  label_action: 'add',
});

export default function TicketUpdaterPage() {
  const [activeSection, setActiveSection] = useState<'ticket' | 'assignee'>('ticket');
  const [tickets, setTickets] = useState<TicketEntry[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [config, setConfig] = useState<DropdownConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflicts, setConflicts] = useState<LabelCheckResult[]>([]);

  // Results dialog state
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [updateResults, setUpdateResults] = useState<BulkUpdateResponse | null>(null);

  // Recent history state
  const [recentHistory, setRecentHistory] = useState<AuditEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const PAGE_SIZE = 10;

  // Label-only actions for the ticket updater history
  const LABEL_ACTIONS = ['label_update', 'comment_added', 'update_failed'];

  const loadHistory = useCallback((page: number) => {
    apiService
      .getHistory(PAGE_SIZE, page * PAGE_SIZE, LABEL_ACTIONS)
      .then((data) => {
        setRecentHistory(data.entries);
        setHistoryTotal(data.total);
        setHistoryPage(page);
      })
      .catch(() => {});
  }, []);

  // Load dropdown config and recent history on mount
  useEffect(() => {
    setLoading(true);
    apiService
      .getDropdownConfig()
      .then(setConfig)
      .catch(() => setError('Failed to load dropdown configuration'))
      .finally(() => setLoading(false));
    loadHistory(0);
  }, [loadHistory]);

  const handleAddBulkTickets = () => {
    if (!bulkInput.trim()) return;
    const keys = bulkInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const newTickets = keys.map((key) => ({
      ...createEmptyTicket(),
      ticket_key: key,
    }));
    setTickets((prev) => [...prev, ...newTickets]);
    setBulkInput('');
  };

  const handleAddSingleTicket = () => {
    setTickets((prev) => [...prev, createEmptyTicket()]);
  };

  const handleTicketChange = useCallback(
    (id: string, field: keyof TicketEntry, value: string) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
      );
    },
    []
  );

  const handleRemoveTicket = useCallback((id: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSubmit = async () => {
    setError(null);

    // Validate: all tickets must have ticket_key, stage, flow, result
    const incomplete = tickets.filter(
      (t) => !t.ticket_key || !t.stage || !t.flow || !t.result
    );
    if (incomplete.length > 0) {
      setError('All tickets must have Ticket Key, Stage, Flow, and Result filled in.');
      return;
    }

    setSubmitting(true);
    try {
      // Check for exact duplicate labels only
      const checkResponse = await apiService.checkLabels(tickets);
      const ticketsWithConflicts = checkResponse.results.filter((r) => r.has_conflict);

      if (ticketsWithConflicts.length > 0) {
        // Show conflict dialog only for exact duplicates
        setConflicts(ticketsWithConflicts);
        setConflictDialogOpen(true);
        setSubmitting(false);
        return;
      }

      // No exact duplicates - submit directly
      await doSubmit();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to check labels';
      setError(msg);
      setSubmitting(false);
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await apiService.bulkUpdateTickets(tickets);
      setUpdateResults(response);
      setResultsDialogOpen(true);

      // Clear successfully updated tickets
      const successKeys = new Set(
        response.results.filter((r) => r.success).map((r) => r.ticket_key)
      );
      setTickets((prev) => prev.filter((t) => !successKeys.has(t.ticket_key)));
      loadHistory(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update tickets';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConflictResolve = (ticketKey: string, action: 'add' | 'skip') => {
    setTickets((prev) =>
      prev.map((t) =>
        t.ticket_key === ticketKey ? { ...t, label_action: action } : t
      )
    );
  };

  const handleConflictResolveAll = (action: 'add' | 'skip') => {
    const conflictKeys = new Set(conflicts.map((c) => c.ticket_key));
    setTickets((prev) =>
      prev.map((t) =>
        conflictKeys.has(t.ticket_key) ? { ...t, label_action: action } : t
      )
    );
  };

  const handleConflictConfirm = () => {
    setConflictDialogOpen(false);
    doSubmit();
  };

  if (loading || !config) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Section Toggle ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {activeSection === 'ticket' ? 'Update Ticket' : 'Update Assignee'}
        </Typography>
        <ToggleButtonGroup
          value={activeSection}
          exclusive
          onChange={(_, v) => { if (v) setActiveSection(v); }}
          size="small"
        >
          <ToggleButton value="ticket">
            <EditIcon sx={{ mr: 0.5, fontSize: 18 }} /> Update Ticket
          </ToggleButton>
          <ToggleButton value="assignee">
            <PersonIcon sx={{ mr: 0.5, fontSize: 18 }} /> Update Assignee
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Assignee Updater Section ────────────────────────────────────────── */}
      {activeSection === 'assignee' && <AssigneeUpdater />}

      {/* ── Ticket Updater Section ──────────────────────────────────────────── */}
      {activeSection === 'ticket' && (
      <Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Bulk add section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Add Tickets
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="Enter ticket numbers separated by commas (e.g. PROJ-123, PROJ-456)"
            size="small"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddBulkTickets();
            }}
          />
          <Button
            variant="contained"
            onClick={handleAddBulkTickets}
            disabled={!bulkInput.trim()}
          >
            Add Tickets
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddSingleTicket}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Add Ticket
          </Button>
        </Box>
      </Paper>

      {/* Ticket table */}
      {tickets.length > 0 && (
        <>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 140 }}>Ticket Key</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Stage</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Flow</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Result</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Failing CMD</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Comments</TableCell>
                  <TableCell align="center" sx={{ width: 60 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    stages={config.stages}
                    flows={config.flows}
                    results={config.results}
                    onChange={handleTicketChange}
                    onRemove={handleRemoveTicket}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={handleSubmit}
              disabled={submitting || tickets.length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </Box>
        </>
      )}

      {tickets.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No tickets added yet. Use the input above to add tickets.
          </Typography>
        </Paper>
      )}

      {/* Recent Activity */}
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <HistoryIcon sx={{ fontSize: 22 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Recent Activity
        </Typography>
        {historyTotal > 0 && (
          <Chip
            label={`${historyTotal} total`}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        )}
      </Box>
      {recentHistory.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No recent activity yet.</Typography>
        </Paper>
      ) : (
        <>
          <Paper sx={{ mb: 2 }}>
            <List sx={{ py: 0 }}>
              {recentHistory.map((entry, idx) => (
                <Box key={idx}>
                  <ListItem sx={{ alignItems: 'flex-start', py: 1.5 }}>
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: actionColors[entry.action] || '#666',
                          fontSize: '0.7rem',
                        }}
                      >
                        <ActionIcon action={entry.action} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {entry.user_name}
                          </Typography>
                          <Chip
                            label={actionLabels[entry.action] || entry.action}
                            size="small"
                            sx={{
                              fontSize: '0.6rem',
                              height: 18,
                              bgcolor: `${actionColors[entry.action] || '#666'}22`,
                              color: actionColors[entry.action] || '#666',
                            }}
                          />
                          {entry.details?.includes('bulk=true') && (
                            <Chip
                              label="BULK"
                              size="small"
                              sx={{
                                fontSize: '0.55rem',
                                height: 16,
                                fontWeight: 700,
                                bgcolor: '#ff980022',
                                color: '#ff9800',
                                border: '1px solid #ff980044',
                              }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}
                          >
                            {entry.ticket_key}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          {entry.label && (
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', color: 'text.secondary', fontFamily: 'monospace' }}
                            >
                              {entry.label}
                            </Typography>
                          )}
                          {(entry.comment || entry.details) && (
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', color: 'text.secondary' }}
                            >
                              {entry.comment || entry.details}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.disabled', fontSize: '0.65rem' }}
                          >
                            {formatTimeAgo(entry.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {idx < recentHistory.length - 1 && (
                    <Divider variant="inset" component="li" />
                  )}
                </Box>
              ))}
            </List>
          </Paper>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {historyPage * PAGE_SIZE + 1}–
              {Math.min((historyPage + 1) * PAGE_SIZE, historyTotal)} of {historyTotal}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                disabled={historyPage === 0}
                onClick={() => loadHistory(historyPage - 1)}
              >
                Previous
              </Button>
              <Button
                size="small"
                disabled={(historyPage + 1) * PAGE_SIZE >= historyTotal}
                onClick={() => loadHistory(historyPage + 1)}
              >
                Next
              </Button>
            </Box>
          </Box>
        </>
      )}

      {/* Dialogs */}
      <LabelConflictDialog
        open={conflictDialogOpen}
        conflicts={conflicts}
        tickets={tickets}
        onResolve={handleConflictResolve}
        onResolveAll={handleConflictResolveAll}
        onConfirm={handleConflictConfirm}
        onCancel={() => {
          setConflictDialogOpen(false);
          setSubmitting(false);
        }}
      />

      <SubmitResultsDialog
        open={resultsDialogOpen}
        results={updateResults}
        onClose={() => setResultsDialogOpen(false)}
      />
      </Box>
      )}
    </Box>
  );
}
