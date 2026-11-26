export const EXTRA_MEAT_GROSZE = 1500;

export function toGrosze(pln: number): number {
  const [digits, exponent = "0"] = pln.toString().split("e");
  return Math.round(Number(`${digits}e${Number(exponent) + 2}`));
}

export function fromGrosze(grosze: number): number {
  return grosze / 100;
}

export function productLineGrosze(unitPriceGrosze: number, addonPricesGrosze: readonly number[], extraMeatCount: number, quantity: number): number {
  const addons = addonPricesGrosze.reduce((sum, price) => sum + price, 0);
  return (unitPriceGrosze + addons + extraMeatCount * EXTRA_MEAT_GROSZE) * quantity;
}

export function totalGrosze(products: number, packaging: number, delivery: number, discount: number, deposit: number): number {
  const subtotal = products + packaging + delivery;
  return subtotal - Math.min(Math.max(discount, 0), subtotal) + deposit;
}

export function quoteInPln(price: {
  products: number;
  packaging: number;
  delivery: number;
  deposit: number;
  discount: number;
  total: number;
  lines: number[];
}) {
  return {
    products: fromGrosze(price.products),
    packaging: fromGrosze(price.packaging),
    delivery: fromGrosze(price.delivery),
    deposit: fromGrosze(price.deposit),
    discount: fromGrosze(price.discount),
    total: fromGrosze(price.total),
    lines: price.lines.map(fromGrosze),
  };
}
