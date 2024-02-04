export class LogController {
    verbose = true;
    static _instance;
    static get Instance() {
        return this._instance || (this._instance = new this());
    }
    log(message, data) {
        if (!this.verbose) {
            return;
        }
        if (!!data) {
            console.log(message, data);
        }
        else {
            console.log(message);
        }
    }
    warn(message, data) {
        if (!this.verbose) {
            return;
        }
        if (!!data) {
            console.log(message, data);
        }
        else {
            console.log(message);
        }
    }
}
//# sourceMappingURL=log.js.map