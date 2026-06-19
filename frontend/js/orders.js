/*
 * Orders.js - Client Live Orders History Loader
 * Purpose: Fetches previous invoices from MongoDB, renders order history cards, and powers visual tracking modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('orders-list-container');
  if (container) {
    renderUserOrders();
  }
});

async function renderUserOrders() {
  const container = document.getElementById('orders-list-container');
  if (!container) return;

  const token = localStorage.getItem('florish_token');
  if (!token) {
    container.innerHTML = `
      <div class="text-center" style="padding: 4rem 2rem;">
        <span style="font-size: 3.5rem;">📦</span>
        <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">Please login to view your order history.</p>
        <a href="login.html" class="btn btn-primary">Login to Account</a>
      </div>
    `;
    return;
  }

  try {
    const orders = await api.get('/orders/myorders');

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="text-center" style="padding: 4rem 2rem;">
          <span style="font-size: 3.5rem;">📦</span>
          <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">You have not placed any orders yet!</p>
          <a href="shop.html" class="btn btn-primary">Browse Floral Catalog</a>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    // Sort orders from newest to oldest
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    orders.forEach(order => {
      const itemsList = order.items.map(i => `${i.name} x${i.quantity}`).join(', ');
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const isTransit = order.orderStatus === 'Processing' || order.orderStatus === 'Shipped';
      let badgeColor = '';
      if (order.orderStatus === 'Delivered') {
        badgeColor = 'background-color: hsl(142, 69%, 90%); color: var(--success);';
      } else if (order.orderStatus === 'Cancelled') {
        badgeColor = 'background-color: hsl(0, 84%, 90%); color: var(--error);';
      } else {
        // Processing or Shipped
        badgeColor = 'background-color: hsl(38, 92%, 90%); color: var(--warning);';
      }
        
      const card = document.createElement('div');
      card.className = 'order-row-card animate-fade-in';
      card.innerHTML = `
        <div class="order-row-info">
          <strong style="color: var(--primary); font-size: 1.1rem;">Order #${order._id.substring(order._id.length - 6).toUpperCase()}</strong>
          <span class="text-muted" style="font-size: 0.85rem;">Date Placed: ${orderDate}</span>
          <span class="text-secondary">Items: ${itemsList}</span>
        </div>
        <div class="order-row-info text-center">
          <span class="order-status-badge" style="${badgeColor}">${order.orderStatus}</span>
          <span style="font-weight: 700; font-size: 1.15rem; color: var(--secondary); margin-top: 0.25rem;">${formatINR(order.totalPrice)}</span>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="openTrackingModal('${order._id}')">
            Track & Details
          </button>
          <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="downloadInvoice('${order._id}', this)">
            📄 Invoice
          </button>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('Error fetching orders:', err);
    container.innerHTML = `
      <div class="text-center" style="padding: var(--space-xl); color: var(--error);">
        <p>Failed to retrieve your order records from the database.</p>
      </div>
    `;
  }
}

/**
 * Open the visual shipment tracker & receipt details modal
 */
