const mongoose = require("mongoose");
const BillEntry = require("./billEntry");

const billSchema = new mongoose.Schema({
    billDate: {
        type: Date,
        default: Date.now, // Default to current date if not specified
    },
    entries: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BillEntry", // References BillEntry collection
        },
    ],
    totalAmount: {
        type: Number,
        required: true, // Total amount for the bill
    },
});

module.exports = mongoose.model("Bill", billSchema);
