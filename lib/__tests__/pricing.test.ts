import { calculatePrice } from '../pricing';

describe('Pricing logic unit tests', () => {
  const config = {
    bwPricePerPage: 0.05,
    colourSurcharge: 0.10,
    currency: 'GBP'
  };

  it('calculates B&W price correctly', () => {
    const result = calculatePrice(config, 10, 1, 'bw');
    expect(result.perPagePrice).toBeCloseTo(0.05, 4);
    expect(result.total).toBeCloseTo(0.50, 4);
  });

  it('calculates colour price correctly', () => {
    const result = calculatePrice(config, 10, 1, 'colour');
    expect(result.perPagePrice).toBeCloseTo(0.15, 4);
    expect(result.total).toBeCloseTo(1.50, 4);
  });

  it('calculates boundary copies (1)', () => {
    const result = calculatePrice(config, 1, 1, 'bw');
    expect(result.total).toBeCloseTo(0.05, 4);
  });

  it('calculates boundary copies (99)', () => {
    const result = calculatePrice(config, 1, 99, 'bw');
    expect(result.total).toBeCloseTo(4.95, 4);
  });
});
