import { createServer } from 'node:http';

import next from 'next';
import { Server } from 'socket.io';

import { GCodeProvider } from './server/gcode/gcode-provider.mjs';
import { TCPClient } from './server/tcp-client.mjs';
import { isGRBLStatus, isOKResponse } from './server/utils.mjs';

const STATUS_INTERVAL = 250;
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// handle process termination
process.on('exit', () => {
  console.log('exit event received');
  process.exit(1);
});
process.on('SIGINT', () => {
  console.log('SIGINT received');
  process.exit(1);
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  process.exit(1);
});
process.on('uncaughtException', (err, origin) => {
  console.log(
    'uncaughtException received',
    process.stderr.fd,
    `Caught exception: ${err}\n` + `Exception origin: ${origin}\n`
  );
  process.exit(1);
});

app.prepare().then(() => {
  // connect to GRBL server
  let tcpClient = TCPClient.getInstance();
  let isGRBLConnected = false;
  let manualQueryGRBLStatus = false;
  let omitOKResponse = false;
  let socketClientList = {};
  let isGCodeRunning = false;

  tcpClient.on('connected', () => {
    console.log('connected to GRBL server');
    isGRBLConnected = true;
    setTimeout(() => queryGRBLStatus(), 1000);
  });

  tcpClient.on('graceful_close', () => {
    console.log('graceful close');
    process.exit(1);
  });

  tcpClient.on('error', (err) => {
    console.log('error', err);
  });

  tcpClient.on('disconnected', () => {
    console.log('disconnected from GRBL server');
    isGRBLConnected = false;
  });

  // handle GRBL responses
  tcpClient.on('data', (data) => {
    // console.log('data:', data);
    if (isGRBLStatus(data)) {
      if (!manualQueryGRBLStatus) {
        broadcast('status', data);
        // omitOKResponse = true;
        return;
      } else {
        manualQueryGRBLStatus = false;
      }
    }
    broadcast('data', data);
    // if (!omitOKResponse) broadcast('data', data);
    // else if (isOKResponse(data)) omitOKResponse = false;
  });

  // monitor status of GRBL server periodically
  // query GRBL status periodically
  const queryGRBLStatus = () => {
    if (!isGRBLConnected) {
      return;
    }
    if (Object.keys(socketClientList).length) {
      tcpClient
        .queryGRBLStatus()
        .then((data) => setTimeout(queryGRBLStatus, STATUS_INTERVAL))
        .catch((err) => broadcast('error', err));
    } else {
      setTimeout(queryGRBLStatus, STATUS_INTERVAL);
    }
  };

  const httpServer = createServer(handler);

  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    // add socket to the list
    socketClientList[socket.id] = socket;
    socketAgent(socket);
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });

  function socketAgent(socket) {
    // get user ip address
    const ip = socket.handshake.address;
    console.log('user connected', ip);

    socket.on('disconnect', () => {
      console.log('user disconnected', ip);
      socket.removeAllListeners();
      delete socketClientList[socket.id];
    });

    // handle incoming messages
    socket.on('cmd', (data) => {
      if (!isGRBLConnected) {
        socket.emit('error', 'GRBL is not connected');
        return;
      }

      console.log('cmd:', data);

      if (data === '?') {
        manualQueryGRBLStatus = true;
      }

      tcpClient.commandGRBL(data + '\n').catch((err) => socket.emit('error', err));
    });

    // handle read gcodes request
    socket.on('read_gcodes', () => {
      GCodeProvider()
        .then((gcodes) => {
          socket.emit('gcodes', gcodes);
        })
        .catch((err) => {
          socket.emit('error', err);
        });
    });

    // handle run gcode request
    socket.on('run_gcode', async (gcode, gcode_cycles) => {
      if (isGCodeRunning) {
        socket.emit('error', 'GCode is already running');
        return;
      }

      // ===> debug
      console.log('> run gcode');

      isGCodeRunning = true;
      socket.emit('run_gcode', isGCodeRunning);

      // split the gcode into lines by '/n'
      const lines = gcode.split('\n');

      let hasError = false;

      const gcodeCycles = parseInt(gcode_cycles) || 1;

      // repeat the gcode cycles
      for (let i = 0; i < gcodeCycles; i++) {
        // send each line to GRBL
        for (const line of lines) {
          if (line === '') continue;
          if (hasError) break;

          // ===> debug
          console.log('> send gcode:', line);

          try {
            await tcpClient.commandGRBL(line + '\n');
          } catch (err) {
            socket.emit('error', err);
            console.error(err);
            hasError = true;
          }
        }
        console.log('cycle:', i + 1);
      }

      isGCodeRunning = false;
      socket.emit('run_gcode', isGCodeRunning);
    });
  }

  // send data to all connected clients
  const broadcast = (event, data) => {
    for (const socket in socketClientList) {
      socketClientList[socket].emit(event, data);
    }
  };
});
