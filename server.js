const express = require("express");
const cors = require("cors");
require('dotenv').config();


const booking = require("./db/booking");
const Admin = require("./db/admin");
const Bike = require("./db/bike");
const Service = require("./db/service");
const Bill = require("./db/bill");
const BillEntry = require("./db/billEntry");

require("./db/config");

const app = express();

app.use(express.json());
const allowedOrigins = [
    'http://localhost:5173/', 
    'https://zealous-grass-0d6c91f1e.4.azurestaticapps.net/',
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

const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info', // Set the default log level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // Log to console
    new winston.transports.File({ filename: 'error.log', level: 'error' }), // Log errors to file
  ],
});

// Log server start
logger.info('Server started');

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error occurred at ${req.originalUrl}: ${err.message}`, { stack: err.stack });
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Book Service
app.post("/bookService", async (req, res) => {
    const newBooking = new booking(req.body);
    const result = await newBooking.save();
    res.send(result);
});

// Admin Signup
app.post("/adminSignup", async (req, res) => {
    const newAdmin = new Admin(req.body);
    const result = await newAdmin.save();
    res.send(result);
});

// Admin Login
app.post("/adminLogin", async (req, res) => {
    if (req.body.name && req.body.password) {
        const userAdmin = await Admin.findOne(req.body).select("-password");
        if (userAdmin) {
            res.send(userAdmin);
        } else {
            res.send({ "result": "no user found" });
        }
    } else {
        res.send({ "result": "no user found" });
    }
});

// Add Bike
app.post("/addBike", async (req, res) => {
    const newBike = new Bike(req.body);
    const result = await newBike.save();
    res.send(result);
});

// Get All Bikes (Admin Panel)
app.get("/adminPanel", async (req, res) => {
    const bikes = await Bike.find();
    if (bikes.length > 0) {
        res.send(bikes);
    } else {
        res.send({ result: "no bike found" });
    }
});

// Delete Bike
app.delete("/adminPanel/:id", async (req, res) => {
    const result = await Bike.deleteOne({ _id: req.params.id });
    res.send(result);
});

// Get Single Bike for Update
app.get("/adminPanel/:id", async (req, res) => {

       
    const result = await Bike.findOne({ _id: req.params.id });
    if (result) {
        res.send(result);
    } else {
        res.send({ "result": "no bike found" });
    }
});

//update bike 

app.put("/adminPanel/:id",async(req,res)=>{
    let result = await Bike.updateOne(
        {_id:req.params.id},
        {$set:req.body}
    );
    res.send(result)
})

// Get Bike Details with Populated Services and Bills
app.get("/adminPanel/bikes/:id", async (req, res) => {
    try {
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
            res.send(bikeDetails);
        } else {
            res.send({ result: "No bike found with the provided ID" });
        }
    } catch (error) {
        res.status(500).send({ error: "An error occurred while fetching the bike details." });
    }
});

// Add Service to a Bike
app.post("/adminPanel/bikes/:id/addService", async (req, res) => {
    const bikeId = req.params.id;
    const { serviceName, dateOfService, bill } = req.body;

    try {
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
            return res.status(404).send({ message: "Bike not found" });
        }

        res.status(201).send(savedService);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error adding service to bike" });
    }
});


//delete a service 

app.delete("/adminPanel/:bikeId/:serviceId/deleteService", async (req, res) => {
    const { bikeId, serviceId } = req.params;

    try {
        // Find the service to retrieve the associated bill ID (if needed)
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).send({ message: "Service not found" });
        }

        // Delete the service
        await Service.findByIdAndDelete(serviceId);

        // Optionally delete the associated bill
        if (service.bill) {
            await Bill.findByIdAndDelete(service.bill);
        }

        // Update the bike by removing the service reference
        const updatedBike = await Bike.findByIdAndUpdate(
            bikeId,
            { $pull: { services: serviceId } },
            { new: true, useFindAndModify: false }
        ).populate("services");

        if (!updatedBike) {
            return res.status(404).send({ message: "Bike not found" });
        }

        res.status(200).send({ message: "Service deleted successfully", bike: updatedBike });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error deleting service from bike" });
    }
});


// Fetch Bill for a Specific Bike Service with Owner's Name
app.get("/adminPanel/bikes/:bikeId/:serviceId/bill", async (req, res) => {
    const { bikeId, serviceId } = req.params;

    try {
        // Fetch the bike along with the specified service and bill details
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
            return res.status(404).json({ message: "Bike not found" });
        }

        const service = bike.services[0];

        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }

        // Include owner's name in the response
        const response = {
            ...service.bill.toObject(),
            owner: bike.owner ,
            bikeNo:bike.bikeNo// Add owner's name to bill details
        };

        res.json(response);
    } catch (error) {
        console.error("Error fetching bill:", error);
        res.status(500).json({ message: "An error occurred while fetching the bill." });
    }
});



app.post("/adminPanel/bikes/:bikeId/:serviceId/bill/entry", async (req, res) => {
    const { bikeId, serviceId } = req.params;
    const { description, amount, quantity } = req.body;

    try {
        // Find the bike and populate the required service and bill
        const bike = await Bike.findById(bikeId).populate({
            path: 'services',
            match: { _id: serviceId },
            populate: { path: 'bill' }
        });

        if (!bike) {
            return res.status(404).json({ message: "Bike not found" });
        }

        const service = bike.services[0];
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }

        const bill = service.bill;
        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        // Create a new bill entry
        const newEntry = new BillEntry({
            description,
            amount,
            quantity,
        });

        // Save the new entry
        const savedEntry = await newEntry.save();

        // Add the entry to the bill's entries array
        bill.entries.push(savedEntry._id);
        await bill.save();

        // Return the updated bill entry
        res.status(201).json(savedEntry);
    } catch (error) {
        console.error("Error adding bill entry:", error);
        res.status(500).json({ message: "An error occurred while adding the bill entry." });
    }
});

const port = process.env.PORT ;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

