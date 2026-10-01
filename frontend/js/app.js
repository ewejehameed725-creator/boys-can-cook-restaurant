const API_URL = "https://boys-can-cook-restaurant.onrender.com";

const PRODUCTS = [
  {
    id: 1,
    name: "Jollof Rice",
    price: 2000,
    emoji: "🍛",
    desc: "Smoky party-style jollof rice."
  },
  {
    id: 2,
    name: "Spaghetti",
    price: 2000,
    emoji: "🍝",
    desc: "Tasty spaghetti prepared fresh."
  },
  {
    id: 4,
    name: "Fried Rice",
    price: 2500,
    emoji: "🍚",
    desc: "Fresh fried rice with vegetables."
  },
  {
    id: 5,
    name: "Beef",
    price: 1200,
    emoji: "🥩",
    desc: "Tender seasoned beef."
  },
  {
    id: 6,
    name: "Chapman",
    price: 1200,
    emoji: "🥤",
    desc: "Cold refreshing drink."
  }
];

const money = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const getToken = () =>
  localStorage.getItem("bcc_token");

const getCart = () =>
  JSON.parse(localStorage.getItem("bcc_cart") || "[]");

const saveCart = (cart) => {
  localStorage.setItem("bcc_cart", JSON.stringify(cart));
  updateCartCount();
};

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

/* =========================
   CART
========================= */

function updateCartCount() {
  const el = document.getElementById("cartCount");

  if (el) {
    el.textContent = getCart().reduce(
      (total, item) => total + item.qty,
      0
    );
  }
}

function productCard(product) {
  return `
    <article class="food-card">
      <div class="food-image">${product.emoji || "🍽️"}</div>

      <div class="food-info">
        <h3>${product.name}</h3>

        <p>${product.description || product.desc || ""}</p>

        <div class="price-row">
          <span class="price">${money(product.price)}</span>

          <button
            class="add-btn"
            onclick="addToCart(${product.id})"
          >
            + Add
          </button>
        </div>
      </div>
    </article>
  `;
}

async function loadMenu() {
  const featured = document.getElementById("featuredMenu");
  const menuGrid = document.getElementById("menuGrid");

  if (!featured && !menuGrid) return;

  try {
    const products = await api("/api/menu");

    if (featured) {
      featured.innerHTML = products
        .slice(0, 3)
        .map(productCard)
        .join("");
    }

    if (menuGrid) {
      menuGrid.innerHTML = products
        .map(productCard)
        .join("");
    }

    localStorage.setItem(
      "bcc_products",
      JSON.stringify(products)
    );

  } catch (error) {
    console.error("Menu error:", error);

    if (featured) {
      featured.innerHTML =
        `<p class="message">Unable to load menu.</p>`;
    }

    if (menuGrid) {
      menuGrid.innerHTML =
        `<p class="message">Unable to load menu.</p>`;
    }
  }
}

function getProducts() {
  return JSON.parse(
    localStorage.getItem("bcc_products") ||
    JSON.stringify(PRODUCTS)
  );
}

function addToCart(id) {
  const products = getProducts();

  const product = products.find(
    (item) => Number(item.id) === Number(id)
  );

  if (!product) {
    alert("Food item not found.");
    return;
  }

  const cart = getCart();

  const existing = cart.find(
    (item) => Number(item.id) === Number(id)
  );

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id: Number(id),
      qty: 1
    });
  }

  saveCart(cart);

  alert(`${product.name} added to cart!`);
}

