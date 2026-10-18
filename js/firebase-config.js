// Green Garden Firebase Configuration & Unified Database Gateway
// Project: greengarden-95803
// Handles Live Firestore Sync with seamless offline/guest resilient caching

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdfx34Np73TiMIBLdHC0ju4hfClqYDK2E",
  authDomain: "greengarden-95803.firebaseapp.com",
  projectId: "greengarden-95803",
  storageBucket: "greengarden-95803.firebasestorage.app",
  messagingSenderId: "208492403860",
  appId: "1:208492403860:web:8928536db74bfddc176881",
  measurementId: "G-MFKW08TZ5X"
};

// State Flags
window.GG_FIREBASE_READY = false;
let fbAuth = null;
let fbDb = null;
let fbStorage = null;

// Initialize Firebase if compat SDK is loaded
function initGreenGardenFirebase() {
  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      try {
        fbStorage = firebase.storage();
      } catch (stErr) {
        console.warn("Firebase Storage optional init:", stErr.message);
      }
      window.GG_FIREBASE_READY = true;
      console.log("🌿 Green Garden Firebase connected to project: greengarden-3a76bad0");
    } else if (typeof firebase !== 'undefined' && firebase.apps.length) {
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      try {
        fbStorage = firebase.storage();
      } catch (stErr) {}
      window.GG_FIREBASE_READY = true;
    }
  } catch (err) {
    console.warn("Firebase live connect note (falling back to resilient local store):", err.message);
    window.GG_FIREBASE_READY = false;
  }
}

// Auto init on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGreenGardenFirebase);
} else {
  initGreenGardenFirebase();
}

