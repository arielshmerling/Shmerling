

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username cannot be blank"]
    },
    password: {
        type: String,
        required: [true, "Password cannot be blank"]
    }
});

userSchema.statics.authenticate = async function (username, password) {
    const foundUser = await this.findOne({ "username": { "$regex": username, $options: "i" } });
    const isValid = foundUser && await bcrypt.compare(password, foundUser.password);
    return isValid ? foundUser : false;
};

module.exports = mongoose.model("User", userSchema);
