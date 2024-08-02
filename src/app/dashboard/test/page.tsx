'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '@/socket';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  OutlinedInput,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { Stack, useMediaQuery, useTheme } from '@mui/system';

import GCodeEditor from '@/components/dashboard/test/gcode-editor';
import UploadingModal from '@/components/dashboard/test/uploading-modal';

const MAX_GRBL_DATA_LINES = 60;
const MAX_CMD_HISTORY = 10;

export default function Page(): React.JSX.Element {
  const theme = useTheme();
  const isLargerThanBreakpoint = useMediaQuery(theme.breakpoints.up(800));
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [grblData, setGrblData] = useState('');
  const [inputCMD, setInputCMD] = useState('');
  const [inputCMDHistory, setInputCMDHistory] = useState<string[]>([]);
  const [currentGRBLStatus, setCurrentGRBLStatus] = useState('');
  const [isModalOpenGCodeEdit, setIsModalOpenGCodeEdit] = useState(false);
  const [isModalOpenGCodeUploading, setIsModalOpenGCodeUploading] = useState(false);
  const [gcode, setGCode] = useState('');
  const grblConsoleRef = useRef<HTMLTextAreaElement>(null);
  const inputCMDRef = useRef<HTMLInputElement>(null);
  const currentInputCMDHistoryNaviIndex = useRef(-1);

  useEffect(() => {
    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('data', onData);
    socket.on('status', onStatus);
    socket.on('error', onError);
    socket.on('gcodes', onReceiveGCode);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('data', onData);
      socket.off('status', onStatus);
      socket.off('error', onError);
      socket.off('gcodes', onReceiveGCode);
    };
  }, []);

  // pin scroll to bottom by MutationObserver
  useEffect(() => {
    if (grblConsoleRef.current) {
      const callback = (mutation_list: MutationRecord[], observer: MutationObserver) => {
        for (let mutation of mutation_list) {
          if (mutation.type === 'childList') {
            if (grblConsoleRef.current) grblConsoleRef.current.scrollTo(0, grblConsoleRef.current.scrollHeight);
          }
        }
      };

      const observer = new MutationObserver(callback);
      observer.observe(grblConsoleRef.current, { childList: true });

      return () => {
        observer.disconnect();
      };
    }
  }, [grblConsoleRef.current]);

  // detect key events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (inputCMDRef.current) {
          const cmd = inputCMDRef.current.value;
          commandGRBL(cmd);
          setInputCMD('');
          currentInputCMDHistoryNaviIndex.current = -1;

          // append to command history
          setInputCMDHistory((prevHistory) => {
            const newHistory = [cmd, ...prevHistory];
            if (newHistory.length > MAX_CMD_HISTORY) {
              return newHistory.slice(0, MAX_CMD_HISTORY);
            }
            return newHistory;
          });
        }
      }
      // navigate command history
      else if (event.key === 'ArrowUp') {
        if (inputCMDHistory.length > 0) {
          if (currentInputCMDHistoryNaviIndex.current < inputCMDHistory.length - 1) {
            currentInputCMDHistoryNaviIndex.current += 1;
            setInputCMD(inputCMDHistory[currentInputCMDHistoryNaviIndex.current]);
          }
        }
      } else if (event.key === 'ArrowDown') {
        if (inputCMDHistory.length > 0) {
          if (currentInputCMDHistoryNaviIndex.current > 0) {
            currentInputCMDHistoryNaviIndex.current -= 1;
            setInputCMD(inputCMDHistory[currentInputCMDHistoryNaviIndex.current]);
          } else {
            setInputCMD('');
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputCMDRef.current, inputCMDHistory]);

  const commandGRBL = useCallback((cmd: string) => {
    // send a command to GRBL
    if (socket.connected) {
      socket.emit('cmd', cmd);
      consoleGRBL(`> ${cmd}`);
    }
  }, []);

  const onChangeInputCMD = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputCMD(event.target.value);
  }, []);

  const onChangeGCode = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setGCode(event.target.value);
  }, []);

  const onRun = useCallback(() => {
    socket.emit('run_gcode', gcode);
    // set timeout in case no response from server
    const setTimeoutID = setTimeout(() => {
      consoleGRBL('Timeout: No response from server');
      setIsModalOpenGCodeUploading(false);
    }, 3000);
    socket.once('run_gcode', () => {
      setIsModalOpenGCodeUploading(false);
      clearTimeout(setTimeoutID);
    });
    socket.once('error', (error: string) => {
      consoleGRBL(`Error: ${error}`);
      setIsModalOpenGCodeUploading(false);
      clearTimeout(setTimeoutID);
    });
    setIsModalOpenGCodeEdit(false);
    setIsModalOpenGCodeUploading(true);
  }, [gcode]);

  const onConnect = () => {
    setIsSocketConnected(true);

    // read gcode
    socket.emit('read_gcodes');
  };

  const onDisconnect = () => {
    setIsSocketConnected(false);
  };

  const onData = (data: string) => {
    // console.log(data);
    consoleGRBL(data);
  };

  const onStatus = (status: string) => {
    setCurrentGRBLStatus(status);
  };

  const onError = (error: string) => {
    consoleGRBL(`Error: ${error}`);
  };

  const onReceiveGCode = (data: string) => {
    setGCode(data);
  };

  const consoleGRBL = (data: string) => {
    setGrblData((prevData) => {
      let newData = prevData + data + '\n';
      const lines = newData.split('\n');
      if (lines.length > MAX_GRBL_DATA_LINES) {
        const newLines = lines.slice(-MAX_GRBL_DATA_LINES);
        return newLines.join('\n');
      }
      return newData;
    });
  };

  return (
    <Stack spacing={3} sx={{ height: '100%' }}>
      <div>
        <Typography variant="h4">Test</Typography>
      </div>
      {isSocketConnected ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ justifyContent: 'center', alignItems: 'stretch' }}
        >
          <Card sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 20%' }}>
            <CardHeader subheader="unit test" title="Manual" />
            <Divider />
            <CardContent sx={{ marginBottom: 'auto' }}>
              <Stack direction="column" spacing={3}>
                <Grid container spacing={3} wrap="wrap" sx={{ justifyContent: 'center' }}>
                  <Grid item>
                    <Button variant="contained" onClick={() => commandGRBL('?')}>
                      ?
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button variant="contained" onClick={() => commandGRBL('$$')}>
                      $$
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button variant="contained" onClick={() => commandGRBL('$X')}>
                      $X
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button variant="contained" onClick={() => commandGRBL('$H')}>
                      $H
                    </Button>
                  </Grid>
                  <Grid item>
                    <Button
                      variant="contained"
                      startIcon={<DescriptionRoundedIcon />}
                      onClick={() => setIsModalOpenGCodeEdit(true)}
                    >
                      G-Code
                    </Button>
                  </Grid>
                </Grid>
                <Divider variant="middle" />
                <Stack direction="row" spacing={3} sx={{ justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<KeyboardArrowUpIcon />}
                    onClick={() => commandGRBL('$J=G91 Z0.1 F100')}
                  >
                    Z+
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<KeyboardArrowUpIcon />}
                    onClick={() => commandGRBL('$J=G91 Y0.1 F100')}
                  >
                    Y+
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<KeyboardArrowDownIcon />}
                    onClick={() => commandGRBL('$J=G91 Z-0.1 F100')}
                  >
                    Z-
                  </Button>
                </Stack>
                <Stack direction="row" spacing={3} sx={{ justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<KeyboardArrowLeftIcon />}
                    onClick={() => commandGRBL('$J=G91 X0.1 F100')}
                  >
                    X+
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<KeyboardArrowDownIcon />}
                    onClick={() => commandGRBL('$J=G91 Y-0.1 F100')}
                  >
                    Y-
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<KeyboardArrowRightIcon />}
                    onClick={() => commandGRBL('$J=G91 X-0.1 F100')}
                  >
                    X-
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
            <Divider />
            <CardActions sx={{ marginTop: 0 }}>
              <Box
                component="p"
                sx={{
                  fontSize: '0.6rem',
                  lineHeight: '0.6rem',
                  ml: '0.5rem',
                  color: 'var(--mui-palette-text-secondary)',
                }}
              >
                {`Status: ${currentGRBLStatus}`}
              </Box>
            </CardActions>
          </Card>
          {isLargerThanBreakpoint && <Divider orientation="vertical" flexItem variant="middle" />}
          <Card sx={{ flex: '1 1 20%' }}>
            <CardContent>
              <Stack direction="column" spacing={3}>
                <TextField
                  inputRef={grblConsoleRef}
                  id="multiline-display"
                  multiline
                  rows={20}
                  value={grblData}
                  disabled
                  inputProps={{ style: { fontSize: '0.6rem', lineHeight: '0.8rem' } }}
                />
                <OutlinedInput
                  inputRef={inputCMDRef}
                  id="singleline-input"
                  placeholder="Type and Press Enter to Go"
                  value={inputCMD}
                  onChange={onChangeInputCMD}
                  disabled={!isSocketConnected}
                />
              </Stack>
            </CardContent>
          </Card>
          <GCodeEditor
            open={isModalOpenGCodeEdit}
            gcode={gcode}
            onChangeGCode={onChangeGCode}
            onClose={() => setIsModalOpenGCodeEdit(false)}
            onRun={onRun}
          />
          <UploadingModal open={isModalOpenGCodeUploading} onClose={() => {}} />
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ justifyContent: 'center' }}>
          <Skeleton variant="rounded" height="60vh" sx={{ flex: '1 1 20%' }} />
          <Skeleton variant="rounded" height="60vh" sx={{ flex: '1 1 20%' }} />
        </Stack>
      )}
    </Stack>
  );
}
