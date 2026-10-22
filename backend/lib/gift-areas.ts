export const GIFT_AREAS = ['home', 'farm', 'meal_prep', 'food_truck', 'catering', 'sit_down'] as const;
export type GiftArea = (typeof GIFT_AREAS)[number];

export const GIFT_AREA_LABEL: Record<GiftArea, string> = {
  home: 'Home plate',
  farm: 'FarmGrownBasket',
  meal_prep: 'MealPrepGo',
  food_truck: 'FoodTruckPopup',
  catering: 'CaterEventDeliver',
  sit_down: 'SitDownDelicious',
};

export const OFFER_AREAS = ['farm', 'meal_prep', 'food_truck', 'catering', 'sit_down'] as const;
export type OfferArea = (typeof OFFER_AREAS)[number];

export const RECIPIENTS = ['unhoused', 'elders', 'children'] as const;
export type GiftRecipient = (typeof RECIPIENTS)[number];

export const RECIPIENT_LABEL: Record<GiftRecipient, string> = {
  unhoused: 'Unhoused',
  elders: 'Elders',
  children: 'Children',
};
