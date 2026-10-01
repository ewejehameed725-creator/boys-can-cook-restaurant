require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET";

async function db(sql, params=[]) {
  return pool.query(sql, params);
}

async function initDB() {
  await db(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(30) UNIQUE NOT NULL,
      email VARCHAR(160) UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
      category VARCHAR(60) DEFAULT 'Food',
      emoji VARCHAR(20) DEFAULT '🍛',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallet_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(balance >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
      reference VARCHAR(120) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total NUMERIC(12,2) NOT NULL CHECK(total >= 0),
      status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
      delivery_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price >= 0)
    );
  `);

  const count = await db("SELECT COUNT(*)::int AS count FROM menu_items");
  if (count.rows[0].count === 0) {
    await db(`
      INSERT INTO menu_items(name,description,price,category,emoji) VALUES
      ('Jollof Rice','Smoky party-style jollof rice.',2000,'Rice','🍛'),
      ('Spaghetti','Tasty spaghetti prepared fresh.',2000,'Pasta','🍝'),
      ('Chicken','Well-seasoned crispy chicken.',1500,'Protein','🍗'),
      ('Fried Rice','Fresh fried rice with vegetables.',2500,'Rice','🍚'),
      ('Beef','Tender seasoned beef.',1200,'Protein','🥩'),
      ('Chapman','Cold refreshing drink.',1200,'Drinks','🥤')
    `);
  }
}

function tokenFor(user) {
  return jwt.sign({ id:user.id, role:user.role }, JWT_SECRET, { expiresIn:"7d" });
}

async function auth(req,res,next) {
  try {
    const header=req.headers.authorization||"";
    if(!header.startsWith("Bearer ")) return res.status(401).json({message:"Login required"});
    const decoded=jwt.verify(header.slice(7),JWT_SECRET);
    const result=await db("SELECT id,name,phone,email,role,created_at FROM users WHERE id=$1",[decoded.id]);
    if(!result.rowCount) return res.status(401).json({message:"Account not found"});
    req.user=result.rows[0];
    next();
  } catch { res.status(401).json({message:"Invalid or expired login"}); }
}

app.get("/", (req,res)=>res.json({ok:true,message:"Boys Can Cook backend is running!"}));
app.get("/db-test", async (req,res)=>{
  try { await db("SELECT 1"); res.json({success:true,message:"Database connected"}); }
  catch(e){ res.status(500).json({success:false,message:"Database connection failed",error:e.message}); }
});

app.post("/api/auth/register", async (req,res)=>{
  try {
    const {name,phone,email,password}=req.body;
    if(!name||!phone||!password) return res.status(400).json({message:"Name, phone and password are required"});
    if(password.length<6) return res.status(400).json({message:"Password must be at least 6 characters"});
    const hash=await bcrypt.hash(password,12);
    const result=await db("INSERT INTO users(name,phone,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,phone,email,role,created_at",
      [name.trim(),phone.trim(),email?.trim()||null,hash]);
    const user=result.rows[0];
    await db("INSERT INTO wallet_accounts(user_id) VALUES($1)",[user.id]);
    res.status(201).json({user,token:tokenFor(user)});
  } catch(e) {
    if(e.code==="23505") return res.status(409).json({message:"Phone or email is already registered"});
    res.status(500).json({message:"Unable to create account"});
  }
});

app.post("/api/auth/login", async (req,res)=>{
  try {
    const {identifier,password}=req.body;
    const result=await db("SELECT * FROM users WHERE phone=$1 OR LOWER(email)=LOWER($1) LIMIT 1",[identifier]);
    if(!result.rowCount) return res.status(401).json({message:"Invalid login details"});
    const user=result.rows[0];
    if(!(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({message:"Invalid login details"});
    delete user.password_hash;
    res.json({user,token:tokenFor(user)});
  } catch(e){ res.status(500).json({message:"Unable to login"}); }
});

app.get("/api/me",auth,(req,res)=>res.json({user:req.user}));

app.get("/api/menu",async(req,res)=>{
  const result=await db("SELECT id,name,description,price,category,emoji,available FROM menu_items WHERE available=true ORDER BY id");
  res.json(result.rows);
});

app.get("/api/wallet",auth,async(req,res)=>{
  const wallet=await db("SELECT balance,updated_at FROM wallet_accounts WHERE user_id=$1",[req.user.id]);
  const transactions=await db("SELECT type,amount,reference,status,description,created_at FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[req.user.id]);
  res.json({balance:wallet.rows[0]?.balance||0,transactions:transactions.rows});
});

/* Creates a pending deposit. A payment provider webhook must mark it successful.
   Never let the browser directly increase wallet balance. */
app.post("/api/wallet/deposit",auth,async(req,res)=>{
  const amount=Number(req.body.amount);
  if(!Number.isFinite(amount)||amount<100) return res.status(400).json({message:"Minimum deposit is ₦100"});
  const reference=`DEP-${req.user.id}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
  await db("INSERT INTO wallet_transactions(user_id,type,amount,reference,status,description) VALUES($1,'deposit',$2,$3,'pending','Wallet deposit')",
    [req.user.id,amount,reference]);
  res.status(201).json({message:"Deposit created. Connect payment gateway here.",reference,amount});
});

