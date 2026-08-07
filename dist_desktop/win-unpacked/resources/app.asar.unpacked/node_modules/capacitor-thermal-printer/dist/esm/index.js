import { registerPlugin } from '@capacitor/core';
import CallablePromise from './utils/CallablePromise';
import Encoding from './utils/Encoding';
const CapacitorThermalPrinterImplementation = registerPlugin('CapacitorThermalPrinter');
const wrappedMethodsArgNames = {
    //#region Text Formatting
    bold: ['enabled'],
    underline: ['enabled'],
    doubleWidth: ['enabled'],
    doubleHeight: ['enabled'],
    inverse: ['enabled'],
    //#endregion
    //#region Image Formatting
    dpi: ['dpi'],
    limitWidth: ['width'],
    //#endregion
    //#region Data Code Formatting
    barcodeWidth: ['width'],
    barcodeHeight: ['height'],
    barcodeTextPlacement: ['placement'],
    //#endregion
    //#region Hybrid Formatting
    align: ['alignment'],
    charSpacing: ['charSpacing'],
    lineSpacing: ['lineSpacing'],
    font: ['font'],
    clearFormatting: [],
    //#endregion
    //#region Content
    text: ['text'],
    image: ['image'],
    qr: ['data'],
    barcode: ['type', 'data'],
    raw: ['data'],
    selfTest: [],
    //#endregion
    //#region Content Actions
    beep: [],
    openDrawer: [],
    cutPaper: ['half'],
    feedCutPaper: ['half'],
    //#endregion
    //#region Printing Actions
    begin: [],
    write: [],
    //#endregion
};
const wrappedMethodsMiddleware = {
    async image(data) {
        return { image: await Encoding.toBase64(data) };
    },
    async raw(data) {
        return { data: await Encoding.toBase64(data) };
    },
};
function mapArgs(key, args) {
    if (key in wrappedMethodsMiddleware) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return wrappedMethodsMiddleware[key](...args);
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const argNames = wrappedMethodsArgNames[key];
    return Object.fromEntries(argNames.map((name, index) => [name, structuredClone(args[index])]));
}
const wrappedMethods = {
    isConnected() {
        return CapacitorThermalPrinterImplementation.isConnected().then(({ state }) => state);
    },
    connect(...args) {
        return CapacitorThermalPrinterImplementation.connect(...args).then((result) => result !== null && result !== void 0 ? result : null);
    }
};
for (const key in wrappedMethodsArgNames) {
    wrappedMethods[key] = (...args) => {
        // Capture and clone the arguments before anything.
        const options = mapArgs(key, args);
        const trailingLock = callQueue.pop();
        const lock = new CallablePromise();
        callQueue.push(lock);
        const promise = Promise.resolve(trailingLock).then(async () => {
            try {
                await CapacitorThermalPrinterImplementation[key](await options);
            }
            finally {
                lock.resolve();
            }
        });
        if (key === 'write')
            return promise;
        return CapacitorThermalPrinter;
    };
}
/// ! To preserve the builder pattern while maintaining thread safety,
/// ! each method call is queued asynchronously before being executed.
/// ! However, a synchronous reference to the object is returned immediately
/// ! achieving our target of a builder pattern!
const callQueue = [];
const CapacitorThermalPrinter = new Proxy({}, {
    get(_, prop) {
        if (prop in wrappedMethods) {
            return wrappedMethods[prop];
        }
        return CapacitorThermalPrinterImplementation[prop];
    },
});
export * from './definitions';
export { CapacitorThermalPrinter };
//# sourceMappingURL=index.js.map