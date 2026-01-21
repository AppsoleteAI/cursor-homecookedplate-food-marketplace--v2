export interface User {
  id: string;
  username: string;
  email: string;
  role: 'platemaker' | 'platetaker';
  isAdmin?: boolean;
  profileImage?: string;
  phone?: string;
  bio?: string;
  createdAt: Date;
  isPaused?: boolean;
  twoFactorEnabled?: boolean;
  membershipTier?: 'free' | 'premium';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  metroArea?: string | null;
  trialEndsAt?: Date | null;
  foodSafetyAcknowledged?: boolean;
}

export interface PlateMaker extends User {
  businessName: string;
  bio: string;
  rating: number;
  totalOrders: number;
  verified: boolean;
  specialties: string[];
  location: string;
}

export interface Meal {
  id: string;
  plateMakerId: string;
  plateMakerName: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  ingredients: string[];
  cuisine: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack';
  dietaryOptions: string[];
  preparationTime: number;
  available: boolean;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  tags?: string[];
  promotionalOffer?: PromotionalOffer;
  availabilityWindows?: AvailabilityWindow[];
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Order {
  id: string;
  mealId: string;
  mealName: string;
  mealImage: string;
  plateTakerId: string;
  plateTakerName?: string;
  plateMakerId: string;
  plateMakerName: string;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  quantity: number;
  totalPrice: number;
  paid?: boolean;
  specialInstructions?: string;
  cookingTemperature?: string;
  allergies?: string[];
  orderDate: Date;
  pickupTime?: Date;
  deliveryAddress?: string;
}

export interface CartItem {
  meal: Meal;
  quantity: number;
  specialInstructions?: string;
  cookingTemperature?: string;
  allergies?: string[];
  pickupTime?: Date;
  deliveryAddress?: string;
}

export interface PromotionalOffer {
  id: string;
  type: 'percentage' | 'buy-x-get-y' | 'fixed-amount' | 'free-item';
  title: string;
  description: string;
  discountPercentage?: number;
  discountAmount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  freeItemName?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: 'platemaker' | 'platetaker';
  text: string;
  createdAt: Date;
}

export interface FreshnessAttachment {
  uri: string;
  type: 'image' | 'video';
  addedAt: Date;
}

export interface MealFreshness {
  expiryDate?: string;
  receiptDate?: string;
  attachments: FreshnessAttachment[];
}

export interface CreatedMeal {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  price: number;
  ingredients: string[];
  media: { uri: string; type: 'image' | 'video' }[];
  freshness: MealFreshness;
  createdAt: Date;
}
