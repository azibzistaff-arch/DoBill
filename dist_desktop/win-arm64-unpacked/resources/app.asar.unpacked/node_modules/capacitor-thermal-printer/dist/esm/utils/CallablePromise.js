export default class CallablePromise {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve_ = resolve;
            this.reject_ = reject;
        });
    }
    resolve(value) {
        this.resolve_(value);
        return this;
    }
    reject(reason) {
        this.reject_(reason);
        return this;
    }
    then(onfulfilled, onrejected) {
        return this.promise.then(onfulfilled, onrejected);
    }
    catch(onrejected) {
        return this.promise.catch(onrejected);
    }
}
//# sourceMappingURL=CallablePromise.js.map