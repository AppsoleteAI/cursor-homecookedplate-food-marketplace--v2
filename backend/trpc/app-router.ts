import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { supabaseTestProcedure } from "./routes/supabase-test/route";
import { signupProcedure } from "./routes/auth/signup/route";
import { loginProcedure } from "./routes/auth/login/route";
import { logoutProcedure } from "./routes/auth/logout/route";
import { meProcedure } from "./routes/auth/me/route";
import { updateProfileProcedure } from "./routes/auth/update-profile/route";
import { requestPlatemakerRoleProcedure } from "./routes/auth/request-platemaker-role/route";
import { resetPasswordProcedure } from "./routes/auth/reset-password/route";
import { reactivateAccountProcedure } from "./routes/auth/reactivate-account/route";
import { createMealProcedure } from "./routes/meals/create/route";
import { listMealsProcedure } from "./routes/meals/list/route";
import { getMealProcedure } from "./routes/meals/get/route";
import { myMealsProcedure } from "./routes/meals/my-meals/route";
import { createOrderProcedure } from "./routes/orders/create/route";
import { listOrdersProcedure } from "./routes/orders/list/route";
import { updateOrderStatusProcedure } from "./routes/orders/update-status/route";
import { updatePaymentIntentProcedure } from "./routes/orders/update-payment-intent/route";
import { createReviewProcedure } from "./routes/reviews/create/route";
import { listReviewsProcedure } from "./routes/reviews/list/route";
import { uploadMediaProcedure } from "./routes/media/upload/route";
import { createPaymentIntentProcedure } from "./routes/payments/create-payment-intent/route";
import { confirmPaymentProcedure } from "./routes/payments/confirm-payment/route";
import { createConnectAccountProcedure } from "./routes/payments/create-connect-account/route";
import { getConnectAccountStatusProcedure } from "./routes/payments/get-connect-account-status/route";
import { sendMessageProcedure } from "./routes/messages/send/route";
import { listMessagesProcedure } from "./routes/messages/list/route";
import { listConversationsProcedure } from "./routes/messages/conversations/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  supabase: createTRPCRouter({
    test: supabaseTestProcedure,
  }),
  auth: createTRPCRouter({
    signup: signupProcedure,
    login: loginProcedure,
    logout: logoutProcedure,
    me: meProcedure,
    updateProfile: updateProfileProcedure,
    requestPlatemakerRole: requestPlatemakerRoleProcedure,
    resetPassword: resetPasswordProcedure,
    reactivateAccount: reactivateAccountProcedure,
  }),
  meals: createTRPCRouter({
    create: createMealProcedure,
    list: listMealsProcedure,
    get: getMealProcedure,
    myMeals: myMealsProcedure,
  }),
  orders: createTRPCRouter({
    create: createOrderProcedure,
    list: listOrdersProcedure,
    updateStatus: updateOrderStatusProcedure,
    updatePaymentIntent: updatePaymentIntentProcedure,
  }),
  reviews: createTRPCRouter({
    create: createReviewProcedure,
    list: listReviewsProcedure,
  }),
  media: createTRPCRouter({
    upload: uploadMediaProcedure,
  }),
  payments: createTRPCRouter({
    createPaymentIntent: createPaymentIntentProcedure,
    confirmPayment: confirmPaymentProcedure,
    createConnectAccount: createConnectAccountProcedure,
    getConnectAccountStatus: getConnectAccountStatusProcedure,
  }),
  messages: createTRPCRouter({
    send: sendMessageProcedure,
    list: listMessagesProcedure,
    conversations: listConversationsProcedure,
  }),
});

export type AppRouter = typeof appRouter;
