import type { Meal, PromotionalOffer } from '@/types';

type ApiOffer = {
  id: string;
  mealId?: string;
  type: PromotionalOffer['type'];
  title: string;
  description: string;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  freeItemName?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  isActive?: boolean;
};

type ApiMeal = {
  id: string;
  plateMakerId: string;
  plateMakerName: string;
  name: string;
  description: string;
  price: number;
  images?: string[] | null;
  ingredients?: string[] | null;
  cuisine: string;
  category: string;
  dietaryOptions?: string[] | null;
  preparationTime: number;
  available: boolean;
  acceptingOrders?: boolean;
  rating: number;
  reviewCount: number;
  featured?: boolean | null;
  tags?: string[] | null;
  isSample?: boolean;
  canOrder?: boolean;
  promotionalOffer?: ApiOffer | null;
};

export function promotionalOfferFromApi(offer: ApiOffer | null | undefined): PromotionalOffer | undefined {
  if (!offer) return undefined;
  const start = offer.startDate instanceof Date ? offer.startDate : new Date(offer.startDate);
  const end = offer.endDate instanceof Date ? offer.endDate : new Date(offer.endDate);
  return {
    id: offer.id,
    mealId: offer.mealId,
    type: offer.type,
    title: offer.title,
    description: offer.description,
    discountPercentage: offer.discountPercentage ?? undefined,
    discountAmount: offer.discountAmount ?? undefined,
    buyQuantity: offer.buyQuantity ?? undefined,
    getQuantity: offer.getQuantity ?? undefined,
    freeItemName: offer.freeItemName ?? undefined,
    startDate: start,
    endDate: end,
    isActive: offer.isActive !== false,
    createdAt: start,
  };
}

/** Keeps meals.price as the list price and keeps the offer that replaces it. */
export function menuMeal(meal: ApiMeal): Meal {
  return {
    id: meal.id,
    plateMakerId: meal.plateMakerId,
    plateMakerName: meal.plateMakerName,
    name: meal.name,
    description: meal.description,
    price: meal.price,
    images: meal.images || [],
    ingredients: meal.ingredients || [],
    cuisine: meal.cuisine,
    category: meal.category as Meal['category'],
    dietaryOptions: meal.dietaryOptions || [],
    preparationTime: meal.preparationTime,
    available: meal.available,
    acceptingOrders: meal.acceptingOrders,
    rating: meal.rating,
    reviewCount: meal.reviewCount,
    featured: meal.featured || false,
    tags: meal.tags || [],
    isSample: meal.isSample === true,
    canOrder: meal.canOrder,
    promotionalOffer: promotionalOfferFromApi(meal.promotionalOffer),
  };
}
