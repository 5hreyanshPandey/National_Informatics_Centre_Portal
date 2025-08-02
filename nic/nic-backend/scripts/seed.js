const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const IPRange = require('../models/IPRange');
const Complaint = require('../models/Complaint');
const IP = require('../models/IP');
require('dotenv').config();

// Connect to database
connectDB();

const locations = [
  "New Composite Building",
  "Collector Office",
  "District Panchayat",
  "District Excise",
  "Family Court",
  "Divisional Commissioner Office",
  "Passport Branch",
  "District Superintendent of Police",
  "Assistant Commissioner State Tax",
  "GST Office",
  "NIC Office",
  "Consumer Forum",
  "District Court"
];

const locationDepartments = {
  "New Composite Building": [
    "Additional Collector Office",
    "Deputy District Election Officer",
    "General Election",
    "Joint Director Treasury Accounts and Pension",
    "Assistant Labour Commissioner",
    "District Trade and Industry Centre",
    "Deputy Director Local Fund Audit",
    "District Planning and Statistics",
    "Assistant Registrar Firms and Societies",
    "Joint Director Village and Town Investment",
    "Civil Supplies Corporation",
    "Mukhya Mantri Gram Sadak Yojna",
    "Food and Drug Administration",
    "District Auditor Panchayat"
  ],
  "Collector Office": [
    "District Mineral Department",
    "District Food Department",
    "Collector Steno Branch",
    "Collector Finance Branch",
    "Collector Superintendent Branch",
    "Collector Room",
    "Collector Court Room",
    "District Nazir Room",
    "District Treasury Branch",
    "Protocol Branch",
    "Public Grievance Branch",
    "Deputy Collector Room",
    "City Magistrate Court Room",
    "Land Records",
    "Assistant Superintendent Land Records",
    "Additional Collector Room 1",
    "Additional Collector Room 2",
    "Additional Collector Steno Room",
    "Additional Collector Court Room",
    "Relief Branch",
    "Small Savings Branch"
  ],
  "District Panchayat": [
    "MGNREGA Branch",
    "Bihan Branch",
    "Pradhan Mantri Awas Yojana",
    "District Panchayat CEO",
    "CEO Steno Room",
    "Meeting Hall",
    "Swachh Bharat Mission",
    "Establishment Branch",
    "National Rural Livelihood Mission"
  ],
  "District Excise": ["Office", "District Excise Officer"],
  "Family Court": ["Office"],
  "Divisional Commissioner Office": [
    "Divisional Commissioner Office",
    "Additional Division Commissioner Office",
    "Steno Room",
    "Establishment Branch",
    "Divisional Commissioner Court Room"
  ],
  "Passport Branch": ["Office"],
  "District Superintendent of Police": [
    "Superintendent of Police Room",
    "Steno Room",
    "Establishment Branch",
    "Additional Superintendent of Police",
    "CCTNS Room"
  ],
  "Assistant Commissioner State Tax": [
    "Establishment Branch",
    "Assistant Commissioner Room"
  ],
  "GST Office": ["Office Circle 1", "Office Circle 2", "Office Circle 3"],
  "NIC Office": ["NIC Office"],
  "Consumer Forum": ["Consumer Forum"],
  "District Court": ["District Court"]
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await IPRange.deleteMany();
    await Complaint.deleteMany();
    await IP.deleteMany();

    // Create Admin
    const admin = new User({
      name: 'Admin User',
      email: 'admin@nic.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      location: 'NIC Office',
      department: 'NIC Office',
      registrationNumber: 1000,
    });
    await admin.save();

    // Create Employees
    let registrationNumber = 1001;
    const employees = [];
    for (const location of locations) {
      for (const department of locationDepartments[location]) {
        employees.push({
          name: `Employee ${location} ${department}`,
          email: `employee${registrationNumber}@example.com`,
          password: await bcrypt.hash('password123', 10),
          phone: `987654${String(registrationNumber).padStart(4, '0')}`,
          designation: 'Staff',
          location,
          department,
          registrationNumber: registrationNumber++,
          role: 'employee',
        });
      }
    }
    const savedEmployees = await User.insertMany(employees);

    // Create IP Ranges
    const ipRanges = [
      { range: '192.168.1.0 - 192.168.1.255', status: 'Active', allocated: 200, available: 56 },
      { range: '192.168.2.0 - 192.168.2.255', status: 'Inactive', allocated: 150, available: 106 },
      { range: '192.168.3.0 - 192.168.3.255', status: 'Active', allocated: 180, available: 76 },
    ];
    await IPRange.insertMany(ipRanges);

    // Create Complaints
    const complaints = [
      { employee: savedEmployees[0]._id, description: 'Network issue in office' },
      { employee: savedEmployees[1]._id, description: 'Printer not working' },
      { employee: savedEmployees[2]._id, description: 'Slow internet speed' },
    ];
    await Complaint.insertMany(complaints);

    // Create IPs
    const ips = [
      {
        ipAddress: '192.168.1.1',
        status: 'Allocated',
        employee: savedEmployees[0]._id,
        macAddress: '00:1B:44:11:3A:B7',
        userName: savedEmployees[0].name,
        userEmail: savedEmployees[0].email,
        mobile: savedEmployees[0].phone,
        location: savedEmployees[0].location,
        department: savedEmployees[0].department,
      },
      {
        ipAddress: '192.168.1.2',
        status: 'Available',
        macAddress: '00:1B:44:11:3A:B8',
        userName: 'Unallocated',
        userEmail: 'unallocated@example.com',
        mobile: '0000000000',
        location: 'NIC Office',
        department: 'NIC Office',
      },
      {
        ipAddress: '192.168.1.3',
        status: 'Allocated',
        employee: savedEmployees[1]._id,
        macAddress: '00:1B:44:11:3A:B9',
        userName: savedEmployees[1].name,
        userEmail: savedEmployees[1].email,
        mobile: savedEmployees[1].phone,
        location: savedEmployees[1].location,
        department: savedEmployees[1].department,
      },
      {
        ipAddress: '192.168.1.4',
        status: 'Available',
        macAddress: '00:1B:44:11:3A:BA',
        userName: 'Unallocated',
        userEmail: 'unallocated@example.com',
        mobile: '0000000000',
        location: 'NIC Office',
        department: 'NIC Office',
      },
    ];
    await IP.insertMany(ips);

    console.log('Database seeded successfully');
    process.exit();
  } catch (err) {
    console.error('Error seeding database:', err.message);
    process.exit(1);
  }
};

seedData();