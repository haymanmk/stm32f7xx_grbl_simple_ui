import * as React from 'react';
import { Button, Modal, OutlinedInput, Paper, Stack } from '@mui/material';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
};

export default function GCodeEditor({
  open,
  gcode,
  onChangeGCode,
  onClose,
  onRun,
}: {
  open: boolean;
  gcode: string;
  onChangeGCode: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
            rows={20}
            value={gcode}
            onChange={onChangeGCode}
          />
          <Button variant="contained" onClick={onRun}>
            RUN
          </Button>
        </Stack>
      </Paper>
    </Modal>
  );
}
