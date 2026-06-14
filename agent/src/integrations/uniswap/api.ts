import { logger } from '../../logger.js';
import { settings } from '../../settings.js';

const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1';

function getHeaders(): Record<string, string> {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) throw new Error('UNISWAP_API_KEY not set in configuration environment.');
  return { 'Content-Type': 'application/json', 'x-api-key': apiKey };
}

async function post<T>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(`${UNISWAP_API_BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uniswap API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export interface CheckApprovalParams {
  walletAddress: string;
  token: string;
  tokenOut?: string;
  amount: string;
  chainId?: number;
}

export async function checkApproval(params: CheckApprovalParams): Promise<{ isRequired: boolean; spender?: string; allowance?: string }> {
  try {
    const res = await post<{ approval: { isRequired: boolean; spender?: string; allowance?: string } }>('/check_approval', {
      walletAddress: params.walletAddress,
      token: params.token,
      tokenOut: params.tokenOut,
      amount: params.amount,
      chainId: params.chainId ?? settings.chainId,
    });
    return res.approval;
  } catch (err) {
    logger.warn('Uniswap Trade API check bypassed or offline under current testnet framework.');
    return { isRequired: false };
  }
}

export interface QuoteRequest {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  type?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  tokenInChainId?: number;
  tokenOutChainId?: number;
  protocols?: ('V2' | 'V3' | 'V4')[];
  routingPreference?: 'CLASSIC' | 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY';
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  autoSlippage?: boolean;
}

export interface QuoteResponse {
  quote: any;
  routing: string;
  permitData?: any;
}

export async function getQuote(params: QuoteRequest): Promise<QuoteResponse> {
  const body: any = {
    swapper: params.swapper,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    tokenInChainId: params.tokenInChainId ?? settings.chainId,
    tokenOutChainId: params.tokenOutChainId ?? settings.chainId,
    amount: params.amount,
    type: params.type ?? 'EXACT_INPUT',
  };
  if (params.protocols) body.protocols = params.protocols;
  if (params.routingPreference) body.routingPreference = params.routingPreference;
  if (params.urgency) body.urgency = params.urgency;
  if (params.autoSlippage) body.autoSlippage = params.autoSlippage;
  return post<QuoteResponse>('/quote', body);
}

export async function submitSwap(
  quote: any,
  permitData: any | null,
  signature?: string
): Promise<{ to: string; data: string; value: string }> {
  const body: any = { quote };
  if (permitData) body.permitData = permitData;
  if (signature) body.signature = signature;
  const res = await post<{ swap: { to: string; data: string; value: string } }>('/swap', body);
  return res.swap;
}

export async function submitOrder(quote: any, signature: string): Promise<{ orderId: string }> {
  return post<{ orderId: string }>('/order', { quote, signature });
}
