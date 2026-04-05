import { latLngToCell } from "h3-js";

export function getH3(lat, lon) {
  return latLngToCell(lat, lon, 9);
}
