/**
 * Учётные данные ТОЛЬКО для сквозных сценариев. Секретом не являются: сервер под тесты
 * поднимает playwright.config.ts с этими значениями, наружу они не уезжают, а рабочие
 * `ADMIN_PASSWORD_HASH` и `SESSION_SECRET` живут в `.env` и в git не попадают.
 */
export const E2E_ADMIN_PASSWORD = "e2e-пароль-администратора";

/** Хэш пароля выше, посчитанный рабочими параметрами scrypt. */
export const E2E_ADMIN_PASSWORD_HASH =
  "scrypt$32768$8$1$VEBPqyZizNCu1bBmEgQQoQ$ew-dS1kNOX5bnC4kEI-p5xLrSb_misQXVp5VTUB_V1o";

export const E2E_SESSION_SECRET =
  "e2e-секрет-подписи-сессии-длиннее-32-знаков-0123456789";
