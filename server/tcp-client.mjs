import { EventEmitter } from 'events';

import { TCPInterface } from './tcp-interface.mjs';
import { isGRBLStatus, isOKResponse } from './utils.mjs';

const DEBUG = false;

const HOST = '172.16.0.10';
const PORT = 8500;

export let tcpClient;

export class TCPClient extends EventEmitter {
  constructor() {
    super();

    // initialize state
    this.state = { connected: false };
    this.lockSend = false;

    // create tcp interface
    this.tcpInterface = new TCPInterface();

    this.connectGRBL();

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

  connectGRBL() {
    if (this.state.connected) {
      return;
    }

    this.tcpInterface.connect(HOST, PORT);
  }

  /**
   * This function sends a command to the GRBL server
   * and waits for 'ok' or 'error' responses.
   * @param {*} data
   * @returns
   */
  commandGRBL(data) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.lock();

        const onData = (rsv, rjt) => {
          // create an once event listener for the "data" event
          this.once('data', (_data) => {
            if (_data.includes('error')) {
              this.unlock();
              rjt(_data); // reject
            } else if (_data.includes('ok')) {
              this.unlock();
              rsv(_data); // resolve
            } else {
              onData(rsv, rjt);
            }
          });
        };

        this.tcpInterface.send(data);

        onData(resolve, reject);
      } catch (err) {
        this.unlock();
        reject(err);
      }
    });
  }

  queryGRBLStatus() {
    return new Promise((resolve, reject) => {
      const onData = (rsv, rjt) => {
        // create an once event listener for the "data" event
        this.once('data', (_data) => {
          if (isGRBLStatus(_data)) {
            rsv(_data); // resolve
          } else {
            onData(rsv, rjt);
          }
        });
      };

      this.tcpInterface.send('?');

      onData(resolve, reject);
    });
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

    // retry to connect to the server
    setTimeout(() => this.connectGRBL(), 1000);
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

  lock() {
    return new Promise((resolve, reject) => {
      const setIntervalID = setInterval(() => {
        if (this.state.connected === false) {
          clearInterval(setIntervalID);
          reject('tcp server is not connected');
        } else if (!this.lockSend) {
          this.lockSend = true;
          clearInterval(setIntervalID);
          resolve();
        }
      }, 100);
    });
  }

  unlock() {
    this.lockSend = false;
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
