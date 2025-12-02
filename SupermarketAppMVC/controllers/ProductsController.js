const ProductsModel = require('../models/Products');
const db = require('../db'); // Make sure you have this so we can run SQL queries

const ProductsController = {

    listProductsView: (req, res) => {
        // First get products
        ProductsModel.getAllProducts((err, products) => {
            if (err) return res.status(500).send('Database error');

            // Now get dashboard stats
            const queries = {
                sales: 'SELECT IFNULL(SUM(totalAmount),0) AS totalSales FROM orders',
                orders: 'SELECT COUNT(*) AS totalOrders FROM orders',
                pending: "SELECT COUNT(*) AS pendingOrders FROM orders WHERE status = 'pending'",
                top: `
                    SELECT p.productName, SUM(oi.quantity) AS totalSold
                    FROM orderitems oi
                    JOIN products p ON oi.productId = p.id
                    GROUP BY oi.productId
                    ORDER BY totalSold DESC
                    LIMIT 1
                `
            };

            db.query(queries.sales, (err, salesResult) => {
                if (err) return res.status(500).send('Dashboard error');

                db.query(queries.orders, (err, ordersResult) => {
                    if (err) return res.status(500).send('Dashboard error');

                    db.query(queries.pending, (err, pendingResult) => {
                        if (err) return res.status(500).send('Dashboard error');

                        db.query(queries.top, (err, topResult) => {
                            if (err) return res.status(500).send('Dashboard error');

                            // Now render with EVERYTHING combined
                            res.render('inventory', {
                                products,
                                user: req.session.user,
                                totalSales: salesResult[0].totalSales,
                                totalOrders: ordersResult[0].totalOrders,
                                pendingOrders: pendingResult[0].pendingOrders,
                                topProduct: topResult
                            });
                        });
                    });
                });
            });
        });
    },

    listProductsViewShopping: (req, res) => {
        ProductsModel.getAllProducts((err, products) => {
            if (err) return res.status(500).send('Database error');
            res.render('shopping', { products, user: req.session.user });
        });
    },

    getProductByIdView: (req, res) => {
        ProductsModel.getProductById(req.params.id, (err, results) => {
            if (err) return res.status(500).send('Database error');
            if (!results.length) return res.status(404).send('Product not found');
            res.render('product', { product: results[0], user: req.session.user });
        });
    },

    getProductByIdEditView: (req, res) => {
        ProductsModel.getProductById(req.params.id, (err, results) => {
            if (err) return res.status(500).send('Database error');
            if (!results.length) return res.status(404).send('Product not found');
            res.render('editProduct', { product: results[0], user: req.session.user });
        });
    },

    addProductView: (req, res) => {
        const product = req.body;
        if (req.file) product.image = req.file.filename;

        ProductsModel.addProduct(product, (err) => {
            if (err) return res.status(500).send('Database error');
            res.redirect('/inventory');
        });
    },

    updateProductView: (req, res) => {
        const id = req.params.id;
        const product = req.body;
        if (req.file) product.image = req.file.filename;

        ProductsModel.updateProduct(id, product, (err) => {
            if (err) return res.status(500).send('Database error');
            res.redirect('/inventory');
        });
    },

    deleteProductView: (req, res) => {
        ProductsModel.deleteProduct(req.params.id, (err) => {
            if (err) {
                req.flash('error', 'Database error');
                return res.redirect('/inventory');
            }
            res.redirect('/inventory');
        });
    },

    addToCart: (req, res) => {
        const productId = req.params.id;
        const quantity = parseInt(req.body.quantity) || 1;

        ProductsModel.getProductById(productId, (err, results) => {
            if (err || !results.length) {
                req.flash('error', 'Product not found');
                return res.redirect('/shopping');
            }

            const product = results[0];
            if (!req.session.cart) req.session.cart = [];

            const existing = req.session.cart.find(item => item.id === product.id);

            if (existing) {
                existing.quantity = quantity;
            } else {
                req.session.cart.push({ ...product, quantity });
            }

            res.redirect('/cart');
        });
    }
};

module.exports = ProductsController;

