/**
 * This module contains functions related to managing game state.
 *
 * @module GameManagement
 */


const gameService = require("./service");
const gamesManagerService = require("../gamesManager/service");
const { Game } = require("./model");
const { Player } = require("./Player");


/**
 * 
 * Handles requests related to reviewing games.
 */
exports.review = async (req, res) => {
    const { id } = req.query; //type [history , pgn]
    req.session.gameId = id;

    let game = gamesManagerService.getGameById(id);
    if (game == null) {
        const gameInfo = await gamesManagerService.findReviewGame(id, req.session.user_name);
        game = gameService.createReviewGame(req.session.user_id, req.session.user_name, gameInfo, "review");
        gamesManagerService.AddGame(game);
    }

    res.render('game', { username: req.session.user_name });
};

exports.getGameInfo = async (req, res) => {
    const { id } = req.query;
    const gameId = id || req.session.gameId;

    const game = gamesManagerService.getGameInfo(gameId);
    let clientDate = {};
    if (game.status == "reJoining") {
        await rejoinGame(game, req.session.user_name, req.session.user_id);
    }

    clientDate = createGameInfo(game, req.session.user_name, req.session.user_id);

    res.send(clientDate);
};

function createGameInfo(game, gameName, userId) {
    const clientDate = {
        id: game.gameId,
        username: gameName,
        userId: userId,
        creatorId: game.createdBy.userId,
        whitePlayerName: game.whitePlayer ? game.whitePlayer.userName : "",
        blackPlayerName: game.blackPlayer ? game.blackPlayer.userName : "",
        gameType: game.constructor.name,
        mode: game.mode,
        reviewType: game.reviewType,
        whiteTimer: calculateTimer(game, true),
        blackTimer: calculateTimer(game, false),
    };
    if (game.lastStatus == "in progress") {
        const gameState = game.chessGame.GameState;
        clientDate.gameState = gameState;
    }
    return clientDate;
}

function calculateTimer(game, isWhite) {
    if (game.startedOn) {

        if (isWhite) {
            if (game.chessGame.Turn == "white") {
                const currentTime = new Date().getTime() / 1000;
                const seconds = game.lastMoveOn / 1000;
                return game.chessGame.GameTimeLength - Math.round(currentTime - seconds);;
            }
            else {
                const lastMove = game.moves[game.moves.length - 1];
                return lastMove.moveTime;
            }
        }
        else {
            if (game.chessGame.Turn == "black") {
                const currentTime = new Date().getTime() / 1000;
                const seconds = game.lastMoveOn / 1000;
                return game.chessGame.GameTimeLength - Math.round(currentTime - seconds);
            }
            else {
                const lastMove = game.moves[game.moves.length - 1];
                return lastMove.moveTime;
            }
        }
    }
    else {
        return game.chessGame.GameTimeLength;
    }


}

async function rejoinGame(game, userName, userId) {
    // 1. notify opponent
    const message = { type: "info", info: 'opponent rejoined', gameId: game.gameId };
    const isWhite = (game.whitePlayer.userId == userId);
    game.sendMessageToOpponent(message, isWhite);


    // 2. updat game status
    const gameDoc = await gamesManagerService.findGameInDB(game);
    game.status = "in progress";
    gameDoc.state = game.status;
    await gameDoc.save();
}


exports.getGameMoves = async (req, res) => {
    const gameId = req.session.gameId;
    const gameInfo = await gamesManagerService.findReviewGame(gameId);
    const movesObj = { moves: gameInfo.moves, type: gameInfo.reviewType };
    res.send(movesObj);
};


exports.rematch = async (req, res) => {
    console.log(req.body);
    const { id } = req.body;
    req.session.gameId = id;
    res.send("OK");
    console.log("update new game id for rematch: " + id);
};

