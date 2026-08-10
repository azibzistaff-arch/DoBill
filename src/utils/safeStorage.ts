class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] !== undefined ? keys[index] : null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

export const safeLocalStorage = (() => {
  try {
    const x = window.localStorage;
    const testKey = '__test_local_storage__';
    x.setItem(testKey, testKey);
    x.removeItem(testKey);
    return x;
  } catch (e) {
    console.log("[Storage] Using customized state-retention container.");
    return new MemoryStorage();
  }
})();

export const safeSessionStorage = (() => {
  try {
    const x = window.sessionStorage;
    const testKey = '__test_session_storage__';
    x.setItem(testKey, testKey);
    x.removeItem(testKey);
    return x;
  } catch (e) {
    console.log("[Storage] Using customized session-retention container.");
    return new MemoryStorage();
  }
})();
