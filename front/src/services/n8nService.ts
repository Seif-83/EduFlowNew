/**
 * Service to dispatch real-time events to local n8n instance (http://localhost:5678)
 */

export interface N8nWebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function sendN8nEvent(event: string, data: Record<string, any>): Promise<N8nWebhookResponse> {
  const geminiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY ||
    '';

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    gemini_key: geminiKey,
    data,
  };

  try {
    // Try production webhook first
    let response = await fetch('http://localhost:5678/webhook/eduflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // If 404, user might be running "Listen for test event" inside n8n editor
    if (response.status === 404) {
      response = await fetch('http://localhost:5678/webhook-test/eduflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      return {
        success: false,
        error: `n8n returned status ${response.status}`,
      };
    }

    const resJson = await response.json();
    return {
      success: true,
      data: resJson,
    };
  } catch (err: any) {
    // Graceful degradation when n8n is offline
    console.info('n8n dispatch note (n8n might be offline or inactive):', err?.message);
    return {
      success: false,
      error: err?.message || 'Network error reaching n8n',
    };
  }
}
