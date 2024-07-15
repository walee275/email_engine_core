const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const RevokeToken = require("../models/revokedTokenModel");


const validateToken = asyncHandler(async (req, res, next) => {
    let token;
    let authHeader = req.header.Authorization || req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        const tokenRevoked = await RevokeToken.findOne({ token });
        if (tokenRevoked) {
            res.status(401);
            throw new Error("User is not authorized");
            return;
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                res.status(401);
                throw new Error("User is not authorized");
            }
            req.user = decoded.user;
            // console.log(decoded);

            next();
        })
        if (!token) {
            res.status(401);
            throw new Error("Authorization Headers missing");

        }
    } else if(req.query?.accessToken != '' && req.query?.accessToken !== null && req.query?.accessToken !== undefined) {
        token = req.query?.accessToken;
        const tokenRevoked = await RevokeToken.findOne({ token });
        if (tokenRevoked) {
            res.status(401);
            throw new Error("User is not authorized");
            return;
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                res.status(401);
                throw new Error("User is not authorized");
            }
            req.user = decoded.user;
            // console.log(decoded);

            next();
        })
        if (!token) {
            res.status(401);
            throw new Error("Authorization Headers missing");
        }
    }else if(req.session?.access_token){
        token = req.session?.access_token;
        const tokenRevoked = await RevokeToken.findOne({ token });
        if (tokenRevoked) {
            res.status(401);
            throw new Error("User is not authorized");
            return;
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                res.status(401);
                throw new Error("User is not authorized");
            }
            req.user = decoded.user;
            // console.log(decoded);

            next();
        })
        if (!token) {
            res.status(401);
            throw new Error("Authorization Headers missing");
        }
    }else {
        res.redirect('/auth/login');
        res.status(401);
        throw new Error("User is not authorized");
    }

});

module.exports = validateToken;
