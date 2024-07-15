const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");


const validateGraphToken = asyncHandler(async (req, res, next) => {

    try{

        if(!req?.user){
            throw new Error("User not authenticated");
        }
        console.log('graph ,iddleware hit :', req.user);
        next();

    }catch(err){
        res.status(401);
        throw new Error("Invalid Graph Token");
    }

});

module.exports = validateGraphToken;