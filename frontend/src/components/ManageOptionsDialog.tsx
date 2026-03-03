import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiService } from '../services/api';
import { DropdownConfig, DropdownOption } from '../types';

interface ManageOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  config: DropdownConfig;
  onConfigChanged: () => void;
}

export default function ManageOptionsDialog({
  open,
  onClose,
  config,
  onConfigChanged,
}: ManageOptionsDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Stage add form
  const [newStageValue, setNewStageValue] = useState('');
  const [newStageLabel, setNewStageLabel] = useState('');

  // Flow add form (per stage)
  const [flowForms, setFlowForms] = useState<Record<string, { value: string; label: string }>>({});

  // Result add form
  const [newResultValue, setNewResultValue] = useState('');
  const [newResultLabel, setNewResultLabel] = useState('');

  // Reset forms when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setNewStageValue('');
      setNewStageLabel('');
      setNewResultValue('');
      setNewResultLabel('');
      setFlowForms({});
    }
  }, [open]);

  const handleAddStage = async () => {
    if (!newStageValue.trim()) return;
    setError(null);
    try {
      await apiService.addStage(
        newStageValue.trim(),
        newStageLabel.trim() || newStageValue.trim(),
      );
      setNewStageValue('');
      setNewStageLabel('');
      onConfigChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add stage';
      setError(msg);
    }
  };

  const handleRemoveStage = async (value: string) => {
    setError(null);
    try {
      await apiService.removeStage(value);
      onConfigChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to remove stage';
      setError(msg);
    }
  };

  const handleAddFlow = async (stage: string) => {
    const form = flowForms[stage];
    if (!form?.value?.trim()) return;
    setError(null);
    try {
      await apiService.addFlow(
        stage,
        form.value.trim(),
        form.label.trim() || form.value.trim(),
      );
      setFlowForms((prev) => ({ ...prev, [stage]: { value: '', label: '' } }));
      onConfigChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add flow';
      setError(msg);
    }
  };

  const handleRemoveFlow = async (stage: string, value: string) => {
    setError(null);
    try {
      await apiService.removeFlow(stage, value);
      onConfigChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to remove flow';
      setError(msg);
    }
  };

  const handleAddResult = async () => {
    if (!newResultValue.trim()) return;
    setError(null);
    try {
      await apiService.addResult(
        newResultValue.trim(),
        newResultLabel.trim() || newResultValue.trim(),
      );
      setNewResultValue('');
      setNewResultLabel('');
      onConfigChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add result';
      setError(msg);
    }
  };

  const handleRemoveResult = async (value: string) => {
    setError(null);
    try {
      await apiService.removeResult(value);
      onConfigChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to remove result';
      setError(msg);
    }
  };

  const getFlowForm = (stage: string) => flowForms[stage] || { value: '', label: '' };

  const updateFlowForm = (stage: string, field: 'value' | 'label', val: string) => {
    setFlowForms((prev) => ({
      ...prev,
      [stage]: { ...getFlowForm(stage), [field]: val },
    }));
  };

  const OptionList = ({
    items,
    onRemove,
  }: {
    items: DropdownOption[];
    onRemove: (value: string) => void;
  }) => (
    <List dense sx={{ py: 0 }}>
      {items.length === 0 && (
        <ListItem>
          <ListItemText
            primary="No options configured"
            primaryTypographyProps={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '0.85rem' }}
          />
        </ListItem>
      )}
      {items.map((opt) => (
        <ListItem
          key={opt.value}
          secondaryAction={
            <Tooltip title="Remove">
              <IconButton edge="end" size="small" color="error" onClick={() => onRemove(opt.value)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
          sx={{ py: 0.25 }}
        >
          <ListItemText
            primary={opt.label}
            secondary={opt.value !== opt.label ? `value: ${opt.value}` : undefined}
            primaryTypographyProps={{ fontSize: '0.9rem' }}
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </ListItem>
      ))}
    </List>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Manage Dropdown Options</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── Stages ──────────────────────────────────────────────────────── */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Stages
        </Typography>
        <OptionList items={config.stages} onRemove={handleRemoveStage} />
        <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label="Value"
            value={newStageValue}
            onChange={(e) => setNewStageValue(e.target.value)}
            placeholder="e.g. ATE"
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Display Label (optional)"
            value={newStageLabel}
            onChange={(e) => setNewStageLabel(e.target.value)}
            placeholder="same as value if empty"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddStage}
            disabled={!newStageValue.trim()}
          >
            Add
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* ── Flows (per Stage) ───────────────────────────────────────────── */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Flows <Chip label="per stage" size="small" sx={{ ml: 1, fontSize: '0.7rem', height: 20 }} />
        </Typography>

        {config.stages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add stages first to configure flows.
          </Typography>
        )}

        {config.stages.map((stage) => {
          const stageFlows = config.flows[stage.value] ?? [];
          const form = getFlowForm(stage.value);
          return (
            <Accordion key={stage.value} disableGutters variant="outlined" sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {stage.label}
                </Typography>
                <Chip
                  label={`${stageFlows.length} flow${stageFlows.length !== 1 ? 's' : ''}`}
                  size="small"
                  sx={{ ml: 1, fontSize: '0.7rem', height: 20 }}
                />
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <OptionList items={stageFlows} onRemove={(v) => handleRemoveFlow(stage.value, v)} />
                <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label="Value"
                    value={form.value}
                    onChange={(e) => updateFlowForm(stage.value, 'value', e.target.value)}
                    placeholder="e.g. ft1"
                    sx={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFlow(stage.value);
                    }}
                  />
                  <TextField
                    size="small"
                    label="Label (optional)"
                    value={form.label}
                    onChange={(e) => updateFlowForm(stage.value, 'label', e.target.value)}
                    placeholder="same as value"
                    sx={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFlow(stage.value);
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddFlow(stage.value)}
                    disabled={!form.value.trim()}
                  >
                    Add
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })}

        <Divider sx={{ my: 2 }} />

        {/* ── Results ─────────────────────────────────────────────────────── */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Results
        </Typography>
        <OptionList items={config.results} onRemove={handleRemoveResult} />
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            label="Value"
            value={newResultValue}
            onChange={(e) => setNewResultValue(e.target.value)}
            placeholder="e.g. Pass"
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Display Label (optional)"
            value={newResultLabel}
            onChange={(e) => setNewResultLabel(e.target.value)}
            placeholder="same as value if empty"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddResult}
            disabled={!newResultValue.trim()}
          >
            Add
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
