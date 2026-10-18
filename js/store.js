// Green Garden Unified Client State, Cart Engine, & UI Component Injector

const COUPON_DATABASE = {
  'GREEN15': { discountPercent: 15, minOrder: 300, description: '15% Off Your Entire Garden Order' },
  'NATURE20': { discountPercent: 20, minOrder: 800, description: '20% Off Orders Above ₹800' },
  'FREESHIP': { freeShipping: true, minOrder: 400, description: 'Complimentary Express Botanical Delivery' },
  'BOTANICAL10': { discountPercent: 10, minOrder: 200, description: '10% Welcome Discount' }
};

const Store = {
  // Cart operations
  getCart: function() {
    try {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
      return [];
    }
  },

  saveCart: function(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    Store.updateBadgeCounters();
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
  },

  addToCart: function(product, quantity = 1, variant = null) {
    const cart = Store.getCart();
    const itemId = variant ? `${product.id}_${variant}` : product.id;
    const existingIndex = cart.findIndex(item => (item.cartItemId || item.id) === itemId);

    if (existingIndex > -1) {
      cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + quantity;
    } else {
      cart.push({
        cartItemId: itemId,
        id: product.id,
        name: product.name,
        price: product.salePrice || product.price,
        originalPrice: product.price,
        image: product.image,
        category: product.category,
        variant: variant || (product.variants ? product.variants[0] : null),
        quantity: quantity,
        sku: product.sku
      });
    }

    Store.saveCart(cart);
    Store.showToast(`🌿 Added "${product.name}" to cart`);
  },

  removeFromCart: function(itemId) {
    let cart = Store.getCart();
    cart = cart.filter(item => (item.cartItemId || item.id) !== itemId);
    Store.saveCart(cart);
    Store.showToast("Item removed from cart");
  },

  updateQuantity: function(itemId, qty) {
    const cart = Store.getCart();
    const item = cart.find(i => (i.cartItemId || i.id) === itemId);
    if (item) {
      if (qty <= 0) {
        Store.removeFromCart(itemId);
      } else {
        item.quantity = qty;
        Store.saveCart(cart);
      }
    }
  },

  // Calculate cart totals accurately on server/client rules
  calculateTotals: function(appliedCouponCode = null, pointsToRedeem = 0) {
    const cart = Store.getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let discount = 0;
    let shippingFee = subtotal > 499 || subtotal === 0 ? 0 : 50; // Free shipping over ₹499

    if (appliedCouponCode && COUPON_DATABASE[appliedCouponCode.toUpperCase()]) {
      const c = COUPON_DATABASE[appliedCouponCode.toUpperCase()];
      if (subtotal >= c.minOrder) {
        if (c.discountPercent) {
          discount += Math.round((subtotal * c.discountPercent) / 100);
        }
        if (c.freeShipping) {
          shippingFee = 0;
        }
      }
    }

    // Reward points conversion: 10 points = ₹10 discount
    let pointsDiscount = 0;
    if (pointsToRedeem > 0) {
      pointsDiscount = Math.min(pointsToRedeem, subtotal - discount);
      discount += pointsDiscount;
    }

    const gstTax = Math.round((subtotal - discount) * 0.05); // 5% agricultural nursery GST
    const finalTotal = Math.max(0, subtotal - discount + shippingFee + gstTax);

    return {
      subtotal,
      discount,
      shippingFee,
      gstTax,
      finalTotal,
      itemCount: cart.reduce((c, i) => c + i.quantity, 0)
    };
  },

  // Wishlist operations
  getWishlist: function() {
    try {
      return JSON.parse(localStorage.getItem('wishlist') || '[]');
    } catch (e) {
      return [];
    }
  },

  toggleWishlist: function(product) {
    let wishlist = Store.getWishlist();
    const existsIndex = wishlist.findIndex(item => item.id === product.id);
    let isAdded = false;

    if (existsIndex > -1) {
      wishlist.splice(existsIndex, 1);
      Store.showToast(`Removed "${product.name}" from wishlist`);
    } else {
      wishlist.push({
        id: product.id,
        name: product.name,
        price: product.salePrice || product.price,
        image: product.image,
        category: product.category,
        rating: product.rating
      });
      isAdded = true;
      Store.showToast(`💚 Added "${product.name}" to your wishlist`);
    }

    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    Store.updateBadgeCounters();
    return isAdded;
  },

  isInWishlist: function(productId) {
    const wishlist = Store.getWishlist();
    return wishlist.some(item => item.id === productId);
  },

  // Update navbar badges
  updateBadgeCounters: function() {
    const cart = Store.getCart();
    const totalCartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartBadges = document.querySelectorAll('.cart-count-badge');
    cartBadges.forEach(b => {
      b.textContent = totalCartCount;
      b.style.display = totalCartCount > 0 ? 'flex' : 'none';
    });

    const wishlist = Store.getWishlist();
    const wishBadges = document.querySelectorAll('.wish-count-badge');
    wishBadges.forEach(b => {
      b.textContent = wishlist.length;
      b.style.display = wishlist.length > 0 ? 'flex' : 'none';
    });
  },

  // Toast Notification
  showToast: function(message, isError = false) {
    let container = document.getElementById('ggToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ggToastContainer';
      container.className = 'gg-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `gg-toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `
      <i class="fas ${isError ? 'fa-exclamation-circle text-danger' : 'fa-seedling'}" style="color: ${isError ? '#ff6b6b' : '#74c69d'}; font-size: 1.2rem;"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  },

  // Unified Navbar Injection across all pages
  renderHeader: function(activePage = 'home') {
    const headerContainer = document.getElementById('global-header');
    if (!headerContainer) return;

    const user = window.AuthService ? window.AuthService.getCurrentUser() : null;
    const isAdmin = user && user.role === 'admin';

    headerContainer.innerHTML = `
      <div class="announcement-bar">
        <span>🌱 Spring Planting Season: Use code <strong>GREEN15</strong> for 15% off orders above ₹300!</span>
        <span class="d-none-mobile">🚚 Free Climate-Safe Delivery on all orders over ₹499</span>
        <a href="subscription.html">🌿 Join Plant Club</a>
      </div>
      <header class="gg-header">
        <div class="nav-container">
          <a href="index.html" class="brand-logo">
            <div class="brand-icon-wrap">🌿</div>
            <div>
              <span>Green Garden</span>
              <span class="brand-tagline">Botanical Haven</span>
            </div>
          </a>

          <ul class="nav-menu">
            <li><a href="index.html" class="nav-item-link ${activePage === 'home' ? 'active' : ''}">Home</a></li>
            <li><a href="products.html" class="nav-item-link ${activePage === 'products' ? 'active' : ''}">Shop Plants & Seeds</a></li>
            <li><a href="ai-doctor.html" class="nav-item-link ${activePage === 'doctor' ? 'active' : ''}">AI Plant Doctor <span class="badge-ai">AI</span></a></li>
            <li><a href="plant-finder.html" class="nav-item-link ${activePage === 'finder' ? 'active' : ''}">Plant Finder</a></li>
            <li><a href="plant-care.html" class="nav-item-link ${activePage === 'care' ? 'active' : ''}">Care Calendar</a></li>
            <li><a href="garden-kit.html" class="nav-item-link ${activePage === 'kit' ? 'active' : ''}">Garden Kits</a></li>
            <li><a href="community.html" class="nav-item-link ${activePage === 'community' ? 'active' : ''}">Community</a></li>
            ${isAdmin ? `<li><a href="admin.html" class="nav-item-link ${activePage === 'admin' ? 'active' : ''}" style="color: #c58b49;"><i class="fas fa-shield-alt"></i> Admin</a></li>` : ''}
          </ul>

          <div class="nav-actions">
            <a href="products.html?focus=search" class="action-btn" title="Search Catalog">
              <i class="fas fa-search"></i>
            </a>

            <a href="cart.html" class="action-btn" title="Shopping Cart">
              <i class="fas fa-shopping-bag"></i>
              <span class="counter-badge cart-count-badge" style="display:none;">0</span>
            </a>

            <a href="orders.html" class="action-btn" title="My Orders & Tracking">
              <i class="fas fa-box-open"></i>
            </a>

            ${user ? `
              <div class="dropdown-wrap" style="position: relative;">
                <button class="user-account-btn" onclick="Store.toggleUserMenu(event)">
                  <img src="Ak.jpg" alt="Avatar" class="user-avatar-mini" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2d6a4f&color=fff'">
                  <span class="user-name-label">${user.name.split(' ')[0]}</span>
                  <i class="fas fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted);"></i>
                </button>
                <div id="userDropdownMenu" style="display: none; position: absolute; right: 0; top: 110%; background: #fff; border-radius: 14px; box-shadow: var(--shadow-float); width: 220px; border: 1px solid var(--border-subtle); z-index: 1000; padding: 8px 0;">
                  <div style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--forest-900);">${user.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${user.email}</div>
                    <div style="font-size: 0.75rem; color: var(--sage-500); font-weight: 600; margin-top: 4px;">🏆 ${window.RewardService ? window.RewardService.getBalance() : 100} Green Points</div>
                  </div>
                  <a href="orders.html" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.88rem; color: var(--text-primary);"><i class="fas fa-truck-moving" style="color: var(--sage-500);"></i> My Orders & Tracker</a>
                  <a href="plant-passport.html" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.88rem; color: var(--text-primary);"><i class="fas fa-passport" style="color: var(--sage-500);"></i> Digital Plant Passport</a>
                  <a href="plant-care.html" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.88rem; color: var(--text-primary);"><i class="fas fa-calendar-check" style="color: var(--sage-500);"></i> Care Schedule</a>
                  ${isAdmin ? `<a href="admin.html" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.88rem; color: #c58b49; font-weight: 600;"><i class="fas fa-lock"></i> Admin Dashboard</a>` : ''}
                  <div style="border-top: 1px solid #f0f0f0; margin-top: 6px;"></div>
                  <button onclick="Store.handleLogout()" style="width: 100%; text-align: left; background: none; border: none; padding: 10px 16px; color: #e63946; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-sign-out-alt"></i> Logout
                  </button>
                </div>
              </div>
            ` : `
              <a href="login.html" class="btn-botanical btn-botanical-primary" style="padding: 8px 18px; font-size: 0.85rem;">
                <i class="fas fa-user"></i> Login
              </a>
            `}
          </div>
        </div>
      </header>
    `;

    Store.updateBadgeCounters();
    document.addEventListener('click', (e) => {
      const drop = document.getElementById('userDropdownMenu');
      if (drop && !e.target.closest('.dropdown-wrap')) {
        drop.style.display = 'none';
      }
    });
  },

  toggleUserMenu: function(e) {
    e.stopPropagation();
    const drop = document.getElementById('userDropdownMenu');
    if (drop) {
      drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
    }
  },

  handleLogout: async function() {
    if (window.AuthService) {
      await window.AuthService.logout();
    }
    Store.showToast("Logged out successfully");
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);
  },

  // Unified Footer Injection
  renderFooter: function() {
    const footerContainer = document.getElementById('global-footer');
    if (!footerContainer) return;

    footerContainer.innerHTML = `
      <footer class="gg-footer">
        <div class="footer-container">
          <div class="footer-col">
            <div class="brand-logo" style="color: #fff; margin-bottom: 16px;">
              <div class="brand-icon-wrap" style="background: var(--sage-500);">🌿</div>
              <span>Green Garden</span>
            </div>
            <p style="color: var(--sage-200); font-size: 0.9rem; line-height: 1.7; margin-bottom: 20px;">
              India's premier botanical sanctuary connecting nature lovers with organic seeds, rare cultivars, artisanal planters, and real-time AI-powered horticultural guidance.
            </p>
            <div style="display: flex; gap: 12px;">
              <a href="#" class="action-btn" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); color: #fff;"><i class="fab fa-instagram"></i></a>
              <a href="#" class="action-btn" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); color: #fff;"><i class="fab fa-facebook-f"></i></a>
              <a href="#" class="action-btn" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); color: #fff;"><i class="fab fa-whatsapp"></i></a>
              <a href="#" class="action-btn" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); color: #fff;"><i class="fab fa-youtube"></i></a>
            </div>
          </div>

          <div class="footer-col">
            <h5>Botanical Catalog</h5>
            <ul class="footer-links">
              <li><a href="products.html?category=Flower%20Seeds">Flower Seeds</a></li>
              <li><a href="products.html?category=Vegetable%20Seeds">Vegetable Seeds</a></li>
              <li><a href="products.html?category=Live%20Plants">Live Indoor Plants</a></li>
              <li><a href="products.html?category=Fruit%20Plants">Fruit & Berry Trees</a></li>
              <li><a href="products.html?category=Planters%20%26%20Pots">Artisanal Ceramic Pots</a></li>
              <li><a href="products.html?category=Plant%20Care">Organic Manure & Feed</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h5>Smart Tools</h5>
            <ul class="footer-links">
              <li><a href="ai-doctor.html">🩺 AI Plant Doctor</a></li>
              <li><a href="plant-finder.html">🔍 Find My Perfect Plant</a></li>
              <li><a href="plant-care.html">📅 Smart Care Calendar</a></li>
              <li><a href="garden-kit.html">🌱 Custom Garden Kit</a></li>
              <li><a href="plant-passport.html">📜 Digital Plant Passport</a></li>
              <li><a href="garden-designer.html">🏡 AI Garden Designer</a></li>
              <li><a href="ar-preview.html">📱 AR Plant Placement</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h5>Customer Support</h5>
            <ul class="footer-links">
              <li><a href="orders.html">📦 Track Live Order</a></li>
              <li><a href="subscription.html">🌿 Plant Subscription Club</a></li>
              <li><a href="community.html">💬 Gardening Community</a></li>
              <li><a href="shipping-returns.html">Shipping & Returns</a></li>
              <li><a href="privacy.html">Privacy Policy</a></li>
              <li><a href="terms.html">Terms & Conditions</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h5>Botanical Newsletter</h5>
            <p style="color: var(--sage-200); font-size: 0.85rem; margin-bottom: 14px;">
              Get seasonal gardening calendars, rare seed drops and ₹100 off your first delivery.
            </p>
            <form onsubmit="event.preventDefault(); Store.showToast('🌸 Thank you for subscribing to Green Garden!'); this.reset();" style="display: flex; gap: 8px;">
              <input type="email" placeholder="Your email address" required style="padding: 10px 14px; border-radius: var(--radius-full); border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); color: #fff; font-size: 0.88rem; outline: none; flex-grow: 1;">
              <button type="submit" class="btn-botanical btn-botanical-accent" style="padding: 8px 16px; font-size: 0.85rem;">Join</button>
            </form>
          </div>
        </div>

        <div class="footer-bottom">
          <div>© 2026 Green Garden Botanical Haven. All rights reserved. Registered Indian Horticultural Nursery.</div>
          <div style="display: flex; gap: 16px;">
            <span><i class="fas fa-lock text-success"></i> 256-Bit SSL Secured</span>
            <span><i class="fas fa-truck"></i> Climate-Proof Eco Packaging</span>
            <span><i class="fas fa-shield-alt"></i> Razorpay & UPI Verified</span>
          </div>
        </div>
      </footer>
    `;
  }
};

window.Store = Store;
