"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinbaseWebSocket = void 0;
const ws_1 = __importDefault(require("ws"));
const KlineService_1 = require("../services/KlineService");
class CoinbaseWebSocket {
    constructor() {
        this.WEBSOCKET_URI = 'wss://ws-feed.exchange.coinbase.com';
        this.ws = null;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 5;
        this.RECONNECT_DELAY = 5000;
        this.currentKline = null;
        this.klineStartTime = 0;
        this.klines = [];
        this.MAX_KLINES = 50;
        this.lastTickTime = 0;
        this.processingKline = false;
        this.EXCHANGE = 'COINBASE';
        this.klineService = new KlineService_1.KlineService();
    }
    static getInstance() {
        if (!CoinbaseWebSocket.instance) {
            CoinbaseWebSocket.instance = new CoinbaseWebSocket();
        }
        return CoinbaseWebSocket.instance;
    }
    async connect() {
        try {
            console.log('Connecting to Coinbase WebSocket...');
            this.ws = new ws_1.default(this.WEBSOCKET_URI);
            this.ws.on('open', this.handleOpen.bind(this));
            this.ws.on('message', this.handleMessage.bind(this));
            this.ws.on('error', this.handleError.bind(this));
            this.ws.on('close', this.handleClose.bind(this));
        }
        catch (error) {
            console.error('Error establishing WebSocket connection:', error);
            await this.handleReconnect();
        }
    }
    handleOpen() {
        console.log('Connected to Coinbase WebSocket');
        this.reconnectAttempts = 0;
        const subscribeMessage = {
            type: 'subscribe',
            product_ids: ['BTC-USD'],
            channels: ['ticker']
        };
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('Sent subscription message:', JSON.stringify(subscribeMessage));
        }
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'ticker') {
                void this.processTickerUpdate(message);
            }
        }
        catch (error) {
            console.error('Error processing message:', error);
        }
    }
    async processTickerUpdate(data) {
        const time = new Date(data.time).getTime();
        if (time <= this.lastTickTime) {
            return;
        }
        this.lastTickTime = time;
        const price = parseFloat(data.price);
        const size = parseFloat(data.last_size);
        const currentMinute = Math.floor(time / 60000) * 60000;
        if (!this.currentKline || currentMinute > this.klineStartTime) {
            if (this.processingKline) {
                console.log('[DEBUG] Waiting for previous kline completion');
                return;
            }
            try {
                this.processingKline = true;
                if (this.currentKline) {
                    console.log(`[DEBUG] Completing kline for ${new Date(this.klineStartTime).toISOString()}`);
                    const completeKline = {
                        ...this.currentKline,
                        exchange: this.EXCHANGE
                    };
                    this.klines.unshift(completeKline);
                    if (this.klines.length > this.MAX_KLINES) {
                        this.klines.pop();
                    }
                    try {
                        await this.klineService.saveKline(completeKline);
                        console.log(`Successfully saved kline to DynamoDB for ${completeKline.exchange}:${completeKline.symbol} at ${new Date(completeKline.openTime).toISOString()}`);
                        this.logKline(completeKline);
                    }
                    catch (error) {
                        if (error instanceof Error && error.name !== 'ConditionalCheckFailedException') {
                            console.error('Failed to save kline to DynamoDB:', error);
                        }
                    }
                }
                this.klineStartTime = currentMinute;
                this.currentKline = {
                    symbol: 'BTC-USD',
                    interval: '1m',
                    openTime: this.klineStartTime,
                    closeTime: this.klineStartTime + 60000,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: size,
                    trades: 1
                };
                console.log(`Started new kline at ${new Date(this.klineStartTime).toISOString()}`);
            }
            finally {
                this.processingKline = false;
            }
        }
        else if (this.currentKline) {
            this.currentKline.high = Math.max(this.currentKline.high, price);
            this.currentKline.low = Math.min(this.currentKline.low, price);
            this.currentKline.close = price;
            this.currentKline.volume += size;
            this.currentKline.trades = (this.currentKline.trades || 0) + 1;
        }
    }
    logKline(kline) {
        console.log(`
            Completed Kline:
            Exchange: ${kline.exchange}
            Symbol: ${kline.symbol}
            Interval: ${kline.interval}
            OpenTime: ${new Date(kline.openTime).toISOString()}
            CloseTime: ${new Date(kline.closeTime).toISOString()}
            Open: ${kline.open.toFixed(2)}
            High: ${kline.high.toFixed(2)}
            Low: ${kline.low.toFixed(2)}
            Close: ${kline.close.toFixed(2)}
            Volume: ${kline.volume.toFixed(8)}
            Trades: ${kline.trades}
            Current Kline Array Length: ${this.klines.length}/${this.MAX_KLINES}
        `);
    }
    handleError(error) {
        console.error('WebSocket error:', error);
        console.error('Error details:', error.message);
    }
    async handleClose() {
        console.log('WebSocket connection closed');
        await this.handleReconnect();
    }
    async handleReconnect() {
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${this.RECONNECT_DELAY / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
            await this.connect();
        }
        else {
            console.error('Max reconnection attempts reached. Please check the connection and restart the application.');
        }
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    getKlines() {
        return [...this.klines];
    }
}
exports.CoinbaseWebSocket = CoinbaseWebSocket;
