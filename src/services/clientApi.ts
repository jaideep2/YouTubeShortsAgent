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

export async function requestTrendRadar(
  payload: ClientTrendRadarRequest
): Promise<TrendRadarResult> {
  const res = await fetch('/api/trends/radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Trend check failed (${res.status})`);
  }
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Moment Finder failed (${res.status})`);
  }
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Fluff Snipper failed (${res.status})`);
  }
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Camera & Hook Styler failed (${res.status})`);
  }
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Quality Polish failed (${res.status})`);
  }
  return data.candidate as ShortEDL;
}

export async function requestCloudVideoExport(
  payload: ClientCloudExportRequest
): Promise<CloudExportResult> {
  const res = await fetch('/api/agents/export-short', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Cloud Export failed (${res.status})`);
  }
  return data.exportResult as CloudExportResult;
}

export async function requestAgentChat(
  payload: ClientAgentChatRequest
): Promise<AgentChatResponse> {
  const res = await fetch('/api/agents/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Agent chat failed (${res.status})`);
  }
  return data as AgentChatResponse;
}