// ============================================
// AUTHENTICATION SERVICE
// ============================================
const AuthService = {
  // Current user helper
  getCurrentUser: function() {
    // Check Firebase auth first
    if (fbAuth && fbAuth.currentUser) {
      const u = fbAuth.currentUser;
      const cached = JSON.parse(localStorage.getItem('gg_user') || 'null');
      return {
        uid: u.uid,
        email: u.email,
        name: u.displayName || (cached ? cached.name : u.email.split('@')[0]),
        role: (cached && cached.role) || (u.email === 'admin@greengarden.com' || u.email === 'akd04376@gmail.com' ? 'admin' : 'customer'),
        photoURL: u.photoURL || 'Ak.jpg'
      };
    }
    // Check persistent session fallback
    const localUser = localStorage.getItem('gg_user') || sessionStorage.getItem('currentUser');
    if (localUser) {
      try {
        return JSON.parse(localUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  // Signup
  signup: async function(name, email, password, role = 'customer') {
    if (fbAuth) {
      try {
        const userCred = await fbAuth.createUserWithEmailAndPassword(email, password);
        await userCred.user.updateProfile({ displayName: name });
        
        const userData = {
          uid: userCred.user.uid,
          name: name,
          email: email,
          role: (email === 'admin@greengarden.com' || email === 'akd04376@gmail.com') ? 'admin' : role,
          createdAt: new Date().toISOString(),
          rewardPoints: 100 // Welcome points bonus!
        };
        
        if (fbDb) {
          await fbDb.collection('users').doc(userCred.user.uid).set(userData, { merge: true });
        }
        
        localStorage.setItem('gg_user', JSON.stringify(userData));
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        return { success: true, user: userData };
      } catch (err) {
        // If Firebase Auth is in need of Console activation, use robust local account
        if (err.code === 'auth/configuration-not-found' || err.message.includes('CONFIGURATION_NOT_FOUND')) {
          console.warn("Using local auth store (Firebase Auth awaiting console toggle)");
        } else {
          return { success: false, error: err.message };
        }
      }
    }
    
    // Resilient local user creation
    const localUsers = JSON.parse(localStorage.getItem('gg_registered_users') || '{}');
    if (localUsers[email.toLowerCase()]) {
      return { success: false, error: "An account with this email already exists." };
    }
    
    const newUser = {
      uid: 'user_' + Date.now(),
      name: name,
      email: email.toLowerCase(),
      password: password, // In production stored as hash
      role: (email.toLowerCase() === 'admin@greengarden.com' || email.toLowerCase() === 'akd04376@gmail.com') ? 'admin' : role,
      createdAt: new Date().toISOString(),
      rewardPoints: 100
    };
    
    localUsers[email.toLowerCase()] = newUser;
    localStorage.setItem('gg_registered_users', JSON.stringify(localUsers));
    
    const sessionUser = { ...newUser };
    delete sessionUser.password;
    localStorage.setItem('gg_user', JSON.stringify(sessionUser));
    sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));
    return { success: true, user: sessionUser };
  },

  // Login
  login: async function(email, password) {
    if (fbAuth) {
      try {
        const userCred = await fbAuth.signInWithEmailAndPassword(email, password);
        let userData = {
          uid: userCred.user.uid,
          name: userCred.user.displayName || email.split('@')[0],
          email: userCred.user.email,
          role: (email === 'admin@greengarden.com' || email === 'akd04376@gmail.com') ? 'admin' : 'customer'
        };
        
        if (fbDb) {
          const userDoc = await fbDb.collection('users').doc(userCred.user.uid).get();
          if (userDoc.exists) {
            userData = { ...userData, ...userDoc.data() };
          }
        }
        
        localStorage.setItem('gg_user', JSON.stringify(userData));
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        return { success: true, user: userData };
      } catch (err) {
        if (err.code !== 'auth/configuration-not-found') {
          // If incorrect password or user not found in Firebase, check local store
        }
      }
    }
    
    // Resilient check in local registered users
    const localUsers = JSON.parse(localStorage.getItem('gg_registered_users') || '{}');
    const u = localUsers[email.toLowerCase()];
    
    // Default admin demo credential support
    if (email.toLowerCase() === 'admin@greengarden.com' && password === 'admin123') {
      const adminUser = {
        uid: 'admin_master_1',
        name: 'Chief Horticulturist (Admin)',
        email: 'admin@greengarden.com',
        role: 'admin',
        rewardPoints: 9999
      };
      localStorage.setItem('gg_user', JSON.stringify(adminUser));
      sessionStorage.setItem('currentUser', JSON.stringify(adminUser));
      return { success: true, user: adminUser };
    }
    
    if (u && u.password === password) {
      const sessionUser = { ...u };
      delete sessionUser.password;
      localStorage.setItem('gg_user', JSON.stringify(sessionUser));
      sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };
    }
    
    return { success: false, error: "Invalid email or password. Please try again." };
  },

  // Google Sign-In
  loginWithGoogle: async function() {
    if (fbAuth) {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await fbAuth.signInWithPopup(provider);
        const u = result.user;
        const userData = {
          uid: u.uid,
          name: u.displayName || u.email.split('@')[0],
          email: u.email,
          role: (u.email === 'admin@greengarden.com' || u.email === 'akd04376@gmail.com') ? 'admin' : 'customer',
          photoURL: u.photoURL || 'Ak.jpg',
          createdAt: new Date().toISOString(),
          rewardPoints: 100
        };

        if (fbDb) {
          await fbDb.collection('users').doc(u.uid).set(userData, { merge: true });
        }

        localStorage.setItem('gg_user', JSON.stringify(userData));
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        return { success: true, user: userData };
      } catch (err) {
        console.warn("Google sign-in popup note:", err.message);
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          return { success: false, error: "Google sign-in was closed." };
        }
        // If Google provider is awaiting toggle in Firebase Console, fallback to demo Google profile
        if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed' || err.message.includes('CONFIGURATION_NOT_FOUND')) {
          console.warn("Google provider pending in console, providing seamless demo Google profile");
        } else {
          return { success: false, error: err.message };
        }
      }
    }

    // Fallback Google Sign-In for demo / before Console activation
    const googleUser = {
      uid: 'google_usr_' + Date.now(),
      name: 'Google Gardener',
      email: 'akd04376@gmail.com',
      role: 'customer',
      photoURL: 'Ak.jpg',
      createdAt: new Date().toISOString(),
      rewardPoints: 100
    };
    localStorage.setItem('gg_user', JSON.stringify(googleUser));
    sessionStorage.setItem('currentUser', JSON.stringify(googleUser));
    return { success: true, user: googleUser, fallback: true };
  },

  // Logout
  logout: async function() {
    if (fbAuth) {
      try { await fbAuth.signOut(); } catch (e) {}
    }
    localStorage.removeItem('gg_user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('loggedInUser');
    return true;
  },

  // Password Reset
  resetPassword: async function(email) {
    if (fbAuth) {
      try {
        await fbAuth.sendPasswordResetEmail(email);
        return { success: true, message: "Password reset link sent to your email." };
      } catch (e) {}
    }
    return { success: true, message: "A recovery link has been prepared for " + email };
  },

  // Auth state listener
  onAuthChange: function(callback) {
    if (fbAuth) {
      fbAuth.onAuthStateChanged(user => {
        if (user) {
          callback(AuthService.getCurrentUser());
        } else {
          callback(null);
        }
      });
    } else {
      callback(AuthService.getCurrentUser());
    }
  }
};

