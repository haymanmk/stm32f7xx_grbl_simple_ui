import { createServer } from 'node:http';

import next from 'next';
import { Server } from 'socket.io';

import { GCodeProvider } from './server/gcode/gcode-provider.mjs';
import { TCPClient } from './server/tcp-client.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

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
    queryGRBLStatus();
  });

  tcpClient.on('error', (err) => {
    console.error(err);
  });

  tcpClient.on('disconnected', () => {
    console.log('disconnected from GRBL server');
    isGRBLConnected = false;
  });

  // handle GRBL responses
  tcpClient.on('data', (data) => {
    if (isGRBLStatus(data)) {
      if (!manualQueryGRBLStatus) {
        broadcast('status', data);
        omitOKResponse = true;
        return;
      } else {
        manualQueryGRBLStatus = false;
      }
    }
    if (!omitOKResponse) broadcast('data', data);
    else if (isOKResponse) omitOKResponse = false;
  });

  // monitor status of GRBL server periodically
  // query GRBL status periodically
  const queryGRBLStatus = () => {
    if (!isGRBLConnected) {
      return;
    }
    if (Object.keys(socketClientList).length) {
      tcpClient.send('?\n', (data, err) => {
        if (err) {
          broadcast('error', err);
        } else {
          setTimeout(queryGRBLStatus, 1000);
        }
      });
    } else {
      setTimeout(queryGRBLStatus, 1000);
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

      tcpClient.send(data + '\n', (data, err) => {
        if (err) {
          socket.emit('error', err);
        }
      });
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
    socket.on('run_gcode', (gcode) => {
      if (isGCodeRunning) {
        socket.emit('error', 'GCode is already running');
        return;
      }

      // ===> debug
      console.log('> run gcode');

      // isGCodeRunning = true;
      // socket.emit('run_gcode');
    });
  }

  // send data to all connected clients
  const broadcast = (event, data) => {
    for (const socket in socketClientList) {
      socketClientList[socket].emit(event, data);
    }
  };
});

// check if data is a GRBL status message
const isGRBLStatus = (data) => {
  const regex = /<.*>/;
  return regex.test(data);
};

// check if there is any 'ok' response from GRBL
const isOKResponse = (data) => {
  const regex = /ok/;
  return regex.test(data);
};
