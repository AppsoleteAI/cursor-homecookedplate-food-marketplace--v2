// eslint-disable-next-line import/no-unresolved
import { Resend } from 'resend';

// Error logging function - uses console.error since sentry may not be available in backend
const logError = (error: Error, context?: Record<string, unknown>) => {
  console.error('[Email Service Error]', error.message, context);
};

/**
 * Production Email Service Utility
 * 
 * Uses Resend for reliable email delivery (not Supabase's rate-limited emails).
 * Supabase emails are rate-limited and not designed for production apps.
 * 
 * CRITICAL: Set RESEND_API_KEY in environment variables.
 * Get your API key from: https://resend.com/api-keys
 */

const resendApiKey = process.env.RESEND_API_KEY || process.env.EXPO_PUBLIC_RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('[Email Service] RESEND_API_KEY not set. Email sending will fail.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Get the "from" email address from environment variable
// Defaults to a fallback if not set (for backward compatibility)
const officialEmailFrom = process.env.OFFICIAL_EMAIL_FROM || 'HomeCookedPlate <noreply@homecookedplate.com>';

if (!process.env.OFFICIAL_EMAIL_FROM) {
  console.warn('[Email Service] OFFICIAL_EMAIL_FROM not set. Using default fallback. Update with your verified domain.');
}

/**
 * Send email confirmation link to new user
 * 
 * @param email - User's email address
 * @param username - User's username
 * @param confirmationToken - Secure token for email verification
 * @param webUrl - Base URL for confirmation link (web or deep link)
 */
export async function sendEmailConfirmation(
  email: string,
  username: string,
  confirmationToken: string,
  webUrl: string
): Promise<void> {
  if (!resend) {
    console.error('[Email Service] Resend not initialized. Check RESEND_API_KEY.');
    throw new Error('Email service not configured');
  }

  try {
    // Determine confirmation URL based on platform
    // For web: use web URL, for mobile: use deep link
    const isWebUrl = webUrl.startsWith('http');
    const confirmationUrl = isWebUrl
      ? `${webUrl}/verify-email?token=${confirmationToken}`
      : `${webUrl}verify-email?token=${confirmationToken}`;

    const result = await resend.emails.send({
      from: officialEmailFrom,
      to: email,
      subject: 'Verify your HomeCookedPlate account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to HomeCookedPlate!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${username},</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Thanks for joining HomeCookedPlate! Please verify your email address to complete your account setup.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #999; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">${confirmationUrl}</p>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
              <p style="font-size: 14px; color: #666; margin-top: 20px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} HomeCookedPlate. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      text: `
Welcome to HomeCookedPlate, ${username}!

Thanks for joining! Please verify your email address by clicking the link below:

${confirmationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

© ${new Date().getFullYear()} HomeCookedPlate. All rights reserved.
      `.trim(),
    });

    if (result.error) {
      console.error('[Email Service] Failed to send confirmation email:', result.error);
      if (logError) {
        logError(new Error(`Resend error: ${result.error.message}`), {
          context: 'sendEmailConfirmation',
          email,
          username,
        });
      }
      throw new Error(`Failed to send email: ${result.error.message}`);
    }

    console.log(`[Email Service] Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('[Email Service] Error sending confirmation email:', error);
    if (logError) {
      logError(error as Error, {
        context: 'sendEmailConfirmation',
        email,
        username,
      });
    }
    throw error;
  }
}

/**
 * Send welcome email after email verification
 * 
 * @param email - User's email address
 * @param username - User's username
 */
export async function sendWelcomeEmail(
  email: string,
  username: string
): Promise<void> {
  if (!resend) {
    console.warn('[Email Service] Resend not initialized. Skipping welcome email.');
    return;
  }

  try {
    await resend.emails.send({
      from: officialEmailFrom,
      to: email,
      subject: 'Welcome to HomeCookedPlate!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to HomeCookedPlate!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${username},</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Your email has been verified! You're all set to start using HomeCookedPlate.</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Get started by:</p>
              <ul style="font-size: 16px; margin-bottom: 20px;">
                <li>Browsing delicious meals from local platemakers</li>
                <li>Placing your first order</li>
                <li>Or becoming a platemaker yourself!</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.EXPO_PUBLIC_WEB_URL || 'https://homecookedplate.com'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Get Started</a>
              </div>
            </div>
            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} HomeCookedPlate. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`[Email Service] Welcome email sent to ${email}`);
  } catch (error) {
    console.error('[Email Service] Error sending welcome email:', error);
    if (logError) {
      logError(error as Error, {
        context: 'sendWelcomeEmail',
        email,
        username,
      });
    }
    // Don't throw - welcome email is not critical
  }
}

/**
 * Send password reset email
 * 
 * @param email - User's email address
 * @param resetToken - Password reset token
 * @param webUrl - Base URL for reset link
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  webUrl: string
): Promise<void> {
  if (!resend) {
    console.warn('[Email Service] Resend not initialized. Skipping password reset email.');
    return;
  }

  try {
    const resetUrl = `${webUrl}/reset-password?token=${resetToken}`;

    await resend.emails.send({
      from: officialEmailFrom,
      to: email,
      subject: 'Reset your HomeCookedPlate password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">You requested to reset your password.</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #999; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 1 hour.</p>
              <p style="font-size: 14px; color: #666; margin-top: 20px;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} HomeCookedPlate. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`[Email Service] Password reset email sent to ${email}`);
  } catch (error) {
    console.error('[Email Service] Error sending password reset email:', error);
    if (logError) {
      logError(error as Error, {
        context: 'sendPasswordResetEmail',
        email,
      });
    }
    throw error;
  }
}
