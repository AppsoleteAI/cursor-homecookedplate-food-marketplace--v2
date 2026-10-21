import { quoteCard, quoteCheckout, quoteCombined } from '../combined-checkout';

describe('combined checkout receipt', () => {
  it('keeps each checkout fee split and adds one card total', () => {
    const plate = quoteCheckout({
      area: 'home',
      sellerId: 'cook-1',
      sellerName: 'Ada',
      lines: [{ name: 'Chicken plate', quantity: 1, unitPrice: 20 }],
    });
    const truck = quoteCheckout({
      area: 'food_truck',
      sellerId: 'truck-1',
      sellerName: 'Lantern',
      lines: [{ name: 'Taco', quantity: 1, unitPrice: 12 }],
    });
    const farm = quoteCheckout({
      area: 'farm',
      sellerId: 'farm-1',
      sellerName: 'Hearth',
      lines: [{ name: 'Apples', quantity: 1, unitPrice: 10 }],
    });
    const receipt = quoteCombined([plate, truck, farm]);

    expect(plate.buyerPays).toBe(22);
    expect(plate.sellerPayout).toBe(18);
    expect(plate.platformKeeps).toBe(4);
    expect(truck.buyerPays).toBe(13.2);
    expect(truck.sellerPayout).toBe(10.8);
    expect(farm.buyerPays).toBe(11);
    expect(farm.sellerPayout).toBe(9);
    expect(receipt.combinedBuyerPays).toBe(46.2);
    expect(receipt.combinedPlatform).toBe(8.4);
    expect(receipt.combinedSellerPayout).toBe(37.8);
  });

  it('refunds one checkout from the seller share of that checkout only', () => {
    const truck = quoteCheckout({
      area: 'food_truck',
      sellerId: 'truck-1',
      sellerName: 'Lantern',
      lines: [{ name: 'Taco', quantity: 1, unitPrice: 12 }],
    });
    const receipt = quoteCombined([
      quoteCheckout({
        area: 'home',
        sellerId: 'cook-1',
        sellerName: 'Ada',
        lines: [{ name: 'Chicken plate', quantity: 1, unitPrice: 20 }],
      }),
      truck,
    ]);
    const afterTruckRefund = Math.round((receipt.combinedBuyerPays - truck.sellerPayout) * 100) / 100;
    expect(truck.sellerPayout).toBe(10.8);
    expect(afterTruckRefund).toBe(24.4);
    expect(truck.platformKeeps).toBe(2.4);
  });

  it('uses the combined food total for a premium buyer fee', () => {
    const receipt = quoteCard([
      {
        area: 'farm',
        sellerId: 'farm-1',
        sellerName: 'Hearth',
        buyerRole: 'platetaker',
        buyerMembershipTier: 'premium',
        lines: [{ name: 'Eggs', quantity: 1, unitPrice: 15 }],
      },
      {
        area: 'food_truck',
        sellerId: 'truck-1',
        sellerName: 'Lantern',
        buyerRole: 'platetaker',
        buyerMembershipTier: 'premium',
        lines: [{ name: 'Taco', quantity: 1, unitPrice: 15 }],
      },
    ]);
    expect(receipt.combinedBase).toBe(30);
    expect(receipt.checkouts[0].buyerFee).toBe(0.75);
    expect(receipt.checkouts[1].buyerFee).toBe(0.75);
    expect(receipt.combinedBuyerPays).toBe(31.5);
    expect(receipt.checkouts[0].sellerPayout).toBe(13.5);
  });

  it('keeps an offer line total that is not a round unit price', () => {
    const plate = quoteCheckout({
      area: 'home',
      sellerId: 'cook-1',
      sellerName: 'Ada',
      lines: [{ name: 'Rice', quantity: 3, unitPrice: 16 / 3, lineTotal: 16 }],
    });
    expect(plate.baseAmount).toBe(16);
    expect(plate.buyerPays).toBe(17.6);
  });
});
