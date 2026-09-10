const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true }
});

const productSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  oldPrice: { type: Number, required: true },
  rating: { type: Number, required: true },
  sold: { type: Number, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true },
  reviews: [reviewSchema]
});

module.exports = mongoose.model('Product', productSchema);