/**
 * Ограничение частоты неудачных попыток входа (T066).
 *
 * Пароль один на всю сеть, админка смотрит в интернет, и до этой правки перебор упирался
 * только в стоимость scrypt — около 0,1 с на попытку. Теперь считаются неудачи.
 *
 * Хранилище — память процесса: схему базы ведёт блок `data`, и заводить ради счётчика
 * таблицу дороже, чем польза. Отсюда два честных ограничения, которые надо знать:
 * счётчики теряются при перезапуске приложения и не общие у нескольких экземпляров.
 * Для одного экземпляра MVP этого достаточно; на нескольких предел станет мягче ровно
 * во столько раз, сколько экземпляров.
 */

/** Приговор попытке: пускать ли и, если нет, через сколько секунд повторять. */
export interface ThrottleVerdict {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface ThrottleOptions {
  /** Сколько неудач в окне допускается, прежде чем начнётся отказ. */
  readonly maxFailures: number;
  readonly windowSeconds: number;
  /** Потолок числа клиентов в памяти: заголовок с адресом подделывается. */
  readonly maxTrackedClients: number;
}

export interface LoginThrottle {
  check: (key: string, now: Date) => ThrottleVerdict;
  registerFailure: (key: string, now: Date) => void;
  /** Удачный вход: счётчик клиента снимается. */
  clear: (key: string) => void;
  clearAll: () => void;
  /** Сколько клиентов сейчас в памяти. Нужно проверке, что хранилище не растёт. */
  size: () => number;
}

interface FailureWindow {
  readonly startedAt: number;
  readonly failures: number;
}

const ALLOWED: ThrottleVerdict = { allowed: true, retryAfterSeconds: 0 };
const MILLISECONDS = 1000;

/**
 * Окно фиксированное: отсчёт идёт от первой неудачи, а не от последней. Так отказ
 * гарантированно кончается в названный срок — иначе попытки злоумышленника продлевали бы
 * блокировку администратору бесконечно.
 */
export function createLoginThrottle(options: ThrottleOptions): LoginThrottle {
  const windows = new Map<string, FailureWindow>();
  const windowMs = options.windowSeconds * MILLISECONDS;

  function liveWindow(key: string, at: number): FailureWindow | undefined {
    const found = windows.get(key);
    if (found === undefined) return undefined;
    if (at - found.startedAt >= windowMs) {
      windows.delete(key);
      return undefined;
    }
    return found;
  }

  function dropExpired(at: number): void {
    for (const [key, window] of windows) {
      if (at - window.startedAt >= windowMs) windows.delete(key);
    }
  }

  // Map хранит ключи в порядке первой вставки, а запись создаётся первой неудачей клиента:
  // первый ключ — самое старое окно, его и вытесняем.
  function evictOverflow(): void {
    while (windows.size > options.maxTrackedClients) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) return;
      windows.delete(oldest);
    }
  }

  return {
    check(key, now) {
      const at = now.getTime();
      const window = liveWindow(key, at);
      if (window === undefined || window.failures < options.maxFailures) {
        return ALLOWED;
      }
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(
          (window.startedAt + windowMs - at) / MILLISECONDS,
        ),
      };
    },

    registerFailure(key, now) {
      const at = now.getTime();
      dropExpired(at);
      const window = liveWindow(key, at);
      windows.set(
        key,
        window === undefined
          ? { startedAt: at, failures: 1 }
          : { startedAt: window.startedAt, failures: window.failures + 1 },
      );
      evictOverflow();
    },

    clear(key) {
      windows.delete(key);
    },

    clearAll() {
      windows.clear();
    },

    size() {
      return windows.size;
    },
  };
}

/**
 * Пределы. Клиентский — жёсткий: пять промахов подряд человек не делает.
 * Общий — потолок на случай, когда клиентский обходят: адрес берётся из заголовка,
 * а заголовок подделывается, и без общего счёта перебор шёл бы с нового адреса каждый раз.
 * Общий предел заметно выше клиентского, чтобы чужие промахи не запирали администратора
 * при первой же случайной опечатке соседа.
 */
export const LOGIN_LIMITS = {
  perClient: {
    maxFailures: 5,
    windowSeconds: 15 * 60,
    maxTrackedClients: 10_000,
  },
  everyone: { maxFailures: 50, windowSeconds: 15 * 60, maxTrackedClients: 1 },
} as const;

const EVERYONE = "все";

const perClient = createLoginThrottle(LOGIN_LIMITS.perClient);
const everyone = createLoginThrottle(LOGIN_LIMITS.everyone);

/** Пускать ли эту попытку. Отказ называет больший из двух сроков ожидания. */
export function checkLoginAllowed(client: string, now: Date): ThrottleVerdict {
  const verdicts = [
    perClient.check(client, now),
    everyone.check(EVERYONE, now),
  ];
  const refused = verdicts.filter((verdict) => !verdict.allowed);
  if (refused.length === 0) return ALLOWED;

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      ...refused.map((verdict) => verdict.retryAfterSeconds),
    ),
  };
}

/** Неверный пароль: считается и клиенту, и всем сразу. */
export function registerLoginFailure(client: string, now: Date): void {
  perClient.registerFailure(client, now);
  everyone.registerFailure(EVERYONE, now);
}

/**
 * Удачный вход снимает оба счётчика: тот, кто знает пароль, — не перебор, и запирать
 * его из-за чужих промахов незачем.
 */
export function forgetLoginFailures(client: string): void {
  perClient.clear(client);
  everyone.clear(EVERYONE);
}

/** Полный сброс. Нужен тестам, которые делят один процесс. */
export function forgetAllLoginFailures(): void {
  perClient.clearAll();
  everyone.clearAll();
}
