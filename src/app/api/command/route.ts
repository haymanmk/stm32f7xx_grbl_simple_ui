import { NextRequest } from 'next/server';
import { TCPClient } from '@/lib/tcp-client';

export async function GET(request: NextRequest) {
  const searchParam = request.nextUrl.searchParams;
  const query = searchParam.get('query');

  // get tcp client instance
  const tcpClient = TCPClient.getInstance();

  let body: string;

  switch (query) {
    case 'status':
    default:
      body = JSON.stringify({
        connected: tcpClient.state.connected,
      });
  }

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  };
}
