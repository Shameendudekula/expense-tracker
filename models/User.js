const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { CURRENCIES } = require('../config/constants');

// bcrypt "cost": the hash is run 2^12 times, which makes guessing passwords slow for an attacker
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [72, 'Password must be at most 72 characters'], // bcrypt only uses the first 72 bytes
      select: false, // never returned by queries unless explicitly requested with .select('+password')
    },
    currency: {
      type: String,
      enum: { values: CURRENCIES, message: 'Currency must be one of: ' + CURRENCIES.join(', ') },
      default: 'INR',
    },
  },
  { timestamps: true }
);

// Hash the password whenever it is set or changed. The plain password is never stored.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Remove the password hash from every JSON response, even if it was loaded
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
