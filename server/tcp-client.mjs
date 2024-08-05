import { EventEmitter } from 'events';

import { TCPInterface } from './tcp-interface.mjs';

const DEBUG = false;

const HOST = '172.16.0.10';
const PORT = 8500;

export let tcpClient;

export class TCPClient extends EventEmitter {
  constructor() {
    super();

    // initialize state
    this.state = { connected: false };

    // create tcp interface
    this.tcpInterface = new TCPInterface();

    this.tcpInterface.connect(HOST, PORT);

    // arrange event handlers for tcp interface events
    this.initTCPInterfaceEventHandlers();
  }

  static getInstance() {
    if (!tcpClient) {
      tcpClient = new TCPClient();
    }

    return tcpClient;
  }

  send(data, callback) {
    this.tcpInterface.send(data, callback);
  }

  close() {
    this.tcpInterface.close();
  }

  initTCPInterfaceEventHandlers() {
    this.tcpInterface.on('connect', this.onConnect.bind(this));
    this.tcpInterface.on('close', this.onClose.bind(this));
    this.tcpInterface.on('data', this.onData.bind(this));
    this.tcpInterface.on('error', this.onError.bind(this));
    this.tcpInterface.on('graceful_close', this.onGracefulClose.bind(this));
  }

  onConnect() {
    this.state.connected = true;
    this.emit('connected');

    this.logging('connected to tcp server');
  }

  onClose() {
    this.state.connected = false;
    this.emit('disconnected');

    this.logging('disconnected from tcp server');
  }

  onData(data) {
    this.emit('data', data);

    this.logging('data', data);
  }

  onError(error) {
    this.emit('error', error);

    this.errorHandler(error);
  }

  onGracefulClose() {
    this.emit('graceful_close');

    this.logging('graceful close');
  }

  logging(...args) {
    if (DEBUG) {
      console.log(...args);
    }
  }

  errorHandler(err) {
    this.logging('error', err);
  }
}
