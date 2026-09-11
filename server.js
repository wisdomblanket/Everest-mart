require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('./User');
const Product = require('./Product');
const Review = require('./Review');
const Order = require('./Order');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'everest.html')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.svg')));



mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already in use.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully', name: newUser.name });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Email not registered.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const resp = { error: 'Incorrect password.' };
      if (user.adminResetNotice) resp.notice = user.adminResetNotice;
      return res.status(400).json(resp);
    }
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    user.adminResetNotice = undefined;
    await user.save();
    res.json({ message: 'Signed in successfully', name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signin' });
  }
});

app.post('/api/track-login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Account no longer exists.' });
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();
    res.json({ name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error during tracking' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (user && !user.passwordRequestPending) {
      user.passwordRequestPending = true;
      user.passwordRequestedAt = new Date();
      await user.save();
    }
    res.json({ message: 'Please be patient, you will be notified about your new password.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { productId, userName, rating, comment } = req.body;
    const newReview = new Review({ productId, userName, rating, comment });
    await newReview.save();
    res.status(201).json(newReview);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post review' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = new Order(req.body);
    await orderData.save();
    res.status(201).json({ message: 'Order placed successfully', orderId: orderData._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const productSales = {};
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = item.title || 'Unknown';
          productSales[key] = (productSales[key] || 0) + (item.qty || 1);
        });
      }
    });
    const popularProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10);
    res.json({ totalUsers, totalOrders, totalRevenue, popularProducts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
    const user = await User.findByIdAndUpdate(req.params.id, { name: String(name).trim() }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.password = await bcrypt.hash(password, 10);
    user.passwordRequestPending = false;
    user.adminResetNotice = 'Your password was reset by the administrator on ' + new Date().toLocaleDateString() + '. Please sign in with the new password provided to you.';
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.put('/api/admin/orders/:id', async (req, res) => {
  try {
    const { customerName } = req.body;
    if (!customerName || !String(customerName).trim()) return res.status(400).json({ error: 'Customer name cannot be empty.' });
    const order = await Order.findByIdAndUpdate(req.params.id, { customerName: String(customerName).trim() }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order.' });
  }
});

app.put('/api/account', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name || !String(name).trim()) return res.status(400).json({ error: 'Valid email and name are required.' });
    const user = await User.findOneAndUpdate(
      { email: String(email).toLowerCase() },
      { name: String(name).trim() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    res.json({ name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/account/password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
