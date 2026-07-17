export class ODataClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  private constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "APIKey": apiKey
    };
  }

  /**
   * Simple initialization requiring only URL and API Key.
   */
  static async create(): Promise<ODataClient> {
    const url = process.env.SAP_API_URL;
    const apiKey = process.env.SAP_API_KEY || process.env.APIKey || process.env.API_KEY;

    if (!url) {
      throw new Error("Missing 'SAP_API_URL' in environment.");
    }
    if (!apiKey) {
      throw new Error("Missing 'SAP_API_KEY' in environment.");
    }

    return new ODataClient(url, apiKey);
  }

  /**
   * Standardized GET request using native fetch.
   */
  async get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    let targetUrl = this.baseUrl + cleanPath;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      targetUrl += `?${searchParams.toString()}`;
    }

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: this.headers
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const responseData: any = await response.json();
      return responseData?.d?.results ?? responseData?.d ?? responseData;
    } catch (err: any) {
      throw new Error(`GET ${cleanPath} failed: ${err.message}`);
    }
  }

  /**
   * Fetches CSRF token and Cookie for stateful POST requests.
   */
  private async fetchCsrfToken(): Promise<{ token: string | null; cookie: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/$metadata`, {
        method: "GET",
        headers: {
          ...this.headers,
          "X-CSRF-Token": "Fetch"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const token = response.headers.get("x-csrf-token");
      const setCookie = response.headers.get("set-cookie");
      
      // Extract just the session cookie portion if it exists
      const cookie = setCookie ? setCookie.split(";")[0] : null;

      return { token, cookie };
    } catch (err: any) {
      throw new Error(`CSRF Token Fetch failed: ${err.message}`);
    }
  }

  /**
   * Standardized POST request with auto-CSRF handling using native fetch.
   */
  async deepInsert<T = any>(entitySet: string, payload: any): Promise<T> {
    const { token, cookie } = await this.fetchCsrfToken();
    const cleanPath = `/${entitySet.replace(/^\/+/, "")}`;
    const targetUrl = this.baseUrl + cleanPath;

    const requestHeaders: Record<string, string> = { ...this.headers };
    if (token) requestHeaders["X-CSRF-Token"] = token;
    if (cookie) requestHeaders["Cookie"] = cookie;

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const responseData: any = await response.json();
      return responseData?.d?.results ?? responseData?.d ?? responseData;
    } catch (err: any) {
      throw new Error(`POST ${cleanPath} failed: ${err.message}`);
    }
  }
}