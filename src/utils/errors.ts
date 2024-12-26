export class DatabaseError extends Error {
    constructor(message: string, public readonly originalError?: Error) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export function handleDatabaseError(error: Error, operation: string): never {
    console.error(`Database error during ${operation}:`, error);
    throw new DatabaseError(`Failed to ${operation}`, error);
}