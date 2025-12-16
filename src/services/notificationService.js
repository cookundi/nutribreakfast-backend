// // src/services/notificationService.js

// const nodemailer = require('nodemailer');
// const prisma = require('../config/database');
// const logger = require('../utils/logger');

// // Pure Nodemailer Postmark API config (works everywhere)
// const transporter = nodemailer.createTransport({
//   host: 'api.postmarkapp.com',
//   port: 443,  // HTTPS port
//   secure: true,
//   auth: {
//     user: process.env.POSTMARK_SERVER_TOKEN,
//     pass: process.env.POSTMARK_SERVER_TOKEN
//   },
//   tls: {
//     rejectUnauthorized: false
//   }
// });

// // Verify transporter
// transporter.verify((error, success) => {
//   if (error) {
//     logger.error('Email transporter error:', error);
//   } else {
//     logger.info('✅ Email service ready');
//   }
// });

// // Send order confirmation email
// exports.sendOrderConfirmation = async (order, user) => {
//   try {
//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: user.email,
//       subject: `Order Confirmed - ${order.orderNumber}`,
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #16a34a;">Order Confirmed! 🎉</h2>
//           <p>Hi ${user.name},</p>
//           <p>Your breakfast order has been confirmed.</p>
          
//           <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
//             <h3 style="margin-top: 0;">Order Details</h3>
//             <p><strong>Order Number:</strong> ${order.orderNumber}</p>
//             <p><strong>Meal:</strong> ${order.meal.name}</p>
//             <p><strong>Quantity:</strong> ${order.quantity}</p>
//             <p><strong>Price:</strong> ₦${(order.price / 100).toLocaleString()}</p>
//             <p><strong>Delivery Date:</strong> ${new Date(order.deliveryDate).toLocaleDateString()}</p>
//             <p><strong>Delivery Time:</strong> ${process.env.DEFAULT_DELIVERY_TIME || '7:30 AM'}</p>
//           </div>
          
//           <p>We'll notify you when your order is being prepared and when it's out for delivery.</p>
          
//           <p style="color: #6b7280; font-size: 14px;">
//             Thank you for choosing NutriBreakfast!<br>
//             Healthy eating, simplified.
//           </p>
//         </div>
//       `,
//     };

//     await transporter.sendMail(mailOptions);

//     // Save notification to database
//     await prisma.notification.create({
//       data: {
//         recipientType: 'STAFF',
//         recipientId: user.id,
//         title: 'Order Confirmed',
//         message: `Your order ${order.orderNumber} has been confirmed`,
//         type: 'ORDER_CONFIRMATION',
//         sentViaEmail: true,
//       },
//     });

//     logger.info(`Order confirmation email sent to ${user.email}`);
//   } catch (error) {
//     logger.error('Error sending order confirmation email:', error);
//   }
// };

// // Send order status update
// exports.sendOrderStatusUpdate = async (order) => {
//   try {
//     const statusMessages = {
//       CONFIRMED: 'Your order has been confirmed',
//       PREPARING: 'Your breakfast is being prepared in our kitchen',
//       OUT_FOR_DELIVERY: `Your order is on the way! ${order.riderName ? `Rider: ${order.riderName}` : ''}`,
//       DELIVERED: 'Your order has been delivered. Enjoy your meal!',
//       CANCELLED: 'Your order has been cancelled',
//     };

//     const statusEmojis = {
//       CONFIRMED: '✅',
//       PREPARING: '👨‍🍳',
//       OUT_FOR_DELIVERY: '🚚',
//       DELIVERED: '🎉',
//       CANCELLED: '❌',
//     };

//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: order.staff.email,
//       subject: `Order Update - ${order.orderNumber}`,
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #16a34a;">Order Update ${statusEmojis[order.status]}</h2>
//           <p>Hi ${order.staff.name},</p>
//           <p><strong>${statusMessages[order.status]}</strong></p>
          
//           <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
//             <p><strong>Order Number:</strong> ${order.orderNumber}</p>
//             <p><strong>Meal:</strong> ${order.meal.name}</p>
//             <p><strong>Status:</strong> ${order.status.replace('_', ' ')}</p>
//             ${order.riderPhone ? `<p><strong>Rider Contact:</strong> ${order.riderPhone}</p>` : ''}
//           </div>
          
//           <p style="color: #6b7280; font-size: 14px;">
//             NutriBreakfast - Healthy eating, simplified.
//           </p>
//         </div>
//       `,
//     };

//     await transporter.sendMail(mailOptions);

//     // Save notification
//     await prisma.notification.create({
//       data: {
//         recipientType: 'STAFF',
//         recipientId: order.staffId,
//         title: 'Order Status Update',
//         message: statusMessages[order.status],
//         type: 'ORDER_STATUS',
//         sentViaEmail: true,
//       },
//     });

//     logger.info(`Order status update email sent for ${order.orderNumber}`);
//   } catch (error) {
//     logger.error('Error sending status update email:', error);
//   }
// };

