require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/user.models");

async function createSystemUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Check if system user already exists
        const existing = await User.findOne({ email: "system@test.com" });
        if (existing) {
            console.log("System user already exists:", existing._id.toString());
            process.exit(0);
        }

        // Create the system user  
        // We bypass the select:false by using .save() directly so systemUser:true is stored
        const systemUser = new User({
            email: "system@test.com",
            name: "SYSTEM_",
            password: "system_password_123",
            systemUser: true
        });

        await systemUser.save();
        console.log("✅ System user created successfully!");
        console.log("   _id:", systemUser._id.toString());
        console.log("   email:", systemUser.email);
        console.log("   name:", systemUser.name);

    } catch (error) {
        console.error("❌ Error creating system user:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
        process.exit(0);
    }
}

createSystemUser();
