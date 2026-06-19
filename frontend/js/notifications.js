document.addEventListener('DOMContentLoaded', () => {
  const inbox = document.getElementById('notifications-inbox');
  const readAllBtn = document.getElementById('btn-read-all');

  if (inbox) {
    loadNotifications();
  }

  if (readAllBtn) {
    readAllBtn.addEventListener('click', markAllAsRead);
  }
});

async function loadNotifications() {
  const inbox = document.getElementById('notifications-inbox');
  if (!inbox) return;

  const token = localStorage.getItem('florish_token');
  if (!token) {
    inbox.innerHTML = `
      <div class="empty-state">
        <span style="font-size: 3.5rem;">🔒</span>
        <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">Please login to view your notifications inbox!</p>
        <a href="login.html" class="btn btn-primary">Login to Account</a>
      </div>
    `;
    return;
  }

  try {
    const notifications = await api.get('/notifications');
    
    if (notifications.length === 0) {
      inbox.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3.5rem;">🔔</span>
          <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">You have no notifications yet!</p>
          <a href="shop.html" class="btn btn-primary">Explore Floral Collections</a>
        </div>
      `;
      return;
    }

    inbox.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'notifications-list';

    notifications.forEach(n => {
      let icon = '🔔';
      let actionLinkHtml = '';

      if (n.type === 'back_in_stock') {
        icon = '🌸';
        if (n.product) {
          actionLinkHtml = `<a href="product-details.html?id=${n.product}" class="notification-action-btn">View Arrangement</a>`;
        }
      } else if (n.type === 'order_status') {
        icon = '📦';
        actionLinkHtml = `<a href="orders.html" class="notification-action-btn">Track Order</a>`;
      } else if (n.type === 'promo') {
        icon = '🎟️';
        actionLinkHtml = `<a href="shop.html" class="notification-action-btn">Shop Sale</a>`;
      }

      const card = document.createElement('div');
      card.className = `notification-card ${n.isRead ? '' : 'unread'}`;
      card.id = `notify-card-${n._id}`;
      
      const dateStr = new Date(n.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-body">
          <div class="notification-title">${n.title}</div>
          <div class="notification-message">${n.message}</div>
          <div class="notification-meta">
            <span>${dateStr}</span>
            ${actionLinkHtml}
          </div>
        </div>
        ${!n.isRead ? `<div class="mark-read-dot" onclick="markSingleAsRead('${n._id}')" title="Mark as Read"></div>` : ''}
      `;
      list.appendChild(card);
    });

    inbox.appendChild(list);
  } catch (err) {
    console.error('Error rendering notifications inbox:', err);
    inbox.innerHTML = '<p class="text-secondary text-center">Could not load notifications. Please try reloading the page.</p>';
  }
}

async function markSingleAsRead(id) {
  try {
    await api.put(`/notifications/${id}/read`);
    const card = document.getElementById(`notify-card-${id}`);
    if (card) {
      card.classList.remove('unread');
      const dot = card.querySelector('.mark-read-dot');
      if (dot) dot.remove();
    }
    // Update navbar badge count
    if (typeof updateNotificationsBadge === 'function') {
      updateNotificationsBadge();
    }
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    showNotification('Could not mark notification as read', 'error');
  }
}

async function markAllAsRead() {
  const token = localStorage.getItem('florish_token');
  if (!token) return;

  const readAllBtn = document.getElementById('btn-read-all');
  if (readAllBtn) {
    readAllBtn.disabled = true;
    readAllBtn.textContent = '...';
  }

  try {
    await api.put('/notifications/read-all');
    
    // Update visual state of all cards
    document.querySelectorAll('.notification-card').forEach(card => {
      card.classList.remove('unread');
      const dot = card.querySelector('.mark-read-dot');
      if (dot) dot.remove();
    });

    // Sync navbar badge
    if (typeof updateNotificationsBadge === 'function') {
      updateNotificationsBadge();
    }

    showNotification('All notifications marked as read', 'success');
  } catch (err) {
    console.error('Failed to mark all as read:', err);
    showNotification('Could not mark all notifications as read', 'error');
  } finally {
    if (readAllBtn) {
      readAllBtn.disabled = false;
      readAllBtn.textContent = 'Mark All as Read';
    }
  }
}
