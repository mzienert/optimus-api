import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ResponseBody {
    [key: string]: unknown;
}

const createResponse = (statusCode: number, body: ResponseBody): APIGatewayProxyResult => {
    console.log('Creating response:', { statusCode, body });
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify(body)
    };
};

interface ErrorResponse {
    statusCode: number;
    message: string;
    error?: string;
}

const handleError = (error: unknown): ErrorResponse => {
    console.error('Processing error:', error);
    
    if (error instanceof Error) {
        if (error.name === 'ResourceNotFoundException') {
            return {
                statusCode: 404,
                message: 'DynamoDB table not found'
            };
        }
        
        if (error.name === 'ValidationException') {
            return {
                statusCode: 400,
                message: 'Invalid query parameters'
            };
        }
        
        return {
            statusCode: 500,
            message: 'Internal server error',
            error: error.message
        };
    }
    
    return {
        statusCode: 500,
        message: 'Unknown error occurred',
        error: String(error)
    };
};

const queryTable = async (): Promise<any[]> => {
    try {
        console.log('Starting table query');
        const scanParams = {
            TableName: process.env.DYNAMODB_TABLE || 'GalvitronTable',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': 'KLINE'
            },
            Limit: 1000
        };

        console.log('Scanning table with params:', scanParams);
        const scanResult = await docClient.send(new ScanCommand(scanParams));
        console.log('Scan result:', scanResult);
        return scanResult.Items || [];
    } catch (error) {
        console.error('Error during queryTable:', error);
        throw error;
    }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Lambda started. Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
        AWS_REGION: process.env.AWS_REGION
    });
    
    try {
        const items = await queryTable();
        
        const response: ResponseBody = {
            message: 'Successfully retrieved records',
            timestamp: new Date().toISOString(),
            count: items.length,
            items: items
        };

        return createResponse(200, response);
    } catch (error) {
        console.error('Handler caught error:', error);
        const errorResponse = handleError(error);
        const responseBody: ResponseBody = {
            message: errorResponse.message,
            statusCode: errorResponse.statusCode
        };
        if (errorResponse.error) {
            responseBody.error = errorResponse.error;
        }
        return createResponse(errorResponse.statusCode, responseBody);
    }
};