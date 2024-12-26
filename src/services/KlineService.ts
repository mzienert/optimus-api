import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ExchangeKline, KlineRecord } from '../types/kline';

export class KlineService {
    private docClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    constructor() {
        const dynamoDbClient = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-west-1'
        });

        this.docClient = DynamoDBDocumentClient.from(dynamoDbClient);

        const tableName = process.env.DYNAMODB_TABLE;
        if (!tableName) {
            throw new Error('DYNAMODB_TABLE environment variable must be set');
        }
        this.tableName = tableName;
    }

    private createPrimaryKey(exchange: string, symbol: string): string {
        return `KLine#${exchange}#${symbol}`;
    }

    async saveKline(kline: ExchangeKline): Promise<void> {
        if (!this.tableName) {
            throw new Error('DynamoDB table name is not configured');
        }

        const currentTimestamp = Date.now();
        const ttl = Math.floor(currentTimestamp / 1000) + (7 * 24 * 60 * 60); // 7 days TTL

        const item: KlineRecord = {
            ...kline,
            pk: this.createPrimaryKey(kline.exchange, kline.symbol),
            sk: kline.openTime,
            type: 'KLINE',
            timestamp: currentTimestamp,
            ttl
        };

        try {
            await this.docClient.send(new PutCommand({
                TableName: this.tableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
            }));
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                console.log(`Kline already exists for ${kline.exchange}:${kline.symbol} at ${new Date(kline.openTime).toISOString()}`);
                return;
            }
            console.error('Error saving kline to DynamoDB:', error);
            throw new Error('Failed to save kline data');
        }
    }

    async getKlines(params: {
        exchange: string;
        symbol: string;
        startTime?: number;
        endTime?: number;
        limit?: number;
    }): Promise<KlineRecord[]> {
        if (!this.tableName) {
            throw new Error('DynamoDB table name is not configured');
        }

        const { exchange, symbol, startTime, endTime, limit = 100 } = params;
        const pk = this.createPrimaryKey(exchange, symbol);

        const queryParams: any = {
            TableName: this.tableName,
            KeyConditionExpression: '#pk = :pk',
            ExpressionAttributeNames: {
                '#pk': 'pk'
            },
            ExpressionAttributeValues: {
                ':pk': pk
            },
            Limit: limit,
            ScanIndexForward: false // Return results in descending order (newest first)
        };

        if (startTime || endTime) {
            if (startTime && endTime) {
                queryParams.KeyConditionExpression += ' AND #sk BETWEEN :start AND :end';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            } else if (startTime) {
                queryParams.KeyConditionExpression += ' AND #sk >= :start';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
            } else if (endTime) {
                queryParams.KeyConditionExpression += ' AND #sk <= :end';
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            }
            queryParams.ExpressionAttributeNames['#sk'] = 'sk';
        }

        try {
            const result = await this.docClient.send(new QueryCommand(queryParams));
            return (result.Items || []) as KlineRecord[];
        } catch (error) {
            console.error('Error querying klines from DynamoDB:', error);
            throw new Error('Failed to retrieve kline data');
        }
    }

    async getKlinesByExchange(params: {
        exchange: string;
        startTime?: number;
        endTime?: number;
        limit?: number;
    }): Promise<KlineRecord[]> {
        if (!this.tableName) {
            throw new Error('DynamoDB table name is not configured');
        }

        const { exchange, startTime, endTime, limit = 100 } = params;

        const queryParams: any = {
            TableName: this.tableName,
            IndexName: 'exchange-timestamp-index', // You'll need to create this GSI
            KeyConditionExpression: '#exchange = :exchange',
            ExpressionAttributeNames: {
                '#exchange': 'exchange'
            },
            ExpressionAttributeValues: {
                ':exchange': exchange
            },
            Limit: limit,
            ScanIndexForward: false
        };

        if (startTime || endTime) {
            if (startTime && endTime) {
                queryParams.KeyConditionExpression += ' AND #timestamp BETWEEN :start AND :end';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            } else if (startTime) {
                queryParams.KeyConditionExpression += ' AND #timestamp >= :start';
                queryParams.ExpressionAttributeValues[':start'] = startTime;
            } else if (endTime) {
                queryParams.KeyConditionExpression += ' AND #timestamp <= :end';
                queryParams.ExpressionAttributeValues[':end'] = endTime;
            }
            queryParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        }

        try {
            const result = await this.docClient.send(new QueryCommand(queryParams));
            return (result.Items || []) as KlineRecord[];
        } catch (error) {
            console.error('Error querying klines by exchange from DynamoDB:', error);
            throw new Error('Failed to retrieve kline data by exchange');
        }
    }
}