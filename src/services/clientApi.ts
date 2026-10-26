import type {
  AgentChatResponse,
  CloudExportResult,
  ShortEDL,
  TrendRadarResult,
} from '../types/edl';

export interface ClientTrendRadarRequest {
  nicheHint: string;
}

export interface ClientScoutRequest {
  youtubeUrl?: string;
  uploadedFileBase64?: string;
  uploadedFileName?: string;
  mimeType?: string;
  nicheHint?: string;
}

export interface ClientSurgicalCutRequest {
  candidate: ShortEDL;
  youtubeUrl?: string;
  mimeType?: string;
}

export interface ClientAutoFramingRequest {
  candidate: ShortEDL;
}

export interface ClientQACriticRequest {
  candidate: ShortEDL;
}

export interface ClientCloudExportRequest {
  candidate: ShortEDL;
  fastTestMode?: boolean;
}

export interface ClientAgentChatRequest {
  userMessage: string;
  currentRoute?: string;
  youtubeUrl?: string;
  nicheHint?: string;
  candidatesSummary?: Array<{
    index: number;
    id: string;
    title: string;
    hookText: string;
    durationSec: number;
  }>;
  selectedMomentIndex?: number;
}

async function parseJsonResponse(res: Response, fallbackLabel: string): Promise<any> {
  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      `${fallbackLabel} timed out or returned an unexpected response (${res.status}).`
    );
  }
  if (!res.ok) {
    throw new Error(data?.error || `${fallbackLabel} failed (${res.status})`);
  }
  return data;
}

export async function requestTrendRadar(
  payload: ClientTrendRadarRequest
): Promise<TrendRadarResult> {
  const res = await fetch('/api/trends/radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(res, 'Trend check');
  return data.radar as TrendRadarResult;
}

export async function requestScoutCandidates(
  payload: ClientScoutRequest
): Promise<ShortEDL[]> {
  const res = await fetch('/api/agents/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(res, 'Moment Finder');
  return data.candidates as ShortEDL[];
}

export async function requestSurgicalCut(
  payload: ClientSurgicalCutRequest
): Promise<ShortEDL> {
  const res = await fetch('/api/agents/surgical-cut', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(res, 'Fluff Snipper');
  return data.candidate as ShortEDL;
}

export async function requestAutoFraming(
  payload: ClientAutoFramingRequest
): Promise<ShortEDL> {
  const res = await fetch('/api/agents/auto-frame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(res, 'Camera & Hook Styler');
  return data.candidate as ShortEDL;
}

export async function requestQACritic(
  payload: ClientQACriticRequest
): Promise<ShortEDL> {
  const res = await fetch('/api/agents/qa-critic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(res, 'Quality Polish');
  return data.candidate as ShortEDL;
}

export async function requestCloudVideoExport(
  payload: ClientCloudExportRequest
): Promise<CloudExportResult> {
  try {
    const res = await fetch('/api/agents/export-short', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse(res, 'MP4 Download');
    return data.exportResult as CloudExportResult;
  } catch (err) {
    // If Live Mode hit an upstream proxy timeout, immediately fall back to the <1s fast render path
    if (!payload.fastTestMode) {
      const retryRes = await fetch('/api/agents/export-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, fastTestMode: true }),
      });
      const retryData = await parseJsonResponse(retryRes, 'MP4 Download');
      return retryData.exportResult as CloudExportResult;
    }
    throw err;
  }
}

export async function requestAgentChat(
  payload: ClientAgentChatRequest
): Promise<AgentChatResponse> {
  const res = await fetch('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(res, 'Agent chat');
  return data as AgentChatResponse;
}



