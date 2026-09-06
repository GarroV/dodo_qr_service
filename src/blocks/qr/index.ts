// Публичный вход в блок qr. Наружу выставлены только рисование кода и адрес,
// который в нём зашит: экран печати и экран планшета живут внутри блока.
export { QR_QUIET_ZONE, stationQrSvg } from "./svg";
export { STATION_SCAN_PREFIX, stationScanUrl } from "./scan-url";