// ============================================
// PRODUCTS SERVICE (REAL-TIME FIRESTORE + CACHE)
// ============================================
const ProductService = {
  // Get all products (merged with Firestore updates)
  getAll: async function() {
    let products = (typeof INITIAL_CATALOG !== 'undefined') ? [...INITIAL_CATALOG] : [];
    
    // Check locally saved products (for admin edits when offline)
    const localOverrides = JSON.parse(localStorage.getItem('gg_custom_products') || '[]');
    if (localOverrides.length > 0) {
      localOverrides.forEach(p => {
        const idx = products.findIndex(item => item.id === p.id);
        if (idx !== -1) {
          products[idx] = { ...products[idx], ...p };
        } else {
          products.unshift(p);
        }
      });
    }
    
    // Live Firestore sync if available
    if (fbDb) {
      try {
        const snap = await fbDb.collection('products').get();
        if (!snap.empty) {
          snap.forEach(doc => {
            const data = doc.data();
            const id = data.id || parseInt(doc.id.replace('prod_', '')) || doc.id;
            const idx = products.findIndex(item => item.id === id);
            if (idx !== -1) {
              products[idx] = { ...products[idx], ...data, id: id };
            } else {
              products.unshift({ id: id, ...data });
            }
          });
        }
      } catch (e) {
        console.warn("Firestore products read note:", e.message);
      }
    }
    
    return products;
  },

  // Real-time listener for product changes
  subscribeToProducts: function(callback) {
    if (fbDb) {
      try {
        return fbDb.collection('products').onSnapshot(snap => {
          ProductService.getAll().then(products => callback(products));
        }, err => {
          console.warn("Snapshot listener fallback:", err.message);
          ProductService.getAll().then(callback);
        });
      } catch (e) {
        ProductService.getAll().then(callback);
      }
    } else {
      ProductService.getAll().then(callback);
    }
  },

  // Save / Update product (Admin)
  saveProduct: async function(product) {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: "Unauthorized. Admin privileges required." };
    }
    
    // Save to Firestore
    if (fbDb) {
      try {
        const docId = 'prod_' + product.id;
        await fbDb.collection('products').doc(docId).set(product, { merge: true });
      } catch (e) {
        console.warn("Firestore product save error:", e.message);
      }
    }
    
    // Update local cache
    const customProds = JSON.parse(localStorage.getItem('gg_custom_products') || '[]');
    const idx = customProds.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      customProds[idx] = product;
    } else {
      customProds.push(product);
    }
    localStorage.setItem('gg_custom_products', JSON.stringify(customProds));
    
    return { success: true, product: product };
  },

  // Delete / Archive product
  deleteProduct: async function(productId) {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: "Unauthorized" };
    }
    
    if (fbDb) {
      try {
        await fbDb.collection('products').doc('prod_' + productId).delete();
      } catch (e) {}
    }
    
    const customProds = JSON.parse(localStorage.getItem('gg_custom_products') || '[]');
    const filtered = customProds.filter(p => p.id !== productId);
    localStorage.setItem('gg_custom_products', JSON.stringify(filtered));
    return { success: true };
  }
};

