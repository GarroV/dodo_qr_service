/**
 * Ограничение частоты на публичном маршруте (D021, третья мера защиты ссылки).
 *
 * Почему свой счётчик, а не тот, что уже есть в блоке `auth`: границы модулей запрещают
 * `fill` зависеть от `auth` — публичный маршрут не имеет права знать о входе в админку
 * (правило `public-route-has-no-auth` в `.dependency-cruiser.cjs`). Считается здесь и
 * другое: у входа считаются НЕудачи (успех говорит, что пароль знают), а здесь —
 * все обращения подряд: заполнение всегда «удачно», и считать в нём нечего, кроме частоты.
 *
 * Хранилище — память процесса, как и у входа. Отсюда два честных ограничения: счётчики
 * теряются при перезапуске и не общие у нескольких экземпляров приложения. Для одного
 * экземпляра MVP этого достаточно; таблицу ради счётчика в схему не заводим — схему
 * ведёт блок `data`, и ради предела частоты её трогать дороже, чем польза.
 */

export interface RateVerdict {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Сколько обращений в окне пропускается. */
  readonly maxHits: number;
  readonly windowSeconds: number;
  /** Потолок числа ключей в памяти: ключ приходит снаружи и подделывается. */
  readonly maxTrackedKeys: number;
}

export interface RateLimiter {
  /** Засчитать обращение и сказать, пропускать ли его. */
  hit: (key: string, now: Date) => RateVerdict;
  size: () => number;
  clearAll: () => void;
}

interface HitWindow {
  readonly startedAt: number;
  readonly hits: number;
}

const ALLOWED: RateVerdict = { allowed: true, retryAfterSeconds: 0 };
const MILLISECONDS = 1000;

/**
 * Окно фиксированное: отсчёт идёт от первого обращения, а не от последнего. Так отказ
 * гарантированно кончается в названный срок — иначе поток запросов продлевал бы
 * блокировку сотруднику, который просто пытается отправить свой чек-лист.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, HitWindow>();
  const windowMs = options.windowSeconds * MILLISECONDS;

  function liveWindow(key: string, at: number): HitWindow | undefined {
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

  // Map хранит ключи в порядке первой вставки: первый ключ — самое старое окно.
  function evictOverflow(): void {
    while (windows.size > options.maxTrackedKeys) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) return;
      windows.delete(oldest);
    }
  }

  return {
    hit(key, now) {
      const at = now.getTime();
      dropExpired(at);
      const window = liveWindow(key, at);

      if (window === undefined) {
        windows.set(key, { startedAt: at, hits: 1 });
        evictOverflow();
        return ALLOWED;
      }

      if (window.hits >= options.maxHits) {
        // Счётчик не растёт: отказ не должен продлевать окно.
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(
            (window.startedAt + windowMs - at) / MILLISECONDS,
          ),
        };
      }

      windows.set(key, { startedAt: window.startedAt, hits: window.hits + 1 });
      return ALLOWED;
    },

    size() {
      return windows.size;
    },

    clearAll() {
      windows.clear();
    },
  };
}

/**
 * Числа взяты от настоящей работы кухни, а не с потолка.
 *
 * · `submitPerCode` — 10 отправок за 5 минут с одного кода. Станцию заполняют
 *   несколько раз в сутки; даже пересменка, когда чек-лист закрывают двое подряд,
 *   плюс пара повторов на слабом Wi-Fi укладываются в это с запасом. Всё, что выше, —
 *   уже не работа, а поток.
 * · `submitEveryone` — 300 за 5 минут на всю сеть: около одной отправки в секунду.
 *   Пилот — десятки станций, то есть предел на порядки выше настоящей нагрузки, и
 *   он ловит поток, размазанный по многим подобранным кодам, который предел на код
 *   не заметит.
 * · `scanPerClient` — 60 открытий экрана в минуту с одного адреса. Сотрудник сканирует
 *   наклейку раз в смену; шестьдесят — это запас на целую пиццерию за одним внешним
 *   адресом. Отдельный счёт от отправок нужен, чтобы перебор кодов не выбирал предел
 *   отправок и не запирал кухню.
 */
export const FILL_LIMITS = {
  submitPerCode: { maxHits: 10, windowSeconds: 5 * 60, maxTrackedKeys: 10_000 },
  submitEveryone: { maxHits: 300, windowSeconds: 5 * 60, maxTrackedKeys: 1 },
  scanPerClient: { maxHits: 60, windowSeconds: 60, maxTrackedKeys: 10_000 },
} as const;

const EVERYONE = "все";

const submitPerCode = createRateLimiter(FILL_LIMITS.submitPerCode);
const submitEveryone = createRateLimiter(FILL_LIMITS.submitEveryone);
const scanPerClient = createRateLimiter(FILL_LIMITS.scanPerClient);

function strictest(verdicts: readonly RateVerdict[]): RateVerdict {
  const refused = verdicts.filter((verdict) => !verdict.allowed);
  if (refused.length === 0) return ALLOWED;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      ...refused.map((verdict) => verdict.retryAfterSeconds),
    ),
  };
}

/** Пускать ли эту отправку: считается и код станции, и вся сеть сразу. */
export function checkSubmitAllowed(code: string, now: Date): RateVerdict {
  return strictest([
    submitPerCode.hit(code, now),
    submitEveryone.hit(EVERYONE, now),
  ]);
}

/** Пускать ли открытие экрана: считается адрес клиента. */
export function checkScanAllowed(client: string, now: Date): RateVerdict {
  return scanPerClient.hit(client, now);
}

/** Полный сброс. Нужен тестам, которые делят один процесс. */
export function forgetAllFillHits(): void {
  submitPerCode.clearAll();
  submitEveryone.clearAll();
  scanPerClient.clearAll();
}
