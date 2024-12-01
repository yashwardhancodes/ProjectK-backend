const mongoose = require("mongoose");
const Service =require("./service");

const bikeSchema = new mongoose.Schema({
    bikeNo: {
        type: String,
        required: true, // Registration number of the bike
        unique: true,
    },
    owner: String,
    contactNo: String,
    dateOfReg: String,
    services: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service", // References Service collection
        },
    ],
});

module.exports = mongoose.model("Bikes", bikeSchema);




