import * as React from 'react';
import { Button, Modal, OutlinedInput, Paper, Stack, TextField } from '@mui/material';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: '50vw',
  maxHeight: '80vh',
  overflow: 'auto',
};

export default function GCodeEditor({
  open,
  gcode,
  cycles,
  onChangeGCode,
  onChangeCycles,
  onClose,
  onRun,
}: {
  open: boolean;
  gcode: string;
  cycles: number;
  onChangeGCode: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeCycles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onRun: () => void;
}): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-g-code-editor"
      aria-describedby="modal-g-code-editor-desc"
    >
      <Paper sx={style}>
        <Stack direction={'column'} spacing={2} sx={{ p: 2 }}>
          <OutlinedInput
            id="g-code-editor"
            placeholder="Paste G-Code Here"
            multiline
            rows={15}
            value={gcode}
            onChange={onChangeGCode}
          />
          <Stack direction={'row'} spacing={3} sx={{ justifyContent: 'center' }}>
            <TextField
              id="num_cycles"
              variant="outlined"
              label="Cycles"
              value={cycles}
              onChange={onChangeCycles}
              type="number"
            />
            <Button variant="contained" onClick={onRun}>
              RUN
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Modal>
  );
}
