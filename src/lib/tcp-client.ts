import { EventEmitter } from 'events';

import { TCPInterface } from './tcp-interface';

const DEBUG = true;

const HOST = '172.16.0.10';
const PORT = 8500;

export class TCPClient extends EventEmitter {
  private static tcpClient: TCPClient;
  private tcpInterface: TCPInterface;
  public state: Record<string, any> = {};

  private constructor() {
    super();

    // initialize state
    this.state.connected = false;

    // create tcp interface
    this.tcpInterface = new TCPInterface();

    // arrange event handlers for tcp interface events
    this.initTCPInterfaceEventHandlers();
  }

  public static getInstance(): TCPClient {
    if (!TCPClient.tcpClient) {
      TCPClient.tcpClient = new TCPClient();
    }

    if (!TCPClient.tcpClient.state.connected) {
      // connect to service
      TCPClient.tcpClient.tcpInterface.connect(HOST, PORT);
    }

    return TCPClient.tcpClient;
  }

  public send(data: string, callback?: (response: string, error?: Error) => void): void {
    this.tcpInterface.send(data, callback);
  }

  public close() {
    this.tcpInterface.close();
  }

  private initTCPInterfaceEventHandlers() {
    this.tcpInterface.on('connect', this.onConnect.bind(this));
    this.tcpInterface.on('close', this.onClose.bind(this));
    this.tcpInterface.on('data', this.onData.bind(this));
    this.tcpInterface.on('error', this.onError.bind(this));
  }

  private onConnect() {
    this.state.connected = true;
    this.emit('connected');

    this.logging('connected to tcp server');
  }

  private onClose() {
    this.state.connected = false;
    this.emit('disconnected');

    this.logging('disconnected from tcp server');
  }

  private onData(data: string) {
    this.emit('data', data);

    this.logging('data', data);
  }

  private onError(error: Error) {
    this.emit('error', error);

    this.errorHandler(error);
  }

  private logging(...args: any[]) {
    if (DEBUG) {
      console.log(...args);
    }
  }

  private errorHandler(err: any) {
    this.logging('error', err);
  }
}
