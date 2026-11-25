// 기기 내 저장소 어댑터.
// 화면 코드는 localStorage를 직접 쓰지 않고 이 인터페이스만 사용한다.
// 앱(React Native)으로 옮길 때는 AsyncStorage 구현으로 이 파일만 바꾸면 된다. (그래서 비동기 인터페이스)
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // 사생활 보호 모드 등에서 접근 자체가 막힌 경우
  }
}

/** 웹 구현: localStorage. 접근이 막힌 환경에서는 읽기는 null, 쓰기는 오류를 던진다. */
export const deviceStorage: KeyValueStorage = {
  async getItem(key) {
    try { return browserStorage()?.getItem(key) ?? null; } catch { return null; }
  },
  async setItem(key, value) {
    const storage = browserStorage();
    if (!storage) throw new Error('이 기기에서는 저장소를 사용할 수 없어요.');
    storage.setItem(key, value); // 용량 초과 시 예외가 그대로 전달된다.
  },
  async removeItem(key) {
    try { browserStorage()?.removeItem(key); } catch { /* 지울 수 없으면 무시 */ }
  },
};
