import { browserOrigin, checkoutReturnPath, membershipReturnUrls } from "../stripe-checkout";

describe("checkout return", () => {
  it("keeps membership and plate checkout on this website", () => {
    expect(browserOrigin("https://homecookedplate.com/checkout")).toBe("https://homecookedplate.com");
    expect(browserOrigin("https://homecookedplate.pages.dev/checkout")).toBe("https://homecookedplate.pages.dev");
    expect(membershipReturnUrls("https://www.homecookedplate.com/membership")).toEqual({
      successUrl: "https://www.homecookedplate.com/membership?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://www.homecookedplate.com/membership",
    });
    expect(membershipReturnUrls(undefined).successUrl).toBe("homecookedplate://payment-success");
    expect(checkoutReturnPath("/farm-grown-basket/basket", "/checkout")).toBe("/farm-grown-basket/basket");
    expect(checkoutReturnPath("/combined-checkout", "/checkout")).toBe("/combined-checkout");
  });

  it("refuses another site, a query, and a path that leaves the site", () => {
    expect(() => browserOrigin("https://evil.example/checkout")).toThrow(/HomeCookedPlate/);
    expect(() => browserOrigin("http://localhost:8081/checkout")).toThrow(/HomeCookedPlate/);
    expect(() => browserOrigin("http://127.0.0.1/checkout")).toThrow(/HomeCookedPlate/);
    expect(() => browserOrigin("http://homecookedplate.com/checkout")).toThrow(/HomeCookedPlate/);
    expect(() => membershipReturnUrls("https://homecookedplate.com/checkout")).toThrow(/HomeCookedPlate/);
    expect(() => membershipReturnUrls("https://evil.example/membership")).toThrow(/HomeCookedPlate/);
    expect(checkoutReturnPath("//evil.example", "/checkout")).toBe("/checkout");
    expect(checkoutReturnPath("/checkout?next=https://evil.example", "/checkout")).toBe("/checkout");
    expect(checkoutReturnPath("/../admin", "/checkout")).toBe("/checkout");
    expect(checkoutReturnPath("https://evil.example", "/combined-checkout")).toBe("/combined-checkout");
  });
});
