const multer = require("multer");

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "uploads/user_profile_pictures");
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname.replace(/ /g, '_'));
    }
});

const upload = multer({storage: storage});

module.exports = upload;