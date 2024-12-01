const mongoose = require("mongoose");

const billEntrySchema = new mongoose.Schema({
    description: {
        type: String,
        required: true, // Description of the service or product
    },
    amount: {
        type: Number,
        required: true, // Amount for this entry
    },
    quantity: {
        type: Number,
        required: true, // Quantity of the service or product
    },
});

module.exports = mongoose.model("BillEntry", billEntrySchema);
