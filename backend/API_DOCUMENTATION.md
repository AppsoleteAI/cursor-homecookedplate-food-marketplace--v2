# HomeCookedPlate API Documentation

**Version:** 1.0.0  
**Base URL:** `/api/trpc`  
**Protocol:** tRPC over HTTP

## Overview

This API provides backend functionality for the HomeCookedPlate marketplace platform, enabling platemakers to list meals and platetakers to browse and order them.

## Authentication

### Authentication Types

- **Public Procedures**: No authentication required
- **Protected Procedures**: Requires valid Supabase session token

### Token Usage

Include the Supabase access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

---

## API Endpoints

### Authentication

#### `auth.signup`

Create a new user account.

**Type:** Mutation (Public)

**Input:**
```typescript
{
  username: string;      // Min 3 characters
  email: string;         // Valid email format
  password: string;      // Min 6 characters
  role: 'platemaker' | 'platetaker';
}
```

**Response:**
```typescript
{
  user: {
    id: string;
    username: string;
    email: string;
    role: 'platemaker' | 'platetaker';
    phone: string | null;
    bio: string | null;
    profileImage: string | null;
    createdAt: Date;
    isPaused: boolean;
    twoFactorEnabled: boolean;
  };
  session: Session;
}
```

**Errors:**
- `Failed to create account`: Email already exists or invalid input
- `Failed to create profile`: Database error

---

#### `auth.login`

Authenticate an existing user.

**Type:** Mutation (Public)

**Input:**
```typescript
{
  email: string;
  password: string;
}
```

**Response:**
```typescript
{
  user: {
    id: string;
    username: string;
    email: string;
    role: 'platemaker' | 'platetaker';
    phone: string | null;
    bio: string | null;
    profileImage: string | null;
    createdAt: Date;
    isPaused: boolean;
    twoFactorEnabled: boolean;
  };
  session: Session;
}
```

**Errors:**
- `Invalid credentials`: Wrong email or password
- `Profile not found`: User profile doesn't exist

---

#### `auth.logout`

End the current user session.

**Type:** Mutation (Protected)

**Input:** None

**Response:**
```typescript
{
  success: boolean;
}
```

---

#### `auth.me`

Get current authenticated user's profile.

**Type:** Query (Protected)

**Input:** None

**Response:**
```typescript
{
  id: string;
  username: string;
  email: string;
  role: 'platemaker' | 'platetaker';
  phone: string | null;
  bio: string | null;
  profileImage: string | null;
  createdAt: Date;
  isPaused: boolean;
  twoFactorEnabled: boolean;
}
```

**Errors:**
- `Profile not found`: User profile doesn't exist

---

#### `auth.updateProfile`

Update current user's profile information.

**Type:** Mutation (Protected)

**Input:**
```typescript
{
  username?: string;      // Min 3 characters
  email?: string;         // Valid email format
  phone?: string;
  bio?: string;
  profileImage?: string;  // URL to profile image
}
```

**Response:**
```typescript
{
  id: string;
  username: string;
  email: string;
  role: 'platemaker' | 'platetaker';
  phone: string | null;
  bio: string | null;
  profileImage: string | null;
  createdAt: Date;
  isPaused: boolean;
  twoFactorEnabled: boolean;
}
```

**Errors:**
- `Failed to update profile`: Database error or validation failure

---

### Meals

#### `meals.create`

Create a new meal listing (platemakers only).

**Type:** Mutation (Protected)

**Input:**
```typescript
{
  name: string;
  description: string;
  price: number;                    // Positive number
  images: string[];                 // Array of image URLs
  ingredients: string[];
  cuisine: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack';
  dietaryOptions?: string[];
  preparationTime: number;          // Minutes (positive)
  tags?: string[];
  expiryDate?: string;              // ISO date string
  receiptDate?: string;             // ISO date string
}
```

**Response:**
```typescript
{
  id: string;
  userId: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  ingredients: string[];
  cuisine: string;
  category: string;
  dietaryOptions: string[];
  preparationTime: number;
  available: boolean;
  published: boolean;
  rating: number;
  reviewCount: number;
  featured: boolean;
  tags: string[];
  expiryDate: string | null;
  receiptDate: string | null;
  createdAt: Date;
}
```

**Errors:**
- `Failed to create meal`: Database error or validation failure

---

#### `meals.list`

List available meals with optional filtering.

**Type:** Query (Public)

**Input:**
```typescript
{
  userId?: string;          // Filter by platemaker
  cuisine?: string;         // Filter by cuisine type
  category?: string;        // Filter by meal category
  featured?: boolean;       // Filter featured meals
  limit?: number;           // Pagination limit
  offset?: number;          // Pagination offset
}
```

**Response:**
```typescript
Array<{
  id: string;
  plateMakerId: string;
  plateMakerName: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  ingredients: string[];
  cuisine: string;
  category: string;
  dietaryOptions: string[];
  preparationTime: number;
  available: boolean;
  rating: number;
  reviewCount: number;
  featured: boolean;
  tags: string[];
}>
```

**Note:** Only returns published and available meals.

---

#### `meals.get`

Get a specific meal by ID.

**Type:** Query (Public)

**Input:**
```typescript
{
  id: string;
}
```

**Response:**
```typescript
{
  id: string;
  plateMakerId: string;
  plateMakerName: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  ingredients: string[];
  cuisine: string;
  category: string;
  dietaryOptions: string[];
  preparationTime: number;
  available: boolean;
  rating: number;
  reviewCount: number;
  featured: boolean;
  tags: string[];
}
```

**Errors:**
- `Meal not found`: Invalid meal ID

---

#### `meals.myMeals`

Get all meals created by the authenticated user.

**Type:** Query (Protected)

