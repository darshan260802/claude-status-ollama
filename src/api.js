const API_URL = "https://ollama-auto-switch-be.onrender.com/hook/status";

export async function fetchStatus(token, { timeout = 8000 } = {}) {
  if (!token) {
    return {
      ok: false,
      noToken: true,
      data: null,
      error: "No API token provided",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {
        // ignore
      }
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `HTTP ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
      };
    }

    const data = await response.json();
    console.log('data', data)
    return { ok: true, data, error: null };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, data: null, error: "API request timed out" };
    }
    return { ok: false, data: null, error: err.message || String(err) };
  }
}
