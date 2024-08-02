'use server';

import { TCPClient } from '../../server/tcp-client';

export async function commandGRBL(cmd: string): Promise<string> {
  const tcpClient = TCPClient.getInstance();

  return new Promise((resolve, reject) => {
    if (!tcpClient) {
      reject(new Error('TCP client is not defined'));
      return;
    }

    console.log('sending command to GRBL:', cmd);
    tcpClient.send(cmd + '\n', (response, error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}
