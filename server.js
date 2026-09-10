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
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password.' });
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();
    res.json({ message: 'Signed in successfully', name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signin' });
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
