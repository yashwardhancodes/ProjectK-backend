const express = require("express");
const cors = require("cors");
require('dotenv').config();
const winston = require('winston');
const rateLimit = require("express-rate-limit");
const Joi = require("joi");

require("./db/config");

const booking = require("./db/booking");
const Admin = require("./db/admin");
const Bike = require("./db/bike");
const Service = require("./db/service");
const Bill = require("./db/bill");
const BillEntry = require("./db/billEntry");

const app = express();

// Middleware to handle async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Environment variable validation
if (!process.env.PORT) {
  throw new Error("PORT is not defined in environment variables.");
}

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173', 
  'https://zealous-grass-0d6c91f1e.4.azurestaticapps.net',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      callback(null, true); 
    } else {
      callback(new Error('Not allowed by CORS')); 
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

logger.info('Server started');

// Rate limiting middleware for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many login attempts, please try again later.",
});

// Input validation schema using Joi
const bikeSchema = Joi.object({
  owner: Joi.string().required(),
  bikeNo: Joi.string().required(),
  contactNo: Joi.string().pattern(/^[0-9]{10}$/).required(),
  dateOfReg: Joi.date().required(),
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const errorMessage = process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error';
  
  logger.error(`Error occurred at ${req.originalUrl}: ${err.message}`, { stack: err.stack });
  res.status(status).json({ success: false, message: errorMessage });
});

// API Endpoints
app.post("/bookService", asyncHandler(async (req, res) => {
  const newBooking = new booking(req.body);
  const result = await newBooking.save();
  res.status(200).json({ success: true, data: result });
}));

app.post("/adminSignup", asyncHandler(async (req, res) => {
  const newAdmin = new Admin(req.body);
  const result = await newAdmin.save();
  res.status(200).json({ success: true, data: result });
}));

app.post("/adminLogin", loginLimiter, asyncHandler(async (req, res) => {
  if (req.body.name && req.body.password) {
    const userAdmin = await Admin.findOne(req.body).select("-password");
    if (userAdmin) {
      res.status(200).json({ success: true, data: userAdmin });
    } else {
      res.status(404).json({ success: false, message: "No user found" });
    }
  } else {
    res.status(400).json({ success: false, message: "Missing required fields" });
  }
}));

app.post("/addBike", asyncHandler(async (req, res) => {
  const { error } = bikeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  const newBike = new Bike(req.body);
  const result = await newBike.save();
  res.status(200).json({ success: true, data: result });
}));

app.get("/adminPanel", asyncHandler(async (req, res) => {
  const bikes = await Bike.find();
  if (bikes.length > 0) {
    res.status(200).json({ success: true, data: bikes });
  } else {
    res.status(404).json({ success: false, message: "No bikes found" });
  }
}));

app.delete("/adminPanel/:id", asyncHandler(async (req, res) => {
  const result = await Bike.deleteOne({ _id: req.params.id });
  res.status(200).json({ success: true, message: "Bike deleted successfully", data: result });
}));

app.get("/adminPanel/:id", asyncHandler(async (req, res) => {
  const result = await Bike.findOne({ _id: req.params.id });
  if (result) {
    res.status(200).json({ success: true, data: result });
  } else {
    res.status(404).json({ success: false, message: "No bike found" });
  }
}));

app.put("/adminPanel/:id", asyncHandler(async (req, res) => {
  const result = await Bike.updateOne(
    { _id: req.params.id },
    { $set: req.body }
  );
  res.status(200).json({ success: true, data: result });
}));

app.get("/adminPanel/bikes/:id", asyncHandler(async (req, res) => {
  const bikeDetails = await Bike.findById(req.params.id).populate({
    path: 'services',
    populate: {
      path: 'bill',
      populate: {
        path: 'entries'
      }
    }
  });
  if (bikeDetails) {
    res.status(200).json({ success: true, data: bikeDetails });
  } else {
    res.status(404).json({ success: false, message: "No bike found with the provided ID" });
  }
}));

app.post("/adminPanel/bikes/:id/addService", asyncHandler(async (req, res) => {
  const bikeId = req.params.id;
  const { serviceName, dateOfService, bill } = req.body;

  const newBill = new Bill(bill);
  const savedBill = await newBill.save();

  const newService = new Service({
    serviceName,
    dateOfService,
    bill: savedBill._id,
  });

  const savedService = await newService.save();

  const bike = await Bike.findByIdAndUpdate(
    bikeId,
    { $push: { services: savedService._id } },
    { new: true, useFindAndModify: false }
  ).populate("services");

  if (!bike) {
    return res.status(404).json({ success: false, message: "Bike not found" });
  }

  res.status(201).json({ success: true, data: savedService });
}));

app.delete("/adminPanel/:bikeId/:serviceId/deleteService", asyncHandler(async (req, res) => {
  const { bikeId, serviceId } = req.params;

  const service = await Service.findById(serviceId);
  if (!service) {
    return res.status(404).json({ success: false, message: "Service not found" });
  }

  await Service.findByIdAndDelete(serviceId);

  if (service.bill) {
    await Bill.findByIdAndDelete(service.bill);
  }

  const updatedBike = await Bike.findByIdAndUpdate(
    bikeId,
    { $pull: { services: serviceId } },
    { new: true, useFindAndModify: false }
  ).populate("services");

  if (!updatedBike) {
    return res.status(404).json({ success: false, message: "Bike not found" });
  }

  res.status(200).json({ success: true, message: "Service deleted successfully", data: updatedBike });
}));

app.get("/adminPanel/bikes/:bikeId/:serviceId/bill", asyncHandler(async (req, res) => {
  const { bikeId, serviceId } = req.params;

  const bike = await Bike.findById(bikeId).populate({
    path: 'services',
    match: { _id: serviceId },
    populate: {
      path: 'bill',
      populate: {
        path: 'entries'
      }
    }
  });

  if (!bike) {
    return res.status(404).json({ success: false, message: "Bike not found" });
  }

  const service = bike.services[0];

  if (!service) {
    return res.status(404).json({ success: false, message: "Service not found" });
  }

  const response = {
    ...service.bill.toObject(),
    owner: bike.owner,
    bikeNo: bike.bikeNo,
  };

  res.status(200).json({ success: true, data: response });
}));

app.post("/adminPanel/bikes/:bikeId/:serviceId/bill/entry", asyncHandler(async (req, res) => {
  const { bikeId, serviceId } = req.params;
  const { description, amount, quantity } = req.body;

  const bike = await Bike.findById(bikeId).populate({
    path: 'services',
    match: { _id: serviceId },
    populate: { path: 'bill' }
  });

  if (!bike) {
    return res.status(404).json({ success: false, message: "Bike not found" });
  }

  const service = bike.services[0];

  if (!service || !service.bill) {
    return res.status(404).json({ success: false, message: "Service or Bill not found" });
  }

  const newEntry = new BillEntry({
    description,
    amount,
    quantity,
    bill: service.bill._id,
  });

  const savedEntry = await newEntry.save();

  service.bill.entries.push(savedEntry._id);
  await service.bill.save();

  res.status(201).json({ success: true, data: savedEntry });
}));

// Start the server
const PORT = process.env.PORT ;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
