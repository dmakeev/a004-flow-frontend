export declare class LogController {
    verbose: boolean;
    private static _instance;
    static get Instance(): LogController;
    log(message: string, data?: any): void;
    warn(message: string, data?: any): void;
}
