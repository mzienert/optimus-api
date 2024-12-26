export interface BaseKline {
    symbol: string;
    interval: string;
    openTime: number;
    closeTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    trades?: number;
}

export interface ExchangeKline extends BaseKline {
    exchange: string;
}

export interface KlineRecord extends ExchangeKline {
    pk: string;         // KLine#<exchange>#<symbol>
    sk: number;         // timestamp (openTime)
    type: 'KLINE';      // Keeping the type discriminator
    timestamp: number;  // For GSI if needed
    ttl: number;
}