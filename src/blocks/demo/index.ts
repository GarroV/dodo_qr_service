// Публичный вход в блок demo. Сид зовут `scripts/seed-demo.mjs` и сквозные проверки;
// прикладные экраны блока у демо нет — контур целиком живёт в данных.
export type { DemoSeedSummary, DemoStationCode, SeedOptions } from "./seed";
export { seedDemo } from "./seed";

export type { DemoDataset } from "./model";
export { DEMO } from "./dataset";
