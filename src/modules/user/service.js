const User = require("./model");
const bcrypt = require("bcrypt");


exports.findUser = async (username, password) => {
    const foundUser = await User.authenticate(username, password);
    if (foundUser) {
        return foundUser;
    }
    return null;
};

exports.registerNewUser = async (username, password) => {
    const hash = await bcrypt.hash(password, 12);
    const user = new User({
        username,
        password: hash
    });
    await user.save();
    return user;
};