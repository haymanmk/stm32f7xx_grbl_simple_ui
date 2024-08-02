import { EventEmitter } from 'events';
import { Socket } from 'net';

const DEBUG = true;

export class TCPInterface extends EventEmitter {
  private socket: Socket;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private isClosing: boolean = false;
  private buffer: string = '';

  constructor() {
    super();

    this.socket = new Socket();
    this.socket.setEncoding('utf8');
    this.socket.on('data', this.onData.bind(this));
    this.socket.on('connect', this.onConnect.bind(this));
    this.socket.on('close', this.onClose.bind(this));
    this.socket.on('error', this.onError.bind(this));

    // listen for process exit
    process.on('exit', this.cleanup.bind(this));
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  public connect(host: string, port: number) {
    if (this.isConnected || this.isConnecting) {
      console.log(`connecting: ${this.isConnecting}, connected: ${this.isConnected}`);
      return;
    }
    this.isConnecting = true;

    this.close();
    this.socket.once('close', () => {
      setTimeout(() => {
        console.log(`connecting to ${host}:${port}`);
        this.socket.connect(port, host);
      }, 2000);
    });
  }

  public close() {
    if (this.isClosing) {
      return;
    }
    this.isClosing = true;
    this.socket.end();
    this.socket.destroy();
    this.logging('closing tcp connection');
  }

  public send(data: string, callback?: (response: string, error?: Error) => void): void {
    if (!this.isConnected) {
      return;
    }

    this.socket.write(data);

    if (callback) {
      // create an once event listener for the "data" event
      this.once('data', (data: string) => {
        if (data.includes('error')) {
          callback(data, new Error("GRBL did not respond with 'ok'"));
        } else {
          callback(data);
        }
      });
    }
  }

  // cleanup resources before exiting
  private cleanup() {
    this.close();
  }

  private onData(data: string) {
    this.buffer += data;
    while (true) {
      const index = this.buffer.indexOf('\n');
      if (index === -1) {
        break;
      }
      const line = this.buffer.substring(0, index);
      this.buffer = this.buffer.substring(index + 1); // update buffer by removing the line
      this.emit('data', line);
    }
  }

  private onConnect() {
    this.isConnected = true;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('connect');
  }

  private onClose() {
    this.isConnected = false;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('close');
  }

  private onError(err: Error) {
    this.isConnected = false;
    this.isConnecting = false;
    this.isClosing = false;
    this.emit('error', err);
  }

  private logging(...args: any[]) {
    if (DEBUG) {
      console.log(...args);
    }
  }
}
