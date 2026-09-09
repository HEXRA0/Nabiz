import axios from 'axios';
import https from 'https';
import tls from 'tls';
import net from 'net';
import { URL } from 'url';

export interface CheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  statusCode?: number;
  message?: string;
  sslDaysRemaining?: number;
  sslExpiryDate?: string;
}

export async function checkMonitor(monitor: any): Promise<CheckResult> {
  const timeoutMs = monitor.timeout_ms || 10000;

  if (monitor.type === 'http' || monitor.type === 'ssl') {
    return checkHttpOrSsl(monitor, timeoutMs);
  } else if (monitor.type === 'tcp') {
    return checkTcp(monitor, timeoutMs);
  } else if (monitor.type === 'ping') {
    return checkTcpOrHttpFallback(monitor, timeoutMs);
  }

  return { status: 'down', latencyMs: 0, message: 'Desteklenmeyen monitör türü' };
}

async function checkHttpOrSsl(monitor: any, timeoutMs: number): Promise<CheckResult> {
  const startTime = Date.now();
  let headers: Record<string, string> = {
    'User-Agent': 'Nabiz-Uptime-Monitor/1.0 (+https://nabiz.thedemir.com)'
  };

  if (monitor.headers) {
    try {
      const parsed = typeof monitor.headers === 'string' ? JSON.parse(monitor.headers) : monitor.headers;
      headers = { ...headers, ...parsed };
    } catch (e) {}
  }

  let sslInfo: { sslDaysRemaining?: number; sslExpiryDate?: string } = {};

  // Check SSL if HTTPS
  if (monitor.url.startsWith('https://')) {
    try {
      const parsedUrl = new URL(monitor.url);
      const port = parseInt(parsedUrl.port || '443', 10);
      sslInfo = await getSslCertificateInfo(parsedUrl.hostname, port, timeoutMs);
    } catch (e: any) {
      // SSL check warning or failure
    }
  }

  try {
    const response = await axios({
      method: monitor.method || 'GET',
      url: monitor.url,
      headers,
      timeout: timeoutMs,
      validateStatus: () => true, // Don't throw on status codes
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // We check SSL validity separately
      }),
      maxRedirects: 5,
    });

    const latencyMs = Date.now() - startTime;
    const expectedCode = monitor.expected_status_code || 200;

    let isUp = true;
    let message = `HTTP ${response.status} (${latencyMs}ms)`;

    if (response.status !== expectedCode) {
      isUp = false;
      message = `Beklenen durum kodu ${expectedCode}, alınan kod: ${response.status}`;
    }

    if (isUp && monitor.body_search) {
      const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (!bodyStr.includes(monitor.body_search)) {
        isUp = false;
        message = `Yanıt gövdesinde '${monitor.body_search}' arama metni bulunamadı`;
      }
    }

    return {
      status: isUp ? 'up' : 'down',
      latencyMs,
      statusCode: response.status,
      message,
      ...sslInfo,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'down',
      latencyMs,
      message: error.code ? `Bağlantı hatası: ${error.code}` : (error.message || 'Zaman aşımı / Erişilemedi'),
      ...sslInfo,
    };
  }
}

function getSslCertificateInfo(hostname: string, port: number, timeoutMs: number): Promise<{ sslDaysRemaining: number; sslExpiryDate: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ sslDaysRemaining: 0, sslExpiryDate: '' });
    }, Math.min(timeoutMs, 5000));

    try {
      const socket = tls.connect(
        {
          host: hostname,
          port: port,
          servername: hostname,
          rejectUnauthorized: false,
        },
        () => {
          clearTimeout(timer);
          const cert = socket.getPeerCertificate();
          socket.end();

          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            const now = new Date();
            const daysRemaining = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            resolve({
              sslDaysRemaining: daysRemaining,
              sslExpiryDate: expiryDate.toISOString(),
            });
          } else {
            resolve({ sslDaysRemaining: 0, sslExpiryDate: '' });
          }
        }
      );

      socket.on('error', () => {
        clearTimeout(timer);
        resolve({ sslDaysRemaining: 0, sslExpiryDate: '' });
      });
    } catch (e) {
      clearTimeout(timer);
      resolve({ sslDaysRemaining: 0, sslExpiryDate: '' });
    }
  });
}

function checkTcp(monitor: any, timeoutMs: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let host = monitor.url;
    let port = 80;

    if (monitor.url.includes(':')) {
      const parts = monitor.url.replace(/^.*:\/\//, '').split(':');
      host = parts[0];
      port = parseInt(parts[1], 10) || 80;
    }

    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({
        status: 'up',
        latencyMs,
        message: `TCP ${host}:${port} bağlantısı başarılı (${latencyMs}ms)`,
      });
    });

    socket.on('error', (err: any) => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({
        status: 'down',
        latencyMs,
        message: `TCP bağlantı hatası: ${err.message || err.code}`,
      });
    });

    socket.on('timeout', () => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({
        status: 'down',
        latencyMs,
        message: `TCP ${host}:${port} bağlantı zaman aşımı (${timeoutMs}ms)`,
      });
    });
  });
}

async function checkTcpOrHttpFallback(monitor: any, timeoutMs: number): Promise<CheckResult> {
  if (monitor.url.startsWith('http://') || monitor.url.startsWith('https://')) {
    return checkHttpOrSsl(monitor, timeoutMs);
  }
  return checkTcp(monitor, timeoutMs);
}
