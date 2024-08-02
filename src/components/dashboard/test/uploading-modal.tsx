import * as React from 'react';
import { Box, CircularProgress, Modal, Stack } from '@mui/material';

export default function UploadingModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="modal-uploading" aria-describedby="modal-uploading-desc">
      <Box
        sx={{
          position: 'absolute' as 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <Stack direction={'column'} spacing={2} sx={{alignItems: 'center'}}>
          <CircularProgress sx={{ color: 'var(--mui-palette-common-white)' }} />
          <Box sx={{ color: 'var(--mui-palette-common-white)', fontWeight: "bolder" }}>Uploading...</Box>
        </Stack>
      </Box>
    </Modal>
  );
}