**Input:** None

**Response:**
```typescript
Array<{
  id: string;
  ownerId: string;
  name: string;
  category: string;
  price: number;
  ingredients: string[];
  media: Array<{ uri: string; type: 'image' }>;
  freshness: {
    expiryDate: string | null;
    receiptDate: string | null;
    attachments: any[];
  };
  createdAt: Date;
}>
```

---

### Orders

#### `orders.create`

Create a new order for a meal.

**Type:** Mutation (Protected)

**Input:**
```typescript
{
  mealId: string;
  sellerId: string;
  quantity: number;                  // Positive integer
  totalPrice: number;                // Positive number
  specialInstructions?: string;
  cookingTemperature?: string;
  allergies?: string[];
  deliveryAddress?: string;
  pickupTime?: string;               // ISO date string
}
```

**Response:**
```typescript
{
  id: string;
  mealId: string;
  buyerId: string;
  sellerId: string;
  status: string;
  quantity: number;
  totalPrice: number;
  paid: boolean;
  specialInstructions: string | null;
  cookingTemperature: string | null;
  allergies: string[];
  deliveryAddress: string | null;
  pickupTime: Date | undefined;
  createdAt: Date;
}
```

**Errors:**
- `Failed to create order`: Database error or validation failure

---

#### `orders.list`

List orders for the authenticated user.

**Type:** Query (Protected)

**Input:**
```typescript
{
  status?: string;              // Filter by order status
  role?: 'buyer' | 'seller';    // Filter by user role
}
```

**Response:**
```typescript
Array<{
  id: string;
  mealId: string;
  mealName: string;
  mealImage: string;
  plateTakerId: string;
  plateTakerName: string;
  plateMakerId: string;
  plateMakerName: string;
  status: string;
  quantity: number;
  totalPrice: number;
  paid: boolean;
  specialInstructions: string | null;
  cookingTemperature: string | null;
  allergies: string[];
  deliveryAddress: string | null;
  pickupTime: Date | undefined;
  orderDate: Date;
}>
```

**Note:** Returns orders where user is either buyer or seller (or filtered by role).

---

#### `orders.updateStatus`

Update the status of an order.

**Type:** Mutation (Protected)

**Input:**
```typescript
{
  orderId: string;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
}
```

**Response:**
```typescript
{
  id: string;
  status: string;
}
```

**Errors:**
- `Order not found`: Invalid order ID
- `Not authorized to update this order`: User is not buyer or seller

---

### Reviews

#### `reviews.create`

Create a review for a meal.

**Type:** Mutation (Protected)

**Input:**
```typescript
{
  mealId: string;
  rating: number;        // 1-5
  comment?: string;
}
```

**Response:**
```typescript
{
  id: string;
  mealId: string;
  authorId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}
```

**Errors:**
- `Failed to create review`: Database error or validation failure

---

#### `reviews.list`

List reviews with optional filtering.

**Type:** Query (Public)

**Input:**
```typescript
{
  mealId?: string;      // Filter by meal
  userId?: string;      // Filter by author
}
```

**Response:**
```typescript
Array<{
  id: string;
  mealId: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
}>
```

---

### Media

#### `media.upload`

Upload media (image/video) for a meal.

**Type:** Mutation (Protected)

**Input:**
```typescript
{
  mealId: string;
  base64Data: string;           // Base64 encoded file data
  mimeType: string;             // e.g., 'image/jpeg', 'video/mp4'
  type: 'image' | 'video';
}
```

**Response:**
```typescript
{
  id: string;
  uri: string;              // Public URL to uploaded media
  type: 'image' | 'video';
  createdAt: Date;
}
```

**Errors:**
- `Failed to upload media`: Storage error
- `Failed to save media attachment`: Database error

---

## Error Handling

All errors follow the tRPC error format:

```typescript
{
  error: {
    message: string;
    code: string;
    data: {
      code: string;
      httpStatus: number;
      path: string;
    };
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Missing or invalid authentication token
- `BAD_REQUEST`: Invalid input data
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Server error

---

## Rate Limiting

⚠️ **Not Currently Implemented**

Rate limiting is recommended for production deployment to prevent abuse.

---

## Example Usage

### TypeScript/React Native

```typescript
import { trpc } from '@/lib/trpc';

// Signup
const signupMutation = trpc.auth.signup.useMutation();
const result = await signupMutation.mutateAsync({
  username: 'johndoe',
  email: 'john@example.com',
  password: 'secure123',
  role: 'platetaker'
});

// List meals
const mealsQuery = trpc.meals.list.useQuery({
  cuisine: 'Italian',
  limit: 10
});

// Create order
const orderMutation = trpc.orders.create.useMutation();
await orderMutation.mutateAsync({
  mealId: 'meal-123',
  sellerId: 'seller-456',
  quantity: 2,
  totalPrice: 29.99
});
```

---

## Database Schema

For detailed database schema information, see:
- `backend/sql/schema.sql` - Table definitions
- `backend/sql/rls_policies.sql` - Row Level Security policies
- `backend/sql/storage.sql` - Storage bucket configuration

---

## Security

### Authentication
- Passwords are hashed using Supabase Auth (bcrypt)
- JWT tokens expire after session timeout
- Session tokens should be stored securely on the client

### Authorization
- Row Level Security (RLS) policies enforce data access
- Protected procedures verify user authentication
- Order updates restricted to buyer/seller only

### Data Validation
- All inputs validated using Zod schemas
- SQL injection protection via parameterized queries
- XSS protection via proper data sanitization

---

## Support

For issues or questions:
1. Check error messages and logs
2. Review this documentation
3. Check database RLS policies if access denied
4. Verify authentication tokens are valid

---

**Last Updated:** 2026-01-01