async function openTrackingModal(orderId) {
  const modal = document.getElementById('tracking-modal');
  const bodyContent = document.getElementById('modal-body-content');
  if (!modal || !bodyContent) return;

  // Render spinner first
  bodyContent.innerHTML = `
    <div class="text-center" style="padding: 3rem 0;">
      <div style="display: inline-block; width: 35px; height: 35px;" class="spinner"></div>
      <p class="text-secondary" style="margin-top: 1rem;">Loading order tracking specs...</p>
    </div>
  `;
  modal.style.display = 'flex';

  try {
    const order = await api.get(`/orders/${orderId}`);
    const formattedId = order._id.substring(order._id.length - 6).toUpperCase();
    const date = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Determine steps status
    const status = order.orderStatus; // 'Processing', 'Shipped', 'Delivered', 'Cancelled'
    const step1Active = true;
    const step2Active = status === 'Shipped' || status === 'Delivered';
    const step3Active = status === 'Delivered';
    const isCancelled = status === 'Cancelled';

    let timelineHtml = '';
    if (isCancelled) {
      timelineHtml = `
        <div style="background-color: hsl(0, 84%, 96%); border: 1px solid var(--error); border-radius: var(--radius-md); padding: var(--space-md); color: var(--error); display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem;">
          <span style="font-size: 1.25rem;">🚫</span>
          <div>
            <strong style="display: block;">This order has been cancelled</strong>
            <span style="font-size: 0.85rem;">Refund has been initiated if paid online. Contact support for details.</span>
          </div>
        </div>
      `;
    } else {
      timelineHtml = `
        <h4 style="margin-top: 1.5rem; margin-bottom: 1rem; font-family: var(--font-primary); font-size: 1rem; color: var(--primary);">Delivery Progress Timeline</h4>
        <div class="stepper-timeline" style="display: flex; flex-direction: column; gap: 1rem; padding-left: 0.5rem;">
          
          <!-- Step 1 -->
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--success); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">✔</div>
              <div style="width: 2px; height: 35px; background: ${step2Active ? 'var(--success)' : 'var(--border-color)'};"></div>
            </div>
            <div>
              <h5 style="margin: 0; font-family: var(--font-primary); font-size: 0.95rem; color: var(--primary);">Order Placed & Processing</h5>
              <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">Your creation is being hand-crafted in our gardens warehouse.</p>
            </div>
          </div>
          
          <!-- Step 2 -->
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: ${step2Active ? 'var(--success)' : 'var(--border-color)'}; color: ${step2Active ? 'white' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">${step2Active ? '✔' : '2'}</div>
              <div style="width: 2px; height: 35px; background: ${step3Active ? 'var(--success)' : 'var(--border-color)'};"></div>
            </div>
            <div>
              <h5 style="margin: 0; font-family: var(--font-primary); font-size: 0.95rem; color: ${step2Active ? 'var(--primary)' : 'var(--text-muted)'};">Shipped & In Transit</h5>
              <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">${step2Active ? 'Dispatched from Garden City Warehouse. Out for local logistics route.' : 'Awaiting florist packaging handoff.'}</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: ${step3Active ? 'var(--success)' : 'var(--border-color)'}; color: ${step3Active ? 'white' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">${step3Active ? '✔' : '3'}</div>
            </div>
            <div>
              <h5 style="margin: 0; font-family: var(--font-primary); font-size: 0.95rem; color: ${step3Active ? 'var(--primary)' : 'var(--text-muted)'};">Delivered</h5>
              <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">${step3Active ? 'Delivered successfully! Enjoy your fresh arrangements.' : 'Awaiting arrival at delivery address.'}</p>
            </div>
          </div>
        </div>
      `;
    }

    // Build invoice items breakdown html
    let receiptItemsHtml = '';
    let subtotal = 0;
    order.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      receiptItemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
          <span style="color: var(--text-secondary);">${item.name} <strong>x${item.quantity}</strong></span>
          <strong>${formatINR(itemTotal)}</strong>
        </div>
      `;
    });

    let discountHtml = '';
    if (order.discountPrice > 0) {
      discountHtml = `
        <div style="font-size: 0.85rem; display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Discount (${order.promoCode || 'PROMO'})</span>
          <span style="color: var(--success); font-weight: 600;">-${formatINR(order.discountPrice)}</span>
        </div>
      `;
    }

    // Compute expected delivery date range
    const dStart = new Date(order.createdAt);
    dStart.setDate(dStart.getDate() + 2);
    const dEnd = new Date(order.createdAt);
    dEnd.setDate(dEnd.getDate() + 4);
    const estRange = `${dStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${dEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`;

    bodyContent.innerHTML = `
      <div style="margin-bottom: var(--space-md); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-sm);">
        <h3 style="font-size: 1.35rem; color: var(--primary);">Order Details</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-secondary);">
          <span>Order Reference: <strong>#FL-${formattedId}</strong></span>
          <span>Placed: <strong>${date}</strong></span>
        </div>
      </div>

      <!-- Left/Right Flex details -->
      <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: var(--space-lg); text-align: left; margin-bottom: 1rem;">
        
        <div>
          <!-- Shipping target -->
          <h4 style="font-family: var(--font-primary); font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Recipient Address</h4>
          <p style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${order.shippingAddress.firstName} ${order.shippingAddress.lastName}</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">${order.shippingAddress.address}</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">${order.shippingAddress.city} - ${order.shippingAddress.pincode}</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">📞 ${order.shippingAddress.phone}</p>
          <p style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-top: 0.5rem;">Est. Delivery: ${estRange}</p>
        </div>

        <div>
          <!-- Payment method -->
          <h4 style="font-family: var(--font-primary); font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Payment Information</h4>
          <p style="font-size: 0.85rem; color: var(--text-primary); font-weight: 600; text-transform: uppercase; color: var(--primary);">${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Card / UPI Instant'}</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; text-transform: capitalize;">Status: <strong>${order.paymentStatus}</strong></p>
        </div>

      </div>

      <!-- Invoice items list -->
      <div style="background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-md);">
        <h4 style="font-family: var(--font-primary); font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Items Invoice</h4>
        ${receiptItemsHtml}
        
        <div style="border-top: 1px dashed var(--border-color); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 0.85rem; display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Subtotal</span>
          <span>${formatINR(subtotal)}</span>
        </div>
        ${discountHtml}
        <div style="font-size: 0.85rem; display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Shipping</span>
          <span>${order.shippingPrice === 0 ? 'Free' : formatINR(order.shippingPrice)}</span>
        </div>
        <div style="font-size: 0.85rem; display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">GST / Taxes (8%)</span>
          <span>${formatINR(order.taxPrice)}</span>
        </div>
        <div style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 1.05rem; font-weight: 700; color: var(--primary); display: flex; justify-content: space-between;">
          <span>Total Price</span>
          <span>${formatINR(order.totalPrice)}</span>
        </div>
      </div>

      <!-- Timeline visual stepper -->
      ${timelineHtml}

      <div style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 1rem;">
        <button id="btn-download-invoice" class="btn btn-primary" style="padding: 0.5rem 1.25rem;" onclick="downloadInvoice('${order._id}', this)">
          📄 Download Invoice
        </button>
        ${status === 'Processing' ? `
          <button id="btn-cancel-order" class="btn btn-outline" style="border-color: var(--error); color: var(--error); padding: 0.5rem 1rem; margin-top: 0;" onclick="cancelUserOrder('${order._id}')">
            ❌ Cancel Order
          </button>
        ` : ''}
      </div>
    `;

  } catch (err) {
    console.error('Error fetching order details:', err);
    bodyContent.innerHTML = `
      <div class="text-center" style="padding: 2rem 0; color: var(--error);">
        <p>Failed to retrieve tracker specs from database.</p>
      </div>
    `;
  }
}

/**
 * Close the visual tracker modal
 */
function closeTrackingModal() {
  const modal = document.getElementById('tracking-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Close modal upon click outside content container
window.addEventListener('click', (e) => {
  const modal = document.getElementById('tracking-modal');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

/**
 * Cancel order handler
 */
async function cancelUserOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
    return;
  }

  const btn = document.getElementById('btn-cancel-order');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Cancelling...';
  }

  try {
    await api.put(`/orders/${orderId}/cancel`);
    if (typeof showNotification === 'function') {
      showNotification('Order successfully cancelled.', 'success');
    } else {
      alert('Order successfully cancelled.');
    }
    closeTrackingModal();
    await renderUserOrders();
  } catch (err) {
    console.error(err);
    if (typeof showNotification === 'function') {
      showNotification(err.message || 'Failed to cancel order.', 'error');
    } else {
      alert(err.message || 'Failed to cancel order.');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = '❌ Cancel Order';
    }
  }
}

/**
 * Trigger invoice download for customer order
 */
async function downloadInvoice(orderId, btn) {
  const token = localStorage.getItem('florish_token');
  if (!token) {
    if (typeof showNotification === 'function') {
      showNotification('Please login to download your invoice.', 'error');
    } else {
      alert('Please login to download your invoice.');
    }
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block; width:12px; height:12px; border: 2px solid white; border-radius:50%; border-top-color:transparent; animation: spin 0.8s linear infinite; margin-right:5px; vertical-align: middle;"></span> Downloading...';

  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `Server returned status ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Florish_Invoice_Order${orderId.substring(orderId.length - 6).toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    if (typeof showNotification === 'function') {
      showNotification('Invoice downloaded successfully!', 'success');
    }
  } catch (err) {
    console.error('Invoice download failed:', err);
    if (typeof showNotification === 'function') {
      showNotification(err.message || 'Invoice download failed. Please try again.', 'error');
    } else {
      alert(err.message || 'Invoice download failed. Please try again.');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}