function renderCart() {
  const box = document.getElementById("cartItems");

  if (!box) return;

  const cart = getCart();
  const products = getProducts();

  if (!cart.length) {
    box.innerHTML = `
      <div class="empty-state">
        Your cart is empty.
        <a
          href="menu.html"
          style="color:#df7d13;font-weight:800"
        >
          Browse menu →
        </a>
      </div>
    `;

    const totalElement =
      document.getElementById("cartTotal");

    if (totalElement) {
      totalElement.textContent = money(0);
    }

    return;
  }

  let total = 0;

  box.innerHTML = cart
    .map((item) => {
      const product = products.find(
        (p) => Number(p.id) === Number(item.id)
      );

      if (!product) return "";

      const itemTotal =
        Number(product.price) * item.qty;

      total += itemTotal;

      return `
        <div class="cart-item">
          <div>
            <strong>
              ${product.emoji || "🍽️"}
              ${product.name}
            </strong>

            <div>
              ${item.qty} × ${money(product.price)}
            </div>
          </div>

          <button
            onclick="removeItem(${product.id})"
          >
            Remove
          </button>
        </div>
      `;
    })
    .join("");

  const totalElement =
    document.getElementById("cartTotal");

  if (totalElement) {
    totalElement.textContent = money(total);
  }
}

function removeItem(id) {
  const cart = getCart().filter(
    (item) => Number(item.id) !== Number(id)
  );

  saveCart(cart);
  renderCart();
}

/* =========================
   REGISTER
========================= */

function initRegister() {
  const form =
    document.getElementById("registerForm");

  if (!form) return;

  form.onsubmit = async (event) => {
    event.preventDefault();

    const message =
      document.getElementById("authMessage");

    const button =
      form.querySelector("button[type='submit']");

    const formData = new FormData(form);

    const name = formData.get("name")?.trim();
    const phone = formData.get("phone")?.trim();
    const email = formData.get("email")?.trim();
    const password = formData.get("password");

    try {
      button.disabled = true;
      button.textContent = "Creating account...";

      const data = await api(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            phone,
            email: email || null,
            password
          })
        }
      );

      localStorage.setItem(
        "bcc_token",
        data.token
      );

      localStorage.setItem(
        "bcc_user",
        JSON.stringify(data.user)
      );

      message.textContent =
        "Account created successfully. Redirecting...";

      message.style.color = "green";

      setTimeout(() => {
        location.href = "account.html";
      }, 700);

    } catch (error) {
      message.textContent = error.message;
      message.style.color = "red";

      button.disabled = false;
      button.textContent = "Create account";
    }
  };
}

/* =========================
   LOGIN
========================= */

function initLogin() {
  const form =
    document.getElementById("loginForm");

  if (!form) return;

  form.onsubmit = async (event) => {
    event.preventDefault();

    const message =
      document.getElementById("authMessage");

    const button =
      form.querySelector("button[type='submit']");

    const formData =
      new FormData(form);

    const identifier =
      formData.get("identifier")?.trim();

    const password =
      formData.get("password");

    try {
      button.disabled = true;
      button.textContent = "Logging in...";

      const data = await api(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            identifier,
            password
          })
        }
      );

      localStorage.setItem(
        "bcc_token",
        data.token
      );

      localStorage.setItem(
        "bcc_user",
        JSON.stringify(data.user)
      );

      location.href = "account.html";

    } catch (error) {
      message.textContent = error.message;
      message.style.color = "red";

      button.disabled = false;
      button.textContent = "Login";
    }
  };
}

/* =========================
   ACCOUNT
========================= */

async function initAccount() {
  const accountName =
    document.getElementById("accountName");

  if (!accountName) return;

  if (!getToken()) {
    location.href = "login.html";
    return;
  }

  try {
    const data = await api("/api/me");

    const user = data.user;

    localStorage.setItem(
      "bcc_user",
      JSON.stringify(user)
    );

    accountName.textContent =
      user.name.split(" ")[0];

    const profileName =
      document.getElementById("profileName");

    const profilePhone =
      document.getElementById("profilePhone");

    const profileEmail =
      document.getElementById("profileEmail");

    if (profileName)
      profileName.textContent = user.name;

    if (profilePhone)
      profilePhone.textContent = user.phone;

    if (profileEmail)
      profileEmail.textContent =
        user.email || "Not added";

    await loadWallet();

    const logout =
      document.getElementById("logoutBtn");

    if (logout) {
      logout.onclick = () => {
        localStorage.removeItem("bcc_token");
        localStorage.removeItem("bcc_user");
        location.href = "index.html";
      };
    }

  } catch (error) {
    localStorage.removeItem("bcc_token");
    localStorage.removeItem("bcc_user");

    location.href = "login.html";
  }
}

