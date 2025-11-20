const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const ProductsController = require('./controllers/ProductsController');
const UsersController = require('./controllers/UsersController');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Session Middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/shopping');
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;
    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Home page
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Inventory (admin only)
app.get('/inventory', checkAuthenticated, checkAdmin, ProductsController.listProductsView);

// Shopping (user)
app.get('/shopping', checkAuthenticated, ProductsController.listProductsViewShopping);

// Product details
app.get('/product/:id', checkAuthenticated, ProductsController.getProductByIdView);

// Add product (admin only)
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { user: req.session.user });
});
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), ProductsController.addProductView);

// Update product (admin only)
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, ProductsController.getProductByIdEditView);
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), ProductsController.updateProductView);

// Delete product (admin only)
app.post('/deleteProduct/:id', checkAuthenticated, checkAdmin, ProductsController.deleteProductView);

// Cart
app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
});

// Add to cart
app.post('/add-to-cart/:id', checkAuthenticated, ProductsController.addToCart);

// Update cart quantity
app.post('/update-cart/:id', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity);

    const item = cart.find(i => i.id === productId);
    if (item && quantity > 0) item.quantity = quantity;

    req.session.cart = cart;
    res.redirect('/cart');
});

// Remove item from cart
app.post('/remove-from-cart/:id', checkAuthenticated, (req, res) => {
    let cart = req.session.cart || [];
    const productId = parseInt(req.params.id);
    cart = cart.filter(item => item.id !== productId);
    req.session.cart = cart;
    res.redirect('/cart');
});

// Clear all items from cart
app.post('/cart/clear', checkAuthenticated, (req, res) => {
    req.session.cart = [];
    res.redirect('/cart');
});

// Checkout page
app.get('/checkout', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    let subtotal = 0;
    cart.forEach(item => { subtotal += item.price * item.quantity; });
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    res.render('checkout', { cart, subtotal, tax, total, user: req.session.user });
});

// Process checkout
app.post('/checkout', checkAuthenticated, (req, res) => {
    // TODO: Save order to DB here
    req.session.cart = [];
    req.flash('success', 'Order placed successfully!');
    res.redirect('/shopping');
});

// Show reviews page
app.get('/reviews', checkAuthenticated, async (req, res) => {
  const [reviews] = await db.query(`
    SELECT r.id, r.rating, r.comment, r.createdAt, u.username, p.productName
    FROM reviews r
    JOIN users u ON r.userId = u.id
    JOIN products p ON r.productId = p.id
    ORDER BY r.createdAt DESC
  `);

  const [products] = await db.query(`SELECT id, productName FROM products`);

  res.render('reviews', { reviews, products, user: req.session.user });
});

// Add review
app.post('/reviews/add', checkAuthenticated, async (req, res) => {
  const { productId, rating, comment } = req.body;
  await db.query(`INSERT INTO reviews (userId, productId, rating, comment) VALUES (?, ?, ?, ?)`, 
                 [req.session.user.id, productId, rating, comment]);
  res.redirect('/reviews');
});

// Delete review (admin only)
app.post('/reviews/delete/:id', checkAuthenticated, (req, res) => {
  if (req.session.user.role !== 'admin') return res.redirect('/reviews');
  db.query(`DELETE FROM reviews WHERE id = ?`, [req.params.id]);
  res.redirect('/reviews');
});


// Register
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});
app.post('/register', validateRegistration, UsersController.registerUser);

// Login
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});
app.post('/login', UsersController.loginUser);

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

