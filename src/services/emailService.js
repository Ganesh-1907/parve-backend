const nodemailer = require("nodemailer");

// Create transporter ONCE (singleton) — avoids reconnecting SMTP on every email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  pool: true,        // reuse connections
  maxConnections: 5, // allow up to 5 parallel sends
});

// Send order confirmation to customer
const sendOrderConfirmation = async (order, user) => {

  const itemsList = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product?.productName || "Product"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
        </tr>`
    )
    .join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .order-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .order-id { font-size: 18px; font-weight: bold; color: #0ea5e9; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f1f5f9; padding: 12px; text-align: left; }
        .total { font-size: 20px; font-weight: bold; color: #0ea5e9; }
        .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
        .status { display: inline-block; background: #dcfce7; color: #166534; padding: 5px 15px; border-radius: 20px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Confirmed!</h1>
          <p>Thank you for shopping with PARVE</p>
        </div>
        <div class="content">
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>Your order has been successfully placed and payment has been received.</p>
          
          <div class="order-info">
            <p class="order-id">Order ID: ${order.orderId}</p>
            <p><span class="status">Payment Successful</span></p>
          </div>

          <h3>Order Details</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 15px; text-align: right; font-weight: bold;">Total:</td>
                <td style="padding: 15px; text-align: right;" class="total">₹${order.totalAmount}</td>
              </tr>
            </tfoot>
          </table>

          <h3>Shipping Address</h3>
          <p style="background: #f8fafc; padding: 15px; border-radius: 8px;">${order.address}</p>

          <p>We'll notify you when your order ships. Track your order in your account.</p>
        </div>
        <div class="footer">
          <p><strong>PARVE</strong> - Natural Beauty, Crafted with Care</p>
          <p>If you have any questions, please contact us.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"PARVE Beauty" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `Order Confirmed - ${order.orderId} | PARVE Beauty`,
      html: emailHtml,
    });
    console.log(`✅ Order confirmation email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send order confirmation email:", error.message);
    return false;
  }
};

// Send order notification to admin
const sendAdminNotification = async (order, user) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  const itemsList = order.items
    .map(
      (item) => `• ${item.product?.productName || "Product"} x${item.quantity} - ₹${item.price}`
    )
    .join("\n");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #fff; padding: 20px; border: 1px solid #e5e7eb; }
        .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .highlight { color: #0ea5e9; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🛒 New Order Received!</h2>
        </div>
        <div class="content">
          <div class="info-box">
            <p><strong>Order ID:</strong> <span class="highlight">${order.orderId}</span></p>
            <p><strong>Amount:</strong> <span class="highlight">₹${order.totalAmount}</span></p>
            <p><strong>Payment:</strong> Razorpay (Paid)</p>
          </div>

          <h3>Customer Details</h3>
          <div class="info-box">
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Phone:</strong> ${user.phone || "N/A"}</p>
            <p><strong>Address:</strong> ${order.address}</p>
          </div>

          <h3>Order Items</h3>
          <pre style="background: #f8fafc; padding: 15px; border-radius: 8px; white-space: pre-wrap;">${itemsList}</pre>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"PARVE Orders" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `🛒 New Order: ${order.orderId} - ₹${order.totalAmount}`,
      html: emailHtml,
    });
    console.log(`✅ Admin notification sent to ${adminEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send admin notification:", error.message);
    return false;
  }
};

module.exports = {
  sendOrderConfirmation,
  sendAdminNotification,
};
