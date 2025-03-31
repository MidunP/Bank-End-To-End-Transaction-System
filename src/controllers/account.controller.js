const accountModel = require("../models/account.models");

/**
 * - POST /api/accounts/
 * - Create a new account for the logged-in user
 */
async function createAccountController(req, res) {
    const { currency } = req.body
    const user = req.user;

    const account = await accountModel.create({
        user: user._id,
        currency
    })

    res.status(201).json({
        account
    })
}

/**
 * - GET /api/accounts/
 * - Get all accounts of the logged-in user
 */
async function getUserAccountsController(req, res) {
    const accounts = await accountModel.find({ user: req.user._id });

    res.status(200).json({
        accounts
    })
}

/**
 * - GET /api/accounts/balance/:accountId
 * - Get balance of a specific account
 */
async function getAccountBalanceController(req, res) {
    const { accountId } = req.params;

    const account = await accountModel.findOne({
        _id: accountId,
        user: req.user._id
    })

    if (!account) {
        return res.status(404).json({
            message: "Account not found"
        })
    }

    const balance = await account.getBalance();

    res.status(200).json({
        accountId: account._id,
        balance
    })
}

module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController
}