/* =========================
   WALLET
========================= */

async function loadWallet() {
  try {
    const data =
      await api("/api/wallet");

    const balance =
      document.getElementById("walletBalance");

    const amount =
      document.getElementById("walletAmount");

    if (balance) {
      balance.textContent =
        money(data.balance);
    }

    if (amount) {
      amount.textContent =
        money(data.balance);
    }

    return data;

  } catch (error) {
    console.error(
      "Wallet error:",
      error
    );
  }
}

async function initWallet() {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }
  
    const depositBtn = document.getElementById("depositBtn");
  
    await loadWallet();
  
    if (depositBtn) {
      depositBtn.addEventListener("click", async () => {
        const amountText = prompt("Enter test payment amount (minimum ₦100):");
  
        if (!amountText) return;
  
        const amount = Number(amountText);
  
        if (!Number.isFinite(amount) || amount < 100) {
          alert("Please enter a valid amount of at least ₦100.");
          return;
        }
  
        try {
          depositBtn.disabled = true;
          depositBtn.textContent = "Processing...";
  
          const result = await api("/api/wallet/test-credit", {
            method: "POST",
            body: JSON.stringify({ amount })
          });
  
          alert(
            `✅ Test payment successful!\n\nAmount: ₦${Number(result.amount).toLocaleString()}\nReference: ${result.reference}`
          );
  
          await loadWallet();
  
        } catch (error) {
          alert(`❌ Payment failed: ${error.message}`);
        } finally {
          depositBtn.disabled = false;
          depositBtn.textContent = "＋ Add money";
        }
      });
    }
  }

/* =========================
   ORDERS
========================= */

async function initOrders() {
  const box =
    document.getElementById("ordersList");

  if (!box) return;

  if (!getToken()) {
    location.href = "login.html";
    return;
  }

  try {
    const orders =
      await api("/api/orders");

    if (!orders.length) {
      box.innerHTML = `
        <div class="empty-state">
          You have no orders yet.
        </div>
      `;

      return;
    }

    box.innerHTML = orders
      .map(
        (order) => `
          <div class="order-card">
            <div class="order-top">
              <strong>
                Order #${order.id}
              </strong>

              <span class="status">
                ${order.status}
              </span>
            </div>

            <p>
              ${money(order.total)}
            </p>

            <small>
              ${new Date(
                order.created_at
              ).toLocaleString()}
            </small>
          </div>
        `
      )
      .join("");

  } catch (error) {
    box.innerHTML = `
      <div class="message">
        ${error.message}
      </div>
    `;
  }
}

/* =========================
   CHECKOUT
========================= */

function initCheckout() {
  const button =
    document.getElementById("checkoutBtn");

  if (!button) return;

  button.onclick = async () => {
    if (!getToken()) {
      alert(
        "Please create an account or login before checkout."
      );

      location.href = "login.html";
      return;
    }

    const cart = getCart();

    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    const deliveryAddress =
      prompt("Enter your delivery address:");

    if (!deliveryAddress) return;

    try {
      button.disabled = true;
      button.textContent =
        "Processing...";

      const items = cart.map(
        (item) => ({
          menuItemId: Number(item.id),
          quantity: Number(item.qty)
        })
      );

      const data =
        await api(
          "/api/orders",
          {
            method: "POST",
            body: JSON.stringify({
              items,
              deliveryAddress
            })
          }
        );

      localStorage.setItem(
        "bcc_cart",
        "[]"
      );

      alert(
        `Order #${data.order.id} created successfully!`
      );

      location.href =
        "orders.html";

    } catch (error) {
      alert(error.message);

      button.disabled = false;
      button.textContent =
        "Checkout";
    }
  };
}

/* =========================
   START APP
========================= */

loadMenu();
updateCartCount();
renderCart();

initRegister();
initLogin();
initAccount();
initWallet();
initOrders();
initCheckout();