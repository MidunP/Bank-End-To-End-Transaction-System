require("dotenv").config({ path: __dirname + "/.env" })
const app = require("./app")
const connectToDB = require("./config/db")

connectToDB()
app.listen(3000,()=>{
    console.log("Server is running on port 3000")


})