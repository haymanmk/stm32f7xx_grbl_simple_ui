export declare class TCPClient extends EventEmitter {
  private constructor();
  public static getInstance(): TCPClient;
  public send(data: string, callback?: (response: string, error?: Error) => void): void;
  public close(): void;
  private initTCPInterfaceEventHandlers(): void;
  private onConnect(): void;
  private onClose(): void;
  private onData(data: string): void;
  private onError(error: Error): void;
  private logging(...args: any[]): void;
  private errorHandler(err: any);
}

export declare let tcpClient: TCPClient;