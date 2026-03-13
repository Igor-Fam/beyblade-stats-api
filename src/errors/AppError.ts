export class AppError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;

        // Mantém o nome da classe correto no stack trace
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
