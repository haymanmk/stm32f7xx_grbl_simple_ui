import { useCallback, useEffect, useRef, useState } from 'react';
import { inputDefinition, IODefinition, IOInformation, outputDefinition } from '@/io-definition';
import { Divider, FormControl, FormControlLabel, FormGroup, Grid, Modal, Paper, Stack, Switch } from '@mui/material';
import { Socket } from 'socket.io-client';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: '50vw',
  maxHeight: '80vh',
  overflow: 'auto',
};

export default function IOMonitor({
  open,
  socket,
  onClose,
}: {
  open: boolean;
  socket: Socket<DefaultEventsMap, DefaultEventsMap>;
  onClose: () => void;
}): React.JSX.Element {
  const [ioData, setIOData] = useState(0);
  const setIntervalIOStatus = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (open) {
        setIntervalIOStatus.current = setInterval(() => {
          commandGRBLIO(0xa2);
        }, 500);
    } else {
      if (setIntervalIOStatus.current) clearInterval(setIntervalIOStatus.current);
    }

    return () => {
      if (setIntervalIOStatus.current) clearInterval(setIntervalIOStatus.current);
    };
  }, [open]);

  const commandGRBLIO = useCallback(
    (cmd: string | number) => {
      // send a command to GRBL I/O
      if (socket.connected) {
        socket.emit('cmd', cmd);

        socket.once('data', (data: string) => {
          // parse data from string like "[IO:0x0123]"
          const regex = /\[IO:(.+)\]/;
          const match = data.match(regex);
          if (match) {
            setIOData(parseInt(match[1], 16));
          }
        });
      }
    },
    [socket]
  );

  const onIOChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const bit = parseInt(event.target.id);
      const newIOData = ioData ^ (1 << bit);
      setIOData(newIOData);
      if (event.target.checked) {
        commandGRBLIO(`M62 P${bit}`);
      } else {
        commandGRBLIO(`M63 P${bit}`);
      }
    },
    [ioData, commandGRBLIO]
  );

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="modal-io-monitor" aria-describedby="modal-io-monitor-desc">
      <Paper sx={style}>
        <FormGroup>
          <Stack direction={'column'} spacing={2} padding={2}>
            <Grid container spacing={2}>
              {Object.values(inputDefinition).map((input: IOInformation, index: number) => (
                <Grid item key={index}>
                  <FormControlLabel
                    value="top"
                    control={<Switch checked={(ioData & (1 << input.bit)) > 0} />}
                    label={input.name}
                  />
                </Grid>
              ))}
            </Grid>
            <Divider />
            <Grid container spacing={2}>
              {Object.values(outputDefinition).map((output: IOInformation, index: number) => (
                <Grid item key={index}>
                  <FormControlLabel
                    value="top"
                    control={
                      <Switch
                        id={`${output.bit}`}
                        checked={(ioData & (1 << output.bit)) > 0 !== output.invert}
                        onChange={onIOChange}
                        disabled={output.disabled}
                      />
                    }
                    label={output.name}
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </FormGroup>
      </Paper>
    </Modal>
  );
}
