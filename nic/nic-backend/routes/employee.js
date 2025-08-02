

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Activity = require('../models/Activity');
const IP = require('../models/IP');
const IPApplication = require('../models/IPApplication');
const Complaint = require('../models/Complaint');
const multer = require('multer');
const path = require('path');

// Configure Multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Apply auth middleware for employee role
router.use(auth('employee'));

// GET /api/employee/user
router.get('/user', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      designation: user.designation,
      location: user.location,
      department: user.department,
      // registrationNumber: user.registrationNumber,
    });
  } catch (err) {
    console.error('User fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/employee/recent-activity
router.get('/recent-activity', async (req, res) => {
  try {
    const activities = await Activity.find({ employee: req.user.id })
      .populate('employee', 'name email location department')
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(activities);
  } catch (err) {
    console.error('Recent activity fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/employee/colleagues/:location/:department
router.get('/colleagues/:location/:department', async (req, res) => {
  try {
    const { location, department } = req.params;
    if (!location?.trim() || !department?.trim()) {
      return res.status(400).json({ message: 'Location and department are required' });
    }
    const colleagues = await User.find({
      location: location.trim(),
      department: department.trim(),
      role: 'employee',
      _id: { $ne: req.user.id },
    }).select('name email designation registrationNumber');
    res.json(
      colleagues.map((colleague) => ({
        registrationNumber: colleague.registrationNumber,
        name: colleague.name,
        email: colleague.email,
        designation: colleague.designation,
      }))
    );
  } catch (err) {
    console.error('Colleagues fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/employee/ip-application
router.post('/ip-application', upload.single('ipForm'), async (req, res) => {
  try {
    const { name, address, department, contact, email, location, macAddress, antivirus, antivirusName, operatingSystem } = req.body;
    const userId = req.user.id;
    const ipForm = req.file;

    if (!ipForm) {
      return res.status(400).json({ message: 'IP application form (PDF) is required' });
    }
    if (!name?.trim() || !address?.trim() || !department?.trim() || !contact?.trim() || !email?.trim() || !location?.trim()) {
      return res.status(400).json({ message: 'Name, address, department, contact, email, and location are required' });
    }
    if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!contact.match(/^\d{10}$/)) {
      return res.status(400).json({ message: 'Contact must be 10 digits' });
    }
    // if (macAddress?.trim() && !macAddress.match(/^([0-9A-Fa-f]{2}([:-])){5}([0-9A-Fa-f]{2})$/)) {
    //   return res.status(400).json({ message: 'Invalid MAC address format' });
    // }
    if (antivirus && !['Y', 'N'].includes(antivirus)) {
      return res.status(400).json({ message: 'Antivirus must be Y or N' });
    }
     
    const currentUser = await User.findById(userId).select('location department role');
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }
    if (currentUser.role !== 'employee') {
      return res.status(403).json({ message: 'Only employees can apply for IPs' });
    }
    if (location.trim() !== currentUser.location || department.trim() !== currentUser.department) {
      return res.status(403).json({ message: 'Can only apply for IP in your own location and department' });
    }

    if (macAddress?.trim()) {
      const existingIP = await IP.findOne({ macAddress: macAddress.trim() });
      const existingApp = await IPApplication.findOne({ macAddress: macAddress.trim(), status: { $ne: 'allocated' } });
      if (existingIP || existingApp) {
        return res.status(400).json({ message: 'MAC address already in use' });
      }
    }

    const application = new IPApplication({
      userId,
      name: name.trim(),
      address: address.trim(),
      department: department.trim(),
      contact: contact.trim(),
      email: email.trim(),
      location: location.trim(),
      ipForm: ipForm.filename,
      macAddress: macAddress?.trim() || '',
      antivirus: antivirus || 'N',
      antivirusName: antivirusName?.trim() || '',
      operatingSystem: operatingSystem?.trim() || 'Windows',
      status: 'pending',
    });

    await application.save();

    const activity = new Activity({
      employee: userId,
      type: 'IP Application',
      description: 'Submitted new IP application',
      location: location.trim(),
      department: department.trim(),
    });
    await activity.save();

    res.status(201).json({ message: 'IP application submitted successfully' });
  } catch (err) {
    console.error('IP application error:', err.message);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `File upload error: ${err.message}` });
    }
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
});

// GET /api/employee/ip-applications/history
router.get('/ip-applications/history', async (req, res) => {
  try {
    const applications = await IPApplication.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    console.error('IP applications history fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/employee/ip-application
router.get('/ip-application', async (req, res) => {
  try {
    const application = await IPApplication.findOne({
      userId: req.user.id,
      status: 'allocated',
    });
    if (!application) {
      return res.status(404).json({ message: 'No allocated IP application found' });
    }
    res.json({
      ipAddress: application.ipAddress,
      macAddress: application.macAddress,
      updatedAt: application.updatedAt,
    });
  } catch (err) {
    console.error('IP application fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/employee/complaints
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find({ employee: req.user.id }).sort({ createdAt: -1 });
    res.json(
      complaints.map((complaint) => ({
        id: complaint._id.toString(),
        description: complaint.description,
        date: complaint.createdAt.toISOString().split('T')[0],
        status: complaint.status,
        remarks: complaint.remarks || '',
      }))
    );
  } catch (err) {
    console.error('Complaints fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/employee/complaint
router.post('/complaint', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description?.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }

    const user = await User.findById(req.user.id).select('name department location');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const complaint = new Complaint({
      employee: req.user.id,
      description: description.trim(),
      department: user.department,
      location: user.location,
      status: 'Open',
      remarks: '',
    });

    await complaint.save();

    const activity = new Activity({
      employee: req.user.id,
      type: 'Complaint',
      description: `Submitted complaint: ${description.trim().substring(0, 50)}...`,
      location: user.location,
      department: user.department,
    });
    await activity.save();

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint: {
        id: complaint._id.toString(),
        description: complaint.description,
        date: complaint.createdAt.toISOString().split('T')[0],
        status: complaint.status,
        remarks: complaint.remarks,
      },
    });
  } catch (err) {
    console.error('Complaint creation error:', err.message);
    res.status(400).json({ message: `Failed to create complaint: ${err.message}` });
  }
});

// GET /api/employee/users
router.get('/users', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json([{
      name: user.name,
      email: user.email,
      location: user.location,
      department: user.department,
      designation: user.designation,
      registrationNumber: user.registrationNumber,
    }]);
  } catch (err) {
    console.error('Users fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