// // Send daily order reminder (4 PM cutoff reminder)
// exports.sendOrderReminder = async (staffList) => {
//   try {
//     for (const staff of staffList) {
//       const mailOptions = {
//         from: process.env.EMAIL_FROM,
//         to: staff.email,
//         subject: 'Don\'t Forget to Order Your Breakfast! ⏰',
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <h2 style="color: #dc2626;">Order Cutoff Reminder ⏰</h2>
//             <p>Hi ${staff.name},</p>
//             <p>Just a friendly reminder that orders for tomorrow's breakfast close at <strong>4:00 PM today</strong>.</p>
            
//             <p>Don't miss out on a healthy, delicious breakfast!</p>
            
//             <a href="${process.env.FRONTEND_URL}/order" 
//                style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
//               Order Now
//             </a>
            
//             <p style="color: #6b7280; font-size: 14px;">
//               NutriBreakfast - Start your day right!
//             </p>
//           </div>
//         `,
//       };

//       await transporter.sendMail(mailOptions);
//     }

//     logger.info(`Order reminders sent to ${staffList.length} staff members`);
//   } catch (error) {
//     logger.error('Error sending order reminders:', error);
//   }
// };

// // Send monthly invoice to company
// exports.sendMonthlyInvoice = async (invoice, company) => {
//   try {
//     const mailOptions = {
//       from: process.env.EMAIL_FROM,
//       to: company.email,
//       subject: `Monthly Invoice - ${invoice.invoiceNumber}`,
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #16a34a;">Monthly Invoice</h2>
//           <p>Dear ${company.name},</p>
//           <p>Please find your monthly invoice for NutriBreakfast services.</p>
          
//           <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
//             <h3 style="margin-top: 0;">Invoice Details</h3>
//             <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
//             <p><strong>Billing Period:</strong> ${invoice.billingMonth}/${invoice.billingYear}</p>
//             <p><strong>Subtotal:</strong> ₦${(invoice.subtotal / 100).toLocaleString()}</p>
//             <p><strong>Tax:</strong> ₦${(invoice.tax / 100).toLocaleString()}</p>
//             <p><strong>Total:</strong> ₦${(invoice.total / 100).toLocaleString()}</p>
//             <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
//           </div>
          
//           <a href="${process.env.FRONTEND_URL}/invoices/${invoice.id}" 
//              style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
//             View Invoice
//           </a>
          
//           <p style="color: #6b7280; font-size: 14px;">
//             Thank you for your business!<br>
//             NutriBreakfast
//           </p>
//         </div>
//       `,
//     };

//     await transporter.sendMail(mailOptions);

//     logger.info(`Invoice email sent to ${company.email}`);
//   } catch (error) {
//     logger.error('Error sending invoice email:', error);
//   }
// };

// // Get user notifications
// exports.getUserNotifications = async (userId, page = 1, limit = 20) => {
//   try {
//     const skip = (page - 1) * limit;

//     const [notifications, total] = await Promise.all([
//       prisma.notification.findMany({
//         where: {
//           recipientType: 'STAFF',
//           recipientId: userId,
//         },
//         orderBy: {
//           createdAt: 'desc',
//         },
//         skip,
//         take: limit,
//       }),
//       prisma.notification.count({
//         where: {
//           recipientType: 'STAFF',
//           recipientId: userId,
//         },
//       }),
//     ]);

//     return {
//       notifications,
//       total,
//       unreadCount: notifications.filter(n => !n.isRead).length,
//     };
//   } catch (error) {
//     logger.error('Error fetching notifications:', error);
//     throw error;
//   }
// };

// // Mark notification as read
// exports.markAsRead = async (notificationId, userId) => {
//   try {
//     await prisma.notification.update({
//       where: {
//         id: notificationId,
//         recipientId: userId,
//       },
//       data: {
//         isRead: true,
//         readAt: new Date(),
//       },
//     });
//   } catch (error) {
//     logger.error('Error marking notification as read:', error);
//     throw error;
//   }
// };





const postmark = require('postmark');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN);

exports.sendOrderConfirmation = async (order, user) => {
  try {
    await client.sendEmail({
      "From": process.env.EMAIL_FROM,
      "To": user.email,
      "Subject": `Order Confirmed - ${order.orderNumber}`,
      "HtmlBody": `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Order Confirmed! 🎉</h2>
          <p>Hi ${user.name},</p>
          <p>Your breakfast order has been confirmed.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Meal:</strong> ${order.meal.name}</p>
            <p><strong>Quantity:</strong> ${order.quantity}</p>
            <p><strong>Price:</strong> ₦${(order.price / 100).toLocaleString()}</p>
            <p><strong>Delivery Date:</strong> ${new Date(order.deliveryDate).toLocaleDateString()}</p>
            <p><strong>Delivery Time:</strong> ${process.env.DEFAULT_DELIVERY_TIME || '7:30 AM'}</p>
          </div>
          
          <p>We'll notify you when your order is being prepared and when it's out for delivery.</p>
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for choosing NutriBreakfast!<br>
            Healthy eating, simplified.
          </p>
        </div>
      `,
      "MessageStream": "outbound"
    });

    await prisma.notification.create({
      data: {
        recipientType: 'STAFF',
        recipientId: user.id,
        title: 'Order Confirmed',
        message: `Your order ${order.orderNumber} has been confirmed`,
        type: 'ORDER_CONFIRMATION',
        sentViaEmail: true,
      },
    });

    logger.info(`Order confirmation email sent to ${user.email}`);
  } catch (error) {
    logger.error('Error sending order confirmation email:', error);
  }
};

