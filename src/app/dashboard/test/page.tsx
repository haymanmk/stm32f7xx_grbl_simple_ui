'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '@/socket';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
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
import IOMonitor from '@/components/dashboard/test/io-monitor';
import UploadingModal from '@/components/dashboard/test/uploading-modal';
import { ScatterPlot } from '@/components/scatter-plot';

const MAX_GRBL_DATA_LINES = 60;
const MAX_CMD_HISTORY = 10;
const MAX_TRAJECTORY_POINTS = 1000;

export default function Page(): React.JSX.Element {
  const theme = useTheme();
  const isLargerThanBreakpoint = useMediaQuery(theme.breakpoints.up(800));
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [grblData, setGrblData] = useState('');
  const [inputCMD, setInputCMD] = useState('');
  const [inputCMDHistory, setInputCMDHistory] = useState<string[]>([]);
  const [currentGRBLStatus, setCurrentGRBLStatus] = useState('');
  const [isModalOpenIOMonitor, setIsModalOpenIOMonitor] = useState(false);
  const [isModalOpenGCodeEdit, setIsModalOpenGCodeEdit] = useState(false);
  const [isModalOpenGCodeUploading, setIsModalOpenGCodeUploading] = useState(false);
  const [gcode, setGCode] = useState('');
  const [gcodeCycles, setGCodeCycles] = useState(1);
  const [posData, setPosData] = useState<number[][]>([[0, 0]]);
  const [ioData, setIOData] = useState<number>(0);
  const grblConsoleRef = useRef<HTMLTextAreaElement>(null);
  const inputCMDRef = useRef<HTMLInputElement>(null);
  const currentInputCMDHistoryNaviIndex = useRef(-1);
  const skipOKResponse = useRef(false);

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

            // send the cursor to the end of the input
            setTimeout(() => {
              if (inputCMDRef.current) {
                const inputLength = inputCMDHistory[currentInputCMDHistoryNaviIndex.current].length;
                inputCMDRef.current.focus();
                inputCMDRef.current.setSelectionRange(inputLength, inputLength);
              }
            }, 50);
          } else {
            // send the cursor to the end of the input
            setTimeout(() => {
              if (inputCMDRef.current) {
                const inputLength = inputCMDHistory[currentInputCMDHistoryNaviIndex.current].length;
                inputCMDRef.current.focus();
                inputCMDRef.current.setSelectionRange(inputLength, inputLength);
              }
            }, 50);
          }
        }
      } else if (event.key === 'ArrowDown') {
        if (inputCMDHistory.length > 0) {
          if (currentInputCMDHistoryNaviIndex.current > 0) {
            currentInputCMDHistoryNaviIndex.current -= 1;
            setInputCMD(inputCMDHistory[currentInputCMDHistoryNaviIndex.current]);

            // send the cursor to the end of the input
            setTimeout(() => {
              if (inputCMDRef.current) {
                const inputLength = inputCMDHistory[currentInputCMDHistoryNaviIndex.current].length;
                inputCMDRef.current.focus();
                inputCMDRef.current.setSelectionRange(inputLength, inputLength);
              }
            }, 50);
          } else {
            currentInputCMDHistoryNaviIndex.current = -1;
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

  const commandGRBL = useCallback((cmd: string | number) => {
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

  const onChangeCycles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setGCodeCycles(parseInt(event.target.value));
  }, []);

  const onRun = useCallback(() => {
    socket.emit('run_gcode', gcode, gcodeCycles);
    // set timeout in case no response from server
    const setTimeoutID = setTimeout(() => {
      consoleGRBL('Timeout: No response from server');
      setIsModalOpenGCodeUploading(false);
    }, 3000);
    socket.once('run_gcode', (status: boolean) => {
      setIsModalOpenGCodeUploading(false);
      clearTimeout(setTimeoutID);
      // clear the trajectory
      setPosData((prev) => {
        if (prev.length > 1) {
          return [prev[prev.length - 1]];
        } else {
          return prev;
        }
      });
    });
    socket.once('error', (error: string) => {
      onError(error);
      setIsModalOpenGCodeUploading(false);
      clearTimeout(setTimeoutID);
    });
    setIsModalOpenGCodeEdit(false);
    setIsModalOpenGCodeUploading(true);
  }, [gcode, gcodeCycles]);

  /*** handlers of socket events ***/
  const onConnect = () => {
    setIsSocketConnected(true);

    // read gcode
    socket.emit('read_gcodes');
  };

  const onDisconnect = () => {
    setIsSocketConnected(false);
  };

  const onData = (data: string) => {
    if (data.includes('IO:')) {
      skipOKResponse.current = true;
      return;
    }

    if (skipOKResponse.current) {
      skipOKResponse.current = false;
      return;
    }

    consoleGRBL(data);
  };

  const onStatus = (status: string) => {
    setCurrentGRBLStatus(status);

    // parse current state, if it is in Run state, then update the position data to draw the trajectory
    const regexRun = /Run/;
    if (regexRun.test(status)) {
      const regex = /EPos:(-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)/;
      const match = status.match(regex);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        // const z = parseFloat(match[3]);

        // debug msg ===>
        // console.log('x:', x, 'y:', y);

        setPosData((prevData) => {
          const newData = [...prevData, [x, y]];
          if (newData.length > MAX_TRAJECTORY_POINTS) {
            return newData.slice(-MAX_TRAJECTORY_POINTS);
          }
          return newData;
        });
      }
    }
  };

  const onError = (error: string | object) => {
    let strError = error;
    if (error instanceof Error) {
      strError = error.message;
    }
    consoleGRBL(`Error: ${strError}`);
  };

  const onReceiveGCode = (data: string) => {
    setGCode(data);
  };
  /*** handlers of socket events ***/

  const consoleGRBL = (data: string) => {
    setGrblData((prevData) => {
      let strData;
      try {
        // stringified JSON or any other data
        strData = typeof data === 'object' ? JSON.stringify(data) : data;
      } catch (error) {
        // string data
        strData = data;
      }

      let newData = prevData + strData + '\n';
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
                    startIcon={<FormatListBulletedRoundedIcon />}
                    onClick={() => setIsModalOpenIOMonitor(true)}
                  >
                    I/O
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
        <IOMonitor open={isModalOpenIOMonitor} socket={socket} onClose={() => setIsModalOpenIOMonitor(false)} />
        <GCodeEditor
          open={isModalOpenGCodeEdit}
          gcode={gcode}
          cycles={gcodeCycles}
          onChangeGCode={onChangeGCode}
          onChangeCycles={onChangeCycles}
          onClose={() => setIsModalOpenGCodeEdit(false)}
          onRun={onRun}
        />
        <UploadingModal open={isModalOpenGCodeUploading} onClose={() => {}} />
      </Stack>
      <Card>
        <CardContent>
          <ScatterPlot data={posData} width={450} height={450} />
        </CardContent>
      </Card>
    </Stack>
  );
}