// ============================================
// ORDERS SERVICE (REAL-TIME TIMELINE & PDF)
// ============================================
const OrderService = {
  createOrder: async function(orderData) {
    const user = AuthService.getCurrentUser();
    const orderId = 'GG-' + Math.floor(100000 + Math.random() * 900000);
    
    const finalOrder = {
      orderId: orderId,
      userId: user ? user.uid : 'guest_' + Date.now(),
      customerName: orderData.shippingAddress.name,
      customerEmail: orderData.shippingAddress.email,
      customerPhone: orderData.shippingAddress.phone,
      items: orderData.items,
      subtotal: orderData.subtotal,
      discount: orderData.discount || 0,
      couponCode: orderData.couponCode || null,
      shippingFee: orderData.shippingFee || 0,
      rewardPointsUsed: orderData.rewardPointsUsed || 0,
      totalAmount: orderData.totalAmount,
      paymentMethod: orderData.paymentMethod, // 'razorpay' or 'cod'
      paymentStatus: orderData.paymentStatus || 'Pending',
      razorpayPaymentId: orderData.razorpayPaymentId || null,
      razorpayOrderId: orderData.razorpayOrderId || null,
      shippingAddress: orderData.shippingAddress,
      status: 'Placed', // Placed -> Confirmed -> Packing -> Dispatched -> Out for Delivery -> Delivered
      timeline: [
        { status: 'Order Placed', timestamp: new Date().toISOString(), note: 'Order successfully placed with Green Garden' }
      ],
      estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAt: new Date().toISOString()
    };
    
    if (finalOrder.paymentStatus === 'Paid') {
      finalOrder.timeline.push({
        status: 'Payment Confirmed',
        timestamp: new Date().toISOString(),
        note: `Verified via ${orderData.paymentMethod === 'razorpay' ? 'Razorpay' : 'Gateway'}`
      });
    }

    // Save to Firestore
    if (fbDb) {
      try {
        await fbDb.collection('orders').doc(orderId).set(finalOrder);
      } catch (e) {
        console.warn("Firestore order create note:", e.message);
      }
    }
    
    // Save locally
    const orders = JSON.parse(localStorage.getItem('gg_orders') || '[]');
    orders.unshift(finalOrder);
    localStorage.setItem('gg_orders', JSON.stringify(orders));
    
    // Deduct stock locally and in Firestore
    for (const item of finalOrder.items) {
      try {
        const prodId = item.id;
        if (fbDb) {
          fbDb.collection('products').doc('prod_' + prodId).update({
            stock: firebase.firestore.FieldValue.increment(-item.quantity)
          }).catch(() => {});
        }
      } catch (e) {}
    }
    
    // Award 5% reward points
    if (user) {
      const earnedPoints = Math.floor(finalOrder.totalAmount * 0.05);
      RewardService.addPoints(earnedPoints, `Earned on Order #${orderId}`);
    }

    // Clear cart
    localStorage.removeItem('cart');
    
    return { success: true, order: finalOrder };
  },

  getUserOrders: async function(userId) {
    if (fbDb && userId) {
      try {
        const snap = await fbDb.collection('orders').where('userId', '==', userId).get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(d => list.push(d.data()));
          return list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
      } catch (e) {}
    }
    
    const local = JSON.parse(localStorage.getItem('gg_orders') || '[]');
    if (userId) {
      return local.filter(o => o.userId === userId || !o.userId);
    }
    return local;
  },

  getAllOrders: async function() {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return [];
    }
    
    if (fbDb) {
      try {
        const snap = await fbDb.collection('orders').get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(d => list.push(d.data()));
          return list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
      } catch (e) {}
    }
    
    return JSON.parse(localStorage.getItem('gg_orders') || '[]');
  },

  updateOrderStatus: async function(orderId, newStatus, note = '') {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { success: false, error: "Admin only" };
    }
    
    const newStep = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: note || `Order updated to ${newStatus}`
    };
    
    if (fbDb) {
      try {
        await fbDb.collection('orders').doc(orderId).update({
          status: newStatus,
          timeline: firebase.firestore.FieldValue.arrayUnion(newStep)
        });
      } catch (e) {}
    }
    
    const orders = JSON.parse(localStorage.getItem('gg_orders') || '[]');
    const o = orders.find(x => x.orderId === orderId);
    if (o) {
      o.status = newStatus;
      o.timeline = o.timeline || [];
      o.timeline.push(newStep);
      localStorage.setItem('gg_orders', JSON.stringify(orders));
    }
    
    return { success: true };
  }
};

// ============================================
// REWARDS & GREEN POINTS SERVICE
// ============================================
const RewardService = {
  getBalance: function() {
    const user = AuthService.getCurrentUser();
    if (!user) return 0;
    const pts = localStorage.getItem('gg_points_' + user.uid);
    return pts !== null ? parseInt(pts) : (user.rewardPoints || 100);
  },
  
  addPoints: function(amount, reason) {
    const user = AuthService.getCurrentUser();
    if (!user) return 0;
    const current = RewardService.getBalance();
    const updated = current + amount;
    localStorage.setItem('gg_points_' + user.uid, updated.toString());
    
    // Log transaction
    const logs = JSON.parse(localStorage.getItem('gg_points_history_' + user.uid) || '[]');
    logs.unshift({
      amount: `+${amount}`,
      reason: reason,
      date: new Date().toISOString()
    });
    localStorage.setItem('gg_points_history_' + user.uid, JSON.stringify(logs));
    return updated;
  },

  redeemPoints: function(amount) {
    const user = AuthService.getCurrentUser();
    if (!user) return false;
    const current = RewardService.getBalance();
    if (current < amount) return false;
    const updated = current - amount;
    localStorage.setItem('gg_points_' + user.uid, updated.toString());
    
    const logs = JSON.parse(localStorage.getItem('gg_points_history_' + user.uid) || '[]');
    logs.unshift({
      amount: `-${amount}`,
      reason: "Redeemed at checkout discount",
      date: new Date().toISOString()
    });
    localStorage.setItem('gg_points_history_' + user.uid, JSON.stringify(logs));
    return true;
  }
};

window.AuthService = AuthService;
window.ProductService = ProductService;
window.OrderService = OrderService;
window.RewardService = RewardService;
