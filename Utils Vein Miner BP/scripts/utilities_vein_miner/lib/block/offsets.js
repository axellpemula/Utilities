import { OFFSETS_6, OFFSETS_26 } from "../util/position";

/**
 * Neighbourhood used by the flood fill shapes.
 *
 * Lives in its own module so the shape files no longer have to import
 * `selectArea.js` (which imports them) - that was a circular import.
 * @param {{config: {connectedDiagonals: boolean}}} info
 * @returns {ReadonlyArray<ReadonlyArray<number>>}
 */
export function getOffsetType(info) {
    return info.config.connectedDiagonals ? OFFSETS_26 : OFFSETS_6;
}
