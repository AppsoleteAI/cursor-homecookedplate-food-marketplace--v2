export interface User {
  id: string;
  username: string;
  email: string;
  role: 'platemaker' | 'platetaker';
  /** The role stored on the account. Stays platemaker while ordering is turned on. */
  accountRole?: 'platemaker' | 'platetaker';
  /** A PlateMaker is using PlateTaker ordering until this is turned off. */
  orderingAsBuyer?: boolean;
  isAdmin?: boolean;
  adminRole?: 'main' | 'monitor' | null;
  profileImage?: string;
  phone?: string;
  bio?: string;
  createdAt: Date;
  isPaused?: boolean;
  twoFactorEnabled?: boolean;
  membershipTier?: 'free' | 'premium' | 'lifetime';
  needsMembership?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  metroArea?: string | null;
  /** The city named on the Early Bird claim. Empty when this cook has no claim. */
  earlyBirdClaimMetro?: string | null;
  /** This device finished Get GPS outside every saved metro, so the kitchen may open. */
  kitchenOpened?: boolean;
  /** A paid order still needs pickup, so an ended trial does not send this cook to Membership. */
  closeoutKeepsKitchen?: boolean;
  trialEndsAt?: Date | null;
  trialExpired?: boolean;
  trialCountdownDays?: number | null;
  foodSafetyAcknowledged?: boolean;
  orderingRemoved?: boolean;
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
  /** The cook is not paused and Available For Orders is on. */
  acceptingOrders?: boolean;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  tags?: string[];
  isSample?: boolean;
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
  instructionsStatus?: 'pending' | 'allowed' | 'removed' | null;
  cookingTemperature?: string;
  allergies?: string[];
  orderDate: Date;
  pickupTime?: Date;
  pickupTimeZone?: string;
  /** Who has already confirmed pickup on a ready order. */
  pickupConfirmedBy?: ('buyer' | 'seller')[];
  /** This buyer has blocked new orders from this cook. */
  cookBlocked?: boolean;
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
  mealId?: string;
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
  moderationStatus?: 'pending' | 'allowed' | 'removed';
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
