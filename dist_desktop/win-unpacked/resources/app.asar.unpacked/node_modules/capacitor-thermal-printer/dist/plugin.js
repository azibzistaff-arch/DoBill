var capacitorCapacitorThermalPrinter = (function (exports, core) {
    'use strict';

    class CallablePromise {
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

    class Encoding {
        static blobToDataURL(blob) {
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onload = () => {
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
        static async blobToBase64(blob) {
            const dataURL = await Encoding.blobToDataURL(blob);
            return dataURL.split(',')[1];
        }
        static bufferToBase64(buffer) {
            return Encoding.blobToBase64(new Blob([buffer]));
        }
        static toURL(url) {
            try {
                return new URL(url);
            }
            catch (_a) {
                return null;
            }
        }
        static async fetchUrlToBase64(url) {
            var _a;
            const urlObject = Encoding.toURL(url);
            if (urlObject === null)
                return null;
            if (urlObject.protocol === 'data:')
                return (_a = urlObject.href.split(',')[1]) !== null && _a !== void 0 ? _a : null;
            if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:')
                return null;
            return fetch(urlObject)
                .then((e) => e.blob())
                .then(Encoding.blobToBase64);
        }
        static async toBase64(data) {
            if (typeof data === 'string') {
                // Case 1: URL or Data URL
                const base64 = await Encoding.fetchUrlToBase64(data);
                if (base64 !== null)
                    return base64;
                // Case 2: Base64
                return data;
            }
            if (data instanceof Blob) {
                // Case 3: Blob
                return await Encoding.blobToBase64(data);
            }
            if (data instanceof Array) {
                // Case 4: Number Array
                return await Encoding.bufferToBase64(new Uint8Array(data));
            }
            // Case 5: Buffer
            return await Encoding.bufferToBase64(data);
        }
    }

    const PrinterDPIs = [200, 300];
    const PrintAlignments = ['left', 'center', 'right'];
    const PrinterFonts = ['A', 'B'];
    const BarcodeTextPlacements = ['none', 'above', 'below', 'both'];
    const BarcodeTypes = ['UPC_A', 'EAN8', 'EAN13', 'CODE39', 'ITF', 'CODABAR', 'CODE128'];
    const DataCodeTypes = ['QR', ...BarcodeTypes];

    const CapacitorThermalPrinterImplementation = core.registerPlugin('CapacitorThermalPrinter');
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

    exports.BarcodeTextPlacements = BarcodeTextPlacements;
    exports.BarcodeTypes = BarcodeTypes;
    exports.CapacitorThermalPrinter = CapacitorThermalPrinter;
    exports.DataCodeTypes = DataCodeTypes;
    exports.PrintAlignments = PrintAlignments;
    exports.PrinterDPIs = PrinterDPIs;
    exports.PrinterFonts = PrinterFonts;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({}, capacitorExports);
//# sourceMappingURL=plugin.js.map
