// #region agent log - ROUTER_LOAD: Track when router is created
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/app-router.ts:ROUTER_LOAD',message:'Router module loading - importing signupProcedure',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'router-load',hypothesisId:'F'})}).catch(()=>{});
// #endregion
import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { supabaseTestProcedure } from "./routes/supabase-test/route";
import { signupProcedure } from "./routes/auth/signup/route";
import { checkEligibilityProcedure } from "./routes/auth/check-eligibility/route";
// #region agent log - ROUTER_LOAD: Signup procedure imported
// Log procedure details to verify which version is imported
const procedureDetails = {
  hasSignupProcedure: !!signupProcedure,
  procedureType: typeof signupProcedure,
  procedureKeys: signupProcedure ? Object.keys(signupProcedure).join(',') : 'null',
  timestamp: Date.now()
};
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/app-router.ts:ROUTER_LOAD_AFTER_IMPORT',message:'Signup procedure imported into router',data:procedureDetails,timestamp:Date.now(),sessionId:'debug-session',runId:'router-load',hypothesisId:'F'})}).catch(()=>{});
// #endregion
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
import { createSetupIntentProcedure } from "./routes/payments/create-setup-intent/route";
import { getPaymentMethodFromSetupProcedure } from "./routes/payments/get-payment-method-from-setup/route";
import { sendMessageProcedure } from "./routes/messages/send/route";
import { listMessagesProcedure } from "./routes/messages/list/route";
import { listConversationsProcedure } from "./routes/messages/conversations/route";
import { subscribeProcedure } from "./routes/membership/subscribe/route";
import { checkTrialEligibilityProcedure } from "./routes/trials/check-eligibility/route";
import { metroCountsProcedure } from "./routes/admin/metro-counts/route";
import { updateMaxCapProcedure } from "./routes/admin/update-max-cap/route";
import { updateMetroSettingsProcedure } from "./routes/admin/update-metro-settings/route";

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
    checkEligibility: checkEligibilityProcedure,
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
    createSetupIntent: createSetupIntentProcedure,
    getPaymentMethodFromSetup: getPaymentMethodFromSetupProcedure,
  }),
  messages: createTRPCRouter({
    send: sendMessageProcedure,
    list: listMessagesProcedure,
    conversations: listConversationsProcedure,
  }),
  membership: createTRPCRouter({
    subscribe: subscribeProcedure,
  }),
  trials: createTRPCRouter({
    checkEligibility: checkTrialEligibilityProcedure,
  }),
  admin: createTRPCRouter({
    getMetroCounts: metroCountsProcedure,
    updateMaxCap: updateMaxCapProcedure,
    updateMetroSettings: updateMetroSettingsProcedure,
  }),
});

export type AppRouter = typeof appRouter;
