const gamesManagerService = require("./service");

exports.showLobby = async (req, res) => {
    const username = req.session.user_name;
    const game = {};
    req.session.gameId = null; //???
    res.render("lobby", { game, username });
};

exports.showList = async (req, res) => {
    const username = req.session.user_name;
    const numberOfGamesToRetrieve = 20;
    const playerGames = await gamesManagerService.getRecentGames(username, numberOfGamesToRetrieve);
    let pgnGames = await gamesManagerService.getPGNGames();
    pgnGames = pgnGames.slice(0, 20);
    const pgn = pgnGames.map(({ moves, ...rest }) => rest);    
    res.render("list", { playerGames, pgn });
};

exports.delete = async (req, res) => {
    const { id } = req.params;
    await gamesManagerService.deleteGame(id);
    res.redirect("/list");
};


exports.generateState = async (req, res) => {
    const files = await gamesManagerService.getPGNFiles();
    const pgnGames = await gamesManagerService.readPGNGames(files);
    await gamesManagerService.addGamesToDB(pgnGames);
    res.redirect("/list");
};