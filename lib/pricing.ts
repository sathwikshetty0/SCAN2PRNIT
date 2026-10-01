export interface KioskConfig {
  bwPricePerPage: number;  // e.g. 0.05
  colourSurcharge: number; // e.g. 0.10
  currency: string;        // e.g. "GBP"
}

export function calculatePrice(
  config: KioskConfig,
  pageCount: number,
  copies: number,
  colourMode: 'bw' | 'colour'
): { perPagePrice: number; total: number } {
  const perPagePrice =
    colourMode === 'colour'
      ? config.bwPricePerPage + config.colourSurcharge
      : config.bwPricePerPage;
  const total = perPagePrice * pageCount * copies;
  return { perPagePrice, total };
}

/**
 * Reads pricing configuration from environment variables.
 * Uses NEXT_PUBLIC_BW_PRICE_PER_PAGE, NEXT_PUBLIC_COLOUR_SURCHARGE,
 * and NEXT_PUBLIC_CURRENCY.
 */
export function getKioskConfig(): KioskConfig {
  const bwPricePerPage = parseFloat(
    process.env.NEXT_PUBLIC_BW_PRICE_PER_PAGE ?? '0.05'
  );
  const colourSurcharge = parseFloat(
    process.env.NEXT_PUBLIC_COLOUR_SURCHARGE ?? '0.10'
  );
  const currency = process.env.NEXT_PUBLIC_CURRENCY ?? 'GBP';

  return { bwPricePerPage, colourSurcharge, currency };
}
