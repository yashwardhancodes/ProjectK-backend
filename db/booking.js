const mongoose=require("mongoose");

const bookingSchema=new mongoose.Schema({
    name:String,
    email:String,
    contact:String,
    bike:String,
    service:String
});

module.exports=mongoose.model("bookings",bookingSchema);