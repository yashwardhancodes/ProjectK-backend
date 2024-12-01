const mongoose = require("mongoose");
const Bill = require("./bill"); // Reference to Bill model

const serviceSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true, // Service name, e.g., "Bike Repair"
    },
    dateOfService: {
        type: Date,
        default: Date.now, // Defaults to current date if not provided
    },
    bill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bill", // Reference to Bill model
    },
});

module.exports = mongoose.model("Service", serviceSchema);
