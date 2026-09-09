interface RequestOptions extends RequestInit {
  params?: Record<string, unknown>;
  data?: unknown;
}

export class ApiError extends Error {
  response?: {
    status: number;
    data: any;
  };

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'ApiError';
    this.response = { status, data };
  }
}

async function request(url: string, options: RequestOptions = {}) {
  const { params, data, headers = {}, ...rest } = options;

  let requestUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const query = searchParams.toString();
    if (query) {
      requestUrl += (requestUrl.includes('?') ? '&' : '?') + query;
    }
  }

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  let body = rest.body;
  const payload = data !== undefined ? data : body;
  if (payload !== undefined && payload !== null && !(payload instanceof FormData) && typeof payload === 'object') {
    reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
    body = JSON.stringify(payload);
  } else if (typeof payload === 'string') {
    body = payload;
  }

  const response = await fetch(requestUrl, {
    ...rest,
    headers: reqHeaders,
    body,
    credentials: 'include',
  });

  const responseData: any = await response.json().catch(() => response.text().catch(() => null));

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      const isLoginRequest = url.includes('/api/auth/login');
      if (!isLoginRequest && window.location.pathname.startsWith('/admin')) {
        window.location.assign('/login?reason=unauthorized');
      }
    }

    const message = responseData?.message || response.statusText || 'Request failed';
    throw new ApiError(message, response.status, responseData);
  }

  return responseData;
}

const apiClient = {
  get: (url: string, options?: RequestOptions) => request(url, { ...options, method: 'GET' }),
  post: (url: string, data?: unknown, options?: RequestOptions) =>
    request(url, { ...options, method: 'POST', data }),
  put: (url: string, data?: unknown, options?: RequestOptions) =>
    request(url, { ...options, method: 'PUT', data }),
  patch: (url: string, data?: unknown, options?: RequestOptions) =>
    request(url, { ...options, method: 'PATCH', data }),
  delete: (url: string, options?: RequestOptions) =>
    request(url, { ...options, method: 'DELETE' }),
};

export default apiClient;
