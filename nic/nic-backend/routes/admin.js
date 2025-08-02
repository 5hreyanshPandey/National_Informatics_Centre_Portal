
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const IPRange = require('../models/IPRange');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const IP = require('../models/IP');
const IPApplication = require('../models/IPApplication');
const Activity = require('../models/Activity');
const ping = require('ping');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

router.use(auth('admin'));

router.get('/user', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ name: user.name });
  } catch (err) {
    console.error('User fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/ip-applications', async (req, res) => {
  try {
    const applications = await IPApplication.find({ status: 'pending' });
    console.log('Fetched pending IP applications:', applications.length, applications.map(a => a._id));
    res.json(applications);
  } catch (err) {
    console.error('IP applications fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/ip-applications/:id/allocate', async (req, res) => {
  try {
    const { ipAddress } = req.body;
    const application = await IPApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (!ipAddress?.trim()) {
      return res.status(400).json({ message: 'IP address is required' });
    }

    if (!ipAddress.match(/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }

    // Check for duplicate IP address
    const existingIP = await IP.findOne({ ipAddress });
    const existingApp = await IPApplication.findOne({ ipAddress });
    if (existingIP || existingApp) {
      return res.status(400).json({ message: 'IP address already allocated' });
    }

    // Update IPApplication
    application.ipAddress = ipAddress;
    application.status = 'allocated';
    application.updatedAt = Date.now();
    await application.save();

    // Create or update IP record
    let ip = await IP.findOne({ ipAddress });
    if (!ip) {
      ip = new IP({
        ipAddress,
        macAddress: application.macAddress || '',
        userName: application.name,
        userEmail: application.email,
        mobile: application.contact,
        designation: '',
        antivirus: application.antivirus || 'N',
        antivirusName: application.antivirusName || '',
        location: application.location,
        department: application.department,
        operatingSystem: application.operatingSystem || 'Windows',
        status: 'Allocated',
        employee: application.userId,
      });
    } else {
      ip.macAddress = application.macAddress || '';
      ip.userName = application.name;
      ip.userEmail = application.email;
      ip.mobile = application.contact;
      ip.antivirus = application.antivirus || 'N';
      ip.antivirusName = application.antivirusName || '';
      ip.location = application.location;
      ip.department = application.department;
      ip.operatingSystem = application.operatingSystem || 'Windows';
      ip.status = 'Allocated';
      ip.employee = application.userId;
    }
    await ip.save();

    // Log activity
    const activity = new Activity({
      employee: application.userId,
      type: 'IP Allocation',
      description: `Allocated IP ${ipAddress} to ${application.name}`,
      location: application.location,
      department: application.department,
    });
    await activity.save();

    res.status(200).json({ message: 'IP allocated successfully' });
  } catch (err) {
    console.error('IP allocation error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: `Validation error: ${messages}` });
    }
    res.status(500).json({ message: `Server error: ${err.message}` });
  }
});

router.get('/database/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error('Users fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/database/users', async (req, res) => {
  const { name, email, role, location, department, designation, phone, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password?.trim() || !location?.trim() || !department?.trim()) {
    return res.status(400).json({ message: 'Name, email, password, location, and department are required' });
  }
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (role && !['employee', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    let user = await User.findOne({ email: email.trim() });
    if (user) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const lastUser = await User.findOne().sort({ registrationNumber: -1 });
    const registrationNumber = lastUser ? lastUser.registrationNumber + 1 : 1000;

    user = new User({
      name: name.trim(),
      email: email.trim(),
      role: role || 'employee',
      location: location.trim(),
      department: department.trim(),
      designation: designation?.trim(),
      phone: phone?.trim(),
      password: await bcrypt.hash(password.trim(), 10),
      registrationNumber,
    });

    await user.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('User create error:', err.message);
    res.status(500).json({ message: `Failed to create user: ${err.message}` });
  }
});

router.put('/database/users/:id', async (req, res) => {
  const { name, email, role, location, department, designation, phone, password } = req.body;

  if (!name?.trim() || !email?.trim() || !location?.trim() || !department?.trim()) {
    return res.status(400).json({ message: 'Name, email, location, and department are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (role && !['employee', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (phone.length< 10) {
    return res.status(400).json({ message: 'Phone Number must be of 10 Digits' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (email && email.trim() !== user.email) {
      const existingUser = await User.findOne({ email: email.trim() });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }

    user.name = name.trim();
    user.email = email.trim();
    user.role = role || user.role;
    user.location = location.trim();
    user.department = department.trim();
    user.designation = designation?.trim() || user.designation;
    user.phone = phone?.trim() || user.phone;
    if (password?.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
    }

    await user.save();
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('User update error:', err.message);
    res.status(500).json({ message: `Failed to update user: ${err.message}` });
  }
});

router.delete('/database/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('User delete error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/activities', async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('employee', 'name email location department')
      .sort({ createdAt: -1 });
    res.json(activities);
  } catch (err) {
    console.error('Activities fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/ip-ranges', async (req, res) => {
  try {
    const ipRanges = await IPRange.find();
    res.json(
      ipRanges.map((range, index) => ({
        id: index + 1,
        range: range.range,
        status: range.status,
        allocated: range.allocated,
        available: range.available,
      }))
    );
  } catch (err) {
    console.error('IP ranges fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('employee', 'name location department')
      .sort({ createdAt: -1 });
    res.json(
      complaints.map((complaint) => ({
        id: complaint._id.toString(),
        employeeName: complaint.employee ? complaint.employee.name : 'Unknown',
        location: complaint.location || 'Unknown',
        department: complaint.department || 'Unknown',
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

router.put('/complaints/:id/close', async (req, res) => {
  const { remarks } = req.body;

  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    if (complaint.status === 'Closed') {
      return res.status(400).json({ message: 'Complaint is already closed' });
    }
    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ message: 'Remarks are required to close the complaint' });
    }

    complaint.status = 'Closed';
    complaint.remarks = remarks.trim();
    await complaint.save();

    const activity = new Activity({
      employee: complaint.employee,
      type: 'Complaint Closed',
      description: `Complaint ${complaint._id} closed by admin: ${remarks.trim()}`,
      location: complaint.location,
      department: complaint.department,
    });
    await activity.save();

    res.json({ message: 'Complaint closed successfully' });
  } catch (err) {
    console.error('Complaint close error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('name email location department');
    const departments = {};

    employees.forEach((employee) => {
      const key = `${employee.location}_${employee.department}`;
      if (!departments[key]) {
        departments[key] = [];
      }
      departments[key].push({
        registrationNumber: employee.registrationNumber,
        name: employee.name,
        email: employee.email,
        designation: employee.designation,
      });
    });

    res.json(departments);
  } catch (err) {
    console.error('Departments fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/employees', async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('name email location department designation registrationNumber');
    res.json(
      employees.map((employee) => ({
        registrationNumber: employee.registrationNumber,
        name: employee.name,
        email: employee.email,
        location: employee.location,
        department: employee.department,
        designation: employee.designation,
      }))
    );
  } catch (err) {
    console.error('Employees fetch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/ip-search', async (req, res) => {
  try {
    const { ip, department, location } = req.query;

    const query = {};

    if (ip) query.ipAddress = ip;
    if (department) query.department = department;
    if (location) query.location = location;

    const ipRecords = await IP.find(query);

    const result = await Promise.all(
      ipRecords.map(async (ip) => {
        let isWorking = false;

        try {
          const pingResult = await ping.promise.probe(ip.ipAddress, { timeout: 2 });
          isWorking = pingResult.alive;

          if (!pingResult.alive && pingResult.output.includes('Access denied')) {
            const { stdout, stderr } = await execPromise(`ping ${ip.ipAddress}`);
            const output = stdout + stderr;
            if (output.includes('Reply from') && output.includes('bytes=')) isWorking = true;
          }
        } catch (err) {
          try {
            const { stdout, stderr } = await execPromise(`ping ${ip.ipAddress}`);
            const output = stdout + stderr;
            if (output.includes('Reply from') && output.includes('bytes=')) isWorking = true;
          } catch {}
        }

        return {
          _id: ip._id,
          ipAddress: ip.ipAddress,
          macAddress: ip.macAddress,
          userName: ip.userName,
          mobile: ip.mobile,
          antivirus: ip.antivirus || 'N',
          antivirusName: ip.antivirusName || 'N/A',
          department: ip.department,
          operatingSystem: ip.operatingSystem || 'Windows',
          isWorking,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('IP search error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/ip-scan', async (req, res) => {
  try {
    const ipRange = '10.132.72.0/24';
    const { stdout, stderr } = await execPromise(`nmap -sP ${ipRange}`);

    if (stderr) {
      console.error('Nmap error:', stderr);
      return res.status(500).json({ message: 'Scan failed' });
    }

    const devices = [];
    const lines = stdout.split('\n');
    let currentDevice = null;

    for (const line of lines) {
      if (line.startsWith('Nmap scan report for')) {
        if (currentDevice) {
          devices.push(currentDevice);
        }
        const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        currentDevice = { ip: ipMatch ? ipMatch[1] : null, mac: null, vendor: 'Unknown' };
      } else if (line.startsWith('MAC Address')) {
        const macMatch = line.match(/([0-9A-F:]{17})/);
        const vendorMatch = line.match(/\((.*?)\)/);
        if (macMatch) {
          currentDevice.mac = macMatch[1];
        }
        if (vendorMatch) {
          currentDevice.vendor = vendorMatch[1];
        }
      }
    }
    if (currentDevice && currentDevice.ip) {
      devices.push(currentDevice);
    }

    res.json(devices.filter(device => device.ip));
  } catch (err) {
    console.error('IP scan error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
