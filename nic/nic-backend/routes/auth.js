

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');


// In-memory OTP store (for simplicity; use MongoDB/Redis in production)
const otpStore = new Map();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Validate email
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.trim(), role: 'employee' });
    if (!user) {
      return res.status(404).json({ message: 'No employee found with this email' });
    }

    // Generate OTP and set expiration (5 minutes)
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes in milliseconds
    otpStore.set(email.trim(), { otp, expiresAt });

    // Send OTP email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email.trim(),
      subject: 'NIC Bilaspur Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. It is valid for 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Validate inputs
    if (!email?.trim() || !otp?.trim()) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Check OTP
    const storedOtpData = otpStore.get(email.trim());
    if (!storedOtpData) {
      return res.status(400).json({ message: 'No OTP found for this email' });
    }
    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(email.trim());
      return res.status(400).json({ message: 'OTP has expired' });
    }
    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP is valid; keep it for password reset
    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('OTP verification error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    // Validate inputs
    if (!email?.trim() || !otp?.trim() || !newPassword?.trim()) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Verify OTP
    const storedOtpData = otpStore.get(email.trim());
    if (!storedOtpData) {
      return res.status(400).json({ message: 'No OTP found for this email' });
    }
    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(email.trim());
      return res.status(400).json({ message: 'OTP has expired' });
    }
    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Find user
    const user = await User.findOne({ email: email.trim(), role: 'employee' });
    if (!user) {
      return res.status(404).json({ message: 'No employee found with this email' });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword.trim(), 10);
    await user.save();

    // Clear OTP
    otpStore.delete(email.trim());

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/employee/register
router.post('/employee/register', async (req, res) => {
  const { name, email, phone, designation, password, location, department } = req.body;

  try {
    // Validate required fields
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !designation?.trim() || !password?.trim() || !location?.trim() || !department?.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!phone.match(/^\d{10}$/)) {
      return res.status(400).json({ message: 'Phone number must be 10 digits' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check for existing user
    let user = await User.findOne({ email: email.trim() });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // Auto-generate registrationNumber
    const lastUser = await User.findOne().sort({ registrationNumber: -1 });
    const registrationNumber = lastUser ? lastUser.registrationNumber + 1000 : 1000;

    user = new User({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      designation: designation.trim(),
      password: await bcrypt.hash(password.trim(), 10),
      location: location.trim(),
      department: department.trim(),
      registrationNumber,
      role: 'employee', // Changed from 'registered' to 'employee'
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        department: user.department,
      },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: `Validation error: ${messages}` });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/employee/login
router.post('/employee/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate required fields
    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.trim(), role: 'employee' });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        department: user.department,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate required fields
    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.trim(), role: 'admin' });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/verify
router.get('/verify', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role location department');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        department: user.department,
      },
    });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;








