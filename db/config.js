require('dotenv').config();



const mongoose =require("mongoose");
mongoose.connect("mongodb://localhost:27017/ProjectK").then("Database connected successfully");
// mongoose.connect(process.env.DB_URI);