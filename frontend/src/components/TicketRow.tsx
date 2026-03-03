import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { TicketEntry, DropdownOption } from '../types';

interface TicketRowProps {
  ticket: TicketEntry;
  stages: DropdownOption[];
  flows: Record<string, DropdownOption[]>;
  results: DropdownOption[];
  onChange: (id: string, field: keyof TicketEntry, value: string) => void;
  onRemove: (id: string) => void;
}

export default function TicketRow({
  ticket,
  stages,
  flows,
  results,
  onChange,
  onRemove,
}: TicketRowProps) {
  const stageSelected = !!ticket.stage;
  const availableFlows = stageSelected ? (flows[ticket.stage] ?? []) : [];
  const stageComingSoon = stageSelected && availableFlows.length === 0;
  const flowDisabled = !stageSelected || stageComingSoon;
  const flowSelected = !!ticket.flow;
  const resultDisabled = !flowSelected;
  const resultSelected = !!ticket.result;

  const handleStageChange = (value: string) => {
    onChange(ticket.id, 'stage', value);
    // Reset downstream selections when stage changes
    onChange(ticket.id, 'flow', '');
    onChange(ticket.id, 'result', '');
  };

  const handleFlowChange = (value: string) => {
    onChange(ticket.id, 'flow', value);
    // Reset result when flow changes
    onChange(ticket.id, 'result', '');
  };

  return (
    <TableRow>
      <TableCell>
        <TextField
          value={ticket.ticket_key}
          onChange={(e) => onChange(ticket.id, 'ticket_key', e.target.value)}
          placeholder="PROJ-123"
          size="small"
          fullWidth
          variant="outlined"
        />
      </TableCell>

      <TableCell>
        <FormControl size="small" fullWidth>
          <InputLabel>Stage</InputLabel>
          <Select
            value={ticket.stage}
            label="Stage"
            onChange={(e) => handleStageChange(e.target.value)}
          >
            {stages.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </TableCell>

      <TableCell>
        <FormControl size="small" fullWidth disabled={flowDisabled}>
          <InputLabel>Flow</InputLabel>
          {stageComingSoon ? (
            <Select value="" label="Flow" disabled>
              <MenuItem value="">Coming Soon</MenuItem>
            </Select>
          ) : (
            <Select
              value={ticket.flow}
              label="Flow"
              onChange={(e) => handleFlowChange(e.target.value)}
            >
              {availableFlows.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
        {stageComingSoon && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
            Flows for {ticket.stage} coming soon
          </Typography>
        )}
      </TableCell>

      <TableCell>
        <FormControl size="small" fullWidth disabled={resultDisabled}>
          <InputLabel>Result</InputLabel>
          <Select
            value={ticket.result}
            label="Result"
            onChange={(e) => onChange(ticket.id, 'result', e.target.value)}
          >
            {results.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </TableCell>

      <TableCell>
        <TextField
          value={ticket.failing_cmd}
          onChange={(e) => onChange(ticket.id, 'failing_cmd', e.target.value)}
          placeholder="50 char limit"
          size="small"
          fullWidth
          variant="outlined"
          inputProps={{ maxLength: 50 }}
        />
      </TableCell>

      <TableCell>
        <TextField
          value={ticket.comment}
          onChange={(e) => onChange(ticket.id, 'comment', e.target.value)}
          placeholder="Comment..."
          size="small"
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          variant="outlined"
        />
      </TableCell>

      <TableCell align="center">
        <Tooltip title="Remove ticket">
          <IconButton size="small" color="error" onClick={() => onRemove(ticket.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
