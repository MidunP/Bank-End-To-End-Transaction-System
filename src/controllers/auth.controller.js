const userModel = require("../models/user.models")
const jwt = require("jsonwebtoken")

async function userRegisterController(req, res) {
    try {
        const { email, password, name } = req.body

        // Check if user already exists
        const isExists = await userModel.findOne({
            email: email
        })

        if (isExists) {
            return res.status(400).json({
                message: "User already exists",
                status: "failed"
            })
        }

        // Create the user
        const user = await userModel.create({
            email, password, name
        })

        // Sign the token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' })
        
        res.cookie("token",token)
        // Send success response
        res.status(201).json({
            message: "Account created successfully",
            status: "success",
            token,
            user: { _id: user._id, name: user.name, email: user.email }
        })

    } catch (error) {
        console.error("Register error:", error.message)
        res.status(500).json({
            message: "Something went wrong creating the user",
            error: error.message   // helpful during development
        })
    }
}

module.exports = {
    userRegisterController
}