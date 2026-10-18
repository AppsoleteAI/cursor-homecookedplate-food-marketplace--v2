import { calculateDeliveryLevy, orderTotalWithDelivery } from '../fees';

describe('delivery levy', () => {
  it('adds 5% on top of the delivery amount the PlateMaker set', () => {
    const levy = calculateDeliveryLevy(8);
    expect(levy.deliveryFee).toBe(8);
    expect(levy.platformFee).toBe(0.4);
    expect(levy.buyerPays).toBe(8.4);
    expect(levy.sellerReceives).toBe(8);
  });

  it('leaves a food order unchanged when delivery is zero', () => {
    const total = orderTotalWithDelivery(22, 18, 0);
    expect(total.buyerPays).toBe(22);
    expect(total.sellerReceives).toBe(18);
    expect(total.levy.platformFee).toBe(0);
  });

  it('adds the delivery levy to the food split', () => {
    const total = orderTotalWithDelivery(22, 18, 8);
    expect(total.buyerPays).toBe(30.4);
    expect(total.sellerReceives).toBe(26);
  });
});
