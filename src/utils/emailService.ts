import nodemailer, { Transporter } from 'nodemailer';
import { IOrder } from '../models/Order';

// Email configuration interface
interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
  fromName?: string;
}

// Initialize email transporter
let transporter: Transporter | null = null;

// Initialize email service
export const initializeEmailService = (): void => {
  const emailConfig: EmailConfig = {
    from: process.env.EMAIL_FROM || 'noreply@giaom-marketplace.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Giaom Marketplace'
  };

  // Check if using SendGrid (via SMTP) or custom SMTP
  if (process.env.EMAIL_SERVICE === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    // SendGrid configuration using SMTP
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'apikey', // SendGrid requires 'apikey' as username
        pass: process.env.SENDGRID_API_KEY
      }
    });
    
    // Verify connection (async, don't block)
    transporter.verify().then(() => {
      console.log('✅ Email service (SendGrid) is ready');
    }).catch((error) => {
      console.error('❌ Email service (SendGrid) verification failed:', error.message);
      console.error('   Please check your SENDGRID_API_KEY in .env file');
    });
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // SMTP configuration
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
    
    // Trim whitespace from credentials (common .env file issue)
    const smtpUser = process.env.SMTP_USER.trim();
    const smtpPass = process.env.SMTP_PASS.trim();
    const smtpHost = process.env.SMTP_HOST.trim();
    
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      requireTLS: !smtpSecure, // Require TLS for port 587 (STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      // Additional options for better compatibility
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates (for development)
      },
      // Connection timeout
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000
    });
    
    // Verify connection (async, don't block)
    transporter.verify().then(() => {
      console.log(`✅ Email service (SMTP: ${smtpHost}) is ready`);
      console.log(`   Authenticated as: ${smtpUser}`);
    }).catch((error: any) => {
      console.error(`❌ Email service (SMTP: ${smtpHost}) verification failed`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Host: ${smtpHost}:${smtpPort}`);
      console.error(`   User: ${smtpUser}`);
      console.error('   Please check your SMTP credentials in .env file');
      console.error('   Common issues:');
      console.error('   - Wrong username/password');
      console.error('   - Credentials have extra spaces (check .env file)');
      console.error('   - Gmail requires App Password (not regular password)');
      console.error('   - 2FA must be enabled for Gmail App Passwords');
      console.error('   - Brevo/Sendinblue: Check SMTP credentials in Brevo dashboard (SMTP & API section)');
      console.error('   - Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      if (error.response) {
        console.error(`   Server response: ${error.response}`);
      }
      if (error.responseCode) {
        console.error(`   Response code: ${error.responseCode}`);
      }
      // Log the full error in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('   Full error:', error);
      }
    });
  } else {
    // Development mode: use Ethereal Email (test account)
    console.warn('⚠️  Email service not configured. Using console logging for development.');
    console.warn('   To enable email sending, configure SMTP or SendGrid in your .env file');
    transporter = null;
  }
};

// Email templates
const getEmailTemplate = (title: string, content: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .order-details {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .order-item {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .order-item:last-child {
      border-bottom: none;
    }
    .order-total {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      font-weight: bold;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Giaom Marketplace</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Giaom Marketplace. All rights reserved.</p>
      <p>This is an automated email, please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;
};

// Send email function
const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> => {
  if (!transporter) {
    // Development mode: log email instead of sending
    console.log('\n📧 Email would be sent:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML:', html);
    if (text) console.log('Text:', text);
    console.log('---\n');
    return;
  }

  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'Giaom Marketplace';
    const fromEmail = process.env.EMAIL_FROM || 'noreply@giaom-marketplace.com';
    
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || subject // Fallback to subject if no text provided
    });

    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error: any) {
    console.error('❌ Error sending email:', error.message);
    
    // Provide helpful error messages for common authentication issues
    if (error.code === 'EAUTH' || error.message.includes('Invalid login')) {
      console.error('   Authentication failed. Please check:');
      if (process.env.EMAIL_SERVICE === 'sendgrid') {
        console.error('   - SENDGRID_API_KEY is correct');
        console.error('   - API key has "Mail Send" permissions in SendGrid');
      } else {
        console.error('   - SMTP_USER and SMTP_PASS are correct');
        console.error('   - For Gmail: Use App Password (not regular password)');
        console.error('   - For Gmail: Enable 2FA and generate App Password');
        console.error('   - SMTP_HOST, SMTP_PORT are correct');
      }
    } else if (error.code === 'ECONNECTION' || error.message.includes('connection')) {
      console.error('   Connection failed. Please check:');
      console.error('   - SMTP_HOST is correct');
      console.error('   - SMTP_PORT is correct (587 for TLS, 465 for SSL)');
      console.error('   - Firewall/network allows SMTP connections');
    }
    
    // Don't throw error - email failures shouldn't break the application
    // Log for monitoring but continue execution
  }
};

// Order confirmation email
export const sendOrderConfirmationEmail = async (
  userEmail: string,
  userName: string,
  order: IOrder
): Promise<void> => {
  const orderItemsHtml = order.items
    .map(
      (item) => `
    <div class="order-item">
      <strong>${item.title}</strong><br>
      Quantity: ${item.quantity} × $${item.price.toFixed(2)} = $${(item.price * item.quantity).toFixed(2)}
    </div>
  `
    )
    .join('');

  const shippingAddress = order.shippingAddress;
  const addressHtml = `
    <p>
      <strong>${shippingAddress.fullName}</strong><br>
      ${shippingAddress.address}<br>
      ${shippingAddress.city}${shippingAddress.state ? `, ${shippingAddress.state}` : ''} ${shippingAddress.zipCode}<br>
      ${shippingAddress.country}
    </p>
  `;

  const content = `
    <h2>Order Confirmation</h2>
    <p>Hi ${userName || 'there'},</p>
    <p>Thank you for your order! We've received your order and will process it shortly.</p>
    
    <div class="order-details">
      <h3>Order Details</h3>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
      <p><strong>Status:</strong> ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
      
      <h4>Items:</h4>
      ${orderItemsHtml}
      
      <div class="order-total">
        <p>Subtotal: $${(order.totalAmount / 1.08).toFixed(2)}</p>
        <p>Tax (8%): $${(order.totalAmount * 0.08 / 1.08).toFixed(2)}</p>
        <p>Total: $${order.totalAmount.toFixed(2)}</p>
      </div>
      
      <h4>Shipping Address:</h4>
      ${addressHtml}
    </div>
    
    <p>You can track your order status in your account dashboard.</p>
    <p>If you have any questions, please don't hesitate to contact our support team.</p>
  `;

  const html = getEmailTemplate('Order Confirmation', content);
  const text = `Order Confirmation\n\nHi ${userName || 'there'},\n\nThank you for your order! Order ID: ${order._id}\nTotal: $${order.totalAmount.toFixed(2)}\n\nView your order details in your account dashboard.`;

  await sendEmail(userEmail, 'Order Confirmation - Giaom Marketplace', html, text);
};

// Order status update email
export const sendOrderStatusUpdateEmail = async (
  userEmail: string,
  userName: string,
  order: IOrder,
  previousStatus?: string
): Promise<void> => {
  const statusMessages: Record<string, string> = {
    pending: 'Your order is pending and will be processed soon.',
    processing: 'Your order is being processed and prepared for shipment.',
    shipped: 'Great news! Your order has been shipped and is on its way to you.',
    delivered: 'Your order has been delivered! We hope you enjoy your purchase.',
    cancelled: 'Your order has been cancelled. If you have any questions, please contact support.'
  };

  const statusMessage = statusMessages[order.status] || 'Your order status has been updated.';

  const content = `
    <h2>Order Status Update</h2>
    <p>Hi ${userName || 'there'},</p>
    <p>${statusMessage}</p>
    
    <div class="order-details">
      <h3>Order Information</h3>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Status:</strong> <strong style="color: #2563eb;">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</strong></p>
      ${previousStatus ? `<p><strong>Previous Status:</strong> ${previousStatus.charAt(0).toUpperCase() + previousStatus.slice(1)}</p>` : ''}
      <p><strong>Updated:</strong> ${new Date(order.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
    </div>
    
    ${order.status === 'shipped' ? '<p>You can track your shipment using the tracking information in your order details.</p>' : ''}
    ${order.status === 'delivered' ? '<p>Thank you for shopping with us! We hope you love your purchase.</p>' : ''}
    ${order.status === 'cancelled' ? '<p>If you did not request this cancellation or have any concerns, please contact our support team immediately.</p>' : ''}
    
    <p>You can view your order details and track its progress in your account dashboard.</p>
  `;

  const html = getEmailTemplate('Order Status Update', content);
  const text = `Order Status Update\n\nHi ${userName || 'there'},\n\n${statusMessage}\n\nOrder ID: ${order._id}\nStatus: ${order.status}\n\nView your order in your account dashboard.`;

  await sendEmail(
    userEmail,
    `Order ${order.status.charAt(0).toUpperCase() + order.status.slice(1)} - Giaom Marketplace`,
    html,
    text
  );
};

// Password reset email
export const sendPasswordResetEmail = async (
  userEmail: string,
  userName: string,
  resetToken: string
): Promise<void> => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;
  const expiresIn = '1 hour';

  const content = `
    <h2>Password Reset Request</h2>
    <p>Hi ${userName || 'there'},</p>
    <p>We received a request to reset your password for your Giaom Marketplace account.</p>
    <p>Click the button below to reset your password:</p>
    <p style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #2563eb;">${resetLink}</p>
    <p><strong>This link will expire in ${expiresIn}.</strong></p>
    <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
    <p><strong>For security reasons:</strong></p>
    <ul>
      <li>Never share this link with anyone</li>
      <li>If you didn't request this, please contact support immediately</li>
      <li>The link expires after ${expiresIn}</li>
    </ul>
  `;

  const html = getEmailTemplate('Password Reset Request', content);
  const text = `Password Reset Request\n\nHi ${userName || 'there'},\n\nWe received a request to reset your password.\n\nReset your password: ${resetLink}\n\nThis link expires in ${expiresIn}.\n\nIf you didn't request this, please ignore this email.`;

  await sendEmail(userEmail, 'Password Reset Request - Giaom Marketplace', html, text);
};

// Welcome email (optional - for new user registration)
export const sendWelcomeEmail = async (
  userEmail: string,
  userName: string
): Promise<void> => {
  const content = `
    <h2>Welcome to Giaom Marketplace!</h2>
    <p>Hi ${userName || 'there'},</p>
    <p>Thank you for joining Giaom Marketplace! We're excited to have you as part of our community.</p>
    <p>You can now:</p>
    <ul>
      <li>Browse thousands of products from verified sellers</li>
      <li>Save items to your wishlist</li>
      <li>Track your orders in real-time</li>
      <li>Leave reviews and ratings</li>
    </ul>
    <p>Start shopping now and discover amazing products!</p>
    <p style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="button">Start Shopping</a>
    </p>
    <p>If you have any questions, our support team is here to help.</p>
  `;

  const html = getEmailTemplate('Welcome to Giaom Marketplace', content);
  const text = `Welcome to Giaom Marketplace!\n\nHi ${userName || 'there'},\n\nThank you for joining! Start shopping now at ${process.env.CLIENT_URL || 'http://localhost:3000'}`;

  await sendEmail(userEmail, 'Welcome to Giaom Marketplace', html, text);
};

// Low stock alert email
export const sendLowStockAlertEmail = async (
  sellerEmail: string,
  sellerName: string,
  productTitle: string,
  stockQuantity: number
): Promise<void> => {
  const content = `
    <h2>Low Stock Alert</h2>
    <p>Hi ${sellerName || 'there'},</p>
    <p>This is an automated notification to inform you that one of your products is running low on stock.</p>
    
    <div class="order-details">
      <h3>Product Information</h3>
      <p><strong>Product:</strong> ${productTitle}</p>
      <p><strong>Current Stock:</strong> <span style="color: #dc2626; font-weight: bold;">${stockQuantity} units</span></p>
    </div>
    
    <p>We recommend restocking this product soon to avoid running out of inventory. When stock reaches zero, customers will not be able to purchase this item.</p>
    <p style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/profile/seller" class="button">Manage Products</a>
    </p>
    <p>If you have any questions, please contact our support team.</p>
  `;

  const html = getEmailTemplate('Low Stock Alert', content);
  const text = `Low Stock Alert\n\nHi ${sellerName || 'there'},\n\nYour product "${productTitle}" is running low on stock.\nCurrent Stock: ${stockQuantity} units\n\nPlease consider restocking soon.`;

  await sendEmail(sellerEmail, `Low Stock Alert: ${productTitle}`, html, text);
};

// Initialize on module load
initializeEmailService();