app.get("/api/orders",auth,async(req,res)=>{
  const orders=await db("SELECT id,total,status,delivery_address,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC",[req.user.id]);
  res.json(orders.rows);
});

app.post("/api/orders",auth,async(req,res)=>{
  const {items,deliveryAddress}=req.body;
  if(!Array.isArray(items)||!items.length) return res.status(400).json({message:"Cart is empty"});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    let total=0, normalized=[];
    for(const item of items){
      const r=await client.query("SELECT id,price,available FROM menu_items WHERE id=$1 FOR SHARE",[item.menuItemId]);
      if(!r.rowCount||!r.rows[0].available) throw new Error("A selected food item is unavailable");
      const qty=Number(item.quantity);
      if(!Number.isInteger(qty)||qty<1||qty>50) throw new Error("Invalid quantity");
      const price=Number(r.rows[0].price);
      total += price*qty;
      normalized.push({id:r.rows[0].id,qty,price});
    }
    const wallet=await client.query("SELECT balance FROM wallet_accounts WHERE user_id=$1 FOR UPDATE",[req.user.id]);
    if(Number(wallet.rows[0].balance)<total) {
      await client.query("ROLLBACK");
      return res.status(400).json({message:"Insufficient wallet balance"});
    }
    const order=await client.query("INSERT INTO orders(user_id,total,status,delivery_address) VALUES($1,$2,'confirmed',$3) RETURNING id,total,status,created_at",
      [req.user.id,total,deliveryAddress||null]);
    for(const x of normalized) await client.query("INSERT INTO order_items(order_id,menu_item_id,quantity,unit_price) VALUES($1,$2,$3,$4)",[order.rows[0].id,x.id,x.qty,x.price]);
    await client.query("UPDATE wallet_accounts SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2",[total,req.user.id]);
    await client.query("INSERT INTO wallet_transactions(user_id,type,amount,reference,status,description) VALUES($1,'debit',$2,$3,'successful',$4)",
      [req.user.id,total,`ORD-${order.rows[0].id}`,`Payment for order #${order.rows[0].id}`]);
    await client.query("COMMIT");
    res.status(201).json({order:order.rows[0]});
  } catch(e) {
    await client.query("ROLLBACK");
    res.status(400).json({message:e.message||"Unable to create order"});
  } finally { client.release(); }
});

app.get("/api/admin/orders",auth,async(req,res)=>{
  if(req.user.role!=="admin") return res.status(403).json({message:"Admin only"});
  const r=await db(`SELECT o.id,o.total,o.status,o.delivery_address,o.created_at,u.name,u.phone
                   FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC`);
  res.json(r.rows);
});

app.patch("/api/admin/orders/:id/status",auth,async(req,res)=>{
  if(req.user.role!=="admin") return res.status(403).json({message:"Admin only"});
  const allowed=["confirmed","preparing","ready","out_for_delivery","delivered","cancelled"];
  if(!allowed.includes(req.body.status)) return res.status(400).json({message:"Invalid status"});
  const r=await db("UPDATE orders SET status=$1 WHERE id=$2 RETURNING id,status",[req.body.status,req.params.id]);
  if(!r.rowCount) return res.status(404).json({message:"Order not found"});
  res.json(r.rows[0]);
});

initDB().then(()=>{
  app.listen(PORT,()=>console.log(`Boys Can Cook API listening on ${PORT}`));
}).catch(err=>{console.error("Startup failed:",err);process.exit(1)});