exports.sendOrderStatusUpdate = async (order) => {
  try {
    const statusMessages = {
      CONFIRMED: 'Your order has been confirmed',
      PREPARING: 'Your breakfast is being prepared in our kitchen',
      OUT_FOR_DELIVERY: `Your order is on the way! ${order.riderName ? `Rider: ${order.riderName}` : ''}`,
      DELIVERED: 'Your order has been delivered. Enjoy your meal!',
      CANCELLED: 'Your order has been cancelled',
    };

    const statusEmojis = {
      CONFIRMED: '✅',
      PREPARING: '👨‍🍳',
      OUT_FOR_DELIVERY: '🚚',
      DELIVERED: '🎉',
      CANCELLED: '❌',
    };

    await client.sendEmail({
      "From": process.env.EMAIL_FROM,
      "To": order.staff.email,
      "Subject": `Order Update - ${order.orderNumber}`,
      "HtmlBody": `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Order Update ${statusEmojis[order.status]}</h2>
          <p>Hi ${order.staff.name},</p>
          <p><strong>${statusMessages[order.status]}</strong></p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Meal:</strong> ${order.meal.name}</p>
            <p><strong>Status:</strong> ${order.status.replace('_', ' ')}</p>
            ${order.riderPhone ? `<p><strong>Rider Contact:</strong> ${order.riderPhone}</p>` : ''}
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            NutriBreakfast - Healthy eating, simplified.
          </p>
        </div>
      `,
      "MessageStream": "outbound"
    });

    await prisma.notification.create({
      data: {
        recipientType: 'STAFF',
        recipientId: order.staffId,
        title: 'Order Status Update',
        message: statusMessages[order.status],
        type: 'ORDER_STATUS',
        sentViaEmail: true,
      },
    });

    logger.info(`Order status update email sent for ${order.orderNumber}`);
  } catch (error) {
    logger.error('Error sending status update email:', error);
  }
};

exports.sendOrderReminder = async (staffList) => {
  try {
    for (const staff of staffList) {
      await client.sendEmail({
        "From": process.env.EMAIL_FROM,
        "To": staff.email,
        "Subject": 'Don\'t Forget to Order Your Breakfast! ⏰',
        "HtmlBody": `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Order Cutoff Reminder ⏰</h2>
            <p>Hi ${staff.name},</p>
            <p>Just a friendly reminder that orders for tomorrow's breakfast close at <strong>4:00 PM today</strong>.</p>
            
            <p>Don't miss out on a healthy, delicious breakfast!</p>
            
            <a href="${process.env.FRONTEND_URL}/order" 
               style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Order Now
            </a>
            
            <p style="color: #6b7280; font-size: 14px;">
              NutriBreakfast - Start your day right!
            </p>
          </div>
        `,
        "MessageStream": "outbound"
      });
    }

    logger.info(`Order reminders sent to ${staffList.length} staff members`);
  } catch (error) {
    logger.error('Error sending order reminders:', error);
  }
};

exports.sendMonthlyInvoice = async (invoice, company) => {
  try {
    await client.sendEmail({
      "From": process.env.EMAIL_FROM,
      "To": company.email,
      "Subject": `Monthly Invoice - ${invoice.invoiceNumber}`,
      "HtmlBody": `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">Monthly Invoice</h2>
          <p>Dear ${company.name},</p>
          <p>Please find your monthly invoice for NutriBreakfast services.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Invoice Details</h3>
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Billing Period:</strong> ${invoice.billingMonth}/${invoice.billingYear}</p>
            <p><strong>Subtotal:</strong> ₦${(invoice.subtotal / 100).toLocaleString()}</p>
            <p><strong>Tax:</strong> ₦${(invoice.tax / 100).toLocaleString()}</p>
            <p><strong>Total:</strong> ₦${(invoice.total / 100).toLocaleString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          </div>
          
          <a href="${process.env.FRONTEND_URL}/invoices/${invoice.id}" 
             style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            View Invoice
          </a>
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for your business!<br>
            NutriBreakfast
          </p>
        </div>
      `,
      "MessageStream": "outbound"
    });

    logger.info(`Invoice email sent to ${company.email}`);
  } catch (error) {
    logger.error('Error sending invoice email:', error);
  }
};

exports.getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          recipientType: 'STAFF',
          recipientId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: {
          recipientType: 'STAFF',
          recipientId: userId,
        },
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount: notifications.filter(n => !n.isRead).length,
    };
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    throw error;
  }
};

exports.markAsRead = async (notificationId, userId) => {
  try {
    await prisma.notification.update({
      where: {
        id: notificationId,
        recipientId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};