exports.startGame = async (req, res) => {
    const { gameType } = req.query;
    const username = req.session.user_name;
    const userId = req.session.user_id;
    const gameTypeInt = parseInt(gameType);
    let gameDoc;
    let game;

    // Game is in progress - for example, user refresh the game page
    game = gamesManagerService.findGameByStatus(gameTypeInt, userId, "in progress");
    if (game) {
        res.render('game', { username });
        return;
    }

    // Game is in on hold - for example, user disconnected and want to rejoin the game
    game = gamesManagerService.findGameByStatus(gameTypeInt, userId, "on hold");
    if (game) {
        // rejoin a game
        game.status = "reJoining";
        req.session.gameId = game.gameId;
        registerEvents(game);
        res.render('game', { username });
        return;
    }

    // pending Game created by me - a user waiting for opponent refreshed the page
    game = gamesManagerService.findPendingGameCreatedByMe(gameTypeInt, userId);
    if (game) {
        req.session.gameId = game.gameId;
        registerEvents(game);
        res.render('game', { username });
        return;
    }


    // Game is pending - a game was created. waiting for opponent to join the game
    game = gamesManagerService.findPendingGame(gameTypeInt, userId);
    if (game) {
        // join a game
        game.status = "establishing";
        const blackPlayer = new Player(userId, username, false);
        gameDoc = await gamesManagerService.findGameInDB(game);
        gameDoc.blackPlayer = username;
        await gameDoc.save();
        game.joinGame(blackPlayer);
        req.session.gameId = game.gameId;
        registerEvents(game);
        res.render('game', { username });
        return;
    }

    // create a new game
    game = gameService.newGame(gameTypeInt, username, userId);
    gamesManagerService.AddGame(game);
    gameDoc = await gamesManagerService.storeGameInDB(game);
    game.gameId = gameDoc.id;
    req.session.gameId = game.gameId;
    registerEvents(game);
    res.render('game', { username });
};

function registerEvents(game) {

    game.OnMove = onMoveConfirmed;
    game.OnGameStateChanged = onGameStateChanged;
    game.OnGameOver = onGameOver;
    game.OnRematch = onRematch;
}

const onMoveConfirmed = async (e) => {
    const { game, move } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.moves.push(JSON.stringify(move));
            await gameDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};

const onGameStateChanged = async (e) => {

    const { game, newState } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.state = newState;
            await gameDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};

const onGameOver = async (e) => {

    const { game, reason } = e;
    try {
        const gameDoc = await Game.findOne({ _id: game.gameId });
        if (gameDoc) {
            gameDoc.state = "game over";
            gameDoc.reason = reason;
            await gameDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};


// Main purpose: Manages the rematch process by creating a new game instance.
// Functionality:
//  - Retrieves old game details and player information from the event object (e).
//  - Creates a new game instance using the `gameService.newGame` method.
//  - Stores the new game in the database using the `gamesManagerService.storeGameInDB` method.
//  - Updates the game state by setting the new game's status to "establishing" and notifying the players.

const onRematch = async (e) => {

    //old game details:
    const { oldGame, whitePlayer, blackPlayer, initiator, cb } = e;
    oldGame.OnMove = null;
    oldGame.OnGameStateChanged = null;
    oldGame.OnGameOver = null;
    oldGame.OnRematch = null;

    const newGame = gameService.newGame(oldGame.constructor.name, initiator.userName, initiator.userId);
    gamesManagerService.AddGame(newGame);

    //for now , keep same players colors
    newGame.whitePlayer = whitePlayer;
    newGame.blackPlayer = blackPlayer;

    const gameDoc = await gamesManagerService.storeGameInDB(newGame);
    newGame.gameId = gameDoc.id;
    newGame.OnMove = onMoveConfirmed;
    newGame.OnGameStateChanged = onGameStateChanged;
    newGame.OnGameOver = onGameOver;
    newGame.OnRematch = onRematch;
    newGame.status = "establishing";
    gameDoc.state = newGame.status;
    await gameDoc.save();
    cb(newGame);
};