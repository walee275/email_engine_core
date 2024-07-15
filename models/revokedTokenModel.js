const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            require: [true, "Please provide the token"]
        },
    },
    {
        timestamps: true,

    }
);

module.exports = mongoose.model("RevokeToken", revokedTokenSchema);