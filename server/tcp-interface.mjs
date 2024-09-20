import { EventEmitter } from 'events';
import { Socket } from 'net';

const DEBUG = true;

export class TCPInterface extends EventEmitter {
  constructor() {
    super();

    this.socket = new Socket();
    this.socket.setEncoding('utf8');
    this.socket.setKeepAlive(true, 3000);
    this.socket.setTimeout(5000);
    this.socket.on('data', this.onData.bind(this));
    this.socket.on('connect', this.onConnect.bind(this));
    this.socket.on('close', this.onClose.bind(this));
    this.socket.on('error', this.onError.bind(this));

    // close the connection when the server is closed
    process.on('exit', () => {
      console.log('TCP: exit event received');
      this.cleanup.bind(this);
    });
    process.on('SIGINT', () => {
      console.log('TCP: SIGINT received');
      this.cleanup.bind(this);
    });
    process.on('SIGTERM', () => {
      console.log('TCP: SIGTERM received');
      this.cleanup.bind(this);
    });
    process.on('uncaughtException', () => {
      console.log('TCP: uncaughtException received');
      this.cleanup.bind(this);
    });
  }

  connect(host, port) {
    if (this.isConnected || this.isConnecting) {
      return;
    }
    this.isConnecting = true;

    console.log(`connecting to ${host}:${port}`);

    try {
      this.socket.connect(port, host);

      this.setTimeoutIDConnect = setTimeout(() => {
        console.log('connection timeout');
        this.isConnecting = false;
        this.connect(host, port);
      }, 3000);
    } catch (error) {
      console.error(error);
      this.isConnecting = false;
      this.connect(host, port);
    }
  }

  close() {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;
    this.socket.end();
    this.socket.destroy();
    this.logging('closing tcp connection');

    let setTimeoutIDClose;

    this.socket.once('close', () => {
      this.isClosing = false;
      clearTimeout(setTimeoutIDClose);
      this.emit('graceful_close');
    });

    setTimeoutIDClose = setTimeout(() => {
      clearTimeout(setTimeoutIDClose);
      this.emit('graceful_close');
    }, 5000);
  }

  send(data, callback) {
    if (!this.isConnected) {
      return;
    }

    this.socket.write(data);

    if (callback) {
      // create an once event listener for the "data" event
      this.once('data', (_data) => {
        if (_data.includes('error')) {
          callback(_data, new Error("GRBL did not respond with 'ok'"));
        } else {
          callback(_data);
        }
      });
    }
  }

  // cleanup resources before exiting
  cleanup() {
    this.close();
  }

  onData(data) {
    this.buffer += data;
    while (true) {
      // check if the line ends with '\r\n'
      const index = this.buffer.indexOf('\n');
      if (index === -1) {
        break;
      }

      let line = '';
      // check if '\r' is the last character
      if (index > 0 && this.buffer[index - 1] === '\r') {
        line = this.buffer.substring(0, index - 1);
      } else {
        line = this.buffer.substring(0, index);
      }
      this.buffer = this.buffer.substring(index + 1); // update buffer by removing the line
      this.emit('data', line);
    }
  }

  onConnect() {
    if (this.setTimeoutIDConnect) {
      clearTimeout(this.setTimeoutIDConnect);
    }
    this.isConnected = true;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('connect');
  }

  onClose() {
    if (this.setTimeoutIDConnect) {
      clearTimeout(this.setTimeoutIDConnect);
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('close');
  }

  onError(err) {
    this.isConnected = false;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('error', err);
  }

  onTimeout() {
    this.isConnected = false;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('timeout');

    this.close();
  }

  logging(...args) {
    if (DEBUG) {
      console.log(...args);
    }
  }
}
