import { getProtocolAdapter } from '../adapters/index.js';
import { logger } from '../logger.js';

export interface ProtocolData {
  timestamp: string;
  chainId: number;
  aaveApy: number;
  uniswapApy: number;
  stakingApy: number;
}

export async function collectProtocolData(chainId: number): Promise<ProtocolData> {
  const aaveAdapter = getProtocolAdapter('aave', chainId);
  const uniswapAdapter = getProtocolAdapter('uniswap', chainId);
  const stakingAdapter = getProtocolAdapter('staking', chainId);

  const [aaveApy, uniswapApy, stakingApy] = await Promise.all([
    aaveAdapter.getApy().catch(() => 0),
    uniswapAdapter.getApy().catch(() => 0),
    stakingAdapter.getApy().catch(() => 0),
  ]);

  return {
    timestamp: new Date().toISOString(),
    chainId,
    aaveApy,
    uniswapApy,
    stakingApy,
  };
}
