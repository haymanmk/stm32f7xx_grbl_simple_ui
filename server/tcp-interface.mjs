import { EventEmitter } from 'events';
import { Socket } from 'net';

const DEBUG = true;

export class TCPInterface extends EventEmitter {
  constructor() {
    super();

    this.socket = new Socket();
    this.socket.setEncoding('utf8');
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
    this.socket.connect(port, host);
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
      process.exit(1);
    });

    setTimeoutIDClose = setTimeout(() => {
      clearTimeout(setTimeoutIDClose);
      this.emit('graceful_close');
      process.exit(1);
    }, 5000);
  }

  send(data, callback) {
    if (!this.isConnected) {
      return;
    }

    this.socket.write(data);

    if (callback) {
      // create an once event listener for the "data" event
      this.once('data', (data) => {
        if (data.includes('error')) {
          callback(data, new Error("GRBL did not respond with 'ok'"));
        } else {
          callback(data);
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
    this.isConnected = true;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('connect');
  }

  onClose() {
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

  logging(...args) {
    if (DEBUG) {
      console.log(...args);
    }
  }
}
