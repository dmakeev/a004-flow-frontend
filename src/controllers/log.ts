export class LogController {
    public verbose: boolean = true;
    private static _instance: LogController;

    public static get Instance(): LogController {
        return this._instance || (this._instance = new this());
    }

    public log(message: string, data?: any): void {
        if (!this.verbose) {
            return;
        }
        if (!!data) {
            console.log(message, data);
        } else {
            console.log(message);
        }
    }

    public warn(message: string, data?: any): void {
        if (!this.verbose) {
            return;
        }
        if (!!data) {
            console.log(message, data);
        } else {
            console.log(message);
        }
    }
}
