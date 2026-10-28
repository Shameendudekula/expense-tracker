const mongoose = require('mongoose');
const { CATEGORIES, TYPES } = require('../config/constants');

const transactionSchema = new mongoose.Schema(
  {
    // Owner of the record. Every query filters on this, so users only ever see their own data.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: { values: TYPES, message: 'Type must be income or expense' },
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
      max: [1_000_000_000, 'Amount is too large'],
      // Store money rounded to 2 decimals (e.g. 10.005 -> 10.01)
      set: (v) => {
        if (v === '' || v === null || v === undefined) return v;
        const n = Number(v);
        // EPSILON avoids float errors such as 1.005 * 100 = 100.4999… rounding down to 1.00
        return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : v;
      },
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      // The category must belong to the transaction's type (e.g. "Salary" is only valid for income)
      validate: {
        // "this" is the document being saved (updates also go through save() in the controller)
        validator: function (value) {
          return (CATEGORIES[this.type] || []).includes(value);
        },
        message: (props) => `"${props.value}" is not a valid category for this type`,
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [120, 'Description must be at most 120 characters'],
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      validate: {
        // Allow up to one day ahead to cover time-zone differences
        validator: (d) => d <= new Date(Date.now() + 24 * 60 * 60 * 1000),
        message: 'Date cannot be in the future',
      },
    },
  },
  { timestamps: true }
);

// Speeds up the most common query: "this user's transactions, newest first, in a date range"
transactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
