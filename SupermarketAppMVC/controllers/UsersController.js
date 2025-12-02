const UsersModel = require('../models/Users');
const db = require('../db');

const UsersController = {
    // Register a new user
    registerUser: (req, res) => {
        const user = req.body;
        UsersModel.addUser(user, (err) => {
            if (err) {
                console.error('Registration error:', err);
                req.flash('error', 'Registration failed');
                req.flash('formData', req.body);
                return res.redirect('/register');
            }
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    },

    // Login user
    loginUser: (req, res) => {
        const { email, password } = req.body;

        UsersModel.getAllUsers((err, users) => {
            if (err) {
                console.error('Login DB error:', err);
                req.flash('error', 'Database error');
                return res.redirect('/login');
            }

            const user = users.find(u => u.email === email && u.password === password);

            if (!user) {
                req.flash('error', 'Invalid credentials');
                return res.redirect('/login');
            }

            req.session.user = user;

            if (user.role === 'admin') {
                return res.redirect('/inventory');
            } else {
                return res.redirect('/shopping');
            }
        });
    },

    // Admin: List all customer accounts
    listCustomers: (req, res) => {
        const sql = `
            SELECT u.id, u.username, u.email, u.role,
                   COUNT(o.id) AS totalOrders,
                   IFNULL(SUM(o.totalAmount), 0) AS totalSpent
            FROM users u
            LEFT JOIN orders o ON u.id = o.userId
            WHERE LOWER(u.role) = 'user'
            GROUP BY u.id
            ORDER BY u.username ASC
        `;
        db.query(sql, (err, customers) => {
            if (err) {
                console.error('Error fetching customers:', err);
                return res.status(500).send('Database error');
            }
            res.render('adminCustomers', { customers, user: req.session.user, messages: req.flash() });
        });
    },

    // Admin: Delete a customer account
    deleteCustomer: (req, res) => {
        const userId = req.params.id;

        db.query(
            'DELETE FROM orderitems WHERE orderId IN (SELECT id FROM orders WHERE userId = ?)',
            [userId],
            (err) => {
                if (err) {
                    console.error('Error deleting user orders:', err);
                    req.flash('error', 'Error deleting user orders');
                    return res.redirect('/admin/customers');
                }

                db.query('DELETE FROM orders WHERE userId = ?', [userId], (err) => {
                    if (err) {
                        console.error('Error deleting user orders:', err);
                        req.flash('error', 'Error deleting user orders');
                        return res.redirect('/admin/customers');
                    }

                    db.query('DELETE FROM users WHERE id = ?', [userId], (err) => {
                        if (err) {
                            console.error('Error deleting user:', err);
                            req.flash('error', 'Error deleting user');
                            return res.redirect('/admin/customers');
                        }

                        req.flash('success', 'Customer account deleted successfully');
                        res.redirect('/admin/customers');
                    });
                });
            }
        );
    },

    // Profile view
    profileView: (req, res) => {
        const userId = req.session.user.id;
        db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
            if (err || results.length === 0) {
                console.error('Error fetching profile:', err);
                req.flash('error', 'Error fetching profile');
                return res.redirect('/shopping');
            }
            res.render('profile', { user: results[0], messages: req.flash() });
        });
    },

    // Update profile
    updateProfile: (req, res) => {
        const userId = req.session.user.id;
        const { username, email, address, contact } = req.body;

        // Validate required fields
        if (!username || !email) {
            req.flash('error', 'Username and email are required');
            return res.redirect('/profile');
        }

        const sql = `
            UPDATE users
            SET username = ?, email = ?, address = ?, contact = ?
            WHERE id = ?
        `;

        db.query(sql, [username, email, address, contact, userId], (err) => {
            if (err) {
                console.error('Update profile DB error:', err);
                req.flash('error', 'Error updating profile');
                return res.redirect('/profile');
            }

            // Update session
            req.session.user.username = username;
            req.session.user.email = email;
            req.session.user.address = address;
            req.session.user.contact = contact;

            req.flash('success', 'Profile updated successfully');
            res.redirect('/profile');
        });
    }
};

module.exports = UsersController;
