require('dotenv').config();



const mongoose =require("mongoose");
// mongoose.connect("mongodb://127.0.0.1:27017/ProjectK") 
mongoose.connect(process.env.DB_URI);